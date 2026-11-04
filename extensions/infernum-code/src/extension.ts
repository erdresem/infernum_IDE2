import * as vscode from 'vscode';
import { AgentManager } from './agents/manager';
import { AgentEngine } from './agents/engine';
import { ProviderRegistry } from './providers/registry';
import { ContextManager } from './workspace/context';
import { WorkspaceTools } from './workspace/tools';
import { InfernumViewProvider } from './ui/view-provider';

type IdeMode = 'editor' | 'ai' | 'hybrid';
const MODE_LABELS: Record<IdeMode, string> = {
  editor: 'Editor Mode · AI Off',
  ai: 'AI Workspace · No Editor',
  hybrid: 'AI + Editor'
};

export async function activate(context: any): Promise<void> {
  const manager = new AgentManager(context);
  await manager.initialize();
  const registry = new ProviderRegistry();
  const contextManager = new ContextManager();
  const workspaceTools = new WorkspaceTools(context);
  const engine = new AgentEngine(manager, registry, contextManager, workspaceTools);
  const view = new InfernumViewProvider(context, manager, registry, engine, workspaceTools);

  let aiPanel: any;
  let activeMode: IdeMode = context.globalState.get('infernum.ideMode', 'hybrid');
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
    aiPanel = vscode.window.createWebviewPanel(
      'infernum.aiWorkspace',
      'Infernum AI Workspace',
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'webview'), vscode.Uri.joinPath(context.extensionUri, 'media')] }
    );
    view.resolveWebviewPanel(aiPanel);
    view.setActiveSurface('panel');
    aiPanel.onDidDispose(() => { aiPanel = undefined; });
  };

  const applyMode = async (mode: IdeMode, persist = true) => {
    activeMode = mode;
    if (persist) await context.globalState.update('infernum.ideMode', mode);
    await vscode.commands.executeCommand('setContext', 'infernum.ideMode', mode);
    await vscode.commands.executeCommand('setContext', 'infernum.aiEnabled', mode !== 'editor');
    view.setAiEnabled(mode !== 'editor');
    if (mode === 'editor') {
      closeAiPanel();
      view.setActiveSurface('none');
      await vscode.commands.executeCommand('workbench.action.closeSidebar');
    } else if (mode === 'ai') {
      await vscode.commands.executeCommand('workbench.action.closeSidebar');
      await vscode.commands.executeCommand('workbench.action.closePanel');
      await showAiPanel();
    } else {
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
      { label: '$(code) Editor Mode', description: 'VS Code editor, extensions and terminal. AI disabled.', mode: 'editor' as IdeMode },
      { label: '$(comment-discussion) AI Workspace', description: 'Infernum AI in the main workspace. No visible code editor.', mode: 'ai' as IdeMode },
      { label: '$(layout-sidebar-right) AI + Editor', description: 'Code editor with Infernum AI sidebar.', mode: 'hybrid' as IdeMode }
    ], { placeHolder: 'Choose how Infernum IDE should work' });
    if (picked) await applyMode(picked.mode);
  }));

  context.subscriptions.push(vscode.commands.registerCommand('infernum.open', async () => {
    if (activeMode === 'ai') await showAiPanel();
    else if (activeMode === 'hybrid') await vscode.commands.executeCommand('workbench.view.extension.infernum');
    else await vscode.window.showInformationMessage('AI is disabled in Editor Mode. Switch to AI Workspace or AI + Editor from the Infernum status bar.');
  }));
  context.subscriptions.push(vscode.commands.registerCommand('infernum.addAgent', async () => {
    if (activeMode === 'editor') await applyMode('hybrid');
    if (activeMode === 'ai') { await showAiPanel(); setTimeout(() => view.openHub(), 250); }
    else { await vscode.commands.executeCommand('workbench.view.extension.infernum'); setTimeout(() => view.openHub(), 250); }
  }));
  context.subscriptions.push(vscode.commands.registerCommand('infernum.cancel', () => view.cancel()));
  context.subscriptions.push(vscode.commands.registerCommand('infernum.importAgent', () => view.requestImport()));
  context.subscriptions.push(vscode.commands.registerCommand('infernum.exportAgent', async () => {
    const agent = manager.agents().find((item: any) => item.id === manager.activeAgentId());
    if (agent) await view.requestExport(agent.id);
  }));

  const promptCommand = (command: string, mode: string, instruction: string) => vscode.commands.registerCommand(command, async () => {
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
      if (!entered) return;
      prompt = entered;
    }
    if (activeMode === 'ai') await showAiPanel();
    else { await vscode.commands.executeCommand('workbench.view.extension.infernum'); view.setActiveSurface('sidebar'); }
    setTimeout(() => view.prefill(mode, prompt), 250);
  });
  context.subscriptions.push(promptCommand('infernum.ask', 'chat', 'Help me with the selected code.'));
  context.subscriptions.push(promptCommand('infernum.fix', 'agent', 'Investigate and fix the issue in the selected code. Use workspace tools and propose diffs; do not apply changes without my approval.'));
  context.subscriptions.push(promptCommand('infernum.explain', 'explain', 'Explain the selected code, its behavior and any important caveats.'));
  context.subscriptions.push(promptCommand('infernum.refactor', 'agent', 'Refactor the selected code while preserving behavior. Inspect related files and propose diffs for my review.'));

  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event: any) => {
    if (event.affectsConfiguration('workbench.colorTheme')) view.refreshTheme();
  }));
  context.subscriptions.push(vscode.commands.registerCommand('infernum.refresh', () => view.refresh()));
  context.subscriptions.push(vscode.commands.registerCommand('infernum.showDiffs', () => view.showPending()));

  // Restore the last selected layout after the workbench is ready.
  if (vscode.workspace.getConfiguration('infernum').get('restoreMode', true)) {
    await applyMode(activeMode, false);
  } else {
    await applyMode('hybrid', false);
  }
}

export function deactivate(): void { /* VS Code disposes registered subscriptions. */ }
