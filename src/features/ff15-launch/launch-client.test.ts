import { describe, expect, it, vi } from "vitest";
import {
	createFf15LaunchClient,
	DEFAULT_FF15_LAUNCH_CLIENT_ID,
	resolveFf15LaunchClientId,
} from "./launch-client";

describe("resolveFf15LaunchClientId", () => {
	it("defaults to GitHub Copilot CLI when no setting is present", () => {
		expect(resolveFf15LaunchClientId(undefined)).toBe(
			DEFAULT_FF15_LAUNCH_CLIENT_ID
		);
	});

	it("falls back to the default when the setting is unsupported", () => {
		expect(resolveFf15LaunchClientId("something-else")).toBe(
			DEFAULT_FF15_LAUNCH_CLIENT_ID
		);
	});

	it("preserves a supported explicit launch client", () => {
		expect(resolveFf15LaunchClientId("opencode")).toBe("opencode");
	});
});

describe("createFf15LaunchClient", () => {
	it("creates the default GitHub Copilot CLI launch plan", async () => {
		const ensureCommandAvailable = vi.fn().mockResolvedValue(undefined);
		const resolveCopilotCommand = vi.fn(() => "C:/tools/copilot.exe");
		const resolveOpenCodeCommand = vi.fn(() => "C:/tools/opencode.exe");

		const launchClient = createFf15LaunchClient("github-copilot-cli", {
			ensureCommandAvailable,
			resolveCopilotCommand: () => ({
				args: [],
				executable: resolveCopilotCommand(),
			}),
			resolveOpenCodeCommand,
		});

		await launchClient.ensureDependenciesAvailable();

		expect(ensureCommandAvailable).toHaveBeenCalledWith("copilot");
		expect(launchClient.getMissingDependencyMessage()).toBe(
			"FF15 launch requires GitHub Copilot CLI `copilot` on PATH."
		);
		expect(launchClient.getPaneLaunchPlan()).toEqual([
			{
				agentId: "noctis",
				args: ["--agent", "noctis"],
				executable: "C:/tools/copilot.exe",
			},
			{
				agentId: "ignis",
				args: ["--agent", "ignis"],
				executable: "C:/tools/copilot.exe",
			},
			{
				agentId: "gladiolus",
				args: ["--agent", "gladiolus"],
				executable: "C:/tools/copilot.exe",
			},
			{
				agentId: "prompto",
				args: ["--agent", "prompto"],
				executable: "C:/tools/copilot.exe",
			},
		]);
		expect(resolveCopilotCommand).toHaveBeenCalledTimes(1);
		expect(resolveOpenCodeCommand).not.toHaveBeenCalled();
	});

	it("creates the OpenCode launch plan with per-agent arguments", async () => {
		const ensureCommandAvailable = vi.fn().mockResolvedValue(undefined);
		const resolveCopilotCommand = vi.fn(() => "C:/tools/copilot.exe");
		const resolveOpenCodeCommand = vi.fn(() => "C:/tools/opencode.exe");

		const launchClient = createFf15LaunchClient("opencode", {
			ensureCommandAvailable,
			resolveCopilotCommand: () => ({
				args: [],
				executable: resolveCopilotCommand(),
			}),
			resolveOpenCodeCommand,
		});

		await launchClient.ensureDependenciesAvailable();

		expect(ensureCommandAvailable).toHaveBeenCalledWith("opencode");
		expect(launchClient.getMissingDependencyMessage()).toBe(
			"FF15 launch requires `opencode` on PATH."
		);
		expect(launchClient.getPaneLaunchPlan()).toEqual([
			{
				agentId: "noctis",
				args: ["--agent", "noctis"],
				executable: "C:/tools/opencode.exe",
			},
			{
				agentId: "ignis",
				args: ["--agent", "ignis"],
				executable: "C:/tools/opencode.exe",
			},
			{
				agentId: "gladiolus",
				args: ["--agent", "gladiolus"],
				executable: "C:/tools/opencode.exe",
			},
			{
				agentId: "prompto",
				args: ["--agent", "prompto"],
				executable: "C:/tools/opencode.exe",
			},
		]);
		expect(resolveCopilotCommand).not.toHaveBeenCalled();
	});

	it("preserves resolved Copilot command arguments in the pane launch plan", () => {
		const launchClient = createFf15LaunchClient("github-copilot-cli", {
			ensureCommandAvailable: vi.fn().mockResolvedValue(undefined),
			resolveCopilotCommand: () => ({
				args: [
					"C:/Users/test/AppData/Roaming/npm/node_modules/@github/copilot/npm-loader.js",
				],
				executable: "node",
			}),
			resolveOpenCodeCommand: vi.fn(() => "C:/tools/opencode.exe"),
		});

		expect(launchClient.getPaneLaunchPlan()).toEqual([
			{
				agentId: "noctis",
				args: [
					"C:/Users/test/AppData/Roaming/npm/node_modules/@github/copilot/npm-loader.js",
					"--agent",
					"noctis",
				],
				executable: "node",
			},
			{
				agentId: "ignis",
				args: [
					"C:/Users/test/AppData/Roaming/npm/node_modules/@github/copilot/npm-loader.js",
					"--agent",
					"ignis",
				],
				executable: "node",
			},
			{
				agentId: "gladiolus",
				args: [
					"C:/Users/test/AppData/Roaming/npm/node_modules/@github/copilot/npm-loader.js",
					"--agent",
					"gladiolus",
				],
				executable: "node",
			},
			{
				agentId: "prompto",
				args: [
					"C:/Users/test/AppData/Roaming/npm/node_modules/@github/copilot/npm-loader.js",
					"--agent",
					"prompto",
				],
				executable: "node",
			},
		]);
	});
});
