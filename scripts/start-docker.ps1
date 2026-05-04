# SubmitFlow Docker Quick Start Script

param(
    [switch]$SkipBuild,    # Always skip image build
    [switch]$ResetData,    # Reset data volume
    [switch]$ForceBuild,   # Force rebuild without cache
    [switch]$Verbose,
    [switch]$Help
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path $PSScriptRoot
if (-not $projectRoot) { $projectRoot = "." }
$script:Success = $true

function Load-EnvFile {
    param([string]$Path)
    if (Test-Path $Path) {
        foreach ($line in Get-Content $Path) {
            if ($line -match '^\s*#' -or $line -match '^\s*$') { continue }
            if ($line -match '^([^=]+)=(.*)$') {
                $key = $matches[1].Trim()
                $value = $matches[2].Trim()
                Set-Item -Path "env:$key" -Value $value -ErrorAction SilentlyContinue
            }
        }
    }
}

Set-Location $projectRoot
$envFile = if (Test-Path "$projectRoot\.env.local") { "$projectRoot\.env.local" }
           elseif (Test-Path "$projectRoot\.env") { "$projectRoot\.env" }
           else { $null }
if ($envFile) { Load-EnvFile $envFile }

if ($Help) {
    Write-Host @"

 SubmitFlow Docker Startup Script

 Usage: .\start-docker.ps1 [options]

 Options:
   -SkipBuild     Always skip image build
   -ForceBuild    Force rebuild without cache
   -ResetData     Reset data volume (deletes all data)
   -Verbose       Show detailed output
   -Help          Show this help message

 Examples:
   .\start-docker.ps1               # Quick start (reuse images when available)
   .\start-docker.ps1 -ForceBuild   # Force full rebuild
   .\start-docker.ps1 -SkipBuild    # Skip build even if no image is found
   .\start-docker.ps1 -ResetData    # Reset all data

"@
    exit 0
}

function Write-Step    { param([string]$m); Write-Host "`n========================================`n $m`n========================================`n" -ForegroundColor Cyan }
function Write-Success { param([string]$m); Write-Host "[OK] $m" -ForegroundColor Green }
function Write-Warn    { param([string]$m); Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Write-Err     { param([string]$m); Write-Host "[ERROR] $m" -ForegroundColor Red; $script:Success = $false }
function Write-Info    { param([string]$m); Write-Host "[INFO] $m" -ForegroundColor Gray }

function Get-ComposeConfig {
    if ($script:ComposeConfig) {
        return $script:ComposeConfig
    }

    $previousErrorActionPreference = $ErrorActionPreference
    $previousNativePreference = $PSNativeCommandUseErrorActionPreference

    try {
        $ErrorActionPreference = "Continue"
        $PSNativeCommandUseErrorActionPreference = $false
        $configJson = docker compose config --format json 2>$null | Out-String
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($configJson.Trim())) {
            return $null
        }

        $script:ComposeConfig = $configJson | ConvertFrom-Json
        return $script:ComposeConfig
    } catch {
        return $null
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
        $PSNativeCommandUseErrorActionPreference = $previousNativePreference
    }
}

function Get-ComposeImageName {
    param([string]$Service)

    $config = Get-ComposeConfig
    if (-not $config -or -not $config.services) {
        return $null
    }

    $serviceProperty = $config.services.PSObject.Properties[$Service]
    if (-not $serviceProperty) { return $null }

    $serviceConfig = $serviceProperty.Value
    if ($serviceConfig.image) {
        return [string]$serviceConfig.image
    }

    if ([string]::IsNullOrWhiteSpace($config.name)) {
        return $null
    }

    return "$($config.name)-$Service"
}

function Test-DockerImageExists {
    param([string]$ImageName)

    $previousErrorActionPreference = $ErrorActionPreference
    $previousNativePreference = $PSNativeCommandUseErrorActionPreference

    try {
        $ErrorActionPreference = "Continue"
        $PSNativeCommandUseErrorActionPreference = $false
        docker image inspect $ImageName *> $null
        return ($LASTEXITCODE -eq 0)
    } catch {
        return $false
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
        $PSNativeCommandUseErrorActionPreference = $previousNativePreference
    }
}

function Test-ComposeImagesExist {
    param([string[]]$Services)

    foreach ($service in $Services) {
        $imageName = Get-ComposeImageName -Service $service
        if ([string]::IsNullOrWhiteSpace($imageName) -or -not (Test-DockerImageExists -ImageName $imageName)) {
            return $false
        }
    }

    return $true
}

function Run-Command {
    param([string]$Command, [string]$Description)
    Write-Info "Executing: $Description"
    if ($Verbose) { Write-Host "  Command: $Command" -ForegroundColor DarkGray }
    try {
        $result = Invoke-Expression $Command 2>&1
        $output = $result | Out-String
        if ($LASTEXITCODE -eq 0 -or $null -eq $LASTEXITCODE) {
            if ($Verbose -and $result) { Write-Host $output -ForegroundColor DarkGray }
            return $true
        } else {
            Write-Err "$Description failed (Exit: $LASTEXITCODE)"
            if ($result) { Write-Host $output -ForegroundColor Red }
            return $false
        }
    } catch {
        Write-Err "$Description failed: $_"
        return $false
    }
}

# ============================================
Write-Host @"

  ____  __  __       ____             __ _
 / ___||  \/  | ___ |  _ \ _   _  ___| || |
 \___ \| |\/| |/ _ \| | | | | | |/ _ \ || |_
  ___) | |  | |  __/| |_| | |_| |  __/__  _|
 |____/|_|  |_|\___||____/ \__, |\___|  |_|
                            |___/          Docker Mode

