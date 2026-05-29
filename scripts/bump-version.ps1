param(
  [switch]$Preview
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$gameJsPath = Join-Path $repoRoot 'game.js'
$aboutPath = Join-Path $repoRoot 'ABOUT.md'
$indexPath = Join-Path $repoRoot 'index.html'

function Read-Utf8File {
  param([string]$Path)

  return [System.IO.File]::ReadAllText($Path)
}

function Write-Utf8File {
  param(
    [string]$Path,
    [string]$Content
  )

  $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

$gameJs = Read-Utf8File -Path $gameJsPath
if ($gameJs -notmatch 'const APP_VERSION = "(?<version>\d{4}\.\d{2}\.\d{2}\.\d{2})";') {
  throw 'Unable to find APP_VERSION in game.js.'
}

$currentVersion = $Matches.version
$currentParts = $currentVersion.Split('.')
$currentDate = ($currentParts[0..2] -join '.')
$today = Get-Date -Format 'yyyy.MM.dd'
$nextSequence = if ($currentDate -eq $today) {
  [int]$currentParts[3] + 1
} else {
  1
}

if ($nextSequence -gt 99) {
  throw 'Daily version sequence exceeded 99.'
}

$nextVersion = '{0}.{1:D2}' -f $today, $nextSequence
$assetVersion = $nextVersion -replace '\.', ''

if ($Preview) {
  Write-Output $nextVersion
  return
}

$updatedGameJs = [regex]::Replace(
  $gameJs,
  'const APP_VERSION = "\d{4}\.\d{2}\.\d{2}\.\d{2}";',
  ('const APP_VERSION = "{0}";' -f $nextVersion),
  1
)

$about = Read-Utf8File -Path $aboutPath
$updatedAbout = [regex]::Replace(
  $about,
  '(?m)^- Version: \d{4}\.\d{2}\.\d{2}\.\d{2}$',
  ('- Version: {0}' -f $nextVersion),
  1
)

$index = Read-Utf8File -Path $indexPath
$updatedIndex = [regex]::Replace(
  $index,
  'style\.css\?v=[^"]+',
  ('style.css?v={0}' -f $assetVersion),
  1
)
$updatedIndex = [regex]::Replace(
  $updatedIndex,
  'game\.js\?v=[^"]+',
  ('game.js?v={0}' -f $assetVersion),
  1
)

Write-Utf8File -Path $gameJsPath -Content $updatedGameJs
Write-Utf8File -Path $aboutPath -Content $updatedAbout
Write-Utf8File -Path $indexPath -Content $updatedIndex

Write-Output $nextVersion