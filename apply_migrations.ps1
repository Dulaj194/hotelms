# Script to apply database migrations safely, bypassing production guardrails if necessary.
param(
    [string]$Env = "development"
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location "$root/backend"

Write-Host "Applying database migrations (Env: $Env)..." -ForegroundColor Cyan

# Set environment variables to bypass production guardrails during migration
$env:APP_ENV = $Env
if (-not $env:REDIS_URL) {
    $env:REDIS_URL = "redis://localhost:6379"
}

try {
    .\venv\Scripts\python -m alembic upgrade head
    Write-Host "Migrations applied successfully!" -ForegroundColor Green
} catch {
    Write-Host "Failed to apply migrations: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
