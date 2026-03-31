param(
  [switch]$CheckDb,
  [switch]$IncludeReference,
  [switch]$InstallDeps
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Write-Step([string]$message) {
  Write-Host "[Build Standard] $message" -ForegroundColor Cyan
}

function Invoke-CheckedCommand(
  [string]$Label,
  [scriptblock]$Command,
  [string]$WorkingDirectory
) {
  Write-Step "$Label (cwd=$WorkingDirectory)"
  Push-Location $WorkingDirectory
  try {
    & $Command
    if ($LASTEXITCODE -ne 0) {
      throw "$Label failed with exit code $LASTEXITCODE."
    }
  }
  finally {
    Pop-Location
  }
}

Write-Step "Starting standard build verification"

$backendPython = Join-Path $root "backend\venv\Scripts\python.exe"
if (-not (Test-Path $backendPython)) {
  throw "Missing backend virtualenv python at '$backendPython'. Create it first: cd backend; python -m venv venv; .\venv\Scripts\activate; pip install -r requirements.txt"
}

$stdArgs = @("backend/scripts/standardization_pass.py")
if (-not $CheckDb) {
  $stdArgs += "--skip-db"
}
Invoke-CheckedCommand -Label "Backend standardization pass" -WorkingDirectory $root -Command {
  & $backendPython @stdArgs
}

$frontendDir = Join-Path $root "frontend"
if (-not (Test-Path $frontendDir)) {
  throw "Missing frontend directory: $frontendDir"
}

if ($InstallDeps) {
  Invoke-CheckedCommand -Label "Frontend dependency install" -WorkingDirectory $frontendDir -Command {
    npm install
  }
}
Invoke-CheckedCommand -Label "Frontend production build" -WorkingDirectory $frontendDir -Command {
  npm run build
}

if ($IncludeReference) {
  $referenceRoot = Join-Path $root "Anawuma-Resturant-App-"
  $referenceBackend = Join-Path $referenceRoot "restaurant-backend-nestjs"
  $referenceFrontend = Join-Path $referenceRoot "restaurant-frontend"

  if (-not (Test-Path $referenceBackend)) {
    throw "Reference backend directory not found: $referenceBackend"
  }
  if (-not (Test-Path $referenceFrontend)) {
    throw "Reference frontend directory not found: $referenceFrontend"
  }

  if ($InstallDeps) {
    Invoke-CheckedCommand -Label "Reference backend dependency install" -WorkingDirectory $referenceBackend -Command {
      npm install
    }
    Invoke-CheckedCommand -Label "Reference frontend dependency install" -WorkingDirectory $referenceFrontend -Command {
      npm install
    }
  }

  Invoke-CheckedCommand -Label "Reference backend build" -WorkingDirectory $referenceBackend -Command {
    npm run build
  }
  Invoke-CheckedCommand -Label "Reference frontend build" -WorkingDirectory $referenceFrontend -Command {
    npm run build
  }
}

Write-Step "All selected standard build checks completed successfully."
