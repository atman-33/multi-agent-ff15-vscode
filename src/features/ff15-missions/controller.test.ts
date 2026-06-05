import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { Ff15LaunchClient } from "../ff15-launch/launch-client";
import { resolveFf15MissionProviderAdapter } from "./mission-provider-adapter";
import {
	createFf15MissionSendController,
	MISSION_TERMINAL_NOT_READY_MESSAGE,
	MISSING_WORKSPACE_MESSAGE,
	MISSING_ZELLIJ_MESSAGE,
} from "./controller";
import {
	createEmptyFf15MissionAgentPanes,
	type Ff15MissionsStoreSnapshot,
	createWorkspaceStateFf15MissionsStore,
	FF15_WORKSPACE_RUNTIME_DIR_NAME,
} from "./state";

const MISSION_SESSION_NAME_PATTERN = /^ff15-[a-f0-9]{10}-mission-1$/;
type TestMissionsStateStorage = Parameters<
	typeof createWorkspaceStateFf15MissionsStore
>[0];

const createStorage = () => {
	let persistedSnapshot: Ff15MissionsStoreSnapshot | undefined;
	const storage: TestMissionsStateStorage = {
		get: <T>() => persistedSnapshot as T | undefined,
		update: vi
			.fn()
			.mockImplementation((_key: string, value: Ff15MissionsStoreSnapshot) => {
				persistedSnapshot = value;
				return Promise.resolve(undefined);
			}),
	};

	return {
		storage,
	};
};

const createNoctisPaneLaunchPlanEntry = () =>
	({
		agentId: "noctis",
		args: ["--agent", "noctis"],
		executable: "copilot",
	}) as const;

const createLaunchClient = (): Ff15LaunchClient => ({
	id: "github-copilot-cli",
	ensureDependenciesAvailable: vi.fn().mockResolvedValue(undefined),
	getMissingDependencyMessage: vi
		.fn()
		.mockReturnValue(
			"FF15 launch requires GitHub Copilot CLI `copilot` on PATH."
		),
	getPaneLaunchPlan: vi
		.fn()
		.mockReturnValue([createNoctisPaneLaunchPlanEntry()]),
});

const createAgentPanes = (noctisPaneId: string | null) => ({
	...createEmptyFf15MissionAgentPanes(),
	noctis: noctisPaneId,
});

const selectMissionOperation = (
	missionsStore: ReturnType<typeof createWorkspaceStateFf15MissionsStore>,
	missionId = "mission-1",
	operationRef = "builtin:idea-to-prd-and-issues"
) =>
	missionsStore.updateMission(missionId, {
		operationRef,
	});

const seedWorkspaceOperation = (workspaceRoot: string) => {
	const facetsDir = join(
		workspaceRoot,
		FF15_WORKSPACE_RUNTIME_DIR_NAME,
		"facets"
	);
	const operationsDir = join(
		workspaceRoot,
		FF15_WORKSPACE_RUNTIME_DIR_NAME,
		"operations"
	);
	mkdirSync(join(facetsDir, "jobs"), { recursive: true });
	mkdirSync(join(facetsDir, "instructions"), { recursive: true });
	mkdirSync(operationsDir, { recursive: true });
	writeFileSync(
		join(facetsDir, "jobs", "planner.md"),
		"Handle the user request directly when Noctis owns the step.\n",
		"utf8"
	);
	writeFileSync(
		join(facetsDir, "instructions", "planner.md"),
		"Continue the conversation directly unless runtime guidance says otherwise.\n",
		"utf8"
	);
	writeFileSync(
		join(operationsDir, "idea-to-prd-and-issues.yaml"),
		[
			"name: idea-to-prd-and-issues",
			"description: >",
			"  Minimal idea-to-prd test operation.",
			"initial_step: clarify-requirements",
			"",
			"steps:",
			"  - name: clarify-requirements",
			"    agent: noctis",
			"    instruction:",
			"      inline: |",
			"        Handle the user request directly.",
		].join("\n"),
		"utf8"
	);
};

