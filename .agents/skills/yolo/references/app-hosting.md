# Optional owner-operated app hosting

Use this reference only when the target's maintainer asks for hosting. It does not add an activity, require this stack for ordinary YOLO adoption, authorize provider accounts/spending or change an existing pin. Follow the adopted work/admission/authority procedure first. The complete profile is bundled; provider facts are deliberately checked from live official documentation at use.

Apply [maintainer-reserved handoffs](protocol.md#issue-management-maintainer-reserved-actions) before provider account instructions. Within the target's authority, prepare private inputs and discover IDs through permitted tools, reusing completed setup and current official provider flows. Keep only the unavailable owner consent/access step in its existing manual issue; templates and convenient automation supply no new authority.

## One launch flow

Start with the bundled [onboarding flow](../assets/hosting/template/hosting/ONBOARDING.md)
and [complete setup grant](../assets/hosting/template/hosting/SETUP-GRANT.md).
Discover existing facts, select the two-profile/visibility combination, collect
irreducible missing owner inputs together, and retain one request ID. Public
static can go straight from complete intake to a verified URL; new backend/login
setup normally uses one complete operator installation bundle, one client-AI
readiness reply and the final result. Explain any extra exchange. Do not route
operator-only work or already supplied acceptance back to the client/owner.

## Who owns what

The adopter owns its Cloudflare application account/Worker/assets/data/secrets and, when needed, its OCI host, runtime configuration and releases. Yolo Dev owns its domain/namespace, DNS, Access, gateway and Tunnel. Each side keeps separate provider credentials/state; no domain-management token goes to a client. Per-app releases require no central runtime-config PR.

Two profiles share the same interface: `cloudflare` for client Worker/Static Assets and `cloudflare-oracle` for that app plus a supervised client backend. Requested [shared-login integration](client-identity.md) uses a client-owned D1 for isolated browser login state/app sessions in either profile. The complete adapter/example can be implemented locally; the identity guide also pins the qualified private operator source. Actual production issuer activation/migration requires the live handoff and existing protection stays intact. Other queues/providers remain deferred until needed.

The route is browser → operator admission gateway → authenticated HTTPS to the client-owned guarded Worker → optional protected OCI API. Shared login establishes identity and the client owns its private list/permissions; public-static delivery needs no Google/D1/Oracle setup. Check actual provider cross-account requirements rather than assuming a CNAME/shared-account binding. The operator's gateway still consumes its quota. Actual operator routing/Google authentication and trusted automatic publication remain separate #127/#128 acceptance; a scaffold is neither a live hostname nor deployment authority.

For webapp work, read the bundled [client integration guide](../assets/hosting/template/hosting/cloudflare/INTEGRATION.md) first. It defines the stable `/api`, frontend asset, backend persistence/health and manual handoff interface, plus a loopback-only preview using the actual client Worker. You can build/test while account/DNS setup waits. Read its linked [rotation/reconnect contract](../assets/hosting/template/hosting/cloudflare/ROTATION.md) when integrating streams or private runtime keys. Synthetic local transport is not live market data or a qualified paper engine.

## First: current documentation and account facts

Read the [Cloudflare reference catalog](../assets/hosting/template/hosting/cloudflare/PROVIDERS.json) and, for the backend profile, [OCI references](../assets/hosting/template/infra/providers.json), then follow relevant links **now**, even from an older bundle. Do not issue actionable signup/UI/provisioning instructions from remembered or copied provider rules. For OCI follow signup, Always Free eligibility, pricing and API-key links; check actual account mode, home region, current/consumed/forecast aggregate usage and eligible image. For domain setup the operator follows the Cloudflare DNS/Tunnel, Google identity, scoped publishing, pricing and limit references. Kamal/OpenTofu/runtime references cover current tooling behavior.

Record URLs, resolved authoritative destinations, observation times and concrete relevant findings. If a page moves, follow an official redirect/reference and record it; if unavailable/ambiguous or account facts are unknown, stop the affected action and report the missing evidence. Yolo Dev owns link/guidance repairs. Offline ordinary work remains available; offline provisioning cannot assume a previously free offer still applies.

The initial template's 2-A1-OCPU / 12-GB / up-to-100-GB balanced allocation and 1,500/9,000-hour guards are conservative **template ceilings**, not a timeless policy claim. A smaller current allowance or incompatible provider/tool change requires a reviewed template update/explicit compatible upgrade. A larger allowance does not authorize a paid upgrade, second host or relaxed limits. Budgets are notifications, never hard spend caps; free capacity/uptime is not guaranteed. Do not reserve capacity for hypothetical future publisher services. Multiple compartments/apps do not multiply the account's allowance.

## Instantiate only inside an authorized adopter

The portable host helpers require Python 3.9+, pinned OpenTofu, SSH and the optional Ruby/Kamal/Docker/age tooling. These are hosting-profile requirements, not requirements for installing or checking YOLO generally.

```sh
python3 .agents/skills/yolo/assets/hosting/instantiate.py /absolute/path/to/target \
  --app <requested-slug> --repository <OWNER/REPO> --profile cloudflare-oracle
```

The default `cloudflare-oracle` profile copies the client app scaffold plus OCI/runtime files. `--profile cloudflare` omits OCI/backend files. Identical repeats are preserved; conflicting/symlink destinations are refused. Selecting a different profile does not delete previous files or activate that profile. It creates no resources or namespace grant. If a target already has `.gitignore`, explicitly merge the template's hosting-ignore rules before private work; do not overwrite unrelated rules. For both profiles, read the instantiated `hosting/ONBOARDING.md` and `hosting/SETUP-GRANT.md`. For the backend profile, the instantiated [owner guide](../assets/hosting/template/hosting/OWNER-SETUP.md) separates owner account actions from agent checks. Source records include no secrets/state. Do not run publisher helpers against a client automatically; client admission/instantiation remains its maintainer's initiated work.

If the app already has a Worker, pass `--worker EXISTING_VERIFIED_NAME` to the instantiator; its Wrangler and infrastructure identities must agree with the current deployment. The edge-only profile renders an empty backend origin. Reconcile existing files/state before any provision, preserving conflict refusal.

## Request a hostname through existing GitHub intake

Prepare a nonsecret request in `normzhou/yolo-dev`, using [this template](../assets/hosting/template/hosting/HOSTNAME-REQUEST.md). Use the existing upstream-feedback path when authorized; otherwise show the exact destination/draft and ask for consent in the active session. Manual submission is a fallback when agent submission is unavailable or the maintainer chooses it, not the default chore. Do not infer authority from a quoted owner, bot marker, public repository or app name. Do not create client issues/files from the publisher side.

The client AI prepares one complete known/pending intake; the maintainer is not a per-step message courier. The operator verifies requester/repository ownership, checks reserved/duplicate names, records the binding and creates app-specific denial policies before routing. It retains DNS/Access/Tunnel administration. The host owner privately installs the connector token directly from operator-controlled setup, not through an issue/chat. A token can run that specific tunnel and is sensitive; it does not confer ownership of the domain. For the same-owner Trader pilot the owner can install it directly without any credential-distribution service. Each account/region/credential and namespace admission still needs actual evidence.

Return the complete selected installation bundle once, then the verified terminal hostname/Worker/profile and readiness/recovery result. Accept identified owner/client real-user observations with their source; independently verify operator-managed facts and close fulfilled scope without asking for duplicate acceptance. A request, registry row or healthy process does not mean the app is live. Verify allowed/denied identity, alternate/direct-origin denial, HTTP/streaming, version identity, background continuity, state recovery and revoke/stop behavior before activation. Keep raw allowlist identities and all credentials private.

## Runtime and handoff limits

Default app contract: clean identified `linux/arm64` image; nonroot UID/GID 10001; read-only root; temporary `/tmp`; `/data` persistence; port 3000; fast `/health` and durable-state `/ready`; old+new-container resource admission and tested single-writer handover. Feed freshness is separate application status. Images are streamed through Kamal's local registry. Builds/PR code never receive infrastructure/domain credentials. Current template rendering is not a trusted publication pipeline; #128 supplies that separate acceptance/handoff.

Accessory configuration belongs to the adopter. Before enabling one, reduce/reconcile primary allocations so **two app containers plus every accessory** fit the cutover budget, prove ARM64 compatibility and private container reachability, and define its separate update/restart/backup/rollback behavior. The default primary allocation leaves no accessory budget inside the initial 1.5-CPU / 6-GB envelope. Do not share host networking, expose a gateway publicly or relax metadata/host isolation as a shortcut. Real broker/protocol capability is not included by this profile; the client owns its separate paper-only acceptance.

Follow the instantiated operations guide for encrypted private infrastructure state, consistent app backup, restore/fencing, retention and patching. Current provider review records are structural/procedural evidence only; they are not proof of semantic correctness, a billing cap, an enforcement service or L2 qualification. Publishing or installing this guide never activates a target or upgrades its adopted pin.