"@ -ForegroundColor Magenta

# ============================================
# 1. Check Docker
# ============================================
Write-Step "Step 1: Check Docker"

try {
    $dockerVersion = docker --version
    Write-Success "Docker installed: $dockerVersion"
} catch {
    Write-Err "Docker not installed. Please install Docker Desktop"
    Write-Info "Download: https://www.docker.com/products/docker-desktop"
    exit 1
}

try {
    $ErrorActionPreference = "SilentlyContinue"
    docker info 2>$null | Out-Null
    $daemonOk = ($LASTEXITCODE -eq 0)
    $ErrorActionPreference = "Stop"
    if ($daemonOk) {
        Write-Success "Docker daemon is running"
    } else {
        Write-Err "Docker daemon not running. Please start Docker Desktop"
        exit 1
    }
} catch {
    Write-Err "Docker daemon not running"
    exit 1
}

# ============================================
# 2. Check Configuration Files
# ============================================
Write-Step "Step 2: Check Configuration Files"

if (-not (Test-Path "docker-compose.yml")) {
    Write-Err "docker-compose.yml not found"
    exit 1
}
Write-Success "docker-compose.yml exists"

# ============================================
# 3. Configure Environment Variables
# ============================================
Write-Step "Step 3: Configure Environment Variables"

$envFilePath = if (Test-Path "$projectRoot\.env.local") { ".env.local" }
               elseif (Test-Path "$projectRoot\.env") { ".env" }
               else { $null }

if (-not $envFilePath) {
    if (Test-Path ".env.example") {
        Write-Info "Creating .env from .env.example"
        Copy-Item ".env.example" ".env"
        $envFilePath = ".env"
        try {
            $encKey = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
            $jwtKey  = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
            $content = Get-Content $envFilePath -Raw
            $content = $content -replace '(?m)^ENCRYPTION_KEY=$', "ENCRYPTION_KEY=$encKey"
            $content = $content -replace '(?m)^JWT_SECRET=$',      "JWT_SECRET=$jwtKey"
            Set-Content -Path $envFilePath -Value $content
            Write-Success "Generated ENCRYPTION_KEY and JWT_SECRET"
        } catch {
            Write-Warn "Failed to auto-generate keys — please fill them in manually in .env"
        }
    } else {
        Write-Err ".env.example not found"
        exit 1
    }
}
Write-Success ".env file ready ($envFilePath)"

