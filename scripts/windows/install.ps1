<#
.SYNOPSIS
    IQV Dictionary - Windows INSTALL. Single command brings up the whole
    system (backend + dashboard).
.EXAMPLE
    .\scripts\windows\install.ps1
.EXAMPLE
    .\scripts\windows\install.ps1 -Mode docker
.EXAMPLE
    .\scripts\windows\install.ps1 -Mode native
#>
[CmdletBinding()]
param(
    [ValidateSet('auto', 'docker', 'native')]
    [string]$Mode = 'auto'
)

$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'lib.psm1') -Force

$RepoRoot = Get-IqvRepoRoot
Set-Location $RepoRoot

Write-Host '============================================================'
Write-Host ' IQV Dictionary - Install'
Write-Host " Version: $(Get-IqvVersion)"
Write-Host " Path:    $RepoRoot"
Write-Host '============================================================'

if (-not (Test-IqvCommand 'node')) {
    Stop-IqvScript 'Node.js was not found on PATH. Install Node.js 20+ and re-run.'
}
Write-IqvInfo "Node.js detected: $(& node --version)"

if ($Mode -eq 'auto') {
    if (Test-IqvDockerAvailable) {
        Write-IqvInfo 'Docker detected.'
        Write-IqvInfo 'Installation mode: docker'
        $Mode = 'docker'
    } else {
        Write-IqvInfo 'Docker not detected.'
        Write-IqvInfo 'Installation mode: native'
        $Mode = 'native'
    }
} else {
    Write-IqvInfo "Installation mode (forced): $Mode"
    if ($Mode -eq 'docker' -and -not (Test-IqvDockerAvailable)) {
        Stop-IqvScript 'Docker/Docker Compose not available, but -Mode docker was requested.'
    }
}

Confirm-IqvBackendEnv
Confirm-IqvDashboardEnv

$Ok = $true

