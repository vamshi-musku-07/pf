# Push EXPO_PUBLIC_* vars from .env to EAS preview (skips secrets).
# Workaround for: eas env:push --force fails on SENTRY_AUTH_TOKEN (CLI bug).
#
# Usage (from play_flash_application/app):
#   .\scripts\push-eas-preview-env.ps1
#   .\scripts\push-eas-preview-env.ps1 -Environment production

param(
  [string]$Environment = "preview",
  [string]$EnvFile = ".env"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

if (-not (Test-Path $EnvFile)) {
  Write-Error "Missing $EnvFile in $root"
}

# Prefer global/local `eas` (avoids broken PowerShell `& $array` and slow npx installs).
$eas = $null
foreach ($candidate in @(
  (Join-Path $root "node_modules\.bin\eas.cmd"),
  "eas.cmd",
  "eas"
)) {
  if ($candidate -match '[\\/]' -and -not (Test-Path $candidate)) { continue }
  $cmd = Get-Command $candidate -ErrorAction SilentlyContinue
  if ($cmd) {
    $eas = $cmd.Source
    break
  }
  if ($candidate -match '[\\/]' -and (Test-Path $candidate)) {
    $eas = $candidate
    break
  }
}
if (-not $eas) {
  Write-Error "eas CLI not found. Install with: npm install -g eas-cli"
}

Write-Host "Using eas: $eas" -ForegroundColor DarkGray

$lines = Get-Content $EnvFile -Encoding UTF8
$count = 0

foreach ($line in $lines) {
  $trimmed = $line.Trim()
  if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
  if ($trimmed -notmatch '^(EXPO_PUBLIC_[A-Z0-9_]+)=(.*)$') { continue }

  $name = $matches[1]
  $value = $matches[2].Trim()
  if ($value.StartsWith('"') -and $value.EndsWith('"')) {
    $value = $value.Substring(1, $value.Length - 2)
  }

  Write-Host "→ $name" -ForegroundColor Cyan
  $easArgs = @(
    "env:create",
    $Environment,
    "--name", $name,
    "--value", $value,
    "--visibility", "plaintext",
    "--force",
    "--non-interactive"
  )
  & $eas @easArgs
  if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to set $name"
  }
  $count++
}

Write-Host ""
Write-Host "Done. Pushed $count EXPO_PUBLIC_* variables to EAS '$Environment'." -ForegroundColor Green
Write-Host "Rebuild: eas build --profile $Environment --platform android" -ForegroundColor Yellow