# ============================================
# 4. Data Volume
# ============================================
if ($ResetData) {
    Write-Step "Step 4: Reset Data Volume"
    $confirm = Read-Host "This will delete ALL data. Type YES to confirm"
    if ($confirm -eq 'YES') {
        $ErrorActionPreference = "SilentlyContinue"
        docker compose down -v 2>$null | Out-Null
        docker volume rm submitflow_postgres_data 2>$null | Out-Null
        $ErrorActionPreference = "Stop"
        Write-Success "Data volumes reset"
    } else {
        Write-Info "Reset cancelled"
    }
} else {
    Write-Step "Step 4: Data Volume"
    Write-Info "Skipping data volume reset (use -ResetData to wipe)"
}

# ============================================
# 5. Build Image
# ============================================
$composeServices = @("app", "worker")
$imagesExist = Test-ComposeImagesExist -Services $composeServices

if ($ForceBuild) {
    Write-Step "Step 5: Build Docker Image"
    $buildStart = Get-Date
    Write-Info "Building images from scratch (--no-cache, this will take longer)..."
    Write-Host ""
    docker compose build --no-cache
    
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Image build failed"
        exit 1
    }
    
    $elapsed = (Get-Date) - $buildStart
    Write-Host ""
    Write-Success "Build completed in $($elapsed.ToString('mm\:ss'))"
} elseif ($SkipBuild) {
    Write-Step "Step 5: Skip Build"
    if (-not $imagesExist) {
        Write-Warn "No existing app/worker images were found. Startup may fail until you run -ForceBuild once."
    } else {
        Write-Info "Using existing images"
    }
} elseif (-not $imagesExist) {
    Write-Step "Step 5: Build Docker Image"
    $buildStart = Get-Date
    Write-Info "No existing app/worker images found. Building once with cache..."
    Write-Host ""
    docker compose build

    if ($LASTEXITCODE -ne 0) {
        Write-Err "Image build failed"
        exit 1
    }

    $elapsed = (Get-Date) - $buildStart
    Write-Host ""
    Write-Success "Build completed in $($elapsed.ToString('mm\:ss'))"
} else {
    Write-Step "Step 5: Reuse Docker Images"
    Write-Info "Found existing app/worker images. Skipping rebuild."
    Write-Info "Use -ForceBuild after code or dependency changes."
}

# ============================================
# 6. Start Services
# ============================================
Write-Step "Step 6: Start Services"

Write-Info "Ensuring services are up to date..."
docker compose up -d

if ($LASTEXITCODE -ne 0) {
    Write-Err "Failed to start services"
    exit 1
}

# Wait for app to be reachable (migrate runs inside app on startup)
Write-Info "Waiting for app to be ready (includes DB migration)..."
$ready = $false
for ($i = 1; $i -le 60; $i++) {
    Start-Sleep -Seconds 3
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:3208/api/health" -Method Get -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
        if ($r.StatusCode -eq 200) {
            $ready = $true
            break
        }
    } catch { }
    if ($i % 5 -eq 0) { Write-Info "Still waiting... ($($i * 3)s)" }
}

# ============================================
# 7. Result
# ============================================
Write-Step "Step 7: Done"

if ($ready) {
    Write-Success "Health check passed: http://localhost:3208/api/health"
} else {
    Write-Warn "App not responding yet — it may still be running migrations"
    Write-Info "Check logs: docker compose logs -f app"
}

Write-Host ""
docker compose ps
Write-Host ""
Write-Host "Access URL : http://localhost:3208" -ForegroundColor White
Write-Host "Logs       : docker compose logs -f" -ForegroundColor Gray
Write-Host "Restart    : docker compose restart" -ForegroundColor Gray
Write-Host "Stop       : docker compose down" -ForegroundColor Gray
Write-Host "Rebuild    : .\\scripts\\start-docker.ps1 -ForceBuild" -ForegroundColor Gray
Write-Host ""

Write-Info "Opening browser..."
Start-Process "http://localhost:3208"

if (-not $script:Success) {
    Write-Warn "Some steps had issues. Run: docker compose logs -f"
}
