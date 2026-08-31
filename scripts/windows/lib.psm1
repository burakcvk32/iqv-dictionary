# ============================================================
# IQV Dictionary — shared PowerShell helpers for scripts/windows/*.ps1.
# Imported by install.ps1 / update.ps1 / uninstall.ps1. Written for
# Windows PowerShell 5.1 compatibility (no PS7-only operators such as
# ?? or ?:) so it runs on a stock Windows install with no extra setup.
# ============================================================

$ErrorActionPreference = 'Stop'

# ---- logging ----
function Write-IqvInfo  { param([string]$Message) Write-Host "[INFO]  $Message" -ForegroundColor Cyan }
function Write-IqvCheck { param([string]$Message) Write-Host "[CHECK] $Message" -ForegroundColor Cyan }
function Write-IqvOk    { param([string]$Message) Write-Host "[OK]    $Message" -ForegroundColor Green }
function Write-IqvWarn  { param([string]$Message) Write-Host "[WARN]  $Message" -ForegroundColor Yellow }
function Write-IqvErr   { param([string]$Message) Write-Host "[ERROR] $Message" -ForegroundColor Red }

function Stop-IqvScript {
    param([string]$Message, [int]$Code = 1)
    Write-IqvErr $Message
    exit $Code
}

# ---- paths (lib.psm1 lives at <repo_root>\scripts\windows\lib.psm1) ----
$Script:IqvLibDir   = $PSScriptRoot
$Script:IqvRepoRoot = (Resolve-Path (Join-Path $IqvLibDir '..\..')).Path
$Script:IqvStateDir = Join-Path $IqvRepoRoot '.iqv-install'
$Script:IqvStateFile = Join-Path $IqvStateDir 'state.json'
$Script:IqvVersionFile = Join-Path $IqvRepoRoot 'VERSION'
$Script:IqvComposeProd = Join-Path $IqvRepoRoot 'docker-compose.prod.yml'
$Script:IqvEcosystem = Join-Path $IqvRepoRoot 'scripts\common\ecosystem.config.js'

function Get-IqvRepoRoot { return $Script:IqvRepoRoot }

function Get-IqvVersion {
    if (Test-Path $Script:IqvVersionFile) {
        return (Get-Content $Script:IqvVersionFile -Raw).Trim()
    }
    return 'unknown'
}

# ---- command detection ----
function Test-IqvCommand {
    param([string]$Name)
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    return [bool]$cmd
}

function Test-IqvDockerAvailable {
    if (-not (Test-IqvCommand 'docker')) { return $false }
    & docker info *> $null
    if ($LASTEXITCODE -ne 0) { return $false }
    & docker compose version *> $null
    if ($LASTEXITCODE -ne 0) { return $false }
    return $true
}

