import { window, workspace } from "vscode";

export const resolveActiveWorkspaceRoot = (): string | undefined => {
	const activeDocumentUri = window.activeTextEditor?.document.uri;
	const activeWorkspaceFolder = activeDocumentUri
		? workspace.getWorkspaceFolder(activeDocumentUri)
		: undefined;

	return (
		activeWorkspaceFolder?.uri.fsPath ??
		workspace.workspaceFolders?.[0]?.uri.fsPath
	);
};
