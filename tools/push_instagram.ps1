<#
.SYNOPSIS
    Obtiene el último post de Instagram y hace git push para que
    GitHub Actions → Deploy FTP lo suba al servidor automáticamente.

.DESCRIPTION
    Correr manualmente o programar con Task Scheduler:
        .\tools\push_instagram.ps1

    Requisito previo:
        pip install -r tools/requirements.txt
#>

$ErrorActionPreference = 'Stop'

$ToolsDir   = $PSScriptRoot
$ProjectDir = Split-Path $ToolsDir -Parent
$LogFile    = Join-Path $ToolsDir "task_log.txt"

function Log($msg) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $msg"
    Write-Host $line
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

Log "--- Inicio ---"

# ── Python ──────────────────────────────────────────────────────
$PythonExe = (Get-Command python -ErrorAction SilentlyContinue)?.Source
if (-not $PythonExe) { $PythonExe = (Get-Command python3 -ErrorAction SilentlyContinue)?.Source }
if (-not $PythonExe) { Log "ERROR: Python no encontrado."; exit 1 }

# ── Obtener post ─────────────────────────────────────────────────
Log "Ejecutando get_instagram_post.py..."
Push-Location $ProjectDir
try {
    & $PythonExe tools/get_instagram_post.py 2>&1 | Tee-Object -FilePath $LogFile -Append
    if ($LASTEXITCODE -ne 0) { Log "AVISO: el script terminó con código $LASTEXITCODE" }
} catch {
    Log "ERROR al ejecutar Python: $_"
    Pop-Location; exit 1
}

# ── Git push si cambió ───────────────────────────────────────────
$diff = & git diff --name-only instagram_latest.json 2>&1
if ($diff -match "instagram_latest.json") {
    Log "JSON cambió, haciendo commit y push..."
    & git add instagram_latest.json
    & git commit -m "chore: actualizar instagram_latest.json"
    & git push
    if ($LASTEXITCODE -eq 0) {
        Log "Push OK → GitHub Actions subirá el archivo al servidor."
    } else {
        Log "ERROR: git push falló (código $LASTEXITCODE)."
    }
} else {
    Log "Sin cambios en el JSON, nada que pushear."
}

Pop-Location
Log "--- Fin ---"
