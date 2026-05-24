import type {
	Ff15LaunchClient,
	Ff15PaneLaunchPlanEntry,
} from "./launch-client";

export interface LaunchTerminalInput {
	cwd: string;
	name: string;
	executable: string;
	args?: string[];
}

export interface Ff15LaunchControllerDependencies {
	ensureCommandAvailable: (command: string) => Promise<void>;
	getLaunchClient: () => Ff15LaunchClient;
	getLaunchLayoutPath: (
		workspaceRoot: string,
		paneLaunchPlan: readonly Ff15PaneLaunchPlanEntry[]
	) => string;
	getWorkspaceRoot: () => string | undefined;
	launchTerminal: (input: LaunchTerminalInput) => Promise<void> | void;
	showErrorMessage: (message: string) => Promise<void> | void;
}

export interface LaunchResult {
	cwd?: string;
	message?: string;
	status: "error" | "launched";
}