function Get-IqvPm2Command {
    $cmd = Get-Command 'pm2' -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

# ---- state file ----
function Get-IqvState {
    if (-not (Test-Path $Script:IqvStateFile)) { return $null }
    try {
        return Get-Content $Script:IqvStateFile -Raw | ConvertFrom-Json
    } catch {
        return $null
    }
}

function Set-IqvState {
    param(
        [Parameter(Mandatory = $true)][string]$Mode,
        [Parameter(Mandatory = $true)][int]$BackendPort,
        [Parameter(Mandatory = $true)][int]$FrontendPort
    )
    if (-not (Test-Path $Script:IqvStateDir)) {
        New-Item -ItemType Directory -Path $Script:IqvStateDir -Force | Out-Null
    }
    $existing = Get-IqvState
    $createdAt = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    if ($existing -and $existing.installedAt) { $createdAt = $existing.installedAt }

    if ($Mode -eq 'docker') {
        $backendSvc = 'iqv-dictionary-backend-prod'
        $frontendSvc = 'iqv-dictionary-frontend-prod'
    } else {
        $backendSvc = 'iqv-dictionary-backend'
        $frontendSvc = 'iqv-dictionary-frontend'
    }

    $state = [ordered]@{
        mode        = $Mode
        version     = Get-IqvVersion
        installPath = $Script:IqvRepoRoot
        installedAt = $createdAt
        updatedAt   = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
        services    = [ordered]@{ backend = $backendSvc; frontend = $frontendSvc }
        ports       = [ordered]@{ backend = $BackendPort; frontend = $FrontendPort }
    }
    ($state | ConvertTo-Json -Depth 5) | Set-Content -Path $Script:IqvStateFile -Encoding UTF8
}

function Get-IqvInstalledMode {
    $state = Get-IqvState
    if ($state -and $state.mode) { return $state.mode }

    if (Test-IqvCommand 'docker') {
        $names = & docker ps --format '{{.Names}}' 2>$null
        if ($names -match '^iqv-dictionary-.*-prod$') { return 'docker' }
    }
    $pm2 = Get-IqvPm2Command
    if ($pm2) {
        $list = & pm2 list 2>$null
        if ($list -match 'iqv-dictionary-') { return 'native' }
    }
    return $null
}

# ---- env files ----
function New-IqvJwtSecret {
    $bytes = New-Object byte[] 48
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    return ([System.BitConverter]::ToString($bytes) -replace '-', '').ToLower()
}

function Confirm-IqvBackendEnv {
    $envFile = Join-Path $Script:IqvRepoRoot 'backend\.env'
    $example = Join-Path $Script:IqvRepoRoot 'backend\.env.example'
    if (Test-Path $envFile) {
        Write-IqvOk 'backend\.env already exists - leaving it as-is.'
        return
    }
    if (-not (Test-Path $example)) {
        Stop-IqvScript 'backend\.env.example not found - cannot bootstrap backend\.env.'
    }
    Copy-Item $example $envFile
    $secret = New-IqvJwtSecret
    (Get-Content $envFile) -replace '^JWT_SECRET=.*', "JWT_SECRET=$secret" | Set-Content $envFile -Encoding UTF8
    Write-IqvOk 'Created backend\.env from .env.example with a freshly generated JWT_SECRET.'
    Write-IqvWarn 'Review backend\.env (MongoDB URI / CORS_ORIGIN) before relying on this install.'
}

function Confirm-IqvDashboardEnv {
    $envFile = Join-Path $Script:IqvRepoRoot 'dashboard\.env'
    $example = Join-Path $Script:IqvRepoRoot 'dashboard\.env.example'
    if (Test-Path $envFile) {
        Write-IqvOk 'dashboard\.env already exists - leaving it as-is.'
        return
    }
    if (-not (Test-Path $example)) {
        Stop-IqvScript 'dashboard\.env.example not found - cannot bootstrap dashboard\.env.'
    }
    Copy-Item $example $envFile
    Write-IqvOk 'Created dashboard\.env from .env.example.'
}

function Confirm-IqvRootEnv {
    $envFile = Join-Path $Script:IqvRepoRoot '.env'
    $example = Join-Path $Script:IqvRepoRoot '.env.example'
    if (Test-Path $envFile) { return }
    if (-not (Test-Path $example)) { return }
    Copy-Item $example $envFile
    Write-IqvOk 'Created root .env (Docker Compose ports / build args) from .env.example.'
}

function Import-IqvRootEnv {
    $result = @{
        IQV_FRONTEND_PORT = '8080'
        IQV_BACKEND_PORT  = '3001'
        VITE_API_BASE_URL = 'http://localhost:3001'
    }
    $envFile = Join-Path $Script:IqvRepoRoot '.env'
    if (Test-Path $envFile) {
        Get-Content $envFile | ForEach-Object {
            $line = $_.Trim()
            if ($line -eq '' -or $line.StartsWith('#')) { return }
            $idx = $line.IndexOf('=')
            if ($idx -lt 1) { return }
            $key = $line.Substring(0, $idx).Trim()
            $value = $line.Substring($idx + 1).Trim()
            $result[$key] = $value
        }
    }
    return $result
}

# ---- healthchecks ----
function Wait-IqvHttpOk {
    param(
        [string]$Url,
        [string]$Label,
        [int]$Attempts = 30,
        [int]$SleepSeconds = 2
    )
    for ($i = 1; $i -le $Attempts; $i++) {
        try {
            $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
            if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 400) {
                Write-IqvCheck "$Label ........ OK"
                return $true
            }
        } catch {
            # not up yet - keep polling
        }
        Start-Sleep -Seconds $SleepSeconds
    }
    Write-IqvCheck "$Label ........ FAIL"
    return $false
}

# ---- git ----
function Test-IqvGitRepo {
    if (-not (Test-IqvCommand 'git')) { return $false }
    Push-Location $Script:IqvRepoRoot
    try {
        & git rev-parse --is-inside-work-tree *> $null
        return ($LASTEXITCODE -eq 0)
    } finally {
        Pop-Location
    }
}

function Test-IqvGitDirty {
    Push-Location $Script:IqvRepoRoot
    try {
        $status = & git status --porcelain 2>$null
        return [bool]$status
    } finally {
        Pop-Location
    }
}

Export-ModuleMember -Function * -Variable IqvRepoRoot, IqvStateFile, IqvStateDir, IqvComposeProd, IqvEcosystem