if ($Mode -eq 'docker') {
    Confirm-IqvRootEnv
    $EnvVars = Import-IqvRootEnv
    $BackendPort = [int]$EnvVars['IQV_BACKEND_PORT']
    $FrontendPort = [int]$EnvVars['IQV_FRONTEND_PORT']

    Write-IqvInfo 'Building production images (backend + dashboard)...'
    & docker compose -f $IqvComposeProd --env-file (Join-Path $RepoRoot '.env') build
    if ($LASTEXITCODE -ne 0) { Stop-IqvScript 'docker compose build failed.' }

    Write-IqvInfo 'Starting containers...'
    & docker compose -f $IqvComposeProd --env-file (Join-Path $RepoRoot '.env') up -d
    if ($LASTEXITCODE -ne 0) { Stop-IqvScript 'docker compose up failed.' }

    Write-IqvInfo 'Waiting for containers to report healthy...'
    if (-not (Wait-IqvHttpOk -Url "http://127.0.0.1:$BackendPort/health" -Label 'Backend' -Attempts 40 -SleepSeconds 3)) { $Ok = $false }
    if (-not (Wait-IqvHttpOk -Url "http://127.0.0.1:$FrontendPort/" -Label 'Frontend' -Attempts 40 -SleepSeconds 3)) { $Ok = $false }
    Write-IqvCheck 'Docker ......... OK'

    Set-IqvState -Mode 'docker' -BackendPort $BackendPort -FrontendPort $FrontendPort

    if (-not $Ok) {
        Stop-IqvScript 'One or more services failed their healthcheck. Run "docker compose -f docker-compose.prod.yml logs" to investigate.'
    }
} else {
    if (-not (Test-IqvCommand 'npm')) {
        Stop-IqvScript 'npm was not found on PATH (should ship with Node.js). Install Node.js 20+ and re-run.'
    }
    if (-not (Test-IqvCommand 'corepack')) {
        Stop-IqvScript 'corepack was not found on PATH (should ship with Node.js 16.9+). Install Node.js 20+ and re-run.'
    }

    Write-IqvInfo 'Enabling pnpm via corepack (dashboard''s declared package manager)...'
    & corepack enable *> $null
    & corepack prepare pnpm@9.15.9 --activate
    if ($LASTEXITCODE -ne 0) { Stop-IqvScript 'corepack prepare pnpm failed.' }

    $Pm2 = Get-IqvPm2Command
    if (-not $Pm2) {
        Write-IqvInfo 'PM2 not found - installing globally (npm install -g pm2)...'
        & npm install -g pm2
        if ($LASTEXITCODE -ne 0) { Stop-IqvScript 'PM2 installation failed.' }
        $Pm2 = Get-IqvPm2Command
        if (-not $Pm2) { Stop-IqvScript 'PM2 installation did not complete successfully (not found on PATH afterwards).' }
    }
    Write-IqvInfo "PM2 detected: $(& pm2 --version)"

    Write-IqvInfo 'Installing backend dependencies (npm ci)...'
    Push-Location (Join-Path $RepoRoot 'backend')
    try {
        & npm ci
        if ($LASTEXITCODE -ne 0) { Stop-IqvScript 'backend npm ci failed.' }
        Write-IqvInfo 'Building backend (tsc)...'
        & npm run build
        if ($LASTEXITCODE -ne 0) { Stop-IqvScript 'backend build failed.' }
    } finally {
        Pop-Location
    }

    Write-IqvInfo 'Installing dashboard dependencies (pnpm install --frozen-lockfile)...'
    Push-Location (Join-Path $RepoRoot 'dashboard')
    try {
        & pnpm install --frozen-lockfile
        if ($LASTEXITCODE -ne 0) { Stop-IqvScript 'dashboard pnpm install failed.' }
        Write-IqvInfo 'Building dashboard (production bundle)...'
        & pnpm run build
        if ($LASTEXITCODE -ne 0) { Stop-IqvScript 'dashboard build failed.' }
    } finally {
        Pop-Location
    }

    Confirm-IqvRootEnv
    $EnvVars = Import-IqvRootEnv
    $BackendPort = [int]$EnvVars['IQV_BACKEND_PORT']
    $FrontendPort = [int]$EnvVars['IQV_FRONTEND_PORT']
    $env:IQV_FRONTEND_PORT = [string]$FrontendPort

    Write-IqvInfo 'Starting IQV Dictionary under PM2 (backend + frontend)...'
    & pm2 startOrReload $IqvEcosystem --update-env
    if ($LASTEXITCODE -ne 0) {
        & pm2 start $IqvEcosystem
        if ($LASTEXITCODE -ne 0) { Stop-IqvScript 'pm2 start failed.' }
    }
    & pm2 save

    Write-IqvInfo 'Registering PM2 to resurrect IQV Dictionary on sign-in (pm2-windows-startup)...'
    if (-not (Test-IqvCommand 'pm2-startup')) {
        & npm install -g pm2-windows-startup
        if ($LASTEXITCODE -ne 0) {
            Write-IqvWarn 'pm2-windows-startup installation failed (non-fatal). PM2 will not auto-start on sign-in; run "npm install -g pm2-windows-startup" then "pm2-startup install" manually.'
        }
    }
    if (Test-IqvCommand 'pm2-startup') {
        & pm2-startup install
        if ($LASTEXITCODE -eq 0) {
            Write-IqvOk 'PM2 will now resurrect IQV Dictionary automatically on sign-in.'
        } else {
            Write-IqvWarn 'pm2-startup install did not complete cleanly (non-fatal). Run "pm2-startup install" manually to survive reboots.'
        }
    }

    Write-IqvInfo 'Waiting for services to become healthy...'
    if (-not (Wait-IqvHttpOk -Url "http://127.0.0.1:$BackendPort/health" -Label 'Backend' -Attempts 30 -SleepSeconds 2)) { $Ok = $false }
    if (-not (Wait-IqvHttpOk -Url "http://127.0.0.1:$FrontendPort/" -Label 'Frontend' -Attempts 30 -SleepSeconds 2)) { $Ok = $false }

    Set-IqvState -Mode 'native' -BackendPort $BackendPort -FrontendPort $FrontendPort

    if (-not $Ok) {
        Stop-IqvScript 'One or more services failed their healthcheck. Run "pm2 logs" to investigate.'
    }
}

Write-IqvCheck 'Health .......... OK'
Write-Host '============================================================'
Write-Host ' IQV Dictionary installation completed successfully.'
Write-Host " Backend:  http://localhost:$BackendPort"
Write-Host " Frontend: http://localhost:$FrontendPort"
Write-Host " Mode:     $Mode"
Write-Host '============================================================'
