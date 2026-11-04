$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$arch = $env:INFERNUM_ARCH
if (-not $arch) { $arch = 'x64' }
node (Join-Path $scriptRoot 'build-ide.mjs') --target "win32-$arch"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
