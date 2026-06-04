import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach, vi } from "vitest";

const mockVsCodeMissionController = vi.hoisted(() => {
	const createLaunchClient = (id: "github-copilot-cli" | "opencode") => ({
		id,
		ensureDependenciesAvailable: vi.fn().mockResolvedValue(undefined),
		getMissingDependencyMessage: vi.fn().mockReturnValue("missing dependency"),
		getPaneLaunchPlan: vi.fn().mockReturnValue([
			{
				agentId: "noctis",
				args: ["--agent", "noctis"],
				executable: id === "opencode" ? "opencode" : "copilot",
			},
		]),
	});

	return {
		currentLaunchClientId: "opencode" as "github-copilot-cli" | "opencode",
		ensureCommandAvailable: vi.fn().mockResolvedValue(undefined),
		githubClient: createLaunchClient("github-copilot-cli"),
		launchZellijTerminal: vi.fn().mockResolvedValue(undefined),
		opencodeClient: createLaunchClient("opencode"),
		prepareFf15LaunchLayout: vi
			.fn()
			.mockReturnValue("C:/repo/.ff15/layout.kdl"),
		resolveActiveWorkspaceRoot: vi.fn().mockReturnValue("C:/repo"),
		resolveFf15ProjectRuntimeContext: vi.fn(({ workspaceRoot }) => ({
			activeProjects: [],
			executionRoot: workspaceRoot,
			openspecRoot: null,
		})),
		resolveLaunchableCopilotCommand: vi.fn().mockReturnValue({
			args: [],
			executable: "copilot",
		}),
		resolveLaunchableOpencodeCommand: vi.fn().mockReturnValue("opencode"),
		showErrorMessage: vi.fn(),
	};
});

vi.mock("vscode", () => ({
	window: {
		showErrorMessage: mockVsCodeMissionController.showErrorMessage,
	},
	workspace: {
		getConfiguration: () => ({
			get: () => mockVsCodeMissionController.currentLaunchClientId,
		}),
	},
}));

vi.mock("../ff15-launch/dependency-check", () => ({
	ensureCommandAvailable: mockVsCodeMissionController.ensureCommandAvailable,
}));

vi.mock("../ff15-launch/launch-client", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("../ff15-launch/launch-client")>();

	return {
		...actual,
		createFf15LaunchClient: vi.fn((id: "github-copilot-cli" | "opencode") =>
			id === "opencode"
				? mockVsCodeMissionController.opencodeClient
				: mockVsCodeMissionController.githubClient
		),
		resolveFf15LaunchClientId: (value: unknown) =>
			value === "github-copilot-cli" ? "github-copilot-cli" : "opencode",
	};
});

vi.mock("../ff15-launch/layout", () => ({
	prepareFf15LaunchLayout: mockVsCodeMissionController.prepareFf15LaunchLayout,
	resolveLaunchableCopilotCommand:
		mockVsCodeMissionController.resolveLaunchableCopilotCommand,
	resolveLaunchableOpencodeCommand:
		mockVsCodeMissionController.resolveLaunchableOpencodeCommand,
}));

vi.mock("../ff15-launch/launch-terminal", () => ({
	launchZellijTerminal: mockVsCodeMissionController.launchZellijTerminal,
}));

vi.mock("../ff15-launch/workspace-root", () => ({
	resolveActiveWorkspaceRoot:
		mockVsCodeMissionController.resolveActiveWorkspaceRoot,
}));

vi.mock("../ff15-projects/runtime-context", () => ({
	resolveFf15ProjectRuntimeContext:
		mockVsCodeMissionController.resolveFf15ProjectRuntimeContext,
}));

import {
	createVsCodeFf15MissionSessionController,
	terminateZellijMissionSession,
} from "./vscode-controller";
import {
	createEmptyFf15MissionAgentPanes,
	createWorkspaceStateFf15MissionsStore,
} from "./state";

beforeEach(() => {
	mockVsCodeMissionController.currentLaunchClientId = "github-copilot-cli";
	mockVsCodeMissionController.ensureCommandAvailable.mockClear();
	mockVsCodeMissionController.githubClient.ensureDependenciesAvailable.mockClear();
	mockVsCodeMissionController.opencodeClient.ensureDependenciesAvailable.mockClear();
	mockVsCodeMissionController.launchZellijTerminal.mockClear();
	mockVsCodeMissionController.showErrorMessage.mockClear();
});

describe("terminateZellijMissionSession", () => {
	it("uses delete-session --force so live and exited sessions are removed by one command", async () => {
		const runCommand = vi.fn().mockResolvedValue(undefined);

		await terminateZellijMissionSession({
			runCommand,
			sessionName: "ff15-session",
			workspaceRoot: "C:/repo",
		});

		expect(runCommand).toHaveBeenCalledWith({
			args: ["delete-session", "--force", "ff15-session"],
			cwd: "C:/repo",
		});
	});

	it("ignores session-not-found teardown errors because the mission metadata can still be removed", async () => {
		const runCommand = vi
			.fn()
			.mockRejectedValue(new Error('Session: "ff15-session" not found.'));

		await expect(
			terminateZellijMissionSession({
				runCommand,
				sessionName: "ff15-session",
				workspaceRoot: "C:/repo",
			})
		).resolves.toBeUndefined();
	});
});

describe("createVsCodeFf15MissionSessionController", () => {
	it("pins the current workspace launch client at mission creation and keeps using it after the setting changes", async () => {
		const workspaceRoot = mkdtempSync(
			join(tmpdir(), "ff15-vscode-controller-")
		);
		let snapshot:
			| ReturnType<
					ReturnType<
						typeof createWorkspaceStateFf15MissionsStore
					>["getSnapshot"]
			  >
			| undefined;
		const storage: Parameters<typeof createWorkspaceStateFf15MissionsStore>[0] =
			{
				get: <T>(_key: string) => snapshot as T | undefined,
				update: vi.fn().mockImplementation((_key, value) => {
					snapshot = value;
					return Promise.resolve(undefined);
				}),
			};

		try {
			mockVsCodeMissionController.resolveActiveWorkspaceRoot.mockReturnValue(
				workspaceRoot
			);
			const missionsStore = createWorkspaceStateFf15MissionsStore(storage, {
				createId: () => "mission-1",
				getNow: () => "2026-06-03T00:20:00.000Z",
				getWorkspaceRoot: () => workspaceRoot,
			});
			const controller = createVsCodeFf15MissionSessionController(
				{ fsPath: "C:/extension" } as never,
				missionsStore,
				{
					reconcileMissionAgentPanes: vi
						.fn()
						.mockResolvedValue(createEmptyFf15MissionAgentPanes()),
				} as never
			);

			mockVsCodeMissionController.currentLaunchClientId = "opencode";
			await controller.createMission();
			mockVsCodeMissionController.currentLaunchClientId = "github-copilot-cli";

			await controller.openMissionSession("mission-1");

			expect(missionsStore.getMissionRecord("mission-1")).toEqual(
				expect.objectContaining({
					providerId: "opencode",
				})
			);
			expect(
				mockVsCodeMissionController.opencodeClient.ensureDependenciesAvailable
			).toHaveBeenCalledTimes(1);
			expect(
				mockVsCodeMissionController.githubClient.ensureDependenciesAvailable
			).not.toHaveBeenCalled();
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});
});
