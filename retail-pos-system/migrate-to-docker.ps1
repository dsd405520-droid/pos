# ຍ້າຍການຮັນຈິງໄປໃສ່ Docker ຢ່າງປອດໄພ
# ຂັ້ນຕອນ: dump ຂໍ້ມູນກ່ອນ -> ຢຸດ node ທີ່ຮັນ 5001 ໃນ Windows -> down ເກົ່າ -> up ໃໝ່
#          -> ກັງ restore ຂໍ້ມູນເຂົ້າ container -> ກວດສອບ (login + ຈຳນວນຂໍ້ມູນ)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Log($m) { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $m" -ForegroundColor Cyan }
function Fail($m) { Write-Host "EXIT: $m" -ForegroundColor Red; exit 1 }

# ---- 1. Pre-flight ----
Log '1) Preflight docker...'
docker version --format '{{.Server.Version}}' | Out-Null
if ($LASTEXITCODE -ne 0) { Fail 'Docker daemon ບໍ່ຮັນ' }

if (-not (Test-Path '.env')) { Fail 'ບໍ່ພົບ .env ຢູ່ root (JWT_SECRET) ກະລຸນາສ້າງກ່ອນ' }

# ---- 2. Dump ----
$ts = Get-Date -Format 'yyyyMMdd_HHmmss'
$dumpDir = "backend\backups\migration-$ts"
New-Item -ItemType Directory -Path $dumpDir -Force | Out-Null
Log "2) Dump ຂໍ້ມູນປັດຈຸບັນ -> $dumpDir"
$env:OUT_DIR = (Join-Path $root $dumpDir)
node backend/migrate-dump.js
if ($LASTEXITCODE -ne 0) { Fail 'Dump ບໍ່ສຳເລັດ' }
Remove-Item Env:OUT_DIR -ErrorAction SilentlyContinue

$info = Get-Content (Join-Path $dumpDir 'dump-info.json') | ConvertFrom-Json
$names = ($info.collections | ForEach-Object { "$($_.name)=$($_.count)" }) -join ', '
Log "   Dumped: $names"

# ---- 3. Stop local node server on 5001 ----
Log '3) ຢຸດ node server ທີ່ຮັນ port 5001 ໃນ Windows...'
$conns = Get-NetTCPConnection -State Listen -LocalPort 5001 -ErrorAction SilentlyContinue
foreach ($c in $conns) {
  $procId = $c.OwningProcess
  $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
  if ($p -and $p.ProcessName -match 'node') {
    Log "   Stop PID $procId (node)"
    Stop-Process -Id $procId -Force
  }
}

# ---- 4. Recreate containers ----
Log '4) docker compose down + up -d --build...'
docker compose down
if ($LASTEXITCODE -ne 0) { Fail 'docker compose down ບໍ່ສຳເລັດ' }
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { Fail 'docker compose up ບໍ່ສຳເລັດ' }

# ---- 5. Wait for health ----
Log '5) ລໍຖ້າ /api/health...'
$ok = $false
for ($i = 0; $i -lt 90; $i++) {
  try {
    $h = Invoke-RestMethod -Uri 'http://localhost:5001/api/health' -TimeoutSec 2
    if ($h.ok) { $ok = $true; break }
  } catch { }
  Start-Sleep -Seconds 2
}
if (-not $ok) {
  docker logs --tail 30 pos_backend 2>&1 | Out-String
  Fail 'Backend ຍັງບໍ່ healthy ຫຼັງ 3 ນາທີ'
}
Log '   Healthy!'

# ---- 6. Restore data into container ----
Log "6) ກັງ restore ຂໍ້ມູນເຂົ້າ container ($dumpDir -> pos_backend: /tmp/migration-restore)..."
docker cp (Join-Path $root $dumpDir) pos_backend:/tmp/migration-restore
if ($LASTEXITCODE -ne 0) { Fail 'docker cp dump ບໍ່ສຳເລັດ' }
docker cp (Join-Path $root 'backend/migrate-restore.js') pos_backend:/app/migrate-restore.js
docker exec -w /app pos_backend node migrate-restore.js
if ($LASTEXITCODE -ne 0) { Fail 'Restore ບໍ່ສຳເລັດ' }

# ---- 7. Verify ----
Log '7) ກວດສອບ...'
try {
  $login = Invoke-RestMethod -Uri 'http://localhost:5001/api/auth/login' -Method Post -ContentType 'application/json' -Body '{"username":"admin","pin":"123456"}'
  $h = @{ Authorization = "Bearer $($login.token)" }
  $products = Invoke-RestMethod -Uri 'http://localhost:5001/api/products' -Headers $h
  $orders = Invoke-RestMethod -Uri 'http://localhost:5001/api/orders' -Headers $h
  $emps = Invoke-RestMethod -Uri 'http://localhost:5001/api/employees' -Headers $h
  Log "   Login OK ($($login.employee.username)) | products=$($products.Count) orders=$($orders.Count) employees=$($emps.Count)"
  $expP = ($info.collections | Where-Object { $_.name -eq 'products' }).count
  $expO = ($info.collections | Where-Object { $_.name -eq 'orders' }).count
  $expE = ($info.collections | Where-Object { $_.name -eq 'employees' }).count
  if ($products.Count -eq $expP -and $orders.Count -eq $expO -and $emps.Count -eq $expE) {
    Log "   ✅ ຈຳນວນຂໍ້ມູນກົງກັນຄົບ: products=$expP orders=$expO employees=$expE"
  } else {
    Log "   ⚠️ ຈຳນວນບໍ່ກົງ: products $($products.Count)/$expP, orders $($orders.Count)/$expO, employees $($emps.Count)/$expE"
  }
} catch {
  Fail "Login/verify ຜິດພາດ: $($_.Exception.Message)"
}

Log "✅ ເຮັດສຳເລັດ! ຂໍ້ມູນສຳຮອງກ່ອນຍ້າຍ: $dumpDir (ໃຫ້ອັດໄວ້ກ່ອນລຶບ)"
Log "   - ບັນຊີຮ້ານເກົ່າ (WSL mongod ເຄື່ອງ original) ຍັງເປັນ snapshot ສຳຮອງໄວ້ໃຫ້"
Log "   - ສຳຮອງອັດຕະໂນມັດ: ຕັ້ງ task ໃໝ່ດ້ວຍ node backup/install-backup-task.js (docker exec)"