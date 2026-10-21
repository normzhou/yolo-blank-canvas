# Operator-owned App setup and preflight

This optional path supplies **access preflight only**. Worker isolation, App-backed execution/publication and job renewal remain #106 work; live evidence belongs to #107. Personal use keeps existing `gh`/Git access. There is no publisher credential service, token-export command, hosted enrollment or L2 runner.

## Register once, reuse

1. Open [GitHub App settings](https://github.com/settings/apps), choose **New GitHub App** (or your organization's developer settings), and enter a unique name and project homepage. Disable **Active** under Webhook for this manual path. Installation authentication needs no user OAuth authorization or callback.
2. For the intended work route select repository **Contents: read and write**, **Issues: read and write**, **Pull requests: read and write**; **Metadata: read** is automatic. Add **Actions: read** and **Checks: read** only when observing them. No administration or branch-rule bypass. Preflight itself requests only metadata read and proves no write capability.
3. Create the App; copy **App ID** and **Client ID**. Generate a private key and move the downloaded PEM into operator-controlled storage outside every checkout. Restrict its directory to owner only (`0700`) and the file to `0600` or `0400`. Keep it out of issues, source and logs. Reuse an already verified App/key; registration is not per runner/repo.
4. Choose **Install App**, select the account and intended repositories. Copy the installation ID from its settings URL. Adding a project requires installation access, not another App.
5. Reconcile the App owner's numeric account ID, installation account ID and repository ID. An authorized personal setup session can obtain nonsecret facts with `gh api users/OWNER --jq .id` (or `orgs/OWNER`) and `gh api repos/OWNER/REPO --jq '{id,full_name,owner_id:.owner.id}'`. This is a setup lookup, not personal-token extraction or App execution authority.

Reference the accepted setup in a compatible target's [execution setting](records.md#execution-setting). Existing targets require an explicit compatible upgrade. App installation, credential switching, the grant and unattended execution are separate decisions; preflight changes none of them.

## Private inputs

Create a **new** owner-only JSON file alongside the private key. It is neither the committed adoption record nor a prior registration receipt. Replace these examples with actual reconciled bindings; paths must be absolute and outside the target:

```json
{
  "schema_version": 1,
  "profile": "self-hosted-app",
  "app_id": 123,
  "client_id": "IvExample",
  "app_owner_id": 100,
  "installation_id": 456,
  "installation_owner_id": 100,
  "repository": "OWNER/REPO",
  "repository_id": 789,
  "private_key_path": "/absolute/private/operator-app.pem"
}
```

The App owner and installation account may differ; verify both. Unknown/duplicate fields, token/endpoint settings, other profiles, symlink files, public file/directory modes and target-contained keys/configuration are rejected. Keys must be unencrypted PKCS#1/PKCS#8 RSA, at least 2048 bits. Windows ACL validation is unavailable, so private preflight there reports a gap.

Run the matching verified executable **on the controller side**:

```sh
/absolute/path/yolo-check app verify --config /absolute/private/operator-app.json /absolute/path/to/target
```

It validates the adopted bundle/bindings and declared App/installation before private access, then authenticates the App/owner and installation/account using an in-memory JWT. It mints one repository's metadata-read-only token, verifies repository ID/name/account and revokes it before reporting `verified_metadata_access`, `temporary_token_revoked: true`, `execution_ready: false`. This is explicit credential issuance/revocation, with no repository content writes. It contacts only `api.github.com`, rejects redirects and never falls back to `gh`. No credentials are printed, cached, exported to a harness or sent to telemetry.

Mismatch, missing/revoked/suspended access, unexpected token scope/expiry or failed revocation is a gap. Reconcile the setup/key/access/clock cause before retry; do not switch identities to make it pass. Uncertain revocation may leave the metadata token valid until its bounded expiry; readiness is not claimed.

File modes protect against other users, **not hostile same-user code**. Preflight runs no candidate, proves no sandbox and enables no worker. Keep controller inputs outside candidate reach. Execution must establish that boundary before being advertised; metadata access proves neither accepted authority, protocol conformity, write capability nor qualification.

Primary references: [registration](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app), [JWT authentication](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app), [installation tokens](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app).
