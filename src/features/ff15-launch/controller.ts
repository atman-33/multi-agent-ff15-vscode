import type { Ff15LaunchControllerDependencies, LaunchResult } from "./types";

export const MISSING_WORKSPACE_MESSAGE =
	"Open a workspace folder to launch FF15.";
export const MISSING_ZELLIJ_MESSAGE = "FF15 launch requires `zellij` on PATH.";

const TERMINAL_EXECUTABLE = "zellij";
const TERMINAL_NAME = "FF15";

export const createFf15LaunchController = (
	dependencies: Ff15LaunchControllerDependencies
) => ({
	async launch(): Promise<LaunchResult> {
		const workspaceRoot = dependencies.getWorkspaceRoot();
		if (!workspaceRoot) {
			await dependencies.showErrorMessage(MISSING_WORKSPACE_MESSAGE);
			return {
				message: MISSING_WORKSPACE_MESSAGE,
				status: "error",
			};
		}

		const launchClient = dependencies.getLaunchClient();

		try {
			await dependencies.ensureCommandAvailable("zellij");
		} catch {
			await dependencies.showErrorMessage(MISSING_ZELLIJ_MESSAGE);
			return {
				cwd: workspaceRoot,
				message: MISSING_ZELLIJ_MESSAGE,
				status: "error",
			};
		}

		let paneLaunchPlan: ReturnType<typeof launchClient.getPaneLaunchPlan>;

		try {
			await launchClient.ensureDependenciesAvailable();
			paneLaunchPlan = launchClient.getPaneLaunchPlan();
		} catch {
			const message = launchClient.getMissingDependencyMessage();
			await dependencies.showErrorMessage(message);
			return {
				cwd: workspaceRoot,
				message,
				status: "error",
			};
		}

		const layoutPath = dependencies.getLaunchLayoutPath(
			workspaceRoot,
			paneLaunchPlan
		);

		await dependencies.launchTerminal({
			cwd: workspaceRoot,
			executable: TERMINAL_EXECUTABLE,
			args: ["--layout", layoutPath],
			name: TERMINAL_NAME,
		});

		return {
			cwd: workspaceRoot,
			status: "launched",
		};
	},
});
