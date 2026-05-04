# SubmitFlow Development Environment Quick Start Script
# Auto-complete: Environment Check -> Dependencies -> Database -> Start Services

param(
    [switch]$SkipCheck,        # Skip system check
    [switch]$SkipInstall,      # Skip dependency installation
    [switch]$DockerDb,         # Use Docker for PostgreSQL
    [switch]$ResetDb,          # Reset database
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"
# Get project root (parent of scripts folder)
$projectRoot = Split-Path $PSScriptRoot
if (-not $projectRoot) {
    $projectRoot = "."
}
$script:Success = $true

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
}

function Write-Err {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
    $script:Success = $false
}

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Gray
}

function Run-Command {
    param(
        [string]$Command,
        [string]$Description,
        [int]$Timeout = 300
    )
    Write-Info "Executing: $Description"
    if ($Verbose) { Write-Host "  Command: $Command" -ForegroundColor DarkGray }

    try {
        $result = Invoke-Expression $Command 2>&1
        if ($LASTEXITCODE -eq 0 -or $LASTEXITCODE -eq $null) {
            if ($Verbose -and $result) {
                Write-Host ($result | Out-String) -ForegroundColor DarkGray
            }
            return $true
        } else {
            Write-Err "$Description failed (Exit: $LASTEXITCODE)"
            if ($result) {
                Write-Host ($result | Out-String) -ForegroundColor Red
            }
            return $false
        }
    } catch {
        Write-Err "$Description failed: $_"
        return $false
    }
}

# ============================================
# 0. Setup
# ============================================
Write-Host @"

 ____  __  __        ____             __ _
|  _ \ \ \/ / ____  / ___| _ __  _   _| || |
| | | | \  / |_  /  \___ \| '_ \| | | | || |_
| |_| | /  \  / /     ___) | |_) | |_| |__  _|
|____/ /_/\_\/_/    |____/| .__/ \__, |  |_|
                         |_|    |___/         v1.0.0

  SubmitFlow - Job Application Tracker for CS/AI Students

"@ -ForegroundColor Magenta

# Load environment variables from .env file (supports .env.local and .env)
function Load-EnvFile {
    param([string]$Path)
    if (Test-Path $Path) {
        $lines = Get-Content $Path
        foreach ($line in $lines) {
            if ($line -match '^\s*#' -or $line -match '^\s*$') { continue }
            if ($line -match '^([^=]+)=(.*)$') {
                $key = $matches[1].Trim()
                $value = $matches[2].Trim()
                [Environment]::SetEnvironmentVariable($key, $value)
                Set-Item -Path "env:$key" -Value $value -ErrorAction SilentlyContinue
            }
        }
    }
}

# Change to script directory and load env (prefer .env.local for development)
Set-Location $projectRoot
$envFile = if (Test-Path "$projectRoot\.env.local") { "$projectRoot\.env.local" } else { "$projectRoot\.env" }
Load-EnvFile $envFile

# ============================================
# 1. System Check
# ============================================
if (-not $SkipCheck) {
    Write-Step "Step 1: System Environment Check"

    # Check Node.js
    try {
        $nodeVersion = node --version
        Write-Success "Node.js: $nodeVersion"
    } catch {
        Write-Err "Node.js not installed. Please install Node.js >= 18.0.0"
        exit 1
    }

    # Check pnpm
    try {
        $pnpmVersion = npx pnpm --version
        Write-Success "pnpm: $pnpmVersion"
    } catch {
        Write-Err "pnpm not installed. Installing..."
        npm install -g pnpm
        if ($LASTEXITCODE -ne 0) {
            Write-Err "pnpm installation failed"
            exit 1
        }
        Write-Success "pnpm installed successfully"
    }

    Write-Success "System check passed"
} else {
    Write-Info "Skipping system check"
}

# ============================================
# 2. Install Dependencies
# ============================================
if (-not $SkipInstall) {
    Write-Step "Step 2: Installing Project Dependencies"

    if (-not (Test-Path "node_modules")) {
        if (-not (Run-Command "npx pnpm install" "Install dependencies")) {
            Write-Err "Dependency installation failed"
            exit 1
        }
        Write-Success "Dependencies installed"
    } else {
        Write-Info "node_modules already exists, skipping installation"
    }
} else {
    Write-Info "Skipping dependency installation"
}

# ============================================
# 3. Configure Environment Variables
# ============================================
Write-Step "Step 3: Configure Environment Variables"

# Environment file configuration (prefer .env.local for development)
$envFile = if (Test-Path "$projectRoot\.env.local") { ".env.local" } elseif (Test-Path "$projectRoot\.env") { ".env" } else { $null }
$envExampleFile = ".env.example"

