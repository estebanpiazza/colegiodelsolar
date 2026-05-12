param(
  [string]$HostName = 'colegiodelsolar.edu.ar',
  [string]$User = 'delsolaresteban',
  [string]$Pass = 'raCs!gQF3P',
  [string]$RemoteRoot = '/web/'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$remoteBackupRoot = "/web/backup/current-$ts/"

$staticRootKeep = @(
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

function New-FtpReq([string]$path, [string]$method) {
  $uri = "ftp://$HostName$(Escape-FtpPath $path)"
  $req = [System.Net.FtpWebRequest]::Create($uri)
  $req.Method = $method
  $req.Credentials = New-Object System.Net.NetworkCredential($User, $Pass)
  $req.UseBinary = $true
  $req.KeepAlive = $false
  return $req
}

function List-Remote([string]$path) {
  $req = New-FtpReq -path $path -method ([System.Net.WebRequestMethods+Ftp]::ListDirectory)
  $resp = $req.GetResponse()
  $sr = New-Object IO.StreamReader($resp.GetResponseStream())
  $txt = $sr.ReadToEnd()
  $sr.Close(); $resp.Close()
  return ($txt -split "`r?`n" | ForEach-Object { Normalize-Name $_ } | Where-Object { $_ })
}

function Is-RemoteFile([string]$path) {
  try {
    $req = New-FtpReq -path $path -method ([System.Net.WebRequestMethods+Ftp]::GetFileSize)
    $resp = $req.GetResponse()
    $resp.Close()
    return $true
  } catch {
    return $false
  }
}

function Ensure-RemoteDir([string]$path) {
  try {
    $req = New-FtpReq -path $path -method ([System.Net.WebRequestMethods+Ftp]::MakeDirectory)
    $resp = $req.GetResponse(); $resp.Close()
  } catch {
    # ignore exists
  }
}

function Download-Remote([string]$remotePath, [string]$localPath) {
  $wc = New-Object System.Net.WebClient
  $wc.Credentials = New-Object System.Net.NetworkCredential($User, $Pass)
  $wc.DownloadFile("ftp://$HostName$(Escape-FtpPath $remotePath)", $localPath)
}

function Upload-Remote([string]$localPath, [string]$remotePath) {
  $wc = New-Object System.Net.WebClient
  $wc.Credentials = New-Object System.Net.NetworkCredential($User, $Pass)
  $wc.UploadFile("ftp://$HostName$(Escape-FtpPath $remotePath)", $localPath) | Out-Null
}

function Delete-RemoteFile([string]$remotePath) {
  $req = New-FtpReq -path $remotePath -method ([System.Net.WebRequestMethods+Ftp]::DeleteFile)
  $resp = $req.GetResponse(); $resp.Close()
}

function Delete-RemoteDir([string]$remotePath) {
  $req = New-FtpReq -path $remotePath -method ([System.Net.WebRequestMethods+Ftp]::RemoveDirectory)
  $resp = $req.GetResponse(); $resp.Close()
}

function Copy-RemoteTreeToBackup([string]$srcDir, [string]$dstDir) {
  Ensure-RemoteDir -path $dstDir
  foreach ($name in (List-Remote -path $srcDir)) {
    if ($srcDir -eq $RemoteRoot -and ($name -like 'backup*')) { continue }
    $src = "$srcDir$name"
    $dst = "$dstDir$name"
    if (Is-RemoteFile -path $src) {
      $tmp = Join-Path $env:TEMP ("rbk-" + [guid]::NewGuid().ToString() + '.tmp')
      try {
        Download-Remote -remotePath $src -localPath $tmp
        Upload-Remote -localPath $tmp -remotePath $dst
        Write-Host "BACKUP FILE $src"
      } finally {
        if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force }
      }
    } else {
      Copy-RemoteTreeToBackup -srcDir "$src/" -dstDir "$dst/"
    }
  }
}

function Upload-LocalStatic() {
  foreach ($name in $staticRootKeep) {
    $localPath = Join-Path $projectRoot $name
    $remotePath = "$RemoteRoot$name"
    if (Test-Path -LiteralPath $localPath -PathType Leaf) {
      Upload-Remote -localPath $localPath -remotePath $remotePath
      Write-Host "UPLOAD FILE $remotePath"
    } elseif (Test-Path -LiteralPath $localPath -PathType Container) {
      Upload-LocalDirRecursive -localDir $localPath -remoteDir "$remotePath/"
    }
  }
}

function Upload-LocalDirRecursive([string]$localDir, [string]$remoteDir) {
  Ensure-RemoteDir -path $remoteDir
  Get-ChildItem -LiteralPath $localDir | ForEach-Object {
    if ($_.PSIsContainer) {
      Upload-LocalDirRecursive -localDir $_.FullName -remoteDir "$remoteDir$($_.Name)/"
    } else {
      Upload-Remote -localPath $_.FullName -remotePath "$remoteDir$($_.Name)"
      Write-Host "UPLOAD FILE $remoteDir$($_.Name)"
    }
  }
}

function Delete-RemoteTree([string]$remoteDir) {
  foreach ($name in (List-Remote -path $remoteDir)) {
    $path = "$remoteDir$name"
    if (Is-RemoteFile -path $path) {
      try { Delete-RemoteFile -remotePath $path; Write-Host "DELETE FILE $path" } catch { Write-Host "DELETE FAIL $path" }
    } else {
      Delete-RemoteTree -remoteDir "$path/"
      try { Delete-RemoteDir -remotePath $path; Write-Host "DELETE DIR  $path/" } catch { Write-Host "DELETE FAIL $path/" }
    }
  }
}

function Clean-RemoteRootToStatic() {
  $keepSet = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)
  foreach ($k in $staticRootKeep) { [void]$keepSet.Add($k) }

  foreach ($name in (List-Remote -path $RemoteRoot)) {
    if ($name -like 'backup*') { continue }
    if ($keepSet.Contains($name)) {
      if (-not (Is-RemoteFile -path "$RemoteRoot$name")) {
        # prune extra files inside kept directories based on local tree
        Prune-RemoteDirToLocal -remoteDir "$RemoteRoot$name/" -localDir (Join-Path $projectRoot $name)
      }
      continue
    }

    $p = "$RemoteRoot$name"
    if (Is-RemoteFile -path $p) {
      try { Delete-RemoteFile -remotePath $p; Write-Host "DELETE FILE $p" } catch { Write-Host "DELETE FAIL $p" }
    } else {
      Delete-RemoteTree -remoteDir "$p/"
      try { Delete-RemoteDir -remotePath $p; Write-Host "DELETE DIR  $p/" } catch { Write-Host "DELETE FAIL $p/" }
    }
  }
}

