param(
  [string]$HostName = 'colegiodelsolar.edu.ar',
  [string]$User = 'delsolaresteban',
  [string]$Pass = 'raCs!gQF3P',
  [string]$RemoteWeb = '/web/'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

$includeFiles = @(
  'index.html',
  'index-en.html',
  'styles.css',
  'script.js',
  'favicon.ico',
  'logos_footer.png',
  'Logo-Del-Solar (1).png'
)

$includeDirs = @(
  'convenios',
  'images',
  'videosExAlumnos'
)

function New-FtpRequest([string]$uri, [string]$method) {
  $req = [System.Net.FtpWebRequest]::Create($uri)
  $req.Method = $method
  $req.Credentials = New-Object System.Net.NetworkCredential($User, $Pass)
  $req.UseBinary = $true
  $req.KeepAlive = $false
  return $req
}

function Ensure-RemoteDir([string]$remotePath) {
  $uri = "ftp://$HostName$remotePath"
  if (-not $uri.EndsWith('/')) { $uri += '/' }
  try {
    $req = New-FtpRequest -uri $uri -method ([System.Net.WebRequestMethods+Ftp]::MakeDirectory)
    $resp = $req.GetResponse()
    $resp.Close()
  } catch {
    # Already exists.
  }
}

function Upload-File([string]$localFile, [string]$remoteFilePath) {
  $segments = $remoteFilePath -split '/' | Where-Object { $_ -ne '' }
  $escapedPath = '/' + (($segments | ForEach-Object { [Uri]::EscapeDataString($_) }) -join '/')
  $uri = "ftp://$HostName$escapedPath"

  try {
    $wc = New-Object System.Net.WebClient
    $wc.Credentials = New-Object System.Net.NetworkCredential($User, $Pass)
    $wc.UploadFile($uri, $localFile) | Out-Null
    Write-Host "UPLOAD FILE $remoteFilePath"
  } catch {
    Write-Host "UPLOAD_FAIL $remoteFilePath :: $($_.Exception.Message)"
  }
}

function Upload-Dir([string]$localDir, [string]$remoteDirPath) {
  Ensure-RemoteDir -remotePath $remoteDirPath

  Get-ChildItem -LiteralPath $localDir | ForEach-Object {
    if ($_.PSIsContainer) {
      $nextRemote = "$remoteDirPath$($_.Name)/"
      Upload-Dir -localDir $_.FullName -remoteDirPath $nextRemote
    } else {
      $remoteFile = "$remoteDirPath$($_.Name)"
      Upload-File -localFile $_.FullName -remoteFilePath $remoteFile
    }
  }
}

# Backup marker folder if not present
$backupTag = "/web/backup-manual-marker/"
Ensure-RemoteDir -remotePath $backupTag

# Force static landing precedence by replacing legacy index.php.
$tempPhp = Join-Path $env:TEMP 'colegiodelsolar-index-bootstrap.php'
"<?php`nreadfile(__DIR__ . '/index.html');`n" | Set-Content -LiteralPath $tempPhp -Encoding ASCII
Upload-File -localFile $tempPhp -remoteFilePath "$RemoteWebindex.php"

foreach ($file in $includeFiles) {
  $local = Join-Path $projectRoot $file
  if (Test-Path -LiteralPath $local -PathType Leaf) {
    Upload-File -localFile $local -remoteFilePath "$RemoteWeb$file"
  } else {
    Write-Host "SKIP MISSING FILE $file"
  }
}

foreach ($dir in $includeDirs) {
  $localDir = Join-Path $projectRoot $dir
  if (Test-Path -LiteralPath $localDir -PathType Container) {
    Upload-Dir -localDir $localDir -remoteDirPath "$RemoteWeb$dir/"
  } else {
    Write-Host "SKIP MISSING DIR  $dir"
  }
}

Write-Host "DEPLOY_CLEAN_OK::$RemoteWeb"
