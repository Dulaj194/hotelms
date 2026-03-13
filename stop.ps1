param(
  [switch]$WipeData
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Write-Step([string]$message) {
  Write-Host "[HotelMS] $message" -ForegroundColor Yellow
}

$dockerOk = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerOk) {
  throw "Docker not found. Please install Docker Desktop first."
}

$composeArgs = @("compose", "down")
if ($WipeData) {
  $composeArgs += "-v"
}

Write-Step "Stopping services: docker $($composeArgs -join ' ')"
& docker @composeArgs

if ($LASTEXITCODE -ne 0) {
  throw "Docker compose down failed."
}

Write-Step "Stopped"
