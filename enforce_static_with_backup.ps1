param(
  [string]$HostName = 'colegiodelsolar.edu.ar',
  [string]$User = 'delsolaresteban',
  [string]$Pass = 'raCs!gQF3P',
  [string]$Root = '/web/'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupRoot = "/web/backup/snapshot-$ts/"

$keepRoot = @(
  'index.html',
  'index-en.html',
  'styles.css',
  'script.js',
  'favicon.ico',
  'logos_footer.png',
  'Logo-Del-Solar (1).png',
  'convenios',
  'images',
  'videosExAlumnos'
)

function Norm([string]$n) {
  $x = $n.Trim()
  if ([string]::IsNullOrWhiteSpace($x)) { return $null }
  $x = $x -replace '\\', '/'
  $x = $x -replace '/+', '/'
  while ($x.StartsWith('./')) { $x = $x.Substring(2) }
  $x = $x.Trim('/')
  if ([string]::IsNullOrWhiteSpace($x)) { return $null }
  if ($x -eq '.' -or $x -eq '..') { return $null }
  if ($x.Contains('/')) { return $null }
  return $x
}

function Esc([string]$p) {
  $segs = $p -split '/' | Where-Object { $_ -ne '' }
  return '/' + (($segs | ForEach-Object { [Uri]::EscapeDataString($_) }) -join '/')
}

function Req([string]$p, [string]$m) {
  $r = [System.Net.FtpWebRequest]::Create("ftp://$HostName$(Esc $p)")
  $r.Method = $m
  $r.Credentials = New-Object System.Net.NetworkCredential($User, $Pass)
  $r.UseBinary = $true
  $r.KeepAlive = $false
  return $r
}

function List([string]$p) {
  $r = Req $p ([System.Net.WebRequestMethods+Ftp]::ListDirectory)
  $resp = $r.GetResponse()
  $sr = New-Object IO.StreamReader($resp.GetResponseStream())
  $txt = $sr.ReadToEnd()
  $sr.Close(); $resp.Close()
  return ($txt -split "`r?`n" | ForEach-Object { Norm $_ } | Where-Object { $_ })
}

function MkDir([string]$p) {
  try {
    $r = Req $p ([System.Net.WebRequestMethods+Ftp]::MakeDirectory)
    $resp = $r.GetResponse(); $resp.Close()
  } catch {}
}

function Upload([string]$local, [string]$remote) {
  $wc = New-Object System.Net.WebClient
  $wc.Credentials = New-Object System.Net.NetworkCredential($User, $Pass)
  $wc.UploadFile("ftp://$HostName$(Esc $remote)", $local) | Out-Null
}

function Download([string]$remote, [string]$local) {
  $wc = New-Object System.Net.WebClient
  $wc.Credentials = New-Object System.Net.NetworkCredential($User, $Pass)
  $wc.DownloadFile("ftp://$HostName$(Esc $remote)", $local)
}

function DelFile([string]$remote) {
  $r = Req $remote ([System.Net.WebRequestMethods+Ftp]::DeleteFile)
  $resp = $r.GetResponse(); $resp.Close()
}

function DelDir([string]$remote) {
  $r = Req $remote ([System.Net.WebRequestMethods+Ftp]::RemoveDirectory)
  $resp = $r.GetResponse(); $resp.Close()
}

function CopyPathToBackup([string]$src, [string]$dst) {
  $tmp = Join-Path $env:TEMP ("cp-" + [guid]::NewGuid().ToString() + '.tmp')
  try {
    Download $src $tmp
    Upload $tmp $dst
    Write-Host "BACKUP FILE $src"
    return
  } catch {
    if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force }
  }

  MkDir $dst
  foreach ($name in (List "$src/")) {
    CopyPathToBackup "$src/$name" "$dst/$name"
  }
}

function DeletePathRecursive([string]$remote) {
  try {
    DelFile $remote
    Write-Host "DELETE FILE $remote"
    return
  } catch {}

  foreach ($name in (List "$remote/")) {
    DeletePathRecursive "$remote/$name"
  }

  try {
    DelDir $remote
    Write-Host "DELETE DIR  $remote/"
  } catch {
    Write-Host "DELETE FAIL $remote/"
  }
}

function UploadDirRecursive([string]$localDir, [string]$remoteDir) {
  MkDir $remoteDir
  Get-ChildItem -LiteralPath $localDir | ForEach-Object {
    if ($_.PSIsContainer) {
      UploadDirRecursive $_.FullName "$remoteDir$($_.Name)/"
    } else {
      Upload $_.FullName "$remoteDir$($_.Name)"
      Write-Host "UPLOAD FILE $remoteDir$($_.Name)"
    }
  }
}

Write-Host "STEP 1 BACKUP REMOTO -> $backupRoot"
MkDir '/web/backup/'
MkDir $backupRoot
foreach ($name in (List $Root)) {
  if ($name -like 'backup*') { continue }
  CopyPathToBackup "$Root$name" "$backupRoot$name"
}
Write-Host "BACKUP_OK::$backupRoot"

Write-Host "STEP 2 LIMPIEZA PRODUCCION"
$keep = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)
$keepRoot | ForEach-Object { [void]$keep.Add($_) }
foreach ($name in (List $Root)) {
  if ($name -like 'backup*') { continue }
  if ($keep.Contains($name)) { continue }
  DeletePathRecursive "$Root$name"
}
Write-Host "CLEAN_OK::$Root"

Write-Host "STEP 3 SUBIDA LOCAL ESTATICA"
foreach ($name in $keepRoot) {
  $lp = Join-Path $projectRoot $name
  if (Test-Path -LiteralPath $lp -PathType Leaf) {
    Upload $lp "$Root$name"
    Write-Host "UPLOAD FILE $Root$name"
  } elseif (Test-Path -LiteralPath $lp -PathType Container) {
    UploadDirRecursive $lp "$Root$name/"
  }
}
Write-Host "DEPLOY_OK::$Root"
