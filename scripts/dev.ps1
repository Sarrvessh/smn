# Lenny Growth Assistant — PowerShell helpers (Windows)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $Root) { $Root = Get-Location }
$Api = Join-Path $Root "apps\api"
$Web = Join-Path $Root "apps\web"
$VenvPy = Join-Path $Api ".venv\Scripts\python.exe"
$VenvPip = Join-Path $Api ".venv\Scripts\pip.exe"

function Ensure-Venv {
  if (-not (Test-Path $VenvPy)) {
    Push-Location $Api
    python -m venv .venv
    & $VenvPip install -e ".[dev]"
    Pop-Location
  }
}

function Install-All {
  Ensure-Venv
  Push-Location $Web; npm install; Pop-Location
}

function Db-Up { docker compose -f (Join-Path $Root "docker-compose.yml") up -d postgres }
function Migrate { Ensure-Venv; Push-Location $Api; & (Join-Path $Api ".venv\Scripts\alembic.exe") upgrade head; Pop-Location }
function Corpus { Ensure-Venv; Push-Location $Api; & $VenvPy -m scripts.corpus; Pop-Location }
function Ingest { Ensure-Venv; Push-Location $Api; & $VenvPy -m scripts.ingest_transcripts --incremental; Pop-Location }
function Query([string]$Q) { Ensure-Venv; Push-Location $Api; & $VenvPy -m scripts.query_transcripts $Q; Pop-Location }
function Dev-Api { Ensure-Venv; Push-Location $Api; & (Join-Path $Api ".venv\Scripts\uvicorn.exe") app.main:app --reload --host 0.0.0.0 --port 8000; Pop-Location }
function Dev-Web { Push-Location $Web; npm run dev; Pop-Location }
function Test-Api { Ensure-Venv; Push-Location $Api; & (Join-Path $Api ".venv\Scripts\pytest.exe") -q; Pop-Location }

Export-ModuleMember -Function * -ErrorAction SilentlyContinue

Write-Host @"
Lenny Growth Assistant helpers loaded.

  Install-All
  Db-Up
  Migrate
  Corpus
  Ingest
  Query 'product-market fit'
  Dev-Api
  Dev-Web
  Test-Api
"@
