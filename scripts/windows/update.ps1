<#
.SYNOPSIS
    IQV Dictionary - Windows UPDATE.

    Detects how IQV Dictionary was installed (docker/native) -> git fetch
    + safe (fast-forward-only) pull -> detects what actually changed ->
    reinstalls dependencies / rebuilds only what needs it -> restarts ->
    healthcheck -> reports the version transition. Never runs
    "git reset --hard", "git clean -fd", or "git checkout ." - a dirty
    working tree aborts the update instead of discarding local changes.
.EXAMPLE
    .\scripts\windows\update.ps1
#>
[CmdletBinding()]
param(
    [ValidateSet('docker', 'native')]
    [string]$Mode,
    [switch]$SkipGit
)

$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'lib.psm1') -Force

$RepoRoot = Get-IqvRepoRoot
Set-Location $RepoRoot

Write-Host '============================================================'
Write-Host ' IQV Dictionary - Update'
Write-Host '============================================================'

if (-not $Mode) {
    $Mode = Get-IqvInstalledMode
    if (-not $Mode) {
        Stop-IqvScript 'Could not detect an existing IQV Dictionary installation. Run scripts\windows\install.ps1 first, or pass -Mode docker|native explicitly.'
    }
}
Write-IqvInfo "Detected installation mode: $Mode"

$CurrentVersion = Get-IqvVersion

$OldSha = $null
$NewSha = $null

if ($SkipGit) {
    Write-IqvWarn '-SkipGit passed - skipping git fetch/pull, only rebuilding/restarting in place.'
} elseif (-not (Test-IqvGitRepo)) {
    Write-IqvWarn 'Not a Git repository - skipping fetch/pull, only rebuilding/restarting in place.'
} else {
    if (Test-IqvGitDirty) {
        Write-IqvErr 'Local modifications detected (git status is not clean).'
        Write-IqvErr 'Update aborted to prevent data loss. Commit, stash, or discard your changes yourself, then re-run update.'
        exit 1
    }

    $Branch = (& git rev-parse --abbrev-ref HEAD).Trim()
    if ($Branch -eq 'HEAD') {
        Stop-IqvScript 'Repository is in a detached HEAD state - checkout a branch before updating.'
    }
    Write-IqvInfo "Current branch: $Branch"

    $OldSha = (& git rev-parse HEAD).Trim()

    Write-IqvInfo "Fetching origin/$Branch..."
    & git fetch origin $Branch
    if ($LASTEXITCODE -ne 0) { Stop-IqvScript 'git fetch failed.' }

    Write-IqvInfo 'Pulling (fast-forward only - never rewrites local history)...'
    & git pull --ff-only origin $Branch
    if ($LASTEXITCODE -ne 0) {
        Stop-IqvScript 'git pull --ff-only failed (local and remote history have diverged). Resolve manually (e.g. rebase/merge) and re-run update.'
    }

    $NewSha = (& git rev-parse HEAD).Trim()
}

$NewVersion = Get-IqvVersion
Write-Host '------------------------------------------------------------'
Write-Host ' IQV Dictionary'
Write-Host " Current version : $CurrentVersion"
Write-Host " Target version  : $NewVersion"
Write-Host '------------------------------------------------------------'

Confirm-IqvBackendEnv
Confirm-IqvDashboardEnv

$Changed = @()
if ($OldSha -and $NewSha -and ($OldSha -ne $NewSha)) {
    $Changed = & git diff --name-only $OldSha $NewSha
}

function Test-IqvChanged {
    param([string]$Pattern)
    foreach ($line in $Changed) {
        if ($line -match $Pattern) { return $true }
    }
    return $false
}

$BackendDepsChanged = $false
$BackendChanged = $false
$BackendDockerChanged = $false
$DashboardDepsChanged = $false
$DashboardChanged = $false
$DashboardDockerChanged = $false
$ComposeChanged = $false
$MigrationsChanged = $false

if (-not $OldSha -or -not $NewSha -or ($OldSha -eq $NewSha)) {
    # No git diff available (skip-git / non-git checkout / already up to
    # date) - treat everything as potentially changed so a manual re-run
    # still rebuilds/restarts correctly instead of silently doing nothing.
    $BackendDepsChanged = $true; $BackendChanged = $true
    $DashboardDepsChanged = $true; $DashboardChanged = $true
} else {
    $BackendDepsChanged = Test-IqvChanged '^backend/(package\.json|package-lock\.json)$'
    $BackendChanged = Test-IqvChanged '^backend/(src|scripts)/'
    $BackendDockerChanged = Test-IqvChanged '^backend/Dockerfile'
    $DashboardDepsChanged = Test-IqvChanged '^dashboard/(package\.json|pnpm-lock\.yaml)$'
    $DashboardChanged = Test-IqvChanged '^dashboard/(src|index\.html|vite\.config\.ts|config\.ts|tailwind\.config\.mjs)'
    $DashboardDockerChanged = Test-IqvChanged '^dashboard/(Dockerfile|nginx\.conf)'
    $ComposeChanged = Test-IqvChanged '^docker-compose(\.prod)?\.yml$'
    $MigrationsChanged = Test-IqvChanged '^backend/scripts/.*(migrat|rename)'
    if (Test-IqvChanged '^\.env\.example$|^backend/\.env\.example$|^dashboard/\.env\.example$') {
        Write-IqvWarn 'A .env.example file changed upstream - compare it with your local .env files for new/renamed variables.'
    }
}
if ($BackendDepsChanged) { $BackendChanged = $true }
if ($DashboardDepsChanged) { $DashboardChanged = $true }

