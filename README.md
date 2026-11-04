# Infernum IDE

**Infernum IDE is a portable, branded VS Code OSS distribution with the Infernum Code 0.3.1 extension bundled in.** It has three workspace modes in one application:

1. **Editor Mode** — ordinary VS Code editor experience. Infernum AI commands are disabled and its panels are hidden; extensions, terminal, Git, language tools, themes and normal editor features remain available.
2. **AI Workspace** — Infernum AI workbench in the main area, without keeping the editor visible as the primary workspace.
3. **AI + Editor** — normal editor with Infernum AI sidebar and Agent Mode.

## Build it on GitHub — no Node.js on your computer

You do **not** need to install Node.js, npm, pnpm, Python, Rust, Visual Studio Build Tools or compile anything on your PC. GitHub Actions installs the build tools on GitHub's temporary Windows and Linux machines and builds both packages in the cloud.

### 1. Download and extract the project

Download the source kit ZIP and extract it. Open the extracted `Infernum-IDE` folder. Make sure you can see the `.github` folder as well as `scripts`, `extensions`, `package.json` and `README.md`.

### 2. Create a GitHub repository

1. Open [github.com/new](https://github.com/new) and sign in.
2. Name the repository `Infernum-IDE`.
3. Choose Public or Private.
4. For the easiest upload, leave **Add a README**, `.gitignore` and License unchecked (the project already contains these files).
5. Click **Create repository**.

### 3. Upload the project in the browser

1. On the new repository page, click **Add file → Upload files**.
2. Drag the contents of the extracted `Infernum-IDE` folder into the upload area. Include the `.github` folder — it contains the build workflow.
3. Scroll down and click **Commit changes** to the `main` branch.

You do not need Git, GitHub Desktop or a terminal for this upload. If the browser hides dot-folders, enable **Show hidden items** in Windows Explorer and ensure `.github/workflows/build-portable.yml` is uploaded.

### 4. GitHub builds automatically

After the commit to `main`, GitHub Actions starts two jobs automatically:

- `Windows x64 Portable` — builds the Windows ZIP.
- `Linux x64 Portable` — builds the Linux TAR.GZ.

To see progress, open the repository's **Actions** tab and select **Build Infernum IDE Portable**. Wait until both jobs show a green check mark. The first build can take a while because GitHub downloads and compiles the complete VS Code OSS source tree.

### 5. Download the finished applications

Open the completed workflow run. At the bottom of its **Summary** page, download the artifacts:

- `Infernum-IDE-Windows-x64-Portable` — extract the ZIP on Windows and launch `Start Infernum IDE.cmd`.
- `Infernum-IDE-Linux-x64-Portable` — extract the TAR.GZ and run `./infernum-ide`.

GitHub stores workflow artifacts for 14 days. Download them to your computer to keep them.

### Rebuild manually

Any time you want a new build:

1. Open **Actions**.
2. Select **Build Infernum IDE Portable**.
3. Click **Run workflow → Run workflow**.
4. Open the run after it finishes and download both artifacts.

The optional `vscode_ref` field defaults to `main`. Leave it unchanged unless you specifically want to build against a VS Code branch, tag or commit.

## What happens in GitHub Actions

The workflow automatically installs the required tools on GitHub-hosted runners (not on your PC): Node.js `24.22.1`, pnpm `12.16.0`, Python `3.11`, Rust, and the platform's native build dependencies. Current VS Code upstream declares `pnpm@12.16.0` and Node `24.22.1`, so the build script uses pnpm for the VS Code source tree. The standalone Infernum extension has its own npm install/test step.

The script downloads VS Code OSS at `VSCODE_REF`, overlays Infernum product branding, bundles the Infernum Code extension, runs the platform Gulp build, creates the portable `data/` folder, and archives the app.

## Portable build outputs

### Windows x64

`Infernum-IDE-win32-x64-portable.zip`

Extract it anywhere and run `Start Infernum IDE.cmd`. A `data/` directory is included next to the application for portable user data.

### Linux x64

`Infernum-IDE-linux-x64-portable.tar.gz`

Extract it and run:

```bash
./infernum-ide
```

A `data/` directory is included next to the app binary. Linux system libraries required by Electron/VS Code must still be present on the host distribution.

## Optional: local build

Local compilation is not required. For maintainers who deliberately want to build locally, the upstream VS Code source tree needs Node.js `24.22.1`, pnpm `12.16.0`, Python `3.11`, Rust and native platform build dependencies. Use a native Windows runner for Windows and native Linux for Linux; cross-platform packaging is intentionally rejected.

## Extensions marketplace

Infernum IDE uses **Open VSX** for extension discovery and installation. Some extensions distributed only through Microsoft's Visual Studio Marketplace may not be available in this OSS distribution.

## AI behaviour

Infernum Code 0.3.1 is bundled (from the 0.3.0 product branch). It provides a single global Primary Model across Chat and Agent Mode, provider connections and local AI integrations. API keys are stored using VS Code SecretStorage. Editor Mode disables Infernum AI commands; AI Workspace and AI + Editor expose the AI interface.

## Build validation notes

The source kit includes unit tests for build helpers and the bundled extension. GitHub Actions is the intended full-build environment. Full VS Code compilation is resource-intensive and has not been executed inside this chat session; the portable Windows/Linux archives are produced only after the GitHub runner completes the native build jobs successfully.

## Upstream references

- [Current VS Code package.json](https://github.com/microsoft/vscode/blob/main/package.json) — current upstream package manager pin.
- [VS Code build instructions](https://github.com/microsoft/vscode/wiki/How-to-Contribute#packaging) — platform Gulp packaging tasks and prerequisites.
- [VS Code Windows packaging task](https://github.com/microsoft/vscode/blob/main/build/gulpfile.vscode.win32.ts) — Windows output layout.
- [Open VSX](https://open-vsx.org/) — extension registry used by this distribution.

## License notes

The Infernum extension retains its MIT license. VS Code OSS source and notices retain their upstream licenses and are included in the build. This project is an independent distribution and is not an official Microsoft product.
