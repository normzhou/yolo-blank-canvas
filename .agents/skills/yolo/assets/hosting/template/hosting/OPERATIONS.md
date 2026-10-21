# App-host operations and recovery

This implements the hosting profile in the installed skill; it supplies no application engine. [Owner setup](OWNER-SETUP.md) prepares the accounts. The operator setup issue and client publication issue own live access/publication acceptance.

## Dependencies and source checks

Pinned versions: OpenTofu **1.13.1**, OCI provider **9.10.0**, Cloudflare provider **5.28.0**, Docker Engine **29.5.2**, cloudflared **2026.10.1**, Kamal **2.12.0**, age **1.3.2**. Commit both provider and Ruby lockfiles. Bootstrap pins SHA-256 for ARM64 runtime binaries; upstream artifact changes require a source change/review. The regional Ubuntu image is pinned privately after account review; do not resolve a moving image on each plan. OS security packages follow Ubuntu's signed security updates; their installed versions are inventoried during live acceptance, not falsely claimed reproducible across dates.

From the repository root, using a fixture-only key and **no cloud credentials**:

```sh
export TF_VAR_state_passphrase=fixture-only-not-a-production-key-00000000
tofu -chdir=infra init -backend=false -input=false -lockfile=readonly
tofu -chdir=infra fmt -check -recursive
tofu -chdir=infra validate
tofu -chdir=infra test -no-color
bash -n infra/bootstrap.sh
python3 infra/hostctl.py # usage only; no provider action
```

Never run `test` with real API credentials; the native test file uses mock providers and explicit fixture values. Plans test free-account/home-region/resource/storage/SSH/Access refusal. `review_plan.py` tests additionally reject arbitrary paid services, deletion/replacement and incomplete settings. Neither proves the provider will allocate free capacity or that a human-created policy is correct.

For the Kamal schema check, use Ruby **3.4** with build tools and Bundler **2.6.9** (`hosting/Gemfile.lock`):

```sh
cd hosting
bundle config set --local path vendor/bundle
bundle install
VERSION=fixture-revision YOLO_HOST_IP=192.0.2.1 YOLO_SSH_KEY=/fixture/key \
  bundle exec kamal config -c deploy.yml.erb
```

This renders/validates only; do not run setup/deploy until the separate publication outcome's publication contract and actual client artifacts are ready. The initial SSH `/32` admits the owner workstation only: it **does not implement the separate publication outcome's laptop-independent CI publication**. the separate publication outcome must prepare a narrowly authenticated publisher access route and isolated credentials, with an exact owner handoff before enabling it; never solve CI connectivity by opening SSH to the Internet or handing the provisioning key to a runner. Infrastructure still has one local writer. `builder.context: .` makes builds include the supplied context: the separate publication outcome must require a clean, identified source export rather than rely on Kamal silently excluding dirty files. Default Kamal restart policy is `unless-stopped`. Readiness uses `/ready`; liveness `/health` is separate. Proxy binds `127.0.0.1`; edge HTTPS and the encrypted tunnel carry external traffic. No end-to-end “one-second rollback” promise is made.

For publisher validation, the original ARM64 fixture remains in the publisher repository. Adopters supply their own app-aware fixture with Docker and age/keygen **1.3.2**:

```sh
# Run the target application's declared ARM64/recovery test; no publisher path is required.
```

On Colima/Docker Desktop, if the OS temp directory is not shared, create a disposable private directory **outside this repo but inside an existing Docker-shared workspace**, and set `YOLO_FIXTURE_PARENT` to it. The fixture mounts only synthetic data, temporarily writable for UID mapping, then removes its own containers/data. Production data remains UID 10001/mode 0700. The synthetic SQLite counter must progress without browser connections, retain state after restart, decrypt/restore consistently, and continue in a new container using restored state. This is ARM64 container evidence, **not** an OCI boot/reboot, metadata-firewall, Google/streaming or real-feed acceptance test.

## Capacity, retention and patch ownership

Before every deployment, inspect `free -m`, `df -h / /srv/yolo`, `docker system df` and `docker stats --no-stream`. Require ≥20 GB free and disk <75%; enforce the 20-GB app-data budget and refuse growth if the next cutover/backup would exhaust it. Logs rotate (3×10 MB/container, journal 200 MB); background data must have app-owned retention. At 75% disk, pause new ingestion/deployment and preserve state; at 85%, stop the app before uncontrolled exhaustion. Never prune mounted data or use `docker system prune --volumes`.

Keep the active and previous known-good image/release on the host and a reproducible local build/export on the owner workstation. Inspect `docker image ls --digests` and remove only explicitly identified older images after validating rollback availability; don't prune by age alone. Builds stay on the operator workstation. The initial two-container cutover consumes ≤1.5 CPU / 6 GB RAM, leaving headroom on the host. No extra feed worker is permitted without counting it and proving single-writer operation across deployment overlap.

