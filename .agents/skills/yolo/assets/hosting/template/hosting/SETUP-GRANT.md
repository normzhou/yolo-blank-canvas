# One setup grant, scoped ongoing operation

The client's maintainer grants setup authority to its trusted local AI operator.
YOLO Dev keeps its own separate domain/operator authority. No management
credential passes through the hostname issue, browser, app runtime or publisher.
Use the owner's existing private secret storage; no specific password manager
or new credential relay is required.

## Prepare before asking

Follow the current [provider catalog](cloudflare/PROVIDERS.json), inspect existing
account membership/resource ownership and select the token type/API route before
giving executable instructions. Prepare one private checklist containing:

- Exact app, provider account/zone or OCI compartment, selected profile, existing
  resources/state owners and intended setup/deploy/rollback/recovery operations.
- Each required API capability mapped to its current official permission-group
  ID/resource type and actual resource scope. Read the token's real policies,
  restrictions/expiry and owner membership; cosmetic permission names alone
  cannot identify the right account/zone group.
- Complete bootstrap grant, narrowest supported operating credentials and their
  actual reach, chosen private delivery/custody and optional revocation plan.
- Remaining owner-only signup, consent/MFA or grant, why it is unavailable to the
  AI, what it blocks and how completion is verified. Reuse completed setup.

Check current [Workers roles](https://developers.cloudflare.com/workers/authorization/workers/) separately for new-resource creation, existing-Worker operation and Custom Domains; do not assume one role or resource scope covers all three.

Use this capability inventory to avoid permission drip-feed; derive current
permission IDs/names from official catalogs and actual account/tool behavior:

| Owner/profile | Capabilities to account for in the same initial checklist |
| --- | --- |
| Client, both profiles | Account/usage and Worker identity discovery; scoped Worker lifecycle/readback; asset/version upload, runtime secrets/configuration, deployment/version observation and rollback. No YOLO Dev zone management. |
| Client, selected shared login | Own D1 lifecycle/query/schema/recovery and app-session configuration; app-owned Oracle assertion key when needed. No central Google credential or client user list is shared. |
| Client, backend only | Actual home-region/eligible image/AD and aggregate usage discovery; host/volume/network management in the dedicated compartment; selected budget/read-only discovery exceptions; verified SSH/Docker and persistent-data/recovery custody. |
| YOLO Dev operator | Its own zone/account discovery and readback, exact DNS/Worker Custom Domain, gateway versions/secrets/deployments, Access organization/application/policy and backend-only Tunnel/service credentials, including required current account/usage reads and recovery. |

Include only the selected operations. The underlying provider may support a
broader resource scope than one Worker; disclose and obtain that actual grant
rather than claiming an application-name restriction. Separate account/zone,
build/deploy and server-runtime credentials. A successful GET proves that read,
not permission for all setup writes. Inspect policies and the legitimate reviewed
setup operation/readback; never mutate unrelated resources as a permission probe.

## Choose one supported bootstrap route

For Cloudflare use the current official [delegated token instructions](https://developers.cloudflare.com/fundamentals/api/how-to/create-via-api/)
and [account-token compatibility](https://developers.cloudflare.com/fundamentals/api/get-started/account-owned-tokens/).
Prefer compatible account-scoped token management when its actual reach satisfies
the selected work. If user-owned token management is needed, disclose its ability
to create tokens across that user's resources; do not describe it as restricted
to this app/account. Follow the provider's current creation template and
restriction/expiry instructions rather than asking the owner to invent a custom
permission row. Do not bundle unrelated permissions into a user token manager.

If management delegation is unavailable or declined, give the complete derived
operating-permission bundle in the same initial owner step. This is a supported
fallback, not a reason to try one permission and return for another routinely.
Use the current [permission catalog](https://developers.cloudflare.com/fundamentals/api/reference/permissions/)
and token-type-specific verification/management API. A user-token verification
failure does not establish that an account-owned token is invalid. Record only
nonsecret credential references/status in the request.

For OCI, follow the backend owner guide and current [IAM policy documentation](https://docs.oracle.com/en-us/iaas/Content/Identity/policieshow/Policy_Basics.htm)
for the actual identity-domain/account model. Prepare the dedicated compartment,
non-admin provisioning identity and complete compartment-scoped policy plus
explicitly needed tenancy discovery/budget exceptions together. A local API key
cannot grant itself IAM administration. The owner supplies the reserved grant;
its AI performs authorized setup with actual eligible home-region/account facts.
Keep the $0 guardrails; no paid upgrade or broad tenancy administration is implied.

With the grant, the trusted local AI configures/reuses operating credentials,
verifies binding/scope and carries out the selected reviewed IaC/deployment flow.
Preserve other policies/restrictions/expiry and completed keys/state. Keep
bootstrap credentials out of candidate builds and app hooks. Lost write responses
require read-only reconciliation before retry, including credential creation.

## Optional cleanup after verified delivery

Prepare this choice in the initial grant; do not invent another required owner
round at the end. Retaining bootstrap access is an explicit owner choice.
If the owner selected revocation/expiry, first verify that independent scoped
operating credentials cover normal deploy/version-readback/rollback/recovery and
check the current provider semantics for effects on derived credentials. Then
revoke only the identified bootstrap credential through its type-specific
provider route, retaining a private intent/receipt. Removing a local/vault copy
is not provider revocation. Never revoke runtime keys or the only recovery path.

Verify the provider's revoked/expired state and continued normal scoped operation
and app health; report any unverified part honestly. If provider semantics would
remove required operating access, prepare a compatible separately authorized
replacement before cleanup. Later capability changes can require a new grant.
This is provider credential hygiene, not a new application deployment or a
permanent permission held by YOLO Dev over the client's account.
