import fs from 'node:fs';
import path from 'node:path';

export function applyProductOverlay(base, overlay) {
  const result = { ...base, ...overlay };
  result.extensionsGallery = { ...(base.extensionsGallery || {}), ...(overlay.extensionsGallery || {}) };
  result.linkProtectionTrustedDomains = [...new Set([
    ...(base.linkProtectionTrustedDomains || []),
    ...(overlay.linkProtectionTrustedDomains || [])
  ])];
  result.defaultUserSettings = { ...(base.defaultUserSettings || {}), ...(overlay.defaultUserSettings || {}) };
  return result;
}

export function portableMarker() {
  return [
    'Infernum IDE portable data directory.',
    'User settings, extensions, profiles and application state are stored here.',
    'Keep this folder next to the application executable to preserve portable mode.',
    ''
  ].join('\n');
}

export function windowsLauncher() {
  return [
    '@echo off',
    'setlocal',
    'cd /d "%~dp0"',
    'set "APP="',
    'for %%E in ("Infernum IDE.exe" infernum.exe Infernum.exe Code.exe) do if exist "%~dp0%%~E" set "APP=%~dp0%%~E"',
    'if not defined APP (echo Infernum IDE executable was not found.& exit /b 1)',
    'start "Infernum IDE" "%APP%" %*',
    ''
  ].join('\r\n');
}

export function linuxLauncher() {
  return [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    'ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"',
    'for APP in "$ROOT/infernum" "$ROOT/code-oss" "$ROOT/code"; do',
    '  if [[ -x "$APP" ]]; then exec "$APP" "$@"; fi',
    'done',
    'echo "Infernum IDE executable was not found in $ROOT" >&2',
    'exit 1',
    ''
  ].join('\n');
}

export function findPackagedApp(repoDir, target) {
  const candidates = [
    path.resolve(repoDir, '..', `VSCode-${target}`),
    path.resolve(repoDir, '..', `Infernum-${target}`),
    path.resolve(repoDir, '.build', target)
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) return candidate;
  }
  return null;
}

export function validateProduct(product) {
  const required = ['nameShort', 'nameLong', 'applicationName', 'dataFolderName', 'extensionsGallery'];
  const missing = required.filter(key => !product[key]);
  if (missing.length) throw new Error(`Product configuration is incomplete: ${missing.join(', ')}`);
  if (!String(product.nameShort).includes('Infernum')) throw new Error('Product name must keep Infernum branding.');
  if (!String(product.extensionsGallery.serviceUrl || '').startsWith('https://')) throw new Error('Extension gallery must use HTTPS.');
  return true;
}
