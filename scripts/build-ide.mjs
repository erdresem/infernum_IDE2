import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { applyProductOverlay, findPackagedApp, linuxLauncher, portableMarker, validateProduct, windowsLauncher } from './build-lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const target = arg('--target') || `${process.platform === 'win32' ? 'win32' : 'linux'}-${process.arch === 'arm64' ? 'arm64' : 'x64'}`;
const allowed = new Set(['linux-x64', 'linux-arm64', 'win32-x64', 'win32-arm64']);
if (!allowed.has(target)) throw new Error(`Unsupported build target: ${target}`);
const [platform, arch] = target.split('-');
const currentPlatform = process.platform === 'win32' ? 'win32' : process.platform;
if (platform !== currentPlatform) throw new Error(`Cross-building ${target} on ${process.platform} is not supported. Run this target on a native ${platform} runner.`);

const buildRoot = path.join(root, '.build');
const vscodeDir = path.join(buildRoot, 'vscode');
const ref = process.env.VSCODE_REF || fs.readFileSync(path.join(root, '.vscode-version'), 'utf8').trim() || 'main';
fs.mkdirSync(buildRoot, { recursive: true });

function run(command, commandArgs, cwd, extraEnv = {}) {
  console.log(`\n> ${command} ${commandArgs.join(' ')}`);
  const result = spawnSync(command, commandArgs, { cwd, stdio: 'inherit', env: { ...process.env, ...extraEnv }, shell: process.platform === 'win32' && /^(npm|npx|pnpm|corepack)$/.test(command) });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with code ${result.status}`);
}

if (!fs.existsSync(path.join(vscodeDir, '.git'))) {
  if (fs.existsSync(vscodeDir)) fs.rmSync(vscodeDir, { recursive: true, force: true });
  fs.mkdirSync(vscodeDir, { recursive: true });
  run('git', ['init'], vscodeDir);
  run('git', ['remote', 'add', 'origin', 'https://github.com/microsoft/vscode.git'], vscodeDir);
}
run('git', ['fetch', '--depth', '1', 'origin', ref], vscodeDir);
run('git', ['checkout', '--detach', 'FETCH_HEAD'], vscodeDir);
const sourceCommitResult = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: vscodeDir, encoding: 'utf8' });
if (sourceCommitResult.status !== 0) throw new Error('Unable to determine checked-out VS Code commit.');
const sourceCommit = sourceCommitResult.stdout.trim();

const extensionDir = path.join(root, 'extensions', 'infernum-code');
run('npm', ['install', '--no-audit', '--no-fund'], extensionDir);
run('npm', ['test'], extensionDir);

const bundledExtension = path.join(vscodeDir, 'extensions', 'infernum-code');
if (fs.existsSync(bundledExtension)) fs.rmSync(bundledExtension, { recursive: true, force: true });
fs.mkdirSync(bundledExtension, { recursive: true });
for (const entry of ['package.json', 'README.md', 'CHANGELOG.md', 'LICENSE', 'dist', 'media', 'webview']) {
  const source = path.join(extensionDir, entry);
  if (!fs.existsSync(source)) throw new Error(`Bundled extension is missing ${entry}.`);
  fs.cpSync(source, path.join(bundledExtension, entry), { recursive: true });
}

const productPath = path.join(vscodeDir, 'product.json');
const baseProduct = JSON.parse(fs.readFileSync(productPath, 'utf8'));
const overlay = JSON.parse(fs.readFileSync(path.join(root, 'product.overlay.json'), 'utf8'));
const product = applyProductOverlay(baseProduct, overlay);
validateProduct(product);
fs.writeFileSync(productPath, `${JSON.stringify(product, null, 2)}\n`);

const icon = path.join(root, 'branding', 'infernum.ico');
const png = path.join(root, 'branding', 'infernum.png');
const winIconTarget = path.join(vscodeDir, 'resources', 'win32', 'code.ico');
const linuxIconTarget = path.join(vscodeDir, 'resources', 'linux', 'code.png');
fs.mkdirSync(path.dirname(winIconTarget), { recursive: true });
fs.mkdirSync(path.dirname(linuxIconTarget), { recursive: true });
fs.copyFileSync(icon, winIconTarget);
fs.copyFileSync(png, linuxIconTarget);

// Compile the upstream workbench for the requested native platform.
// VS Code upstream pins its package manager in package.json. Current upstream uses pnpm.
// pnpm is installed by the GitHub Actions runner; no local Node.js setup is required from the user.
run('pnpm', ['install', '--frozen-lockfile'], vscodeDir, { PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1' });
const gulpTask = `vscode-${platform}-${arch}-min`;
run('pnpm', ['run', 'gulp', '--', gulpTask], vscodeDir, { NODE_OPTIONS: '--max-old-space-size=12288' });

const packaged = findPackagedApp(vscodeDir, target);
if (!packaged) throw new Error(`VS Code build completed but the packaged output folder was not found for ${target}.`);
const releaseRoot = path.join(root, 'dist', 'releases');
const outputDir = path.join(releaseRoot, `Infernum-IDE-${target}`);
fs.mkdirSync(releaseRoot, { recursive: true });
if (fs.existsSync(outputDir)) fs.rmSync(outputDir, { recursive: true, force: true });
fs.cpSync(packaged, outputDir, { recursive: true, dereference: false });
fs.mkdirSync(path.join(outputDir, 'data'), { recursive: true });
fs.writeFileSync(path.join(outputDir, 'data', 'README.txt'), portableMarker());
fs.copyFileSync(path.join(root, 'branding', 'infernum.png'), path.join(outputDir, 'infernum.png'));
fs.copyFileSync(path.join(root, 'branding', 'infernum.ico'), path.join(outputDir, 'infernum.ico'));
const userSettingsDir = path.join(outputDir, 'data', 'user-data', 'User');
fs.mkdirSync(userSettingsDir, { recursive: true });
fs.copyFileSync(path.join(root, 'branding', 'default-settings.json'), path.join(userSettingsDir, 'settings.json'));
fs.writeFileSync(path.join(outputDir, 'INFERNUM-IDE-PORTABLE.txt'), `Infernum IDE ${target}\nBased on VS Code OSS ref: ${ref}\nVS Code OSS commit: ${sourceCommit}\nBundled AI extension: Infernum Code 0.3.1 (based on the 0.3.0 product branch)\n`);

if (platform === 'win32') {
  fs.writeFileSync(path.join(outputDir, 'Start Infernum IDE.cmd'), windowsLauncher());
  const archive = path.join(releaseRoot, `Infernum-IDE-${target}-portable.zip`);
  if (fs.existsSync(archive)) fs.rmSync(archive);
  const quotePs = value => `'${String(value).replaceAll("'", "''")}'`;
  const command = `Compress-Archive -Path ${quotePs(path.join(outputDir, '*'))} -DestinationPath ${quotePs(archive)} -Force`;
  run('powershell.exe', ['-NoProfile', '-Command', command], root);
} else {
  const launcher = path.join(outputDir, 'infernum-ide');
  fs.writeFileSync(launcher, linuxLauncher(), { mode: 0o755 });
  fs.chmodSync(launcher, 0o755);
  const archive = path.join(releaseRoot, `Infernum-IDE-${target}-portable.tar.gz`);
  if (fs.existsSync(archive)) fs.rmSync(archive);
  run('tar', ['-czf', archive, '-C', releaseRoot, path.basename(outputDir)], root);
}

const outputArchive = path.join(releaseRoot, `Infernum-IDE-${target}-portable.${platform === 'win32' ? 'zip' : 'tar.gz'}`);
const hashCmd = platform === 'win32' ? 'certutil' : 'sha256sum';
if (platform === 'win32') run(hashCmd, ['-hashfile', outputArchive, 'SHA256'], root);
else run(hashCmd, [outputArchive], root);
console.log(`\nInfernum IDE portable package created: ${outputArchive}`);
