import { describe, expect, it, vi } from "vitest";
import { createEmptyFf15MissionAgentPanes } from "./state";
import { createFf15MissionZellijTransport } from "./transport";

const createNoctisPaneLaunchPlanEntry = () =>
	({
		agentId: "noctis",
		args: ["--agent", "noctis"],
		executable: "copilot",
	}) as const;

const createAgentPanes = (noctisPaneId: string | null) => ({
	...createEmptyFf15MissionAgentPanes(),
	noctis: noctisPaneId,
});

const createPane = (id: number, agentId: string) => ({
	exited: false,
	id,
	is_plugin: false,
	is_selectable: true,
	pane_command: `copilot --agent ${agentId}`,
	title: "GitHub Copilot",
});

describe("createFf15MissionZellijTransport", () => {
	it("reuses an existing Noctis pane by reading the pane command metadata", async () => {
		const runZellijCommand = vi.fn().mockResolvedValue({
			stdout: JSON.stringify([
				createPane(0, "noctis"),
				createPane(1, "gladiolus"),
				createPane(2, "ignis"),
				createPane(3, "prompto"),
			]),
		});
		const transport = createFf15MissionZellijTransport({ runZellijCommand });

		const result = await transport.ensureMissionSession({
			missionId: "mission-1",
			paneLaunchPlanEntry: createNoctisPaneLaunchPlanEntry(),
			sessionName: "ff15-session",
			workspaceRoot: "C:/repo",
		});

		expect(result).toEqual({
			agentPanes: {
				...createEmptyFf15MissionAgentPanes(),
				gladiolus: "terminal_1",
				ignis: "terminal_2",
				noctis: "terminal_0",
				prompto: "terminal_3",
			},
			paneId: "terminal_0",
		});
		expect(runZellijCommand).toHaveBeenCalledTimes(1);
		expect(runZellijCommand).toHaveBeenCalledWith({
			args: ["--session", "ff15-session", "action", "list-panes", "--json"],
			cwd: "C:/repo",
		});
	});

	it("reuses the cached Noctis pane id when pane metadata no longer exposes the agent name", async () => {
		const runZellijCommand = vi.fn().mockResolvedValue({
			stdout: JSON.stringify([
				{
					exited: false,
					id: 7,
					is_plugin: false,
					is_selectable: true,
					title: "GitHub Copilot",
				},
			]),
		});
		const transport = createFf15MissionZellijTransport({ runZellijCommand });

		const result = await transport.ensureMissionSession({
			agentPanes: createAgentPanes("terminal_7"),
			missionId: "mission-1",
			paneLaunchPlanEntry: createNoctisPaneLaunchPlanEntry(),
			sessionName: "ff15-session",
			workspaceRoot: "C:/repo",
		});

		expect(result).toEqual({
			agentPanes: createAgentPanes("terminal_7"),
			paneId: "terminal_7",
		});
	});

	it("creates the mission session and opens a Noctis pane when the session does not exist yet", async () => {
		const runZellijCommand = vi
			.fn()
			.mockRejectedValueOnce(new Error("Session not found"))
			.mockResolvedValueOnce({ stdout: JSON.stringify([]) })
			.mockResolvedValueOnce({ stdout: "terminal_9\n" });
		const transport = createFf15MissionZellijTransport({ runZellijCommand });

		const result = await transport.ensureMissionSession({
			missionId: "mission-1",
			paneLaunchPlanEntry: createNoctisPaneLaunchPlanEntry(),
			sessionName: "ff15-session",
			workspaceRoot: "C:/repo",
		});

		expect(result).toEqual({
			agentPanes: createAgentPanes("terminal_9"),
			paneId: "terminal_9",
		});
		expect(runZellijCommand).toHaveBeenNthCalledWith(1, {
			args: ["--session", "ff15-session", "action", "list-panes", "--json"],
			cwd: "C:/repo",
		});
		expect(runZellijCommand).toHaveBeenNthCalledWith(2, {
			args: ["attach", "--create-background", "ff15-session"],
			cwd: "C:/repo",
		});
		expect(runZellijCommand).toHaveBeenNthCalledWith(3, {
			args: [
				"--session",
				"ff15-session",
				"action",
				"new-pane",
				"--name",
				"noctis",
				"--cwd",
				"C:/repo",
				"--",
				"copilot",
				"--agent",
				"noctis",
			],
			cwd: "C:/repo",
		});
	});

	it("reconciles mission agent panes from the current session", async () => {
		const runZellijCommand = vi.fn().mockResolvedValue({
			stdout: JSON.stringify([
				createPane(0, "noctis"),
				createPane(1, "gladiolus"),
				createPane(2, "ignis"),
				createPane(3, "prompto"),
			]),
		});
		const transport = createFf15MissionZellijTransport({ runZellijCommand });

		const agentPanes = await transport.reconcileMissionAgentPanes({
			agentPanes: createAgentPanes("terminal_9"),
			sessionName: "ff15-session",
			workspaceRoot: "C:/repo",
		});

		expect(agentPanes).toEqual({
			...createEmptyFf15MissionAgentPanes(),
			gladiolus: "terminal_1",
			ignis: "terminal_2",
			noctis: "terminal_0",
			prompto: "terminal_3",
		});
	});

	it("sends the prompt and trailing Enter through Zellij external control", async () => {
		const runZellijCommand = vi.fn().mockResolvedValue({ stdout: "" });
		const waitForPromptDelivery = vi.fn().mockResolvedValue(undefined);
		const transport = createFf15MissionZellijTransport({
			runZellijCommand,
			waitForPromptDelivery,
		});

		await transport.sendPrompt({
			paneId: "terminal_9",
			prompt: "Investigate the regression",
			sessionName: "ff15-session",
		});

		expect(runZellijCommand).toHaveBeenNthCalledWith(1, {
			args: [
				"--session",
				"ff15-session",
				"action",
				"write-chars",
				"--pane-id",
				"terminal_9",
				"Investigate the regression",
			],
			cwd: undefined,
		});
		expect(waitForPromptDelivery).toHaveBeenCalledTimes(1);
		expect(runZellijCommand).toHaveBeenNthCalledWith(2, {
			args: [
				"--session",
				"ff15-session",
				"action",
				"send-keys",
				"--pane-id",
				"terminal_9",
				"Enter",
			],
			cwd: undefined,
		});
	});
});
