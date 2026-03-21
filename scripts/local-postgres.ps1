param(
  [ValidateSet("start", "stop", "status")]
  [string]$Action = "start",
  [int]$Port = 5433,
  [string]$DatabaseName = "discord_analytics",
  [string]$UserName = "postgres"
)

$ErrorActionPreference = "Stop"

function Get-PostgresBinary {
  param([string]$BinaryName)

  $command = Get-Command $BinaryName -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $candidates = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\$BinaryName" -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending

  if (-not $candidates) {
    throw "Could not find PostgreSQL binary '$BinaryName'."
  }

  return $candidates[0].FullName
}

function Invoke-CheckedProcess {
  param(
    [string]$FilePath,
    [string[]]$Arguments,
    [switch]$AllowFailure
  )

  & $FilePath @Arguments
  if (-not $AllowFailure -and $LASTEXITCODE -ne 0) {
    throw "Command failed: $FilePath $($Arguments -join ' ')"
  }

  return $LASTEXITCODE
}

function Wait-ForPostgres {
  param(
    [string]$PgIsReadyPath,
    [int]$WaitPort,
    [string]$WaitUserName
  )

  for ($attempt = 0; $attempt -lt 30; $attempt += 1) {
    & $PgIsReadyPath -h "localhost" -p $WaitPort -U $WaitUserName | Out-Null
    if ($LASTEXITCODE -eq 0) {
      return
    }

    Start-Sleep -Seconds 1
  }

  throw "Timed out waiting for local PostgreSQL to accept connections on port $WaitPort."
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$localRoot = Join-Path $repoRoot ".local"
$dataDir = Join-Path $localRoot "postgres"
$logFile = Join-Path $localRoot "postgres.log"
$schemaPath = Join-Path $repoRoot "apps\api\sql\001_init.sql"

$initDb = Get-PostgresBinary "initdb.exe"
$pgCtl = Get-PostgresBinary "pg_ctl.exe"
$pgIsReady = Get-PostgresBinary "pg_isready.exe"
$createdb = Get-PostgresBinary "createdb.exe"
$psql = Get-PostgresBinary "psql.exe"

switch ($Action) {
  "start" {
    New-Item -ItemType Directory -Force -Path $localRoot | Out-Null

    if (-not (Test-Path (Join-Path $dataDir "PG_VERSION"))) {
      New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
      Invoke-CheckedProcess -FilePath $initDb -Arguments @(
        "-D", $dataDir,
        "-U", $UserName,
        "-A", "trust",
        "-E", "UTF8"
      )
    }

    & $pgCtl status -D $dataDir | Out-Null
    if ($LASTEXITCODE -ne 0) {
      Invoke-CheckedProcess -FilePath $pgCtl -Arguments @(
        "start",
        "-D", $dataDir,
        "-l", $logFile,
        "-o", "-p $Port"
      )
    }

    Wait-ForPostgres -PgIsReadyPath $pgIsReady -WaitPort $Port -WaitUserName $UserName

    $exists = & $psql -h "localhost" -p $Port -U $UserName -d "postgres" -tAc "SELECT 1 FROM pg_database WHERE datname = '$DatabaseName';"
    if (($exists | Out-String).Trim() -ne "1") {
      Invoke-CheckedProcess -FilePath $createdb -Arguments @(
        "-h", "localhost",
        "-p", $Port,
        "-U", $UserName,
        $DatabaseName
      )
    }

    Invoke-CheckedProcess -FilePath $psql -Arguments @(
      "-h", "localhost",
      "-p", $Port,
      "-U", $UserName,
      "-d", $DatabaseName,
      "-f", $schemaPath
    )

    Write-Host "Local PostgreSQL is ready on port $Port."
    Write-Host "DATABASE_URL=postgres://postgres:postgres@localhost:$Port/$DatabaseName"
  }

  "stop" {
    if (-not (Test-Path $dataDir)) {
      Write-Host "Local PostgreSQL data directory does not exist yet."
      exit 0
    }

    Invoke-CheckedProcess -FilePath $pgCtl -Arguments @(
      "stop",
      "-D", $dataDir
    ) -AllowFailure | Out-Null
  }

  "status" {
    if (-not (Test-Path $dataDir)) {
      Write-Host "Local PostgreSQL has not been initialized yet."
      exit 0
    }

    & $pgCtl status -D $dataDir
    if ($LASTEXITCODE -eq 0) {
      Write-Host "DATABASE_URL=postgres://postgres:postgres@localhost:$Port/$DatabaseName"
    }
  }
}
