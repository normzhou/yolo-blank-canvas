#!/bin/bash
# Ubuntu 24.04 ARM64, first boot only. No credentials or owner identifiers here.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
umask 027
test "$(uname -m)" = aarch64
. /etc/os-release
test "$ID:$VERSION_ID" = ubuntu:24.04

apt-get update
apt-get install -y --no-install-recommends ca-certificates curl iptables logrotate python3 unattended-upgrades
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'APT'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT

scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT
curl --fail --silent --show-error --location --retry 3 --max-time 180 \
  https://download.docker.com/linux/static/stable/aarch64/docker-29.5.2.tgz \
  -o "$scratch/docker.tgz"
echo "d1d9cb857c32c596ea96a9ca6b25d13621a97c83511e667868a33a320b2a707f  $scratch/docker.tgz" | sha256sum --check --status
tar -xzf "$scratch/docker.tgz" -C "$scratch"
install -m 0755 "$scratch"/docker/* /usr/local/bin/
groupadd -f docker
# Only the operator's ubuntu account receives Docker access (root-equivalent).
usermod -aG docker ubuntu
install -d -m 0750 /etc/docker /etc/cloudflared /srv/yolo
install -d -o 10001 -g 10001 -m 0700 /srv/yolo/__APP_SLUG__
cat > /etc/docker/daemon.json <<'JSON'
{"log-driver":"local","log-opts":{"max-size":"10m","max-file":"3"},"live-restore":true,"ipv6":false,"default-address-pools":[{"base":"172.28.0.0/16","size":24}]}
JSON
cat > /etc/systemd/system/docker.service <<'UNIT'
[Unit]
Description=Pinned Docker Engine for Yolo __APP_SLUG__ host
After=network-online.target
Wants=network-online.target
[Service]
Type=notify
ExecStart=/usr/local/bin/dockerd --host=unix:///var/run/docker.sock
ExecStartPost=/usr/local/sbin/yolo-container-firewall
Restart=always
RestartSec=5
TimeoutStartSec=120
TimeoutStopSec=120
Delegate=yes
KillMode=process
LimitNOFILE=1048576
TasksMax=infinity
[Install]
WantedBy=multi-user.target
UNIT

# Reject new container access to host services, metadata and other private networks.
# The one trusted app and kamal-proxy share yolo0. No other apps are admitted yet.
cat > /usr/local/sbin/yolo-container-firewall <<'FIREWALL'
#!/bin/bash
set -euo pipefail
iptables -w -N YOLO-EGRESS 2>/dev/null || true
iptables -w -F YOLO-EGRESS
iptables -w -A YOLO-EGRESS -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN
iptables -w -A YOLO-EGRESS -i yolo0 -o yolo0 -j RETURN
for dst in 169.254.0.0/16 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16 100.64.0.0/10 127.0.0.0/8; do
  iptables -w -A YOLO-EGRESS -d "$dst" -j REJECT
done
iptables -w -A YOLO-EGRESS -j RETURN
iptables -w -C DOCKER-USER -j YOLO-EGRESS 2>/dev/null || iptables -w -I DOCKER-USER 1 -j YOLO-EGRESS
for iface in docker0 'br+' yolo0; do
  iptables -w -C INPUT -i "$iface" -m conntrack --ctstate NEW -j REJECT 2>/dev/null || \
    iptables -w -I INPUT 1 -i "$iface" -m conntrack --ctstate NEW -j REJECT
done
FIREWALL
chmod 0750 /usr/local/sbin/yolo-container-firewall

cat > /etc/ssh/sshd_config.d/00-yolo-owner.conf <<'SSH'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
AllowUsers ubuntu
AllowTcpForwarding yes
GatewayPorts no
X11Forwarding no
SSH
sshd -t
systemctl reload ssh

install -d /etc/systemd/journald.conf.d
cat > /etc/systemd/journald.conf.d/yolo.conf <<'JOURNAL'
[Journal]
SystemMaxUse=200M
RuntimeMaxUse=100M
MaxRetentionSec=7day
JOURNAL
systemctl restart systemd-journald

curl --fail --silent --show-error --location --retry 3 --max-time 180 \
  https://github.com/cloudflare/cloudflared/releases/download/2026.10.1/cloudflared-linux-arm64 \
  -o "$scratch/cloudflared"
echo "2c65dfabf616c40efc7545d107d7a57ad5e21377e2964b7e88af19a238074a46  $scratch/cloudflared" | sha256sum --check --status
install -m 0755 "$scratch/cloudflared" /usr/local/bin/cloudflared
cat > /etc/systemd/system/cloudflared.service <<'UNIT'
[Unit]
Description=Private Yolo app origin tunnel
After=network-online.target docker.service
Wants=network-online.target
ConditionPathExists=/etc/cloudflared/token
[Service]
Type=simple
DynamicUser=yes
LoadCredential=token:/etc/cloudflared/token
ExecStart=/usr/local/bin/cloudflared tunnel --no-autoupdate --metrics 127.0.0.1:2000 run --token-file %d/token
Restart=always
RestartSec=5
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
MemoryMax=256M
CPUQuota=25%
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now docker
for attempt in $(seq 1 60); do
  if docker info >/dev/null 2>&1; then break; fi
  sleep 2
done
docker info >/dev/null
docker network inspect kamal >/dev/null 2>&1 || \
  docker network create --driver bridge --opt com.docker.network.bridge.name=yolo0 kamal
systemctl enable cloudflared
# It intentionally waits for the owner-installed root-only token. No public app yet.
echo 'Yolo __APP_SLUG__ host SSH Ed25519 fingerprint (verify through OCI console history):'
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
touch /var/lib/yolo-bootstrap-ready
