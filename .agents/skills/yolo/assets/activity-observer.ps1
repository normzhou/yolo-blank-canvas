param([string]$BundleKey, [string]$Harness)
if ($BundleKey -notmatch '^[a-f0-9]{64}$') { exit 0 }
if ($Harness -notin @('claude-code', 'gemini', 'cursor', 'opencode')) { exit 0 }
$RepoRoot = git rev-parse --show-toplevel 2>$null
if ($LASTEXITCODE -ne 0) { exit 0 }
$ConfigBase = $env:YOLO_OBSERVE_CONFIG_DIR
if (-not $ConfigBase) { $ConfigBase = Join-Path $env:APPDATA 'yolo' }
$Binary = Join-Path $ConfigBase "checkers/bundles/$BundleKey/windows_amd64/yolo-check.exe"
if (Test-Path -LiteralPath $Binary -PathType Leaf) {
    [Console]::In.ReadToEnd() | & $Binary observe hook $Harness $RepoRoot unknown 2>$null | Out-Null
}
exit 0