const seedRichWorkspaceOperation = (workspaceRoot: string) => {
	const runtimeRoot = join(workspaceRoot, FF15_WORKSPACE_RUNTIME_DIR_NAME);
	const operationsDir = join(runtimeRoot, "operations");
	const facetsDir = join(runtimeRoot, "facets");
	mkdirSync(join(facetsDir, "jobs"), { recursive: true });
	mkdirSync(join(facetsDir, "policies"), { recursive: true });
	mkdirSync(join(facetsDir, "output-contracts"), { recursive: true });
	mkdirSync(join(facetsDir, "skills", "agent-relationships"), {
		recursive: true,
	});
	mkdirSync(operationsDir, { recursive: true });
	writeFileSync(
		join(facetsDir, "jobs", "planner.md"),
		"Plan the current issue into a spec-ready brief.\n",
		"utf8"
	);
	writeFileSync(
		join(facetsDir, "jobs", "implementer.md"),
		"Implement the approved change.\n",
		"utf8"
	);
	writeFileSync(
		join(facetsDir, "policies", "coding-standards.md"),
		"Follow repository coding standards.\n",
		"utf8"
	);
	writeFileSync(
		join(facetsDir, "output-contracts", "spec-plan.md"),
		"## Format\n\n- Include the accepted plan.\n",
		"utf8"
	);
	writeFileSync(
		join(facetsDir, "skills", "agent-relationships", "SKILL.md"),
		[
			"---",
			"name: agent-relationships",
			"description: Coordinate with the FF15 roster safely.",
			"---",
			"",
			"# Agent Relationships",
		].join("\n"),
		"utf8"
	);
	writeFileSync(
		join(operationsDir, "github-issue-openspec-dev.yaml"),
		[
			"name: github-issue-openspec-dev",
			"description: >",
			"  Drive spec planning for an incoming GitHub issue.",
			"initial_step: spec-planning",
			"",
			"steps:",
			"  - name: spec-planning",
			"    agent: noctis",
			"    job:",
			"      file: ../facets/jobs/planner.md",
			"    instruction:",
			"      inline: |",
			"        Draft the spec plan and prepare the handoff.",
			"    skills:",
			"      - file: ../facets/skills/agent-relationships/SKILL.md",
			"    policies:",
			"      - file: ../facets/policies/coding-standards.md",
			"    output_contracts:",
			"      report:",
			"        - name: spec-plan.md",
			"          format:",
			"            file: ../facets/output-contracts/spec-plan.md",
			"    rules:",
			"      - condition: Spec plan is ready for implementation",
			"        next: implement",
			"  - name: implement",
			"    agent: gladiolus",
			"    job:",
			"      file: ../facets/jobs/implementer.md",
			"    rules:",
			"      - condition: Implementation is complete",
			"        next: COMPLETE",
		].join("\n"),
		"utf8"
	);
};

const seedPersistedMission = async (
	storage: ReturnType<typeof createStorage>["storage"],
	workspaceRoot: string
) => {
	const seedStore = createWorkspaceStateFf15MissionsStore(storage, {
		createId: () => "mission-1",
		getNow: vi
			.fn()
			.mockReturnValueOnce("2026-05-26T00:10:00.000Z")
			.mockReturnValueOnce("2026-05-26T00:11:00.000Z"),
		getWorkspaceRoot: () => workspaceRoot,
	});

	await seedStore.createMission();
	await seedStore.updateMission("mission-1", {
		agentPanes: createAgentPanes("terminal_7"),
		lastError: null,
		operationRef: "builtin:idea-to-prd-and-issues",
		sessionName: "ff15-session",
		status: "active",
		workspaceRoot,
	});
};

