<#
.SYNOPSIS
    Instala dependencias Python y crea la Tarea Programada de Windows
    que actualiza el post de Instagram diariamente a las 23:55.

.DESCRIPTION
    Ejecutar como Administrador la primera vez:
        Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
        .\tools\setup_task.ps1

    La tarea:
      · Se ejecuta todos los días a las 23:55
      · Corre get_instagram_post.py con el Python del sistema
      · Guarda el log en tools\task_log.txt
      · Se llama "DelSolar - Actualizar Instagram"
#>

$ErrorActionPreference = 'Stop'

# ── Rutas ──────────────────────────────────────────────────────
$ToolsDir   = $PSScriptRoot
$ProjectDir = Split-Path $ToolsDir -Parent
$ScriptFile = Join-Path $ToolsDir "get_instagram_post.py"
$EnvFile    = Join-Path $ToolsDir ".env"
$LogFile    = Join-Path $ToolsDir "task_log.txt"

# ── Python ─────────────────────────────────────────────────────
$PythonExe = (Get-Command python -ErrorAction SilentlyContinue)?.Source
if (-not $PythonExe) {
    $PythonExe = (Get-Command python3 -ErrorAction SilentlyContinue)?.Source
}
if (-not $PythonExe) {
    Write-Error "Python no encontrado. Instalarlo desde https://python.org"
    exit 1
}
Write-Host "Python: $PythonExe"

# ── Instalar dependencias ───────────────────────────────────────
Write-Host "Instalando dependencias..."
& $PythonExe -m pip install -r (Join-Path $ToolsDir "requirements.txt") --quiet
if ($LASTEXITCODE -ne 0) { Write-Error "pip install falló"; exit 1 }
Write-Host "Dependencias OK."

# ── Crear archivo .env si no existe ────────────────────────────
if (-not (Test-Path $EnvFile)) {
    $pass = Read-Host "Contraseña FTP (se guarda en tools\.env, nunca en git)"
    Set-Content -Path $EnvFile -Value "FTP_PASS=$pass" -Encoding UTF8
    Write-Host ".env creado."
} else {
    Write-Host ".env ya existe."
}

# ── Tarea Programada ────────────────────────────────────────────
$TaskName = "DelSolar - Actualizar Instagram"

# Comando: python script.py >> log.txt 2>&1
$Cmd  = $PythonExe
$Args = "`"$ScriptFile`" >> `"$LogFile`" 2>&1"

$Action   = New-ScheduledTaskAction -Execute $Cmd -Argument $Args -WorkingDirectory $ProjectDir
$Trigger  = New-ScheduledTaskTrigger -Daily -At "23:55"
$Settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 5) `
    -MultipleInstances IgnoreNew

# Registrar (o reemplazar si ya existe)
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

Register-ScheduledTask `
    -TaskName   $TaskName `
    -Action     $Action `
    -Trigger    $Trigger `
    -Settings   $Settings `
    -RunLevel   Highest `
    -Description "Obtiene el último post de @delsolarschool y lo sube al servidor." `
    | Out-Null

Write-Host ""
Write-Host "=========================================="
Write-Host "  Tarea programada creada correctamente."
Write-Host "  Nombre : $TaskName"
Write-Host "  Horario: Todos los dias a las 23:55"
Write-Host "  Log    : $LogFile"
Write-Host "=========================================="
Write-Host ""
Write-Host "Para ejecutar ahora manualmente:"
Write-Host "  python `"$ScriptFile`""
