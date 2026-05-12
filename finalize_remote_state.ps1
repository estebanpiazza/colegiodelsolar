param(
  [string]$HostName = 'colegiodelsolar.edu.ar',
  [string]$User = 'delsolaresteban',
  [string]$Pass = 'raCs!gQF3P',
  [string]$RemoteRoot = '/web/'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupRootName = "backup-final-$timestamp"
$backupRoot = "$RemoteRoot$backupRootName/"

$excludeNames = @('.git', '.github', '.vscode', 'node_modules', '.env', 'backups')
$excludeExtensions = @('.ps1', '.docx', '.exe')

function Normalize-Name([string]$name) {
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

function Escape-FtpPath([string]$path) {
  $segments = $path -split '/' | Where-Object { $_ -ne '' }
  return '/' + (($segments | ForEach-Object { [Uri]::EscapeDataString($_) }) -join '/')
}

function New-FtpRequest([string]$path, [string]$method) {
  $escaped = Escape-FtpPath -path $path
  $req = [System.Net.FtpWebRequest]::Create("ftp://$HostName$escaped")
  $req.Method = $method
  $req.Credentials = New-Object System.Net.NetworkCredential($User, $Pass)
  $req.UseBinary = $true
  $req.KeepAlive = $false
  return $req
}

function Get-RemoteList([string]$path) {
  $req = New-FtpRequest -path $path -method ([System.Net.WebRequestMethods+Ftp]::ListDirectory)
  $resp = $req.GetResponse()
  $sr = New-Object IO.StreamReader($resp.GetResponseStream())
  $txt = $sr.ReadToEnd()
  $sr.Close()
  $resp.Close()
  return ($txt -split "`r?`n" | ForEach-Object { Normalize-Name $_ } | Where-Object { $_ })
}

function Test-RemoteFile([string]$path) {
  try {
    $req = New-FtpRequest -path $path -method ([System.Net.WebRequestMethods+Ftp]::GetFileSize)
    $resp = $req.GetResponse()
    $resp.Close()
    return $true
  } catch {
    return $false
  }
}

function Ensure-RemoteDir([string]$path) {
  try {
    $req = New-FtpRequest -path $path -method ([System.Net.WebRequestMethods+Ftp]::MakeDirectory)
    $resp = $req.GetResponse()
    $resp.Close()
  } catch {
    # ignore if exists
  }
}

function Download-RemoteFile([string]$remotePath, [string]$localPath) {
  $escaped = Escape-FtpPath -path $remotePath
  $wc = New-Object System.Net.WebClient
  $wc.Credentials = New-Object System.Net.NetworkCredential($User, $Pass)
  $wc.DownloadFile("ftp://$HostName$escaped", $localPath)
}

function Upload-LocalFile([string]$localPath, [string]$remotePath) {
  $escaped = Escape-FtpPath -path $remotePath
  $wc = New-Object System.Net.WebClient
  $wc.Credentials = New-Object System.Net.NetworkCredential($User, $Pass)
  $wc.UploadFile("ftp://$HostName$escaped", $localPath) | Out-Null
}

function Remove-RemoteFile([string]$path) {
  $req = New-FtpRequest -path $path -method ([System.Net.WebRequestMethods+Ftp]::DeleteFile
  )
  $resp = $req.GetResponse()
  $resp.Close()
}

function Remove-RemoteDir([string]$path) {
  $req = New-FtpRequest -path $path -method ([System.Net.WebRequestMethods+Ftp]::RemoveDirectory)
  $resp = $req.GetResponse()
  $resp.Close()
}

function Backup-RemoteTree([string]$sourceDir, [string]$destDir) {
  Ensure-RemoteDir -path $destDir

  foreach ($name in (Get-RemoteList -path $sourceDir)) {
    if ($sourceDir -eq $RemoteRoot -and ($name -like 'backup*')) { continue }

    $src = "$sourceDir$name"
    $dst = "$destDir$name"

    if (Test-RemoteFile -path $src) {
      $temp = Join-Path $env:TEMP ("ftp-bkp-" + [guid]::NewGuid().ToString() + '.tmp')
      try {
        Download-RemoteFile -remotePath $src -localPath $temp
        Upload-LocalFile -localPath $temp -remotePath $dst
        Write-Host "BACKUP FILE $src -> $dst"
      } finally {
        if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Force }
      }
    } else {
      Backup-RemoteTree -sourceDir "$src/" -destDir "$dst/"
    }
  }
}

function Should-ExcludeLocal([System.IO.FileSystemInfo]$item) {
  if ($excludeNames -contains $item.Name) { return $true }
  if ($item.PSIsContainer) { return $false }
  if ($excludeExtensions -contains $item.Extension.ToLowerInvariant()) { return $true }
  return $false
}

function Sync-LocalToRemote([string]$localDir, [string]$remoteDir) {
  Ensure-RemoteDir -path $remoteDir

  Get-ChildItem -LiteralPath $localDir | ForEach-Object {
    if (Should-ExcludeLocal -item $_) { return }

    if ($_.PSIsContainer) {
      Sync-LocalToRemote -localDir $_.FullName -remoteDir "$remoteDir$($_.Name)/"
    } else {
      $remoteFile = "$remoteDir$($_.Name)"
      try {
        Upload-LocalFile -localPath $_.FullName -remotePath $remoteFile
        Write-Host "UPLOAD FILE $remoteFile"
      } catch {
        Write-Host "UPLOAD FAIL $remoteFile :: $($_.Exception.Message)"
      }
    }
  }
}

function Remove-RemoteExtras([string]$remoteDir, [string]$localDir) {
  foreach ($name in (Get-RemoteList -path $remoteDir)) {
    if ($remoteDir -eq $RemoteRoot -and ($name -like 'backup*')) { continue }

    $remotePath = "$remoteDir$name"
    $localPath = Join-Path $localDir $name

    if (Test-RemoteFile -path $remotePath) {
      if (-not (Test-Path -LiteralPath $localPath -PathType Leaf)) {
        try {
          Remove-RemoteFile -path $remotePath
          Write-Host "DELETE FILE $remotePath"
        } catch {
          Write-Host "DELETE FAIL $remotePath :: $($_.Exception.Message)"
        }
      }
    } else {
      if (Test-Path -LiteralPath $localPath -PathType Container) {
        Remove-RemoteExtras -remoteDir "$remotePath/" -localDir $localPath
      } else {
        # Remove full remote directory tree if not in local.
        Remove-RemoteExtras -remoteDir "$remotePath/" -localDir (Join-Path $env:TEMP '__none__')
        try {
          Remove-RemoteDir -path $remotePath
          Write-Host "DELETE DIR  $remotePath/"
        } catch {
          Write-Host "DELETE FAIL $remotePath/ :: $($_.Exception.Message)"
        }
      }
    }
  }
}

Write-Host "STEP 1/3 BACKUP REMOTO EN /web/$backupRootName/"
Ensure-RemoteDir -path $backupRoot
Backup-RemoteTree -sourceDir $RemoteRoot -destDir $backupRoot
Write-Host "BACKUP_DONE::$backupRoot"

Write-Host "STEP 2/3 SUBIR LOCAL A PRODUCCION"
Sync-LocalToRemote -localDir $projectRoot -remoteDir $RemoteRoot
Write-Host "UPLOAD_DONE::$RemoteRoot"

Write-Host "STEP 3/3 LIMPIAR PRODUCCION (NO TOCA backups)"
Remove-RemoteExtras -remoteDir $RemoteRoot -localDir $projectRoot
Write-Host "CLEAN_DONE::$RemoteRoot"
