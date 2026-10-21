param([string]$BundleKey, [string]$Operation)
# Preserve the host's execution policy and native hook trust.
if ($BundleKey -notmatch '^[a-f0-9]{64}$') { exit 0 }
$RepoRoot = git rev-parse --show-toplevel 2>$null
if ($LASTEXITCODE -ne 0) { exit 0 }
$ConfigBase = $env:YOLO_OBSERVE_CONFIG_DIR
if (-not $ConfigBase) { $ConfigBase = Join-Path $env:APPDATA 'yolo' }
$Binary = Join-Path $ConfigBase "checkers/bundles/$BundleKey/windows_amd64/yolo-check.exe"
if (-not (Test-Path -LiteralPath $Binary -PathType Leaf)) {
    if ($Operation -eq 'context') { Write-Output '{"status":"unavailable"}' }
    exit 0
}
if ($Operation -eq 'context') { & $Binary observe context $RepoRoot }
elseif ($Operation -eq 'hook') {
    $NativeVersion = codex --version 2>$null
    if ($LASTEXITCODE -eq 0) { & $Binary observe hook codex $RepoRoot ($NativeVersion -replace '^codex-cli ', '') }
}
exit 0