if (-not $envFile) {
    if (Test-Path $envExampleFile) {
        Write-Info "Creating .env.local from .env.example"
        Copy-Item $envExampleFile ".env.local"
        $envFile = ".env.local"

        # Auto-generate ENCRYPTION_KEY
        try {
            $encryptionKey = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
            $content = Get-Content $envFile -Raw
            $content = $content -replace 'ENCRYPTION_KEY=', "ENCRYPTION_KEY=$encryptionKey"
            Set-Content -Path $envFile -Value $content
            Write-Success "ENCRYPTION_KEY auto-generated"
        } catch {
            Write-Warning "Failed to auto-generate ENCRYPTION_KEY, please fill in manually"
        }

        # Auto-generate JWT_SECRET (v1.3)
        try {
            $jwtSecret = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
            $envContent = Get-Content $envFile -Raw
            if ($envContent -notmatch 'JWT_SECRET=') {
                Add-Content -Path $envFile -Value "JWT_SECRET=$jwtSecret"
                Write-Success "JWT_SECRET auto-generated (v1.3)"
            }
        } catch {
            Write-Warning "Failed to auto-generate JWT_SECRET"
        }

        Write-Warning "Please edit .env.local file for database configuration"
        Write-Info "Default DATABASE_URL: postgresql://postgres:postgres@localhost:5432/submitflow"
    } else {
        Write-Err ".env.example file does not exist"
        exit 1
    }
} else {
    Write-Info ".env file already exists"
}

# ============================================
# 4. Database Setup
# ============================================
Write-Step "Step 4: Prepare Database"

# Read DATABASE_URL
$dbUrl = $null
if (Test-Path $envFile) {
    $envContent = Get-Content $envFile -Raw
    if ($envContent -match 'DATABASE_URL=(.+)') {
        $dbUrl = $matches[1].Trim()
    }
}

# Check if using Docker
if ($DockerDb) {
    Write-Info "Using Docker for PostgreSQL..."

    # Check Docker
    try {
        docker info 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Err "Docker not running. Please start Docker Desktop"
            exit 1
        }
    } catch {
        Write-Err "Docker not available"
        exit 1
    }

    # Check if container already exists (docker-compose or manual)
    $existingContainer = docker ps -a --filter "name=submitflow-postgres" --format "{{.Names}}" 2>$null | Select-Object -First 1
    if (-not $existingContainer) {
        $existingContainer = docker ps -a --filter "name=submitflow-db" --format "{{.Names}}" 2>$null | Select-Object -First 1
    }

    if ($existingContainer) {
        Write-Info "Found existing PostgreSQL container: $existingContainer"
        if ($ResetDb) {
            Write-Info "Resetting database..."
            docker stop $existingContainer 2>$null
            docker rm $existingContainer 2>$null
        } else {
            # Start existing container (suppress container name output)
            docker start $existingContainer 2>$null | Out-Null
            Write-Success "PostgreSQL container started"
        }
    }

    if (-not $existingContainer -or $ResetDb) {
        # Create and start new container
        Write-Info "Creating PostgreSQL Docker container..."
        docker run -d `
            --name submitflow-postgres `
            -e POSTGRES_USER=postgres `
            -e POSTGRES_PASSWORD=postgres `
            -e POSTGRES_DB=submitflow `
            -p 5432:5432 `
            -v submitflow-postgres-data:/var/lib/postgresql/data `
            postgres:16-alpine

        if ($LASTEXITCODE -ne 0) {
            Write-Err "PostgreSQL container creation failed"
            exit 1
        }

        Write-Success "PostgreSQL Docker container created"

        # Wait for database to be ready
        Write-Info "Waiting for database to be ready..."
        $maxRetries = 30
        for ($i = 1; $i -le $maxRetries; $i++) {
            Start-Sleep -Seconds 2
            try {
                docker exec $containerName pg_isready -U postgres -q
                if ($LASTEXITCODE -eq 0) {
                    Write-Success "Database is ready (waited ${i}x2 seconds)"
                    break
                }
            } catch { }
        }
    }

    # Update DATABASE_URL
    if ($dbUrl -ne "postgresql://postgres:postgres@localhost:5432/submitflow") {
        $envContent = Get-Content $envFile -Raw
        $envContent = $envContent -replace 'DATABASE_URL=.*', 'DATABASE_URL=postgresql://postgres:postgres@localhost:5432/submitflow'
        Set-Content -Path $envFile -Value $envContent
        Write-Info "DATABASE_URL updated"
    }

} else {
    # Local PostgreSQL check
    Write-Info "Checking local PostgreSQL..."

    $pgAvailable = $false

    # Check service
    try {
        $pgService = Get-Service -Name "*postgres*" -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'Running' }
        if ($pgService) {
            Write-Success "PostgreSQL service is running"
            $pgAvailable = $true
        }
    } catch { }

    # Check Docker container
    try {
        $dockerPg = docker ps --filter "ancestor=postgres:16-alpine" --format "{{.Names}}" 2>$null
        if ($dockerPg) {
            Write-Success "PostgreSQL Docker container is running: $dockerPg"
            $pgAvailable = $true
        }
    } catch { }

    # Check port
    try {
        $pgPort = Get-NetTCPConnection -LocalPort 5432 -ErrorAction SilentlyContinue
        if ($pgPort) {
            Write-Success "Port 5432 is in use (possibly PostgreSQL)"
            $pgAvailable = $true
        }
    } catch { }

    if (-not $pgAvailable) {
        Write-Warning "PostgreSQL not detected"
        Write-Info "Please choose one of the following:"
        Write-Info "  1. Use Docker: retry with -DockerDb parameter"
        Write-Info "  2. Install PostgreSQL: https://www.postgresql.org/download/windows/"
        Write-Info "  3. Use existing database, make sure .env.local DATABASE_URL is correct"

        $continue = Read-Host "Continue starting anyway? (y/N)"
        if ($continue -ne 'y') {
            exit 1
        }
    }
}

# ============================================
# 5. Run Database Migration
# ============================================
Write-Step "Step 5: Run Database Migration"

if ($ResetDb) {
    Write-Warning "Reset mode: This will delete all database objects!"
    $confirm = Read-Host "Enter 'YES' to confirm deletion of all database objects"
    if ($confirm -ne 'YES') {
        Write-Info "Reset cancelled"
    } else {
        Write-Info "Database reset confirmed - will recreate on next steps"
    }
}

# Check if schema.sql exists
if (-not (Test-Path "src\db\schema.sql")) {
    Write-Err "src\db\schema.sql does not exist"
    exit 1
}

# Check for migrate script
$containerName = "submitflow-postgres"
$containerExists = docker ps -a --filter "name=submitflow-postgres" --format "{{.Names}}" 2>$null
if (-not $containerExists) {
    $containerName = (docker ps -a --filter "name=submitflow-db" --format "{{.Names}}" 2>$null).Split("`n")[0]
    $containerExists = ![string]::IsNullOrEmpty($containerName)
}

