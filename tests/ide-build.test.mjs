import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { applyProductOverlay, linuxLauncher, portableMarker, validateProduct, windowsLauncher } from '../scripts/build-lib.mjs';

test('Infernum product overlay preserves upstream defaults and points to Open VSX', () => {
  const result = applyProductOverlay({ nameShort: 'Code - OSS', extensionsGallery: { itemUrl: 'old' }, linkProtectionTrustedDomains: ['https://example.com'] }, {
    nameShort: 'Infernum IDE', nameLong: 'Infernum IDE — AI & Code Editor', applicationName: 'infernum', dataFolderName: '.infernum-ide', enableTelemetry: true,
    extensionsGallery: { serviceUrl: 'https://open-vsx.org/vscode/gallery', itemUrl: 'https://open-vsx.org/vscode/item' }, linkProtectionTrustedDomains: ['https://open-vsx.org']
  });
  assert.equal(result.nameShort, 'Infernum IDE');
  assert.equal(result.extensionsGallery.itemUrl, 'https://open-vsx.org/vscode/item');
  assert.deepEqual(result.linkProtectionTrustedDomains, ['https://example.com', 'https://open-vsx.org']);
  assert.equal(validateProduct({ ...result, extensionsGallery: { serviceUrl: 'https://open-vsx.org/vscode/gallery' } }), true);
});

test('product validation rejects branding and insecure extension gallery misconfiguration', () => {
  assert.throws(() => validateProduct({ nameShort: 'Other IDE', nameLong: 'x', applicationName: 'x', dataFolderName: 'x', extensionsGallery: { serviceUrl: 'http://example.com' }, enableTelemetry: false, enableCrashReporter: false }));
});

test('portable data marker explains persistence', () => {
  assert.match(portableMarker(), /User settings, extensions, profiles/);
  assert.match(portableMarker(), /next to the application executable/);
});

test('platform launchers keep paths relative to portable folder', () => {
  assert.match(windowsLauncher(), /%~dp0/);
  assert.match(linuxLauncher(), /BASH_SOURCE\[0\]/);
  assert.match(linuxLauncher(), /exec "\$APP" "\$@"/);
});


test('bundled Infernum extension declares the three IDE modes', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extensions/infernum-code/package.json'), 'utf8'));
  const commands = new Set(manifest.contributes.commands.map(item => item.command));
  assert.ok(commands.has('infernum.mode.editor'));
  assert.ok(commands.has('infernum.mode.ai'));
  assert.ok(commands.has('infernum.mode.hybrid'));
  assert.ok(commands.has('infernum.selectMode'));
  assert.ok(manifest.activationEvents.includes('onStartupFinished'));
});

test('AI-only mode uses a WebviewPanel while editor mode blocks AI requests', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const extension = fs.readFileSync(path.join(root, 'extensions/infernum-code/src/extension.ts'), 'utf8');
  const viewProvider = fs.readFileSync(path.join(root, 'extensions/infernum-code/src/ui/view-provider.ts'), 'utf8');
  assert.match(extension, /createWebviewPanel\(/);
  assert.match(extension, /applyMode\('editor'\)/);
  assert.match(extension, /applyMode\('ai'\)/);
  assert.match(extension, /applyMode\('hybrid'\)/);
  assert.match(viewProvider, /setAiEnabled\(enabled: boolean\)/);
  assert.match(viewProvider, /!this\.aiEnabled/);
});


test('portable defaults disable telemetry in the user profile', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const settings = JSON.parse(fs.readFileSync(path.join(root, 'branding/default-settings.json'), 'utf8'));
  assert.equal(settings['telemetry.telemetryLevel'], 'off');
  assert.equal(settings['telemetry.enableCrashReporter'], false);
  assert.equal(settings['infernum.restoreMode'], true);
});

test('GitHub Actions builds automatically on main/master without local Node.js setup', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/build-portable.yml'), 'utf8');
  assert.match(workflow, /push:\s*\n\s*branches:\s*\[main, master\]/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /node-version: '24\.22\.1'/);
  assert.match(workflow, /version: '12\.16\.0'/);
  assert.match(workflow, /Infernum-IDE-Windows-x64-Portable/);
  assert.match(workflow, /Infernum-IDE-Linux-x64-Portable/);
});

test('VS Code upstream build uses its pinned pnpm package manager', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const build = fs.readFileSync(path.join(root, 'scripts/build-ide.mjs'), 'utf8');
  assert.match(build, /run\('pnpm', \['install', '--frozen-lockfile'\]/);
  assert.match(build, /run\('pnpm', \['run', 'gulp', '--', gulpTask\]/);
  assert.match(build, /pnpm\|corepack/);
});
