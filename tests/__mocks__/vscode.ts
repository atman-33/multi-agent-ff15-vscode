/** biome-ignore-all lint/nursery/noUselessUndefined: ignore */
const createDisposable = () => ({ dispose: () => undefined });

export const commands = {
	registerCommand: () => createDisposable(),
	executeCommand: async () => undefined,
};

export const window = {
	showInformationMessage: async () => undefined,
};

export const workspace = {
	getConfiguration: () => ({ get: () => undefined }),
};

export type Disposable = ReturnType<typeof createDisposable>;
