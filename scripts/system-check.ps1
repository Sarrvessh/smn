param(
  [switch]$Live,
  [switch]$SkipBrowser,
  [string]$ApiBase = "http://127.0.0.1:8001"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $ScriptDir
$Api = Join-Path $Root "apps\api"
$Web = Join-Path $Root "apps\web"
$Python = Join-Path $Api ".venv\Scripts\python.exe"

function Invoke-Check {
  param(
    [string]$Name,
    [string]$WorkingDirectory,
    [string]$Command,
    [string[]]$Arguments
  )

  Write-Host "`n==> $Name" -ForegroundColor Cyan
  Push-Location $WorkingDirectory
  try {
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "$Name failed with exit code $LASTEXITCODE"
    }
  }
  finally {
    Pop-Location
  }
}

if (-not (Test-Path $Python)) {
  throw "API virtual environment is missing: $Python"
}
if (-not (Test-Path (Join-Path $Web "node_modules"))) {
  throw "Web dependencies are missing. Run npm install in apps/web."
}

Invoke-Check "API tests" $Api $Python @("-m", "pytest", "-q")
Invoke-Check "API lint" $Api $Python @("-m", "ruff", "check", "app", "tests", "scripts")
Invoke-Check "Corpus parse and chunk audit" $Api $Python @("-m", "scripts.check_corpus")
Invoke-Check "Web lint" $Web "npm.cmd" @("run", "lint")
Invoke-Check "Web production build" $Web "npm.cmd" @("run", "build")

if (-not $SkipBrowser) {
  Invoke-Check "Mock browser journeys" $Web "npx.cmd" @(
    "playwright", "test", "--workers=2"
  )
}

if ($Live) {
  Write-Host "`n==> Live API product gate ($ApiBase)" -ForegroundColor Cyan
  try {
    $live = Invoke-RestMethod "$ApiBase/health/live" -TimeoutSec 10
  }
  catch {
    throw "Live API is unavailable at $ApiBase. Start the API and retry with -Live."
  }
  if ($live.status -ne "ok") {
    throw "Unexpected liveness response from $ApiBase"
  }
  Invoke-Check "Live sessions, retrieval, streaming, and artifacts" $Api $Python @(
    "-m", "scripts.hard_gate", $ApiBase
  )
}

Write-Host "`nSYSTEM CHECK PASSED" -ForegroundColor Green
