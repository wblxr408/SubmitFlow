# SubmitFlow System Environment Check Script
# Verifies if development environment meets all requirements

param(
    [switch]$Verbose
)

$ErrorActionPreference = "Continue"
$script:AllPassed = $true

# Get project root (parent of scripts folder)
$projectRoot = Split-Path $PSScriptRoot
if (-not $projectRoot) {
    $projectRoot = "."
}

# Color definitions
function Write-Step {
    param([string]$Message)
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host " $Message" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
    $script:AllPassed = $false
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
    $script:AllPassed = $false
}

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Gray
}

# ============================================
# 1. Check Node.js
# ============================================
Write-Step "Checking Node.js"

try {
    $nodeVersion = node --version 2>$null
    if ($nodeVersion) {
        Write-Success "Node.js installed: $nodeVersion"
        $majorVersion = [int]($nodeVersion -replace 'v(\d+)\..+', '$1')
        if ($majorVersion -ge 18) {
            Write-Success "Node.js version OK (>= 18.0.0)"
        } else {
            Write-Error "Node.js version too low. Required: >= 18.0.0, Current: $nodeVersion"
        }
    } else {
        Write-Error "Node.js not installed"
    }
} catch {
    Write-Error "Node.js not installed or PATH not configured"
}

# ============================================
# 2. Check pnpm
# ============================================
Write-Step "Checking pnpm"

try {
    $pnpmVersion = pnpm --version 2>$null
    if ($pnpmVersion) {
        Write-Success "pnpm installed: $pnpmVersion"
    } else {
        Write-Error "pnpm not installed"
        Write-Info "Install: npm install -g pnpm"
    }
} catch {
    Write-Error "pnpm not installed"
}

# ============================================
# 3. Check PostgreSQL
# ============================================
Write-Step "Checking PostgreSQL"

$pgInstalled = $false
$pgRunning = $false

# Check psql
try {
    $psqlVersion = psql --version 2>$null
    if ($psqlVersion) {
        Write-Success "psql client installed: $psqlVersion"
        $pgInstalled = $true
    }
} catch {
    Write-Warning "psql client not installed"
}

# Check Docker PostgreSQL
try {
    $dockerPg = docker ps --filter "ancestor=postgres:16-alpine" --format "{{.Names}}" 2>$null
    if ($dockerPg) {
        Write-Success "PostgreSQL container running: $dockerPg"
        $pgRunning = $true
    }
} catch {
    # Docker check failed, ignore
}

# Check service status (Windows)
try {
    $pgService = Get-Service -Name "*postgres*" -ErrorAction SilentlyContinue
    if ($pgService) {
        foreach ($svc in $pgService) {
            if ($svc.Status -eq 'Running') {
                Write-Success "PostgreSQL service running: $($svc.Name)"
                $pgRunning = $true
            } else {
                Write-Warning "PostgreSQL service not running: $($svc.Name)"
            }
        }
    }
} catch {
    # Service check failed, ignore
}

if (-not $pgInstalled -and -not $pgRunning) {
    Write-Warning "PostgreSQL not installed and no Docker container running"
    Write-Info "Options:"
    Write-Info "  1. Docker: docker run -d --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16-alpine"
    Write-Info "  2. Direct install: https://www.postgresql.org/download/windows/"
}

# ============================================
# 4. Check Docker
# ============================================
Write-Step "Checking Docker"

try {
    $dockerVersion = docker --version 2>$null
    if ($dockerVersion) {
        Write-Success "Docker installed: $dockerVersion"

        # Check Docker daemon
        docker info 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Docker daemon is running"
        } else {
            Write-Warning "Docker daemon not running. Please start Docker Desktop"
        }
    } else {
        Write-Warning "Docker not installed"
    }
} catch {
    Write-Warning "Docker not installed or not running"
}

# ============================================
# 5. Check Port Usage
# ============================================
Write-Step "Checking Port Usage"

$ports = @(3208, 5432, 6379)
foreach ($port in $ports) {
    $connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connection) {
        Write-Warning "Port $port is in use"
        foreach ($conn in $connection) {
            $process = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
            if ($process) {
                Write-Info "  PID $($conn.OwningProcess): $($process.ProcessName)"
            }
        }
    } else {
        Write-Success "Port $port is available"
    }
}

# ============================================
# 6. Check Project Files
# ============================================
Write-Step "Checking Project Files"

Write-Info "Project root: $projectRoot"
$requiredFiles = @(
    "package.json",
    ".env.example",
    "docker-compose.yml",
    "src/db/schema.sql"
)

foreach ($file in $requiredFiles) {
    $filePath = Join-Path $projectRoot $file
    if (Test-Path $filePath) {
        Write-Success "Found: $file"
    } else {
        Write-Error "Missing: $file"
    }
}

# Check node_modules
$nodeModulesPath = Join-Path $projectRoot "node_modules"
if (Test-Path $nodeModulesPath) {
    Write-Success "node_modules installed"
} else {
    Write-Warning "node_modules not installed. Run pnpm install"
}

# ============================================
# 7. Check Environment Variables
# ============================================
Write-Step "Checking Environment Variables"

$envFiles = @(".env.local", ".env")
foreach ($envFile in $envFiles) {
    $envPath = Join-Path $projectRoot $envFile
    if (Test-Path $envPath) {
        Write-Success "Found: $envFile"
    } else {
        Write-Warning "Missing: $envFile (copy from .env.example)"
    }
}

# ============================================
# 8. Check Network Connection
# ============================================
Write-Step "Checking Network Connection"

$testUrls = @(
    @{ Name = "npm registry"; Url = "https://registry.npmjs.org" },
    @{ Name = "PostgreSQL"; Url = "https://hub.docker.com/_/postgres" }
)

foreach ($test in $testUrls) {
    try {
        $response = Invoke-WebRequest -Uri $test.Url -Method Head -TimeoutSec 5 -UseBasicParsing -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Write-Success "$($test.Name) connection OK"
        }
    } catch {
        Write-Warning "$($test.Name) connection failed"
    }
}

# ============================================
# Summary
# ============================================
Write-Step "Check Complete"

if ($script:AllPassed) {
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host " All checks passed! Ready to run startup script." -ForegroundColor Green
    Write-Host "========================================`n" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n========================================" -ForegroundColor Yellow
    Write-Host " Some checks failed. Please fix the issues above." -ForegroundColor Yellow
    Write-Host "========================================`n" -ForegroundColor Yellow
    exit 1
}
