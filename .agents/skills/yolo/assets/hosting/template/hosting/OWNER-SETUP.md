# Owner setup: __APP_SLUG__

Use this with the installed skill's `references/app-hosting.md` and `hosting/cloudflare/INTEGRATION.md`. The client owns its Cloudflare application account/Worker; Yolo Dev owns the separate domain gateway. Local frontend/backend development can proceed through the loopback preview before account setup. It prepares the client's OCI host; Yolo Dev operates the shared domain separately. No Cloudflare zone/API management token is required or permitted in this client setup. Application deployment/routing remains separately verified before activation.

## 1. Follow current official instructions

Before giving the owner actionable account steps, the agent follows `infra/providers.json` (signup, eligibility, pricing, API credentials), records current findings and reconciles them with this template. Direct starting points: [signup documentation](https://docs.oracle.com/en-us/iaas/Content/GSG/Tasks/signingup.htm), [signup](https://signup.cloud.oracle.com/), [Always Free](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm), [pricing](https://www.oracle.com/cloud/price-list/), [required API keys](https://docs.oracle.com/en-us/iaas/Content/API/Concepts/apisigningkey.htm). These links, not copied click paths, govern current provider onboarding. If inaccessible or incompatible, stop the affected setup and report the gap.

The owner registers/verifies an unupgraded Free Tier/trial account and records the actual permanent home region, eligible Ubuntu 24.04 aarch64 image/AD and all account-wide A1 consumption/allocations and boot/block volumes. Never choose a paid alternative or assume each compartment has another allowance. Do not change an existing home region or open duplicate accounts to chase capacity. No VM is created by registration or template instantiation.

## 2. Private access and recovery

Use the live official API-key/policy documentation to create a dedicated `yolo-__APP_SLUG__-host` compartment and non-admin provisioning identity. Grant instance/volume/network management in that compartment only; read-only tenancy/region/image discovery and budget-management are the only tenancy-wide exceptions. Do not grant IAM/user/policy administration or `manage all-resources in tenancy`. Keep its API key/config in the owner's `YOLO_APP_HOST` OCI profile outside source. The owner creates a dedicated passphrase-protected SSH key; only that owner has root-equivalent Docker access.

Choose one owner workstation as the infrastructure writer. Create a private 0700 directory on its encrypted disk, outside every checkout, with `terraform.tfvars` copied from the example and filled privately. Use the dedicated compartment, actual home region/pinned image/AD, private alert email, SSH public key and single administrative IPv4 `/32`. Retain separate encrypted state backups and a separately recoverable ≥32-character state passphrase in the password manager. No state/plan/key/identifier values belong in source/issues/chat. A hostname request is prepared from `hosting/HOSTNAME-REQUEST.md`; the operator privately supplies only the admitted connector credential later.

## 3. Current-policy review, then a saved plan

The agent writes `provider-review.json` **inside the private directory** after following the official references and observing account facts. It records the profile, current UTC verification date, exact SHA-256 of private `terraform.tfvars`, current account mode/home region/allowance and each official source's original/resolved URL, observation time, verification status and actual finding. See `infra/provider-review.example.json`; it is deliberately unverified and cannot authorize provisioning. Review records expire within 24 hours and bind to exact input bytes. The helper checks structure/freshness/bindings; it does not browse or certify webpage interpretation. Current guidance/account verification is still required before planning or using an older installed template.

Use OpenTofu 1.13.1 with the committed provider lock. Inject the password-manager passphrase as runtime `TF_VAR_state_passphrase` using hidden input, not a command literal. Set `YOLO_HOST_PRIVATE_DIR` to the private directory and optionally `YOLO_TOFU` to the verified binary. Then:

```sh
python3 infra/hostctl.py init
python3 infra/hostctl.py plan
python3 infra/hostctl.py review
```

Owner/account action is separate from source readiness: review the exact nine-object plan privately and verify one eligible A1 host, balanced boot, actual home region, restricted SSH, budget alert and no deletion/replacement/prohibited resource. The machine reviewer cannot prove billing or actual provider eligibility. Apply only the reviewed saved plan after the current owner setup has been verified:

```sh
python3 infra/hostctl.py apply
python3 infra/hostctl.py check-state
```

The local writer lock, backend binding and exact plan/source/state/input/review hashes prevent accidental stale reuse within this procedural path. Never bypass guards with `-target`, `-auto-approve`, another state writer or a paid fallback. On partial failure, retain/reconcile state and resources before retrying only a suitable AD in the same home region. Lifecycle protection blocks accidental host replacement.

## 4. Readiness and private connector installation

Verify the emitted SSH fingerprint through OCI console boot history before accepting first SSH; use the dedicated key and `/32`. Over verified SSH, run `sudo timeout 900 cloud-init status --wait`, check `/var/lib/yolo-bootstrap-ready`, `docker info` and the expected private network/firewall. Bootstrap contains no token. Confirm host/data readiness before accepting domain traffic.

The Yolo Dev operator creates Access denial policies and an app-specific tunnel in the **same Cloudflare account as our DNS**, then arranges private connector-token installation. The owner writes it directly to root-only `/etc/cloudflared/token` through verified SSH/private storage and starts `cloudflared`; never paste it into an issue/chat or give the client zone credentials. Tunnel health alone does not establish protected app readiness. Routing, Google allow/deny, alternate/direct-origin denial and trusted Worker/Kamal publication must pass their separate operator/client acceptance before the hostname becomes active.

## 5. Nonsecret completion handoff

Return installed skill/full source revision, app/repository/setup issue, home-region name, account-mode/free-eligibility/aggregate-usage confirmation, private key/state/recovery preparedness, and host/connector readiness references. Do not return actual credentials, OCIDs, IPs or private Google identities. The publisher coordinates domain changes here; client source/release work stays in the client's own authorized issue loop.

To stop routing, stop the connector and ask the operator to revoke sessions/tunnel credentials. Stop app processes separately to halt background work. Preserve verified app/state backups before any replacement/retirement; lifecycle protection is removed only by an identified reviewed teardown within owner authority. Do not use destroy as a stop button.
