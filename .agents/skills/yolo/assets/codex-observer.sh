#!/bin/sh
# Native launcher; no new runtime, secrets, prompts or permission decisions.
key=$1
operation=$2
case "$key" in ''|*[!0-9a-f]*) exit 0 ;; esac
[ "${#key}" -eq 64 ] || exit 0
root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
case "$(uname -s)" in
  Darwin) os=darwin; base=${YOLO_OBSERVE_CONFIG_DIR:-"$HOME/Library/Application Support/yolo"} ;;
  Linux) os=linux; base=${YOLO_OBSERVE_CONFIG_DIR:-"${XDG_CONFIG_HOME:-$HOME/.config}/yolo"} ;;
  *) exit 0 ;;
esac
case "$(uname -m)" in arm64|aarch64) arch=arm64 ;; x86_64|amd64) arch=amd64 ;; *) exit 0 ;; esac
binary="$base/checkers/bundles/$key/${os}_${arch}/yolo-check"
if [ ! -x "$binary" ]; then
  [ "$operation" != context ] || printf '%s\n' '{"status":"unavailable"}'
  exit 0
fi
case "$operation" in
  context) "$binary" observe context "$root" ;;
  hook)
    native_version=$(codex --version 2>/dev/null) || exit 0
    native_version=${native_version#codex-cli }
    "$binary" observe hook codex "$root" "$native_version" || :
    ;;
esac
exit 0
