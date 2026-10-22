"""Client-owned transport verifier. Existing machine-ingress guard stays required."""
import base64
import hashlib
import hmac
import json
import re
import time


class InvalidIdentity(ValueError):
    pass


def verify_identity(value, *, app, origin, secret, method, path, now=None):
    """Return optional identity; callers apply their own permissions afterwards."""
    try:
        if not isinstance(secret, str) or not re.fullmatch(r"[a-f0-9]{64}", secret):
            raise InvalidIdentity()
        if not isinstance(value, str) or len(value) > 4096:
            raise InvalidIdentity()
        body, signature = value.split(".")
        if not re.fullmatch(r"[A-Za-z0-9_-]+", body) or not re.fullmatch(r"[A-Za-z0-9_-]+", signature):
            raise InvalidIdentity()
        decode = lambda raw: base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4))
        expected = hmac.new(secret.encode(), body.encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(decode(signature), expected):
            raise InvalidIdentity()
        data = json.loads(decode(body))
        clock = int(time.time()) if now is None else now
        if (type(data["v"]) is not int or data["v"] != 1 or data["app"] != app or data["origin"] != origin
                or data["method"] != method or data["path"] != path
                or type(data["iat"]) is not int or type(data["exp"]) is not int
                or data["iat"] > clock or data["exp"] <= clock
                or not 0 < data["exp"] - data["iat"] <= 30):
            raise InvalidIdentity()
        identity = data["identity"]
        if identity is not None and (
                not isinstance(identity, dict)
                or set(identity) != {"issuer", "subject", "email", "emailVerified"}
                or identity["issuer"] != "https://login.yolo-dev.ai"
                or identity["emailVerified"] is not True
                or not isinstance(identity["subject"], str) or not identity["subject"]
                or not isinstance(identity["email"], str) or not identity["email"]):
            raise InvalidIdentity()
        return identity
    except (ValueError, KeyError, TypeError, UnicodeError):
        raise InvalidIdentity("Identity unavailable") from None


class IdentityMiddleware:
    """Minimal ASGI seam; mount inside existing ingress protection, before routes."""
    def __init__(self, application, *, app, origin, secret):
        self.application, self.settings = application, dict(app=app, origin=origin, secret=secret)

    async def __call__(self, scope, receive, send):
        if scope["type"] not in ("http", "websocket"):
            return await self.application(scope, receive, send)
        try:
            headers = {k.decode("ascii").lower(): v.decode("ascii") for k, v in scope["headers"]}
            if sum(k.lower() == b"x-yolo-app-identity" for k, _ in scope["headers"]) != 1:
                raise InvalidIdentity()
            path = scope.get("raw_path", scope["path"].encode()).decode("ascii")
            if scope.get("query_string"):
                path += "?" + scope["query_string"].decode("ascii")
            identity = verify_identity(headers.get("x-yolo-app-identity"), method=scope.get("method", "GET"), path=path, **self.settings)
        except (InvalidIdentity, UnicodeError):
            if scope["type"] == "websocket":
                return await send({"type": "websocket.close", "code": 4403})
            await send({"type": "http.response.start", "status": 403, "headers": [(b"cache-control", b"no-store")]})
            return await send({"type": "http.response.body", "body": b"Identity unavailable"})
        return await self.application({**scope, "yolo.identity": identity}, receive, send)
