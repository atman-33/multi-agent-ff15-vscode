/** biome-ignore-all lint/nursery/noUselessUndefined: ignore */
const createDisposable = () => ({ dispose: () => undefined });

const createTerminalHandle = () => ({
	dispose: () => undefined,
	sendText: () => undefined,
	show: () => undefined,
});

export const commands = {
	registerCommand: () => createDisposable(),
	executeCommand: async () => undefined,
};

export const window = {
	activeTextEditor: undefined,
	createTerminal: () => createTerminalHandle(),
	showErrorMessage: async () => undefined,
	showInformationMessage: async () => undefined,
};

export const workspace = {
	getWorkspaceFolder: () => undefined,
	workspaceFolders: undefined,
	getConfiguration: () => ({ get: () => undefined }),
};

export type Disposable = ReturnType<typeof createDisposable>;