if ($MigrationsChanged) {
    Write-IqvWarn 'backend\scripts contains changed migration-style scripts (e.g. rename-iqvizyon-dictionary-2026-08-30.ts).'
    Write-IqvWarn 'These are NOT run automatically (data safety) - review backend\package.json "migrate:*" scripts and run the relevant one manually if it applies to this install.'
}

Confirm-IqvRootEnv
$EnvVars = Import-IqvRootEnv
$BackendPort = [int]$EnvVars['IQV_BACKEND_PORT']
$FrontendPort = [int]$EnvVars['IQV_FRONTEND_PORT']

$Ok = $true

if ($Mode -eq 'docker') {
    if (-not (Test-IqvDockerAvailable)) {
        Stop-IqvScript 'This install was recorded as Docker-based, but Docker is not available now.'
    }

    if ($BackendDockerChanged -or $DashboardDockerChanged -or $ComposeChanged -or $BackendDepsChanged -or $DashboardDepsChanged -or $BackendChanged -or $DashboardChanged) {
        Write-IqvInfo 'Rebuilding production images...'
        & docker compose -f $IqvComposeProd --env-file (Join-Path $RepoRoot '.env') build
        if ($LASTEXITCODE -ne 0) { Stop-IqvScript 'docker compose build failed.' }
    } else {
        Write-IqvInfo 'No backend/dashboard/Docker changes detected - skipping image rebuild.'
    }

    Write-IqvInfo 'Recreating containers (only what changed)...'
    & docker compose -f $IqvComposeProd --env-file (Join-Path $RepoRoot '.env') up -d
    if ($LASTEXITCODE -ne 0) { Stop-IqvScript 'docker compose up failed.' }

    if (-not (Wait-IqvHttpOk -Url "http://127.0.0.1:$BackendPort/health" -Label 'Backend' -Attempts 40 -SleepSeconds 3)) { $Ok = $false }
    if (-not (Wait-IqvHttpOk -Url "http://127.0.0.1:$FrontendPort/" -Label 'Frontend' -Attempts 40 -SleepSeconds 3)) { $Ok = $false }
    Write-IqvCheck 'Docker ......... OK'
} else {
    $Pm2 = Get-IqvPm2Command
    if (-not $Pm2) {
        Stop-IqvScript 'This install was recorded as native, but PM2 is not on PATH.'
    }

    if ($BackendDepsChanged) {
        Write-IqvInfo 'Backend dependencies changed - running npm ci...'
        Push-Location (Join-Path $RepoRoot 'backend')
        try { & npm ci; if ($LASTEXITCODE -ne 0) { Stop-IqvScript 'backend npm ci failed.' } } finally { Pop-Location }
    }
    if ($BackendChanged) {
        Write-IqvInfo 'Rebuilding backend...'
        Push-Location (Join-Path $RepoRoot 'backend')
        try { & npm run build; if ($LASTEXITCODE -ne 0) { Stop-IqvScript 'backend build failed.' } } finally { Pop-Location }
    } else {
        Write-IqvInfo 'No backend changes detected - skipping backend rebuild.'
    }

    if ($DashboardDepsChanged) {
        Write-IqvInfo 'Dashboard dependencies changed - running pnpm install --frozen-lockfile...'
        & corepack enable *> $null
        Push-Location (Join-Path $RepoRoot 'dashboard')
        try {
            & corepack prepare pnpm@9.15.9 --activate
            if ($LASTEXITCODE -ne 0) { Stop-IqvScript 'corepack prepare pnpm failed.' }
            & pnpm install --frozen-lockfile
            if ($LASTEXITCODE -ne 0) { Stop-IqvScript 'dashboard pnpm install failed.' }
        } finally { Pop-Location }
    }
    if ($DashboardChanged) {
        Write-IqvInfo 'Rebuilding dashboard...'
        Push-Location (Join-Path $RepoRoot 'dashboard')
        try { & pnpm run build; if ($LASTEXITCODE -ne 0) { Stop-IqvScript 'dashboard build failed.' } } finally { Pop-Location }
    } else {
        Write-IqvInfo 'No dashboard changes detected - skipping dashboard rebuild.'
    }

    $env:IQV_FRONTEND_PORT = [string]$FrontendPort
    Write-IqvInfo 'Restarting IQV Dictionary under PM2...'
    & pm2 startOrReload $IqvEcosystem --update-env
    if ($LASTEXITCODE -ne 0) {
        & pm2 restart $IqvEcosystem
        if ($LASTEXITCODE -ne 0) { Stop-IqvScript 'pm2 restart failed.' }
    }
    & pm2 save

    if (-not (Wait-IqvHttpOk -Url "http://127.0.0.1:$BackendPort/health" -Label 'Backend' -Attempts 30 -SleepSeconds 2)) { $Ok = $false }
    if (-not (Wait-IqvHttpOk -Url "http://127.0.0.1:$FrontendPort/" -Label 'Frontend' -Attempts 30 -SleepSeconds 2)) { $Ok = $false }
}

Set-IqvState -Mode $Mode -BackendPort $BackendPort -FrontendPort $FrontendPort

if (-not $Ok) {
    Stop-IqvScript "IQV Dictionary was updated to $NewVersion but one or more services failed their post-update healthcheck. Check logs."
}

Write-IqvCheck 'Health .......... OK'
Write-Host '============================================================'
Write-Host '[OK] IQV Dictionary updated successfully.'
Write-Host "Version: $NewVersion"
Write-Host '============================================================'
