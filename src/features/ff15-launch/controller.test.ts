import { describe, expect, it, vi } from "vitest";
import {
	createFf15LaunchController,
	MISSING_OPENCODE_MESSAGE,
	MISSING_WORKSPACE_MESSAGE,
	MISSING_ZELLIJ_MESSAGE,
} from "./controller";

describe("createFf15LaunchController", () => {
	it("launches zellij for the resolved workspace when dependencies are available", async () => {
		const ensureCommandAvailable = vi.fn().mockResolvedValue(undefined);
		const launchTerminal = vi.fn().mockResolvedValue(undefined);
		const showErrorMessage = vi.fn().mockResolvedValue(undefined);
		const getBundledLayoutPath = () => "C:/extension/assets/ff15-roster.kdl";

		const controller = createFf15LaunchController({
			ensureCommandAvailable,
			getBundledLayoutPath,
			getWorkspaceRoot: () => "C:/repo",
			launchTerminal,
			showErrorMessage,
		});

		const result = await controller.launch();

		expect(result).toEqual({
			cwd: "C:/repo",
			status: "launched",
		});
		expect(ensureCommandAvailable).toHaveBeenNthCalledWith(1, "zellij");
		expect(ensureCommandAvailable).toHaveBeenNthCalledWith(2, "opencode");
		expect(launchTerminal).toHaveBeenCalledWith({
			cwd: "C:/repo",
			executable: "zellij",
			args: ["--layout", "C:/extension/assets/ff15-roster.kdl"],
			name: "FF15",
		});
		expect(showErrorMessage).not.toHaveBeenCalled();
	});

	it("shows an error when no workspace root can be resolved", async () => {
		const ensureCommandAvailable = vi.fn().mockResolvedValue(undefined);
		const launchTerminal = vi.fn().mockResolvedValue(undefined);
		const showErrorMessage = vi.fn().mockResolvedValue(undefined);
		const getBundledLayoutPath = () => "C:/extension/assets/ff15-roster.kdl";
		const getWorkspaceRoot = () => ["C:/repo"][1];

		const controller = createFf15LaunchController({
			ensureCommandAvailable,
			getBundledLayoutPath,
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
		expect(launchTerminal).not.toHaveBeenCalled();
	});

	it("shows an error when zellij is unavailable", async () => {
		const ensureCommandAvailable = vi
			.fn()
			.mockRejectedValueOnce(new Error("missing zellij"));
		const launchTerminal = vi.fn().mockResolvedValue(undefined);
		const showErrorMessage = vi.fn().mockResolvedValue(undefined);
		const getBundledLayoutPath = () => "C:/extension/assets/ff15-roster.kdl";

		const controller = createFf15LaunchController({
			ensureCommandAvailable,
			getBundledLayoutPath,
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
		expect(launchTerminal).not.toHaveBeenCalled();
	});

	it("shows an error when opencode is unavailable", async () => {
		const ensureCommandAvailable = vi
			.fn()
			.mockResolvedValueOnce(undefined)
			.mockRejectedValueOnce(new Error("missing opencode"));
		const launchTerminal = vi.fn().mockResolvedValue(undefined);
		const showErrorMessage = vi.fn().mockResolvedValue(undefined);
		const getBundledLayoutPath = () => "C:/extension/assets/ff15-roster.kdl";

		const controller = createFf15LaunchController({
			ensureCommandAvailable,
			getBundledLayoutPath,
			getWorkspaceRoot: () => "C:/repo",
			launchTerminal,
			showErrorMessage,
		});

		const result = await controller.launch();

		expect(result).toEqual({
			cwd: "C:/repo",
			message: MISSING_OPENCODE_MESSAGE,
			status: "error",
		});
		expect(showErrorMessage).toHaveBeenCalledWith(MISSING_OPENCODE_MESSAGE);
		expect(ensureCommandAvailable).toHaveBeenCalledTimes(2);
		expect(launchTerminal).not.toHaveBeenCalled();
	});
});
