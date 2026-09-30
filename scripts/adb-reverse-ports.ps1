# Forward backend ports from the Android device to this PC over USB.
# Required when .env uses http://127.0.0.1 — the phone reaches your PC via adb reverse.
$ports = 8081, 3000, 3001, 3002, 3003, 3005, 3006, 3008, 3009, 5001, 5005

$devices = adb devices | Select-String "device$"
if (-not $devices) {
  Write-Warning "No Android device on USB — skip adb reverse. API calls need Wi-Fi LAN IP in .env, or plug in USB and re-run."
  exit 0
}

foreach ($port in $ports) {
  adb reverse "tcp:$port" "tcp:$port"
  if ($LASTEXITCODE -ne 0) {
    Write-Error "adb reverse failed for port $port"
    exit 1
  }
  Write-Host "Forwarded tcp:$port -> tcp:$port"
}

Write-Host ""
adb reverse --list
