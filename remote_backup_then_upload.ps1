param(
  [string]$HostName = 'colegiodelsolar.edu.ar',
  [string]$User = 'delsolaresteban',
  [string]$Pass = 'raCs!gQF3P',
  [string]$RemoteWeb = '/web/'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDirName = "backup-$timestamp"
$remoteBackup = "$RemoteWeb$backupDirName/"

$excludeNames = @('.git', '.github', '.vscode', 'node_modules', '.env', 'ftp_sync.ps1', 'deploy_with_remote_backup.ps1', 'remote_backup_then_upload.ps1', 'backups')
$excludeExtensions = @('.docx', '.exe', '.ps1')

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

function Normalize-FtpName([string]$name) {
  $clean = $name.Trim()
  if ([string]::IsNullOrWhiteSpace($clean)) { return $null }
  $clean = $clean -replace '\\', '/'
  $clean = $clean -replace '/+', '/'
  while ($clean.StartsWith('./')) { $clean = $clean.Substring(2) }
  $clean = $clean.Trim('/')
  if ([string]::IsNullOrWhiteSpace($clean)) { return $null }
  if ($clean -eq '.' -or $clean -eq '..') { return $null }
  if ($clean.Contains('/')) { return $null }
  return $clean
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

function Move-RemoteItem([string]$fromPath, [string]$toPath) {
  $fromNorm = $fromPath.TrimEnd('/')
  $toNorm = $toPath.Trim('/')
  $uri = "ftp://$HostName$fromNorm"
  $req = New-FtpRequest -uri $uri -method ([System.Net.WebRequestMethods+Ftp]::Rename)
  $req.RenameTo = $toNorm
  $resp = $req.GetResponse()
  $resp.Close()
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
      Write-Host "SKIP        $($_.Name)"
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

Write-Host "=== REMOTE BACKUP IN PLACE ==="
Ensure-RemoteDir -remotePath $remoteBackup

$webUri = "ftp://$HostName$RemoteWeb"
if (-not $webUri.EndsWith('/')) { $webUri += '/' }
$items = Get-FtpList -uri $webUri

foreach ($rawName in $items) {
  $name = Normalize-FtpName -name $rawName
  if (-not $name) { continue }
  if ($name -eq $backupDirName) { continue }
  if ($name -like 'backup-*') { continue }

  $from = "$RemoteWeb$name"
  $to = "$remoteBackup$name"

  try {
    Move-RemoteItem -fromPath $from -toPath $to
    Write-Host "MOVED       $from -> $to"
  } catch {
    Write-Host "MOVE_FAIL   $from :: $($_.Exception.Message)"
  }
}

Write-Host "BACKUP_REMOTE_OK::$remoteBackup"
Write-Host "=== UPLOAD NEW SITE ==="
Upload-LocalDir -localDir $projectRoot -remoteDirPath $RemoteWeb
Write-Host "UPLOAD_OK::$RemoteWeb"