# Try npm run db:migrate first
if (Test-Path "package.json") {
    Write-Info "Running npm run db:migrate..."
    $migrateResult = npx pnpm run db:migrate 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Database migration completed"
    } else {
        Write-Warning "npm run db:migrate failed"
        if ($Verbose) {
            Write-Host $migrateResult -ForegroundColor Red
        }

        # Fallback: execute SQL directly via Docker
        if ($containerExists) {
            Write-Info "Executing SQL via Docker..."
            $sqlFiles = @(
                "src\db\schema.sql",
                "src\db\seed.sql"
            )

            # Add migration files
            $migrationFiles = Get-ChildItem "src\db\migrations" -Filter "*.sql" | Sort-Object Name
            foreach ($file in $migrationFiles) {
                $sqlFiles += $file.FullName
            }

            # Execute each file
            foreach ($sqlFile in $sqlFiles) {
                if (Test-Path $sqlFile) {
                    Write-Info "Executing: $sqlFile"
                    $content = Get-Content $sqlFile -Raw
                    $content | docker exec -i $containerName psql -U postgres -d submitflow 2>$null
                    if ($LASTEXITCODE -eq 0) {
                        Write-Success "Applied: $sqlFile"
                    }
                }
            }

            # Execute companies-extended.sql
            if (Test-Path "src\db\companies-extended.sql") {
                Write-Info "Executing: companies-extended.sql"
                $content = Get-Content "src\db\companies-extended.sql" -Raw
                $content | docker exec -i $containerName psql -U postgres -d submitflow 2>$null
            }
        } else {
            Write-Warning "No Docker container found and npm migrate failed."
            Write-Info "Please run the migration manually:"
            Write-Info "  1. Make sure PostgreSQL is running"
            Write-Info "  2. Run: npx pnpm run db:migrate"
        }
    }
} else {
    Write-Warning "package.json not found, skipping npm migration"
}

# ============================================
# 6. Start Services
# ============================================
Write-Step "Step 6: Start Development Server"

Write-Host "About to start the following services:" -ForegroundColor White
Write-Host "  - Next.js dev server (http://localhost:3208)" -ForegroundColor Gray
Write-Host "  - Worker process (background)" -ForegroundColor Gray
Write-Host ""

# Start Next.js
Write-Info "Starting Next.js..."
$devJob = Start-Job -ScriptBlock {
        Set-Location $using:projectRoot
        npx pnpm run dev
    }

# Wait for server to start
Write-Info "Waiting for server to start (5 seconds)..."
Start-Sleep -Seconds 5

# Check status
$jobOutput = Receive-Job -Job $devJob
if ($jobOutput -match "Ready" -or $jobOutput -match "started server" -or $jobOutput -match "3208") {
    Write-Success "Server started: http://localhost:3208"
    
    # Auto-open browser
    Write-Info "Opening browser..."
    Start-Process "http://localhost:3208"
} else {
    Write-Info "Checking server status..."
}

# ============================================
# Completion
# ============================================
Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  Startup Complete!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green

Write-Host "Access URL: http://localhost:3208" -ForegroundColor White
Write-Host "API URL: http://localhost:3208/api" -ForegroundColor Gray
Write-Host ""

if (-not $script:Success) {
    Write-Warning "Some steps may not have completed successfully. Please check the output above."
}

# Keep running hint
Write-Host "Press Ctrl+C to stop services, or close this window" -ForegroundColor DarkGray
Write-Host ""

# Wait for user interrupt
try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
} finally {
    Write-Info "Stopping services..."
    Stop-Job -Job $devJob -ErrorAction SilentlyContinue
    Remove-Job -Job $devJob -ErrorAction SilentlyContinue
}
