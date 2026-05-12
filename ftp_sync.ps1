param(
  [string]$HostName = 'colegiodelsolar.edu.ar',
  [string]$User = 'delsolaresteban',
  [string]$Pass = 'raCs!gQF3P',
  [string]$RemoteRoot = '/web/'
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupRoot = Join-Path $projectRoot ("backups/remote-$timestamp")

$excludeNames = @('.git', '.github', '.vscode', 'node_modules', '.env', 'ftp_sync.ps1', 'backups')
$excludeExtensions = @('.docx', '.exe')
$visitedRemoteDirs = New-Object 'System.Collections.Generic.HashSet[string]'

function Normalize-FtpName([string]$name) {
  $clean = $name.Trim()
  if ([string]::IsNullOrWhiteSpace($clean)) { return $null }

  $clean = $clean -replace '\\', '/'
  $clean = $clean -replace '/+', '/'

  while ($clean.StartsWith('./')) {
    $clean = $clean.Substring(2)
  }

  $clean = $clean.Trim('/')

  if ([string]::IsNullOrWhiteSpace($clean)) { return $null }
  if ($clean -eq '.' -or $clean -eq '..') { return $null }

  # ListDirectory should return only one item name, never nested paths.
  if ($clean.Contains('/')) { return $null }

  return $clean
}

function New-FtpRequest([string]$uri, [string]$method) {
  $req = [System.Net.FtpWebRequest]::Create($uri)
  $req.Method = $method
  $req.Credentials = New-Object System.Net.NetworkCredential($User, $Pass)
  $req.UseBinary = $true
  $req.KeepAlive = $false
  return $req
}

function Get-FtpList([string]$uri) {
  $req = New-FtpRequest -uri $uri -method ([System.Net.WebRequestMethods+Ftp]::ListDirectory)
  $resp = $req.GetResponse()
  $sr = New-Object IO.StreamReader($resp.GetResponseStream())
  $txt = $sr.ReadToEnd()
  $sr.Close()
  $resp.Close()
  return ($txt -split "`r?`n" | Where-Object { $_ -and $_.Trim().Length -gt 0 })
}

function Test-FtpIsFile([string]$uri) {
  try {
    $req = New-FtpRequest -uri $uri -method ([System.Net.WebRequestMethods+Ftp]::GetFileSize)
    $resp = $req.GetResponse()
    $resp.Close()
    return $true
  } catch {
    return $false
  }
}

function Backup-FtpDir([string]$remotePath, [string]$localPath) {
  if (-not $remotePath.EndsWith('/')) { $remotePath += '/' }
  if ($visitedRemoteDirs.Contains($remotePath)) {
    Write-Host "SKIP CYCLE  $remotePath"
    return
  }
  [void]$visitedRemoteDirs.Add($remotePath)

  New-Item -ItemType Directory -Path $localPath -Force | Out-Null
  $baseUri = "ftp://$HostName$remotePath"
  if (-not $baseUri.EndsWith('/')) { $baseUri += '/' }

  $items = Get-FtpList -uri $baseUri
  foreach ($rawName in $items) {
    $name = Normalize-FtpName -name $rawName
    if (-not $name) {
      continue
    }
    $itemRemotePath = "$remotePath$name"
    $itemUri = "ftp://$HostName$itemRemotePath"

    if (Test-FtpIsFile -uri $itemUri) {
      $dest = Join-Path $localPath $name
      $wc = New-Object System.Net.WebClient
      $wc.Credentials = New-Object System.Net.NetworkCredential($User, $Pass)
      $wc.DownloadFile($itemUri, $dest)
      Write-Host "BACKUP FILE $itemRemotePath"
    } else {
      $nextRemote = "$remotePath$name/"
      $nextLocal = Join-Path $localPath $name
      Write-Host "BACKUP DIR  $nextRemote"
      Backup-FtpDir -remotePath $nextRemote -localPath $nextLocal
    }
  }
}

function Ensure-RemoteDir([string]$remotePath) {
  $uri = "ftp://$HostName$remotePath"
  if (-not $uri.EndsWith('/')) { $uri += '/' }

  try {
    $req = New-FtpRequest -uri $uri -method ([System.Net.WebRequestMethods+Ftp]::MakeDirectory)
    $resp = $req.GetResponse()
    $resp.Close()
  } catch {
    # Ignore if it already exists.
  }
}

function Upload-File([string]$localFile, [string]$remoteFilePath) {
  $uri = "ftp://$HostName$remoteFilePath"
  $wc = New-Object System.Net.WebClient
  $wc.Credentials = New-Object System.Net.NetworkCredential($User, $Pass)
  $wc.UploadFile($uri, $localFile) | Out-Null
  Write-Host "UPLOAD FILE $remoteFilePath"
}

function Should-Exclude([System.IO.FileSystemInfo]$item) {
  if ($excludeNames -contains $item.Name) { return $true }
  if ($item.PSIsContainer) { return $false }
  if ($excludeExtensions -contains $item.Extension.ToLowerInvariant()) { return $true }
  return $false
}

function Upload-LocalDir([string]$localDir, [string]$remoteDirPath) {
  Ensure-RemoteDir -remotePath $remoteDirPath

  Get-ChildItem -LiteralPath $localDir | ForEach-Object {
    if (Should-Exclude -item $_) {
      Write-Host "SKIP        $($_.FullName)"
      return
    }

    if ($_.PSIsContainer) {
      $nextRemote = "$remoteDirPath$($_.Name)/"
      Upload-LocalDir -localDir $_.FullName -remoteDirPath $nextRemote
    } else {
      $remoteFile = "$remoteDirPath$($_.Name)"
      Upload-File -localFile $_.FullName -remoteFilePath $remoteFile
    }
  }
}

Write-Host "=== BACKUP REMOTO ==="
Backup-FtpDir -remotePath $RemoteRoot -localPath $backupRoot
Write-Host "BACKUP_OK::$backupRoot"

Write-Host "=== SUBIDA NUEVA WEB ==="
Upload-LocalDir -localDir $projectRoot -remoteDirPath $RemoteRoot
Write-Host "UPLOAD_OK::$RemoteRoot"
