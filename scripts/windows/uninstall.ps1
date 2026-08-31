<#
.SYNOPSIS
    IQV Dictionary - Windows UNINSTALL.
.EXAMPLE
    .\scripts\windows\uninstall.ps1
.EXAMPLE
    .\scripts\windows\uninstall.ps1 -Purge
.EXAMPLE
    .\scripts\windows\uninstall.ps1 -Purge -RemoveSource
.EXAMPLE
    .\scripts\windows\uninstall.ps1 -PurgeData
.NOTES
    MongoDB is never containerized or managed by this installer (see
    docker-compose.prod.yml) - no uninstall path here ever deletes
    database data. -PurgeData exists to document that explicitly and is
    a safe no-op beyond printing what was (not) done.
#>
[CmdletBinding()]
param(
    [switch]$Purge,
    [switch]$PurgeData,
    [switch]$RemoveSource,
    [switch]$Yes
)

$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'lib.psm1') -Force

$RepoRoot = Get-IqvRepoRoot
Set-Location $RepoRoot

Write-Host '============================================================'
Write-Host ' IQV Dictionary - Uninstall'
Write-Host '============================================================'

$Mode = Get-IqvInstalledMode
if (-not $Mode) {
    Write-IqvWarn 'Could not detect an existing IQV Dictionary installation (no state file, no running containers/PM2 processes).'
    Write-IqvWarn 'Proceeding with best-effort cleanup of both Docker and native artifacts.'
    $Mode = 'both'
}
Write-IqvInfo "Detected installation mode: $Mode"

if ($Mode -eq 'docker' -or $Mode -eq 'both') {
    if (Test-IqvDockerAvailable) {
        Write-IqvInfo 'Stopping and removing containers (docker compose down)...'
        & docker compose -f (Join-Path $RepoRoot 'docker-compose.prod.yml') down --remove-orphans 2>$null
        Write-IqvOk 'Docker containers stopped/removed.'

        if ($Purge) {
            Write-IqvInfo 'Removing IQV Dictionary production images (-Purge)...'
            & docker rmi iqv-dictionary-backend:prod iqv-dictionary-frontend:prod *> $null
            Write-IqvOk 'Docker images removed.'
        }
    } else {
        Write-IqvWarn 'Docker not available on this machine - skipping container cleanup.'
    }
}

if ($Mode -eq 'native' -or $Mode -eq 'both') {
    $Pm2 = Get-IqvPm2Command
    if ($Pm2) {
        Write-IqvInfo 'Stopping and removing PM2 processes...'
        & pm2 delete iqv-dictionary-backend iqv-dictionary-frontend *> $null
        & pm2 save --force *> $null
        Write-IqvOk 'PM2 processes removed.'

        if (Test-IqvCommand 'pm2-startup') {
            Write-IqvInfo 'De-registering PM2 from sign-in startup...'
            & pm2-startup uninstall *> $null
            if ($LASTEXITCODE -ne 0) {
                Write-IqvWarn 'pm2-startup uninstall did not complete cleanly (non-fatal).'
            }
        }
    } else {
        Write-IqvWarn 'PM2 not found - skipping native service cleanup.'
    }
}

$StateFile = Join-Path $RepoRoot '.iqv-install\state.json'
if (Test-Path $StateFile) { Remove-Item $StateFile -Force }

if ($PurgeData) {
    Write-IqvInfo '-PurgeData requested: IQV Dictionary does not manage a MongoDB container or volume (see docker-compose.prod.yml) - your MongoDB data was NOT touched by this uninstall.'
}

if ($Purge) {
    Write-IqvInfo 'Purging generated build artifacts and env files...'
    $paths = @(
        (Join-Path $RepoRoot 'backend\node_modules'),
        (Join-Path $RepoRoot 'backend\dist'),
        (Join-Path $RepoRoot 'dashboard\node_modules'),
        (Join-Path $RepoRoot 'dashboard\dist'),
        (Join-Path $RepoRoot 'backend\.env'),
        (Join-Path $RepoRoot 'dashboard\.env'),
        (Join-Path $RepoRoot '.env'),
        (Join-Path $RepoRoot '.iqv-install')
    )
    foreach ($p in $paths) {
        if (Test-Path $p) { Remove-Item $p -Recurse -Force }
    }
    Write-IqvOk 'Build artifacts, generated .env files, and install state removed.'

    if ($RemoveSource) {
        if (-not $Yes) {
            $confirm = Read-Host "This will permanently delete the ENTIRE repository at '$RepoRoot'. Type 'yes' to confirm"
            if ($confirm -ne 'yes') {
                Stop-IqvScript 'Aborted - repository was NOT deleted.'
            }
        }
        Write-IqvWarn 'Scheduling repository removal (cannot delete this running script''s own directory synchronously)...'

        $cleanupScript = Join-Path $env:TEMP ('iqv-dictionary-cleanup-' + [guid]::NewGuid().ToString('N') + '.ps1')
        $cleanupBody = @"
Start-Sleep -Seconds 2
Remove-Item -LiteralPath '$RepoRoot' -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath '$cleanupScript' -Force -ErrorAction SilentlyContinue
"@
        Set-Content -Path $cleanupScript -Value $cleanupBody -Encoding UTF8

        Start-Process -FilePath 'powershell.exe' `
            -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', $cleanupScript) `
            -WindowStyle Hidden

        Write-Host '============================================================'
        Write-Host '[OK] IQV Dictionary services removed. Repository deletion has'
        Write-Host '     been scheduled and will complete in the background.'
        Write-Host '============================================================'
        exit 0
    }
}

Write-Host '============================================================'
Write-Host '[OK] IQV Dictionary uninstalled successfully.'
if ($Purge) {
    Write-Host '     Build artifacts and generated .env files were purged.'
} else {
    Write-Host '     Source code, node_modules, dist, and .env files were left'
    Write-Host '     in place (pass -Purge to remove them too).'
}
Write-Host '============================================================'
