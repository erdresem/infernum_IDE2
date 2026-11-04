"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const manager_1 = require("./agents/manager");
const engine_1 = require("./agents/engine");
const registry_1 = require("./providers/registry");
const context_1 = require("./workspace/context");
const tools_1 = require("./workspace/tools");
const view_provider_1 = require("./ui/view-provider");
const MODE_LABELS = {
    editor: 'Editor Mode · AI Off',
    ai: 'AI Workspace · No Editor',
    hybrid: 'AI + Editor'
};
async function activate(context) {
    const manager = new manager_1.AgentManager(context);
    await manager.initialize();
    const registry = new registry_1.ProviderRegistry();
    const contextManager = new context_1.ContextManager();
    const workspaceTools = new tools_1.WorkspaceTools(context);
    const engine = new engine_1.AgentEngine(manager, registry, contextManager, workspaceTools);
    const view = new view_provider_1.InfernumViewProvider(context, manager, registry, engine, workspaceTools);
    let aiPanel;
    let activeMode = context.globalState.get('infernum.ideMode', 'hybrid');
    const modeStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    modeStatus.command = 'infernum.selectMode';
    modeStatus.tooltip = 'Change Infernum IDE workspace mode';
    context.subscriptions.push(modeStatus);
    const updateModeStatus = () => {
        modeStatus.text = `$(layout) Infernum: ${MODE_LABELS[activeMode]}`;
        modeStatus.show();
    };
    const closeAiPanel = () => {
        if (aiPanel) {
            const old = aiPanel;
            aiPanel = undefined;
            old.dispose();
        }
    };
    const showAiPanel = async () => {
        if (aiPanel) {
            aiPanel.reveal(vscode.ViewColumn.One, false);
            return;
        }
        aiPanel = vscode.window.createWebviewPanel('infernum.aiWorkspace', 'Infernum AI Workspace', vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'webview'), vscode.Uri.joinPath(context.extensionUri, 'media')] });
        view.resolveWebviewPanel(aiPanel);
        view.setActiveSurface('panel');
        aiPanel.onDidDispose(() => { aiPanel = undefined; });
    };
    const applyMode = async (mode, persist = true) => {
        activeMode = mode;
        if (persist)
            await context.globalState.update('infernum.ideMode', mode);
        await vscode.commands.executeCommand('setContext', 'infernum.ideMode', mode);
        await vscode.commands.executeCommand('setContext', 'infernum.aiEnabled', mode !== 'editor');
        view.setAiEnabled(mode !== 'editor');
        if (mode === 'editor') {
            closeAiPanel();
            view.setActiveSurface('none');
            await vscode.commands.executeCommand('workbench.action.closeSidebar');
        }
        else if (mode === 'ai') {
            await vscode.commands.executeCommand('workbench.action.closeSidebar');
            await vscode.commands.executeCommand('workbench.action.closePanel');
            await showAiPanel();
        }
        else {
            closeAiPanel();
            await vscode.commands.executeCommand('workbench.view.extension.infernum');
            view.setActiveSurface('sidebar');
        }
        updateModeStatus();
    };
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('infernum.sidebar', view, { webviewOptions: { retainContextWhenHidden: true } }));
    context.subscriptions.push(vscode.commands.registerCommand('infernum.mode.editor', () => applyMode('editor')));
    context.subscriptions.push(vscode.commands.registerCommand('infernum.mode.ai', () => applyMode('ai')));
    context.subscriptions.push(vscode.commands.registerCommand('infernum.mode.hybrid', () => applyMode('hybrid')));
    context.subscriptions.push(vscode.commands.registerCommand('infernum.selectMode', async () => {
        const picked = await vscode.window.showQuickPick([
            { label: '$(code) Editor Mode', description: 'VS Code editor, extensions and terminal. AI disabled.', mode: 'editor' },
            { label: '$(comment-discussion) AI Workspace', description: 'Infernum AI in the main workspace. No visible code editor.', mode: 'ai' },
            { label: '$(layout-sidebar-right) AI + Editor', description: 'Code editor with Infernum AI sidebar.', mode: 'hybrid' }
        ], { placeHolder: 'Choose how Infernum IDE should work' });
        if (picked)
            await applyMode(picked.mode);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('infernum.open', async () => {
        if (activeMode === 'ai')
            await showAiPanel();
        else if (activeMode === 'hybrid')
            await vscode.commands.executeCommand('workbench.view.extension.infernum');
        else
            await vscode.window.showInformationMessage('AI is disabled in Editor Mode. Switch to AI Workspace or AI + Editor from the Infernum status bar.');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('infernum.addAgent', async () => {
        if (activeMode === 'editor')
            await applyMode('hybrid');
        if (activeMode === 'ai') {
            await showAiPanel();
            setTimeout(() => view.openHub(), 250);
        }
        else {
            await vscode.commands.executeCommand('workbench.view.extension.infernum');
            setTimeout(() => view.openHub(), 250);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('infernum.cancel', () => view.cancel()));
    context.subscriptions.push(vscode.commands.registerCommand('infernum.importAgent', () => view.requestImport()));
    context.subscriptions.push(vscode.commands.registerCommand('infernum.exportAgent', async () => {
        const agent = manager.agents().find((item) => item.id === manager.activeAgentId());
        if (agent)
            await view.requestExport(agent.id);
    }));
    const promptCommand = (command, mode, instruction) => vscode.commands.registerCommand(command, async () => {
        if (activeMode === 'editor') {
            await vscode.window.showInformationMessage('Infernum AI is turned off in Editor Mode. Switch to AI + Editor or AI Workspace to use it.');
            return;
        }
        const editor = vscode.window.activeTextEditor;
        const selection = editor && !editor.selection.isEmpty ? editor.document.getText(editor.selection) : '';
        const currentFile = editor ? `\nFile: ${vscode.workspace.asRelativePath(editor.document.uri)}` : '';
        let prompt = `${instruction}${currentFile}${selection ? `\n\nSelected code:\n\`\`\`\n${selection}\n\`\`\`` : ''}`;
        if (!selection && mode === 'chat') {
            const entered = await vscode.window.showInputBox({ prompt: 'What would you like Infernum to help with?', placeHolder: 'Ask about your project…' });
            if (!entered)
                return;
            prompt = entered;
        }
        if (activeMode === 'ai')
            await showAiPanel();
        else {
            await vscode.commands.executeCommand('workbench.view.extension.infernum');
            view.setActiveSurface('sidebar');
        }
        setTimeout(() => view.prefill(mode, prompt), 250);
    });
    context.subscriptions.push(promptCommand('infernum.ask', 'chat', 'Help me with the selected code.'));
    context.subscriptions.push(promptCommand('infernum.fix', 'agent', 'Investigate and fix the issue in the selected code. Use workspace tools and propose diffs; do not apply changes without my approval.'));
    context.subscriptions.push(promptCommand('infernum.explain', 'explain', 'Explain the selected code, its behavior and any important caveats.'));
    context.subscriptions.push(promptCommand('infernum.refactor', 'agent', 'Refactor the selected code while preserving behavior. Inspect related files and propose diffs for my review.'));
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('workbench.colorTheme'))
            view.refreshTheme();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('infernum.refresh', () => view.refresh()));
    context.subscriptions.push(vscode.commands.registerCommand('infernum.showDiffs', () => view.showPending()));
    // Restore the last selected layout after the workbench is ready.
    if (vscode.workspace.getConfiguration('infernum').get('restoreMode', true)) {
        await applyMode(activeMode, false);
    }
    else {
        await applyMode('hybrid', false);
    }
}
function deactivate() { }
//# sourceMappingURL=extension.js.map