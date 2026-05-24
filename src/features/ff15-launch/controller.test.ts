import { describe, expect, it, vi } from "vitest";
import {
	createFf15LaunchController,
	MISSING_WORKSPACE_MESSAGE,
	MISSING_ZELLIJ_MESSAGE,
} from "./controller";

const createPaneLaunchPlan = () =>
	[
		{ agentId: "noctis", args: [], executable: "copilot" },
		{ agentId: "ignis", args: [], executable: "copilot" },
		{ agentId: "gladiolus", args: [], executable: "copilot" },
		{ agentId: "prompto", args: [], executable: "copilot" },
	] as const;

const createLaunchClient = (overrides?: {
	ensureDependenciesAvailable?: ReturnType<typeof vi.fn>;
	getMissingDependencyMessage?: ReturnType<typeof vi.fn>;
	getPaneLaunchPlan?: ReturnType<typeof vi.fn>;
}) => ({
	ensureDependenciesAvailable:
		overrides?.ensureDependenciesAvailable ??
		vi.fn().mockResolvedValue(undefined),
	getMissingDependencyMessage:
		overrides?.getMissingDependencyMessage ??
		vi
			.fn()
			.mockReturnValue(
				"FF15 launch requires GitHub Copilot CLI `copilot` on PATH."
			),
	getPaneLaunchPlan:
		overrides?.getPaneLaunchPlan ??
		vi.fn().mockReturnValue(createPaneLaunchPlan()),
});

describe("createFf15LaunchController", () => {
	it("launches zellij for the resolved workspace when the selected launch client is available", async () => {
		const ensureCommandAvailable = vi.fn().mockResolvedValue(undefined);
		const launchClient = createLaunchClient();
		const getLaunchLayoutPath = vi
			.fn<
				(
					workspaceRoot: string,
					paneLaunchPlan: ReturnType<typeof createPaneLaunchPlan>
				) => string
			>()
			.mockReturnValue("C:/temp/ff15-roster.kdl");
		const launchTerminal = vi.fn().mockResolvedValue(undefined);
		const showErrorMessage = vi.fn().mockResolvedValue(undefined);

		const controller = createFf15LaunchController({
			ensureCommandAvailable,
			getLaunchClient: () => launchClient,
			getLaunchLayoutPath,
			getWorkspaceRoot: () => "C:/repo",
			launchTerminal,
			showErrorMessage,
		});

		const result = await controller.launch();

		expect(result).toEqual({
			cwd: "C:/repo",
			status: "launched",
		});
		expect(ensureCommandAvailable).toHaveBeenCalledTimes(1);
		expect(ensureCommandAvailable).toHaveBeenCalledWith("zellij");
		expect(launchClient.ensureDependenciesAvailable).toHaveBeenCalledTimes(1);
		expect(getLaunchLayoutPath).toHaveBeenCalledWith(
			"C:/repo",
			createPaneLaunchPlan()
		);
		expect(launchTerminal).toHaveBeenCalledWith({
			cwd: "C:/repo",
			executable: "zellij",
			args: ["--layout", "C:/temp/ff15-roster.kdl"],
			name: "FF15",
		});
		expect(showErrorMessage).not.toHaveBeenCalled();
	});

	it("shows an error when no workspace root can be resolved", async () => {
		const ensureCommandAvailable = vi.fn().mockResolvedValue(undefined);
		const launchClient = createLaunchClient();
		const getLaunchLayoutPath = vi.fn();
		const launchTerminal = vi.fn().mockResolvedValue(undefined);
		const showErrorMessage = vi.fn().mockResolvedValue(undefined);
		const getWorkspaceRoot = () => ["C:/repo"][1];

		const controller = createFf15LaunchController({
			ensureCommandAvailable,
			getLaunchClient: () => launchClient,
			getLaunchLayoutPath,
			getWorkspaceRoot,
			launchTerminal,
			showErrorMessage,
		});

		const result = await controller.launch();

		expect(result).toEqual({
			message: MISSING_WORKSPACE_MESSAGE,
			status: "error",
		});
		expect(showErrorMessage).toHaveBeenCalledWith(MISSING_WORKSPACE_MESSAGE);
		expect(ensureCommandAvailable).not.toHaveBeenCalled();
		expect(launchClient.ensureDependenciesAvailable).not.toHaveBeenCalled();
		expect(getLaunchLayoutPath).not.toHaveBeenCalled();
		expect(launchTerminal).not.toHaveBeenCalled();
	});

	it("shows an error when zellij is unavailable", async () => {
		const ensureCommandAvailable = vi
			.fn()
			.mockRejectedValueOnce(new Error("missing zellij"));
		const launchClient = createLaunchClient();
		const getLaunchLayoutPath = vi.fn();
		const launchTerminal = vi.fn().mockResolvedValue(undefined);
		const showErrorMessage = vi.fn().mockResolvedValue(undefined);

		const controller = createFf15LaunchController({
			ensureCommandAvailable,
			getLaunchClient: () => launchClient,
			getLaunchLayoutPath,
			getWorkspaceRoot: () => "C:/repo",
			launchTerminal,
			showErrorMessage,
		});

		const result = await controller.launch();

		expect(result).toEqual({
			cwd: "C:/repo",
			message: MISSING_ZELLIJ_MESSAGE,
			status: "error",
		});
		expect(showErrorMessage).toHaveBeenCalledWith(MISSING_ZELLIJ_MESSAGE);
		expect(ensureCommandAvailable).toHaveBeenCalledTimes(1);
		expect(launchClient.ensureDependenciesAvailable).not.toHaveBeenCalled();
		expect(getLaunchLayoutPath).not.toHaveBeenCalled();
		expect(launchTerminal).not.toHaveBeenCalled();
	});

	it("shows an error when the selected launch client is unavailable", async () => {
		const ensureCommandAvailable = vi.fn().mockResolvedValue(undefined);
		const launchClient = createLaunchClient({
			ensureDependenciesAvailable: vi
				.fn()
				.mockRejectedValue(new Error("missing copilot")),
			getMissingDependencyMessage: vi
				.fn()
				.mockReturnValue(
					"FF15 launch requires GitHub Copilot CLI `copilot` on PATH."
				),
		});
		const getLaunchLayoutPath = vi.fn();
		const launchTerminal = vi.fn().mockResolvedValue(undefined);
		const showErrorMessage = vi.fn().mockResolvedValue(undefined);

		const controller = createFf15LaunchController({
			ensureCommandAvailable,
			getLaunchClient: () => launchClient,
			getLaunchLayoutPath,
			getWorkspaceRoot: () => "C:/repo",
			launchTerminal,
			showErrorMessage,
		});

		const result = await controller.launch();

		expect(result).toEqual({
			cwd: "C:/repo",
			message: "FF15 launch requires GitHub Copilot CLI `copilot` on PATH.",
			status: "error",
		});
		expect(showErrorMessage).toHaveBeenCalledWith(
			"FF15 launch requires GitHub Copilot CLI `copilot` on PATH."
		);
		expect(ensureCommandAvailable).toHaveBeenCalledTimes(1);
		expect(launchClient.ensureDependenciesAvailable).toHaveBeenCalledTimes(1);
		expect(launchClient.getPaneLaunchPlan).not.toHaveBeenCalled();
		expect(getLaunchLayoutPath).not.toHaveBeenCalled();
		expect(launchTerminal).not.toHaveBeenCalled();
	});
});