AI owns monthly patch review and prompt security fixes within authorized sessions. Prepare source pin/hash updates, check release notes, run fixtures, back up data and schedule the owner-operated maintenance window before applying on the live host. Keep previous binaries/config in a root-only dated backup; stop app/tunnel, replace the reviewed binaries/unit configuration, `systemctl daemon-reload`, restart Docker/cloudflared and verify readiness/firewall/background progress. Static Docker/cloudflared **do not auto-update**. Ubuntu unattended security updates are enabled; inspect `/var/run/reboot-required`, select a maintenance window and verify startup/persistence after reboot. No independent maintenance agent has been deployed; work requires an initiated session.

## Backups and restoration

Infrastructure: after every apply, `hostctl.py` copies the **encrypted** state to local hash-named backups. Copy current state/backups to the chosen independent encrypted owner storage before another write; keep the latest source revision and private variable/config recovery copy there. Passphrase recovery is separate. Record a private current-state digest/lineage/serial so a restore cannot silently select an older snapshot. To exercise loss of the working copy: restore state into a new private directory, set the saved passphrase, initialize that backend and run `hostctl.py check-state`; confirm the expected lineage/serial and wrong-key refusal. Restore the original writer binding before continuing. Do not apply a fixture or an old state to a live tenancy.

App data: take a backup daily during use, before every migration and before host maintenance; retain the newest seven verified encrypted copies on the owner workstation plus an independent encrypted backup. A local VM snapshot is not an independent backup. For the initial filesystem/SQLite fixture, stop all app writer containers gracefully, then copy the **quiesced** `/srv/yolo/__APP_SLUG__` to a new private workstation staging directory over verified SSH. Use `sudo tar -C /srv/yolo -cf - __APP_SLUG__` over SSH into local `tar -xf -` in that empty private directory. Resume after the copy and consistency check. Keep staging on the owner's encrypted disk and remove it after encrypting/verifying the backup. A real database uses its client-provided consistent dump/checkpoint procedure; do not assume tar of a running database is consistent.

Create an age identity on the workstation with `age-keygen -o <private-key-file>` (private permissions), save its independent recovery copy, and use `age-keygen -y <private-key-file>` for the recipient. Neither key belongs on the VM. Then:

```sh
python3 hosting/backup.py backup <quiesced-local-data-directory> <new-backup.age> \
  --recipient <AGE_PUBLIC_RECIPIENT> --quiesced
python3 hosting/backup.py restore <backup.age> <new-restore-directory> \
  --identity <private-age-key-file>
```

The utility encrypts to a new output, rejects links/special entries, decrypts to private staging and refuses to overwrite an existing destination. Plaintext temporary data exists briefly on the encrypted local disk; it is not streamed through GitHub/logs. Verify the restored schema, integrity, expected event/counter identities and snapshot age before selecting it. Preserve original data while testing recovery. Restore privately over SSH to a separate host path, set UID/GID 10001 and mode 0700, then select the restored directory during a stopped deployment. Never run original and recovered paper writers simultaneously. Retire temporary staging only after successful verification.

Host loss: recover state/key/config first; disable the origin tunnel and fence the old VM so two paper engines cannot run. Verify latest app backup in a fixture, then prepare a separately reviewed replacement/boot-volume recovery plan in the **same home region**, within aggregate free limits including any preserved old volume. Default lifecycle protection deliberately blocks accidental replacement. Wait for capacity if unavailable. Restore app data/secrets privately, validate read-only/paper mode, and enable the tunnel only after recovery acceptance. Market feeds may need resubscription/replay; the client must report stale/missing data truthfully. No data-loss-free recovery is promised beyond the latest verified backup.

Container rollback: use the identified known-good image and its compatible configuration through the separate publication outcome. First compare data schema/migration effects. If incompatible, use an app-tested downgrade/restore procedure while writes are stopped; rolling an image back alone does not roll data back. Preserve the failed release/logs for diagnosis.

## Stop and revoke

To hide the app: `sudo systemctl stop cloudflared` and revoke Access sessions/token as needed. To stop background work too: stop the specifically identified `yolo-__APP_SLUG__` containers (including any deployment-overlap instance) and verify no writer remains; a browser logout does not stop ingestion. Preserve data. A deliberately stopped `unless-stopped` container remains stopped after reboot; unexpected exit is restarted. Power off the VM if necessary; storage still counts toward the allowance.

Keep Access denial in place until the app/origin routes are removed. Permanent retirement/replacement requires an identified, reviewed plan and owner confirmation of data retention; see the owner runbook. Do not weaken lifecycle guards, expose Docker/HTTP, or broaden SSH/Access as troubleshooting shortcuts.