describe("createFf15MissionSendController", () => {
	it("sends prompts with the mission's pinned provider", async () => {
		const { storage } = createStorage();
		const missionsStore = createWorkspaceStateFf15MissionsStore(storage, {
			createId: () => "mission-1",
			getNow: () => "2026-06-03T00:15:00.000Z",
		});
		await missionsStore.createMission({ providerId: "opencode" });
		await selectMissionOperation(missionsStore);

		const ensureCommandAvailable = vi.fn().mockResolvedValue(undefined);
		const githubClient = createLaunchClient();
		const opencodeClient = createLaunchClient();
		const missionTransport = {
			ensureMissionSession: vi.fn().mockResolvedValue({
				agentPanes: createAgentPanes("terminal_7"),
				paneId: "terminal_7",
			}),
			sendPrompt: vi.fn().mockResolvedValue(undefined),
		};

		const controller = createFf15MissionSendController({
			ensureCommandAvailable,
			getLaunchClient: (mission) =>
				mission.providerId === "opencode" ? opencodeClient : githubClient,
			getWorkspaceRoot: () => "C:/repo",
			missionTransport,
			missionsStore,
		});

		await controller.submitPrompt({
			missionId: "mission-1",
			prompt: "Investigate the regression",
		});

		expect(ensureCommandAvailable).toHaveBeenCalledWith("zellij");
		expect(opencodeClient.ensureDependenciesAvailable).toHaveBeenCalledTimes(1);
		expect(githubClient.ensureDependenciesAvailable).not.toHaveBeenCalled();
	});

	it("launches or attaches the mission session and marks the mission active after the first prompt is delivered", async () => {
		const { storage } = createStorage();
		const missionsStore = createWorkspaceStateFf15MissionsStore(storage, {
			createId: () => "mission-1",
			getNow: () => "2026-05-26T00:10:00.000Z",
		});
		await missionsStore.createMission();
		await selectMissionOperation(missionsStore);

		const ensureCommandAvailable = vi.fn().mockResolvedValue(undefined);
		const launchClient = createLaunchClient();
		const missionTransport = {
			ensureMissionSession: vi.fn().mockResolvedValue({
				agentPanes: createAgentPanes("terminal_7"),
				paneId: "terminal_7",
			}),
			sendPrompt: vi.fn().mockResolvedValue(undefined),
		};

		const controller = createFf15MissionSendController({
			ensureCommandAvailable,
			getLaunchClient: () => launchClient,
			getWorkspaceRoot: () => "C:/repo",
			missionTransport,
			missionsStore,
		});

		const snapshot = await controller.submitPrompt({
			missionId: "mission-1",
			prompt: "Investigate the regression",
		});

		expect(ensureCommandAvailable).toHaveBeenCalledWith("zellij");
		expect(launchClient.ensureDependenciesAvailable).toHaveBeenCalledTimes(1);
		expect(missionTransport.ensureMissionSession).toHaveBeenCalledWith(
			expect.objectContaining({
				agentPanes: createAgentPanes(null),
				missionId: "mission-1",
				paneLaunchPlanEntry: createNoctisPaneLaunchPlanEntry(),
				workspaceRoot: "C:/repo",
			})
		);
		expect(missionTransport.sendPrompt).toHaveBeenCalledWith(
			expect.objectContaining({
				paneId: "terminal_7",
				prompt: "Investigate the regression",
			})
		);
		expect(snapshot.activeMissionId).toBe("mission-1");
		expect(snapshot.missions).toEqual([
			expect.objectContaining({
				id: "mission-1",
				lastError: null,
				sessionName: expect.stringMatching(MISSION_SESSION_NAME_PATTERN),
				status: "active",
				workspaceRoot: "C:/repo",
			}),
		]);
		expect(missionsStore.getMissionRecord("mission-1")).toEqual(
			expect.objectContaining({
				agentPanes: createAgentPanes("terminal_7"),
				sessionName: expect.stringMatching(MISSION_SESSION_NAME_PATTERN),
			})
		);
	});

	it("promotes the first prompt into the mission title when the default title is still in place", async () => {
		const { storage } = createStorage();
		const missionsStore = createWorkspaceStateFf15MissionsStore(storage, {
			createId: () => "mission-1",
			getNow: () => "2026-06-01T00:10:00.000Z",
		});
		await missionsStore.createMission();
		await selectMissionOperation(missionsStore);

		const ensureCommandAvailable = vi.fn().mockResolvedValue(undefined);
		const launchClient = createLaunchClient();
		const missionTransport = {
			ensureMissionSession: vi.fn().mockResolvedValue({
				agentPanes: createAgentPanes("terminal_7"),
				paneId: "terminal_7",
			}),
			sendPrompt: vi.fn().mockResolvedValue(undefined),
		};

		const controller = createFf15MissionSendController({
			ensureCommandAvailable,
			getLaunchClient: () => launchClient,
			getWorkspaceRoot: () => "C:/repo",
			missionTransport,
			missionsStore,
		});

		const snapshot = await controller.submitPrompt({
			missionId: "mission-1",
			prompt: "Investigate the customer onboarding regression",
		});

		expect(snapshot.missions).toEqual([
			expect.objectContaining({
				id: "mission-1",
				title: "Investigate the customer onboarding regression",
			}),
		]);
		expect(missionsStore.getMissionRecord("mission-1")).toEqual(
			expect.objectContaining({
				title: "Investigate the customer onboarding regression",
			})
		);
	});

	it("keeps a manually renamed mission title when the first prompt is sent", async () => {
		const { storage } = createStorage();
		const missionsStore = createWorkspaceStateFf15MissionsStore(storage, {
			createId: () => "mission-1",
			getNow: () => "2026-06-01T00:10:00.000Z",
		});
		await missionsStore.createMission();
		await missionsStore.updateMission("mission-1", {
			title: "Customer onboarding handoff",
		});
		await selectMissionOperation(missionsStore);

		const ensureCommandAvailable = vi.fn().mockResolvedValue(undefined);
		const launchClient = createLaunchClient();
		const missionTransport = {
			ensureMissionSession: vi.fn().mockResolvedValue({
				agentPanes: createAgentPanes("terminal_7"),
				paneId: "terminal_7",
			}),
			sendPrompt: vi.fn().mockResolvedValue(undefined),
		};

		const controller = createFf15MissionSendController({
			ensureCommandAvailable,
			getLaunchClient: () => launchClient,
			getWorkspaceRoot: () => "C:/repo",
			missionTransport,
			missionsStore,
		});

		const snapshot = await controller.submitPrompt({
			missionId: "mission-1",
			prompt: "Investigate the customer onboarding regression",
		});

		expect(snapshot.missions).toEqual([
			expect.objectContaining({
				id: "mission-1",
				title: "Customer onboarding handoff",
			}),
		]);
		expect(missionsStore.getMissionRecord("mission-1")).toEqual(
			expect.objectContaining({
				title: "Customer onboarding handoff",
			})
		);
	});

	it("normalizes and truncates the first prompt before promoting it into the mission title", async () => {
		const { storage } = createStorage();
		const missionsStore = createWorkspaceStateFf15MissionsStore(storage, {
			createId: () => "mission-1",
			getNow: () => "2026-06-01T00:10:00.000Z",
		});
		await missionsStore.createMission();
		await selectMissionOperation(missionsStore);

		const ensureCommandAvailable = vi.fn().mockResolvedValue(undefined);
		const launchClient = createLaunchClient();
		const missionTransport = {
			ensureMissionSession: vi.fn().mockResolvedValue({
				agentPanes: createAgentPanes("terminal_7"),
				paneId: "terminal_7",
			}),
			sendPrompt: vi.fn().mockResolvedValue(undefined),
		};

		const controller = createFf15MissionSendController({
			ensureCommandAvailable,
			getLaunchClient: () => launchClient,
			getWorkspaceRoot: () => "C:/repo",
			missionTransport,
			missionsStore,
		});

		await controller.submitPrompt({
			missionId: "mission-1",
			prompt:
				"  Investigate\n\n the   regression in onboarding and confirm whether the retry path still duplicates follow-up prompts across sessions  ",
		});

		const title = missionsStore.getMissionRecord("mission-1")?.title;
		expect(title).toBeDefined();
		expect(title).toHaveLength(80);
		expect(title).not.toContain("\n");
		expect(title).not.toContain("  ");
		expect(title?.startsWith("Investigate the regression in onboarding")).toBe(
			true
		);
	});

	it("rejects prompt delivery until an operation is selected", async () => {
		const { storage } = createStorage();
		const missionsStore = createWorkspaceStateFf15MissionsStore(storage, {
			createId: () => "mission-1",
			getNow: () => "2026-05-26T00:10:00.000Z",
		});
		await missionsStore.createMission();

		const ensureCommandAvailable = vi.fn().mockResolvedValue(undefined);
		const launchClient = createLaunchClient();
		const missionTransport = {
			ensureMissionSession: vi.fn().mockResolvedValue({
				agentPanes: createAgentPanes("terminal_7"),
				paneId: "terminal_7",
			}),
			sendPrompt: vi.fn().mockResolvedValue(undefined),
		};

		const controller = createFf15MissionSendController({
			ensureCommandAvailable,
			getLaunchClient: () => launchClient,
			getWorkspaceRoot: () => "C:/repo",
			missionTransport,
			missionsStore,
		});

		const snapshot = await controller.submitPrompt({
			missionId: "mission-1",
			prompt: "Investigate the regression",
		});

		expect(snapshot.missions).toEqual([
			expect.objectContaining({
				id: "mission-1",
				lastError: "Select an operation before sending a mission prompt.",
				status: "draft",
			}),
		]);
		expect(ensureCommandAvailable).not.toHaveBeenCalled();
		expect(launchClient.ensureDependenciesAvailable).not.toHaveBeenCalled();
		expect(missionTransport.ensureMissionSession).not.toHaveBeenCalled();
		expect(missionTransport.sendPrompt).not.toHaveBeenCalled();
	});

	it("stores a mission-scoped error when the mission terminal has not been launched yet", async () => {
		const { storage } = createStorage();
		const missionsStore = createWorkspaceStateFf15MissionsStore(storage, {
			createId: () => "mission-1",
			getNow: () => "2026-05-26T00:10:00.000Z",
		});
		await missionsStore.createMission();
		await selectMissionOperation(missionsStore);

		const ensureCommandAvailable = vi.fn().mockResolvedValue(undefined);
		const launchClient = createLaunchClient();
		const missionTransport = {
			ensureMissionSession: vi.fn(),
			sendPrompt: vi.fn(),
		};

		const controller = createFf15MissionSendController({
			ensureCommandAvailable,
			getLaunchClient: () => launchClient,
			getWorkspaceRoot: () => "C:/repo",
			isMissionTerminalReady: () => false,
			missionTransport,
			missionsStore,
		});

		const snapshot = await controller.submitPrompt({
			missionId: "mission-1",
			prompt: "Investigate the regression",
		});

		expect(snapshot.missions).toEqual([
			expect.objectContaining({
				id: "mission-1",
				lastError: MISSION_TERMINAL_NOT_READY_MESSAGE,
				status: "draft",
			}),
		]);
		expect(ensureCommandAvailable).not.toHaveBeenCalled();
		expect(launchClient.ensureDependenciesAvailable).not.toHaveBeenCalled();
		expect(missionTransport.ensureMissionSession).not.toHaveBeenCalled();
		expect(missionTransport.sendPrompt).not.toHaveBeenCalled();
	});

	it("activates operation workflow state and sends an operation-aware prompt for the first operation-backed send", async () => {
		const workspaceRoot = mkdtempSync(join(tmpdir(), "ff15-missions-"));
		const openspecRoot = join(workspaceRoot, "selected-project", "openspec");

		try {
			seedRichWorkspaceOperation(workspaceRoot);
			const { storage } = createStorage();
			const missionsStore = createWorkspaceStateFf15MissionsStore(storage, {
				createId: () => "mission-1",
				getNow: vi
					.fn()
					.mockReturnValueOnce("2026-05-28T00:10:00.000Z")
					.mockReturnValueOnce("2026-05-28T00:11:00.000Z"),
				getWorkspaceRoot: () => workspaceRoot,
			});
			await missionsStore.createMission();
			await selectMissionOperation(missionsStore);
			await missionsStore.updateMission("mission-1", {
				operationRef: "builtin:github-issue-openspec-dev",
				workflow: {
					activeTask: null,
					currentStep: null,
					lastReportSummary: null,
					probe: {
						checkedAt: "2026-05-28T00:09:00.000Z",
						summary:
							"Extension-host bridge is viable for the next runtime slice.",
						verdict: "go",
					},
					runtimeStatus: "ready",
				},
			});

			const ensureCommandAvailable = vi.fn().mockResolvedValue(undefined);
			const launchClient = createLaunchClient();
			const missionTransport = {
				ensureMissionSession: vi.fn().mockResolvedValue({
					agentPanes: createAgentPanes("terminal_7"),
					paneId: "terminal_7",
				}),
				sendPrompt: vi.fn().mockResolvedValue(undefined),
			};

			const controller = createFf15MissionSendController({
				ensureCommandAvailable,
				getLaunchClient: () => launchClient,
				resolveRuntimeContext: () => ({
					activeProjects: ["frontend", "backend"],
					executionRoot: workspaceRoot,
					openspecRoot,
				}),
				getWorkspaceRoot: () => workspaceRoot,
				missionTransport,
				missionsStore,
			});

			const snapshot = await controller.submitPrompt({
				missionId: "mission-1",
				prompt: "Draft the first response",
			});

			expect(missionTransport.sendPrompt).toHaveBeenCalledWith(
				expect.objectContaining({
					paneId: "terminal_7",
					prompt: expect.stringContaining("<operation-prompt>"),
				})
			);
			expect(missionTransport.sendPrompt).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: expect.stringContaining(
						"operation: github-issue-openspec-dev"
					),
				})
			);
			expect(missionTransport.sendPrompt).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: expect.stringContaining("step: spec-planning"),
				})
			);
			expect(missionTransport.sendPrompt).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: expect.stringContaining("<job>"),
				})
			);
			expect(missionTransport.sendPrompt).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: expect.stringContaining(
						"Plan the current issue into a spec-ready brief."
					),
				})
			);
			expect(missionTransport.sendPrompt).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: expect.stringContaining("<step-completion-contract>"),
				})
			);
			expect(missionTransport.sendPrompt).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: expect.stringContaining(`execution_root: ${workspaceRoot}`),
				})
			);
			expect(missionTransport.sendPrompt).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: expect.stringContaining(`openspec_root: ${openspecRoot}`),
				})
			);
			expect(missionTransport.sendPrompt).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: expect.stringContaining(
						"active_projects:\n  - frontend\n  - backend"
					),
				})
			);
			expect(missionTransport.sendPrompt).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: expect.stringContaining(
						join(
							workspaceRoot,
							FF15_WORKSPACE_RUNTIME_DIR_NAME,
							"bridge",
							"submit-report.ps1"
						)
					),
				})
			);
			expect(missionTransport.sendPrompt).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: expect.stringContaining(
						'<user-request from="user" to="noctis">'
					),
				})
			);
			expect(missionTransport.sendPrompt).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: expect.stringContaining("Draft the first response"),
				})
			);
			expect(missionsStore.getMissionRecord("mission-1")).toEqual(
				expect.objectContaining({
					operationRef: "builtin:github-issue-openspec-dev",
					workflow: expect.objectContaining({
						activeTask: "Spec Planning",
						currentStep: "spec-planning",
						runtimeStatus: "ready",
					}),
				})
			);
			expect(snapshot.missions).toEqual([
				expect.objectContaining({
					id: "mission-1",
					status: "active",
					workspaceRoot,
				}),
			]);
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	for (const providerId of ["github-copilot-cli", "opencode"] as const) {
		it(`resolves the pinned ${providerId} mission provider adapter before delivering an operation activation prompt`, async () => {
			const workspaceRoot = mkdtempSync(join(tmpdir(), "ff15-missions-"));

			try {
				seedRichWorkspaceOperation(workspaceRoot);
				const { storage } = createStorage();
				const missionsStore = createWorkspaceStateFf15MissionsStore(storage, {
					createId: () => "mission-1",
					getNow: () => "2026-06-04T00:10:00.000Z",
				});
				await missionsStore.createMission({ providerId });
				await selectMissionOperation(
					missionsStore,
					"mission-1",
					"builtin:github-issue-openspec-dev"
				);

				const ensureCommandAvailable = vi.fn().mockResolvedValue(undefined);
				const launchClient = createLaunchClient();
				const missionTransport = {
					ensureMissionSession: vi.fn().mockResolvedValue({
						agentPanes: createAgentPanes("terminal_7"),
						paneId: "terminal_7",
					}),
					sendPrompt: vi.fn().mockResolvedValue(undefined),
				};
				const adapter = resolveFf15MissionProviderAdapter(providerId);
				const deliverOperationActivationPrompt = vi
					.spyOn(adapter, "deliverOperationActivationPrompt")
					.mockResolvedValue({
						agentPanes: createAgentPanes("adapter_7"),
						paneId: "adapter_7",
					});

				try {
					const controller = createFf15MissionSendController({
						ensureCommandAvailable,
						getLaunchClient: () => launchClient,
						getWorkspaceRoot: () => workspaceRoot,
						missionTransport,
						missionsStore,
					});

					await controller.submitPrompt({
						missionId: "mission-1",
						prompt: "Investigate the provider route",
					});

					expect(deliverOperationActivationPrompt).toHaveBeenCalledWith(
						expect.objectContaining({
							launchClient,
							missionId: "mission-1",
							sessionName: expect.stringMatching(MISSION_SESSION_NAME_PATTERN),
							workspaceRoot,
						})
					);
					expect(missionTransport.ensureMissionSession).not.toHaveBeenCalled();
					expect(missionTransport.sendPrompt).not.toHaveBeenCalled();
					expect(missionsStore.getMissionRecord("mission-1")).toEqual(
						expect.objectContaining({
							agentPanes: createAgentPanes("adapter_7"),
							providerId,
						})
					);
				} finally {
					deliverOperationActivationPrompt.mockRestore();
				}
			} finally {
				rmSync(workspaceRoot, { force: true, recursive: true });
			}
		});
	}

	it("resets probe placeholder workflow state to the operation initial step on the first operation-backed send", async () => {
		const workspaceRoot = mkdtempSync(join(tmpdir(), "ff15-missions-"));

		try {
			seedWorkspaceOperation(workspaceRoot);
			const { storage } = createStorage();
			const missionsStore = createWorkspaceStateFf15MissionsStore(storage, {
				createId: () => "mission-1",
				getNow: vi
					.fn()
					.mockReturnValueOnce("2026-05-28T00:12:00.000Z")
					.mockReturnValueOnce("2026-05-28T00:13:00.000Z"),
				getWorkspaceRoot: () => workspaceRoot,
			});
			await missionsStore.createMission();
			await missionsStore.updateMission("mission-1", {
				operationRef: "builtin:idea-to-prd-and-issues",
				workflow: {
					activeTask: "Validate loopback bridge readiness",
					currentStep: "probe:ready",
					lastReportSummary:
						"Bridge lookup and submission endpoints responded.",
					probe: {
						checkedAt: "2026-05-28T00:11:00.000Z",
						summary:
							"Extension-host bridge is viable for the next runtime slice.",
						verdict: "go",
					},
					runtimeStatus: "ready",
				},
			});

			const ensureCommandAvailable = vi.fn().mockResolvedValue(undefined);
			const launchClient = createLaunchClient();
			const missionTransport = {
				ensureMissionSession: vi.fn().mockResolvedValue({
					agentPanes: createAgentPanes("terminal_7"),
					paneId: "terminal_7",
				}),
				sendPrompt: vi.fn().mockResolvedValue(undefined),
			};

			const controller = createFf15MissionSendController({
				ensureCommandAvailable,
				getLaunchClient: () => launchClient,
				getWorkspaceRoot: () => workspaceRoot,
				missionTransport,
				missionsStore,
			});

			await controller.submitPrompt({
				missionId: "mission-1",
				prompt: "Draft the first response",
			});

			expect(missionTransport.sendPrompt).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: expect.stringContaining("<operation-prompt>"),
				})
			);
			expect(missionTransport.sendPrompt).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: expect.stringContaining("step: clarify-requirements"),
				})
			);
			expect(missionTransport.sendPrompt).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: expect.stringContaining("task: Clarify Requirements"),
				})
			);
			expect(missionsStore.getMissionRecord("mission-1")).toEqual(
				expect.objectContaining({
					workflow: expect.objectContaining({
						activeTask: "Clarify Requirements",
						currentStep: "clarify-requirements",
					}),
				})
			);
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("rehydrates persisted mission metadata and reuses the existing session for follow-up prompts", async () => {
		const workspaceRoot = mkdtempSync(join(tmpdir(), "ff15-missions-"));

		try {
			const { storage } = createStorage();
			await seedPersistedMission(storage, workspaceRoot);

			const missionsStore = createWorkspaceStateFf15MissionsStore(storage, {
				getWorkspaceRoot: () => workspaceRoot,
			});
			const ensureCommandAvailable = vi.fn().mockResolvedValue(undefined);
			const launchClient = createLaunchClient();
			const missionTransport = {
				ensureMissionSession: vi.fn().mockResolvedValue({
					agentPanes: createAgentPanes("terminal_7"),
					paneId: "terminal_7",
				}),
				sendPrompt: vi.fn().mockResolvedValue(undefined),
			};

			const controller = createFf15MissionSendController({
				ensureCommandAvailable,
				getLaunchClient: () => launchClient,
				getWorkspaceRoot: () => workspaceRoot,
				missionTransport,
				missionsStore,
			});

			const snapshot = await controller.submitPrompt({
				missionId: "mission-1",
				prompt: "Resume the work",
			});

			expect(missionsStore.getMissionRecord("mission-1")).toEqual(
				expect.objectContaining({
					agentPanes: createAgentPanes("terminal_7"),
					sessionName: "ff15-session",
					workspaceRoot,
				})
			);
			expect(missionTransport.ensureMissionSession).toHaveBeenCalledWith(
				expect.objectContaining({
					allowCreateNoctisPane: false,
					agentPanes: createAgentPanes("terminal_7"),
					missionId: "mission-1",
					sessionName: "ff15-session",
					workspaceRoot,
				})
			);
			expect(missionTransport.sendPrompt).toHaveBeenCalledWith({
				paneId: "terminal_7",
				prompt: "Resume the work",
				sessionName: "ff15-session",
			});
			expect(snapshot.missions).toEqual([
				expect.objectContaining({
					id: "mission-1",
					lastError: null,
					sessionName: "ff15-session",
					status: "active",
					workspaceRoot,
				}),
			]);
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("stores a recoverable error when an existing mission no longer resolves a live Noctis pane", async () => {
		const workspaceRoot = mkdtempSync(join(tmpdir(), "ff15-missions-"));

		try {
			const { storage } = createStorage();
			await seedPersistedMission(storage, workspaceRoot);

			const missionsStore = createWorkspaceStateFf15MissionsStore(storage, {
				getWorkspaceRoot: () => workspaceRoot,
			});
			const ensureCommandAvailable = vi.fn().mockResolvedValue(undefined);
			const launchClient = createLaunchClient();
			const missionTransport = {
				ensureMissionSession: vi
					.fn()
					.mockRejectedValue(
						new Error(
							"FF15 could not resolve a live Noctis pane for this mission. Start a new mission to continue."
						)
					),
				sendPrompt: vi.fn().mockResolvedValue(undefined),
			};

			const controller = createFf15MissionSendController({
				ensureCommandAvailable,
				getLaunchClient: () => launchClient,
				getWorkspaceRoot: () => workspaceRoot,
				missionTransport,
				missionsStore,
			});

			const snapshot = await controller.submitPrompt({
				missionId: "mission-1",
				prompt: "Resume the work",
			});

			expect(missionTransport.sendPrompt).not.toHaveBeenCalled();
			expect(snapshot.missions).toEqual([
				expect.objectContaining({
					id: "mission-1",
					lastError:
						"FF15 could not resolve a live Noctis pane for this mission. Start a new mission to continue.",
					sessionName: "ff15-session",
					status: "error",
					workspaceRoot,
				}),
			]);
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("recovers an errored mission by retrying the send from the same mission context", async () => {
		const workspaceRoot = mkdtempSync(join(tmpdir(), "ff15-missions-"));

		try {
			const { storage } = createStorage();
			const missionsStore = createWorkspaceStateFf15MissionsStore(storage, {
				createId: () => "mission-1",
				getNow: vi
					.fn()
					.mockReturnValueOnce("2026-05-26T00:10:00.000Z")
					.mockReturnValueOnce("2026-05-26T00:11:00.000Z")
					.mockReturnValueOnce("2026-05-26T00:12:00.000Z")
					.mockReturnValueOnce("2026-05-26T00:13:00.000Z"),
				getWorkspaceRoot: () => workspaceRoot,
			});
			await missionsStore.createMission();
			await selectMissionOperation(missionsStore);

			const ensureCommandAvailable = vi.fn().mockResolvedValue(undefined);
			const launchClient = createLaunchClient();
			const missionTransport = {
				ensureMissionSession: vi
					.fn()
					.mockRejectedValueOnce(
						new Error(
							"FF15 could not resolve a live Noctis pane for this mission. Start a new mission to continue."
						)
					)
					.mockResolvedValueOnce({
						agentPanes: createAgentPanes("terminal_7"),
						paneId: "terminal_7",
					}),
				sendPrompt: vi.fn().mockResolvedValue(undefined),
			};

			const controller = createFf15MissionSendController({
				ensureCommandAvailable,
				getLaunchClient: () => launchClient,
				getWorkspaceRoot: () => workspaceRoot,
				missionTransport,
				missionsStore,
			});

			await controller.submitPrompt({
				missionId: "mission-1",
				prompt: "Retry the delivery",
			});

			const recoveredSnapshot = await controller.submitPrompt({
				missionId: "mission-1",
				prompt: "Retry the delivery",
			});

			expect(missionTransport.ensureMissionSession).toHaveBeenNthCalledWith(
				2,
				expect.objectContaining({
					allowCreateNoctisPane: false,
					missionId: "mission-1",
					sessionName: expect.stringMatching(MISSION_SESSION_NAME_PATTERN),
					workspaceRoot,
				})
			);
			expect(missionTransport.sendPrompt).toHaveBeenCalledWith({
				paneId: "terminal_7",
				prompt: "Retry the delivery",
				sessionName: expect.stringMatching(MISSION_SESSION_NAME_PATTERN),
			});
			expect(recoveredSnapshot.missions).toEqual([
				expect.objectContaining({
					id: "mission-1",
					lastError: null,
					status: "active",
					workspaceRoot,
				}),
			]);
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("stores a mission-scoped error when no workspace root can be resolved", async () => {
		const { storage } = createStorage();
		const missionsStore = createWorkspaceStateFf15MissionsStore(storage, {
			createId: () => "mission-1",
			getNow: () => "2026-05-26T00:10:00.000Z",
		});
		await missionsStore.createMission();
		await selectMissionOperation(missionsStore);

		const ensureCommandAvailable = vi.fn().mockResolvedValue(undefined);
		const launchClient = createLaunchClient();
		const missionTransport = {
			ensureMissionSession: vi.fn().mockResolvedValue({
				paneId: "terminal_7",
			}),
			sendPrompt: vi.fn().mockResolvedValue(undefined),
		};

		const controller = createFf15MissionSendController({
			ensureCommandAvailable,
			getLaunchClient: () => launchClient,
			getWorkspaceRoot: () => ["C:/repo"][1],
			missionTransport,
			missionsStore,
		});

		const snapshot = await controller.submitPrompt({
			missionId: "mission-1",
			prompt: "Investigate the regression",
		});

		expect(snapshot.missions).toEqual([
			expect.objectContaining({
				id: "mission-1",
				lastError: MISSING_WORKSPACE_MESSAGE,
				status: "error",
				sessionName: null,
				workspaceRoot: null,
			}),
		]);
		expect(ensureCommandAvailable).not.toHaveBeenCalled();
		expect(launchClient.ensureDependenciesAvailable).not.toHaveBeenCalled();
		expect(missionTransport.ensureMissionSession).not.toHaveBeenCalled();
	});

	it("stores the transport failure on the selected mission when prompt delivery fails", async () => {
		const { storage } = createStorage();
		const missionsStore = createWorkspaceStateFf15MissionsStore(storage, {
			createId: () => "mission-1",
			getNow: () => "2026-05-26T00:10:00.000Z",
		});
		await missionsStore.createMission();
		await selectMissionOperation(missionsStore);

		const ensureCommandAvailable = vi.fn().mockResolvedValue(undefined);
		const launchClient = createLaunchClient();
		const missionTransport = {
			ensureMissionSession: vi.fn().mockResolvedValue({
				agentPanes: createAgentPanes("terminal_7"),
				paneId: "terminal_7",
			}),
			sendPrompt: vi
				.fn()
				.mockRejectedValue(new Error("Noctis pane is unavailable.")),
		};

		const controller = createFf15MissionSendController({
			ensureCommandAvailable,
			getLaunchClient: () => launchClient,
			getWorkspaceRoot: () => "C:/repo",
			missionTransport,
			missionsStore,
		});

		const snapshot = await controller.submitPrompt({
			missionId: "mission-1",
			prompt: "Investigate the regression",
		});

		expect(snapshot.missions).toEqual([
			expect.objectContaining({
				id: "mission-1",
				lastError: "Noctis pane is unavailable.",
				sessionName: expect.stringMatching(MISSION_SESSION_NAME_PATTERN),
				status: "error",
				workspaceRoot: "C:/repo",
			}),
		]);
		expect(missionsStore.getMissionRecord("mission-1")).toEqual(
			expect.objectContaining({
				agentPanes: createAgentPanes("terminal_7"),
			})
		);
	});

	it("stores a zellij availability error when zellij is unavailable", async () => {
		const { storage } = createStorage();
		const missionsStore = createWorkspaceStateFf15MissionsStore(storage, {
			createId: () => "mission-1",
			getNow: () => "2026-05-26T00:10:00.000Z",
		});
		await missionsStore.createMission();
		await selectMissionOperation(missionsStore);

		const ensureCommandAvailable = vi
			.fn()
			.mockRejectedValue(new Error("missing zellij"));
		const launchClient = createLaunchClient();
		const missionTransport = {
			ensureMissionSession: vi.fn().mockResolvedValue({
				paneId: "terminal_7",
			}),
			sendPrompt: vi.fn().mockResolvedValue(undefined),
		};

		const controller = createFf15MissionSendController({
			ensureCommandAvailable,
			getLaunchClient: () => launchClient,
			getWorkspaceRoot: () => "C:/repo",
			missionTransport,
			missionsStore,
		});

		const snapshot = await controller.submitPrompt({
			missionId: "mission-1",
			prompt: "Investigate the regression",
		});

		expect(snapshot.missions).toEqual([
			expect.objectContaining({
				id: "mission-1",
				lastError: MISSING_ZELLIJ_MESSAGE,
				status: "error",
				workspaceRoot: "C:/repo",
			}),
		]);
		expect(launchClient.ensureDependenciesAvailable).not.toHaveBeenCalled();
		expect(missionTransport.ensureMissionSession).not.toHaveBeenCalled();
	});
});
