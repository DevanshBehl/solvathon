# =====================================================
#  HMS.SYS v3.0 — Full Stack Startup (Windows)
# =====================================================
#
#  Usage:  .\start.ps1
#  
#  Starts:
#    1. Next.js Dashboard  → http://localhost:3000
#    2. Media Server (WS)  → ws://localhost:4000
#    3. ML Inference        → http://localhost:8010
#    4. ML Bridge           → connects 8010 ↔ 4000
#
# =====================================================

Write-Host ""
Write-Host "╔═══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║          HMS.SYS v3.0 — Startup           ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Kill stale processes ──────────────────────
Write-Host "[1/5] Clearing ports 3000, 4000, 8010..." -ForegroundColor Yellow
$ports = @(3000, 4000, 8010)
foreach ($port in $ports) {
    Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique |
        Where-Object { $_ -ne 0 } |
        ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
}
Start-Sleep -Seconds 1

# ── Step 2: Clear .next build cache ──────────────────
Write-Host "[2/5] Clearing .next cache..." -ForegroundColor Yellow
$nextDir = Join-Path $PSScriptRoot "apps\web\.next"
if (Test-Path $nextDir) {
    Remove-Item -Path $nextDir -Recurse -Force -ErrorAction SilentlyContinue
}

# ── Step 3: Start Node.js services (web + media) ─────
Write-Host "[3/5] Starting Dashboard + Media Server..." -ForegroundColor Green
$nodeJob = Start-Job -ScriptBlock {
    Set-Location $using:PSScriptRoot
    npm run dev 2>&1
}

# ── Step 4: Start ML Inference (port 8010) ────────────
Write-Host "[4/5] Starting ML Inference Service..." -ForegroundColor Green
$mlDir = Join-Path $PSScriptRoot "apps\ml-inference"
if (Test-Path $mlDir) {
    $mlJob = Start-Job -ScriptBlock {
        Set-Location $using:mlDir
        python run.py 2>&1
    }
} else {
    Write-Host "  ⚠ apps/ml-inference not found — skipping ML service" -ForegroundColor DarkYellow
}

# ── Step 5: Start ML Bridge (after 5s delay) ──────────
Write-Host "[5/5] Starting ML Bridge (5s delay)..." -ForegroundColor Green
$bridgeDir = Join-Path $PSScriptRoot "apps\ml-bridge"
if (Test-Path (Join-Path $bridgeDir "bridge.py")) {
    $bridgeJob = Start-Job -ScriptBlock {
        Start-Sleep -Seconds 5
        Set-Location $using:bridgeDir
        python bridge.py 2>&1
    }
} else {
    Write-Host "  ⚠ apps/ml-bridge/bridge.py not found — skipping bridge" -ForegroundColor DarkYellow
}

# ── Print service table ──────────────────────────────
Write-Host ""
Write-Host "┌──────────────────────────────────────────────────┐" -ForegroundColor DarkGray
Write-Host "│  Service             │  URL                      │" -ForegroundColor DarkGray
Write-Host "│──────────────────────│───────────────────────────│" -ForegroundColor DarkGray
Write-Host "│  Dashboard           │  http://localhost:3000     │" -ForegroundColor White
Write-Host "│  Media Server        │  ws://localhost:4000       │" -ForegroundColor White
Write-Host "│  ML Inference        │  http://localhost:8010     │" -ForegroundColor White
Write-Host "│  ML Bridge           │  (internal relay)         │" -ForegroundColor White
Write-Host "│──────────────────────│───────────────────────────│" -ForegroundColor DarkGray
Write-Host "│  Login               │  admin@hostel.com         │" -ForegroundColor Magenta
Write-Host "│  Password            │  password123              │" -ForegroundColor Magenta
Write-Host "└──────────────────────────────────────────────────┘" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Press Ctrl+C to stop all services." -ForegroundColor DarkYellow
Write-Host ""

# ── Keep alive — stream Node.js output ────────────────
try {
    while ($true) {
        Receive-Job -Job $nodeJob -ErrorAction SilentlyContinue | Write-Host
        Start-Sleep -Seconds 2
    }
} finally {
    Write-Host "`nShutting down..." -ForegroundColor Red
    Stop-Job -Job $nodeJob -ErrorAction SilentlyContinue
    Remove-Job -Job $nodeJob -Force -ErrorAction SilentlyContinue
    if ($mlJob) { Stop-Job -Job $mlJob -ErrorAction SilentlyContinue; Remove-Job -Job $mlJob -Force -ErrorAction SilentlyContinue }
    if ($bridgeJob) { Stop-Job -Job $bridgeJob -ErrorAction SilentlyContinue; Remove-Job -Job $bridgeJob -Force -ErrorAction SilentlyContinue }
}
