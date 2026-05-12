param(
  [string]$HostName = 'colegiodelsolar.edu.ar',
  [string]$User = 'delsolaresteban',
  [string]$Pass = 'raCs!gQF3P',
  [string]$RemoteWeb = '/web/'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupRemote = "/web-backup-$timestamp/"

$excludeNames = @('.git', '.github', '.vscode', 'node_modules', '.env', 'ftp_sync.ps1', 'deploy_with_remote_backup.ps1', 'backups')
$excludeExtensions = @('.docx', '.exe', '.ps1')

function New-FtpRequest([string]$uri, [string]$method) {
  $req = [System.Net.FtpWebRequest]::Create($uri)
  $req.Method = $method
  $req.Credentials = New-Object System.Net.NetworkCredential($User, $Pass)
  $req.UseBinary = $true
  $req.KeepAlive = $false
  return $req
}

function Rename-RemoteDirectory([string]$fromPath, [string]$toPath) {
  $fromNormalized = $fromPath.TrimEnd('/')
  $toNormalized = $toPath.Trim('/')

  $uri = "ftp://$HostName$fromNormalized"
  $req = New-FtpRequest -uri $uri -method ([System.Net.WebRequestMethods+Ftp]::Rename)
  $req.RenameTo = $toNormalized
  $resp = $req.GetResponse()
  $resp.Close()
}

function Ensure-RemoteDir([string]$remotePath) {
  $uri = "ftp://$HostName$remotePath"
  if (-not $uri.EndsWith('/')) { $uri += '/' }
  try {
    $req = New-FtpRequest -uri $uri -method ([System.Net.WebRequestMethods+Ftp]::MakeDirectory)
    $resp = $req.GetResponse()
    $resp.Close()
  } catch {
    # Ignore if exists.
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

Write-Host "RENAMING $RemoteWeb -> $backupRemote"
Rename-RemoteDirectory -fromPath $RemoteWeb -toPath $backupRemote
Write-Host "BACKUP_REMOTE_OK::$backupRemote"

Ensure-RemoteDir -remotePath $RemoteWeb
Upload-LocalDir -localDir $projectRoot -remoteDirPath $RemoteWeb
Write-Host "UPLOAD_OK::$RemoteWeb"