function Prune-RemoteDirToLocal([string]$remoteDir, [string]$localDir) {
  $localNames = @{}
  if (Test-Path -LiteralPath $localDir -PathType Container) {
    Get-ChildItem -LiteralPath $localDir | ForEach-Object { $localNames[$_.Name.ToLowerInvariant()] = $_ }
  }

  foreach ($name in (List-Remote -path $remoteDir)) {
    $remotePath = "$remoteDir$name"
    $key = $name.ToLowerInvariant()
    $existsLocal = $localNames.ContainsKey($key)

    if (Is-RemoteFile -path $remotePath) {
      if (-not $existsLocal -or $localNames[$key].PSIsContainer) {
        try { Delete-RemoteFile -remotePath $remotePath; Write-Host "DELETE FILE $remotePath" } catch { Write-Host "DELETE FAIL $remotePath" }
      }
    } else {
      if ($existsLocal -and $localNames[$key].PSIsContainer) {
        Prune-RemoteDirToLocal -remoteDir "$remotePath/" -localDir $localNames[$key].FullName
      } else {
        Delete-RemoteTree -remoteDir "$remotePath/"
        try { Delete-RemoteDir -remotePath $remotePath; Write-Host "DELETE DIR  $remotePath/" } catch { Write-Host "DELETE FAIL $remotePath/" }
      }
    }
  }
}

Write-Host "STEP 1: BACKUP REMOTO REAL -> $remoteBackupRoot"
Ensure-RemoteDir -path $remoteBackupRoot
Copy-RemoteTreeToBackup -srcDir $RemoteRoot -dstDir $remoteBackupRoot
Write-Host "REMOTE_BACKUP_OK::$remoteBackupRoot"

Write-Host "STEP 2: DEPLOY LOCAL ESTATICO"
Upload-LocalStatic
Write-Host "REMOTE_DEPLOY_OK::$RemoteRoot"

Write-Host "STEP 3: LIMPIEZA REMOTA A ESTATICO"
Clean-RemoteRootToStatic
Write-Host "REMOTE_CLEAN_OK::$RemoteRoot"
