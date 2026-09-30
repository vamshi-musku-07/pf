# Push .env to EAS production, excluding SENTRY_AUTH_TOKEN (must stay a secret on EAS).
# Usage: .\scripts\eas-push-env.ps1 [production|preview|development]

param(
  [string]$Environment = "production"
)

$ErrorActionPreference = "Stop"
$appRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $appRoot ".env"
$pushFile = Join-Path $appRoot ".env.eas-push"

if (-not (Test-Path $envFile)) {
  Write-Error ".env not found at $envFile"
}

Get-Content $envFile |
  Where-Object {
    $_ -match '^\s*[A-Za-z_][A-Za-z0-9_]*\s*=' -and
    $_ -notmatch '^\s*SENTRY_AUTH_TOKEN\s*='
  } |
  Set-Content $pushFile -Encoding utf8

Write-Host "Pushing $(@(Get-Content $pushFile | Where-Object { $_ -match '=' }).Count) variables to EAS ($Environment), skipping SENTRY_AUTH_TOKEN..."
Write-Host ""

Push-Location $appRoot
try {
  eas env:push $Environment --path .env.eas-push
}
finally {
  Remove-Item $pushFile -ErrorAction SilentlyContinue
  Pop-Location
}

Write-Host ""
Write-Host "Done. Rebuild so EXPO_PUBLIC_* URLs are baked in:"
Write-Host "  eas build --platform android --profile production"
