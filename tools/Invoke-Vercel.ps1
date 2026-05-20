# Загружает VERCEL_TOKEN из apps/web/.env.vercel и вызывает vercel CLI.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root "apps\web\.env.vercel"
if (Test-Path $envFile) {
  Get-Content $envFile -Encoding UTF8 | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $idx = $line.IndexOf("=")
    if ($idx -lt 1) { return }
    $key = $line.Substring(0, $idx).Trim()
    $val = $line.Substring($idx + 1).Trim().Trim('"').Trim("'")
    Set-Item -Path "Env:$key" -Value $val
  }
}
if (-not $env:VERCEL_TOKEN) {
  Write-Host "Нет VERCEL_TOKEN. Создайте apps/web/.env.vercel из .env.vercel.example или выполните: vercel login" -ForegroundColor Yellow
}
Set-Location (Join-Path $root "apps\web")
& vercel @args
