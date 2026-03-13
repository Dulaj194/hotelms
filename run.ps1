param(
  [switch]$Detached,
  [switch]$NoBuild
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Write-Step([string]$message) {
  Write-Host "[HotelMS] $message" -ForegroundColor Cyan
}

function Ensure-EnvFile([string]$path, [string]$content) {
  if (-not (Test-Path $path)) {
    Set-Content -Path $path -Value $content -Encoding UTF8
    Write-Step "Created $path"
  }
}

Write-Step "Checking Docker CLI"
$dockerOk = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerOk) {
  throw "Docker not found. Please install Docker Desktop first."
}

Write-Step "Preparing .env files (if missing)"
Ensure-EnvFile "backend/.env" @"
APP_NAME=hotelms-backend
APP_ENV=development
API_V1_PREFIX=/api/v1
FRONTEND_URL=http://localhost:5173
DATABASE_URL=mysql+pymysql://root:@mysql:3306/hotelms
REDIS_URL=redis://redis:6379
SECRET_KEY=change-this-to-a-long-random-string
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
RESET_TOKEN_EXPIRE_MINUTES=30
LOGIN_RATE_LIMIT_ATTEMPTS=5
LOGIN_RATE_LIMIT_WINDOW_MINUTES=15
"@

Ensure-EnvFile "frontend/.env" @"
VITE_API_URL=http://localhost:8000/api/v1
VITE_APP_NAME=HotelMS
"@

$composeArgs = @("compose", "up")
if (-not $NoBuild) {
  $composeArgs += "--build"
}
if ($Detached) {
  $composeArgs += "-d"
}

Write-Step "Starting services: docker $($composeArgs -join ' ')"
& docker @composeArgs

if ($LASTEXITCODE -ne 0) {
  throw "Docker compose up failed."
}

Write-Step "Done"
Write-Host "Frontend: http://localhost:5173"
Write-Host "Backend : http://localhost:8000"
Write-Host "Swagger : http://localhost:8000/docs"
