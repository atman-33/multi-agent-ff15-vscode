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
		const resolveOpenCodeCommand = vi.fn(() => "C:/tools/opencode.exe");

		const launchClient = createFf15LaunchClient("github-copilot-cli", {
			ensureCommandAvailable,
			resolveOpenCodeCommand,
		});

		await launchClient.ensureDependenciesAvailable();

		expect(ensureCommandAvailable).toHaveBeenCalledWith("copilot");
		expect(launchClient.getMissingDependencyMessage()).toBe(
			"FF15 launch requires GitHub Copilot CLI `copilot` on PATH."
		);
		expect(launchClient.getPaneLaunchPlan()).toEqual([
			{ agentId: "noctis", args: [], executable: "copilot" },
			{ agentId: "ignis", args: [], executable: "copilot" },
			{ agentId: "gladiolus", args: [], executable: "copilot" },
			{ agentId: "prompto", args: [], executable: "copilot" },
		]);
		expect(resolveOpenCodeCommand).not.toHaveBeenCalled();
	});

	it("creates the OpenCode launch plan with per-agent arguments", async () => {
		const ensureCommandAvailable = vi.fn().mockResolvedValue(undefined);
		const resolveOpenCodeCommand = vi.fn(() => "C:/tools/opencode.exe");

		const launchClient = createFf15LaunchClient("opencode", {
			ensureCommandAvailable,
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
	});
});
