export interface LaunchTerminalInput {
	cwd: string;
	name: string;
	executable: string;
	args?: string[];
}

export interface Ff15LaunchControllerDependencies {
	ensureCommandAvailable: (command: string) => Promise<void>;
	getBundledLayoutPath: () => string;
	getWorkspaceRoot: () => string | undefined;
	launchTerminal: (input: LaunchTerminalInput) => Promise<void> | void;
	showErrorMessage: (message: string) => Promise<void> | void;
}

export interface LaunchResult {
	cwd?: string;
	message?: string;
	status: "error" | "launched";
}
