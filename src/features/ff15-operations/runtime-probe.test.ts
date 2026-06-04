import {
	existsSync,
	mkdtempSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { resolveFf15MissionProviderAdapter } from "../ff15-missions/mission-provider-adapter";
import {
	createWorkspaceStateFf15MissionsStore,
	getWorkspaceMissionOutputFilePath,
	FF15_WORKSPACE_RUNTIME_DIR_NAME,
} from "../ff15-missions/state";
import {
	createFf15OperationRuntimeProbeService,
	FF15_BRIDGE_MANIFEST_FILE_NAME,
	FF15_WORKSPACE_BRIDGE_DIR_NAME,
} from "./runtime-probe";

const seedTransitionOperation = (workspaceRoot: string) => {
	const operationsDir = join(
		workspaceRoot,
		FF15_WORKSPACE_RUNTIME_DIR_NAME,
		"operations"
	);
	mkdirSync(operationsDir, { recursive: true });
	writeFileSync(
		join(operationsDir, "idea-to-prd-and-issues.yaml"),
		[
			"name: idea-to-prd-and-issues",
			"initial_step: clarify-requirements",
			"",
			"steps:",
			"  - name: clarify-requirements",
			"    agent: noctis",
			"    rules:",
			"      - condition: Requirements clarified and brief recorded",
			"        next: draft-prd",
			"      - condition: User cancelled before drafting",
			"        next: cancelled",
			"  - name: draft-prd",
			"    agent: noctis",
			"    rules:",
			"      - condition: Draft complete",
			"        next: COMPLETE",
		].join("\n"),
		"utf8"
	);
};

const seedWorkerDispatchOperation = (workspaceRoot: string) => {
	const operationsDir = join(
		workspaceRoot,
		FF15_WORKSPACE_RUNTIME_DIR_NAME,
		"operations"
	);
	mkdirSync(operationsDir, { recursive: true });
	writeFileSync(
		join(operationsDir, "shiritori-smoke-test.yaml"),
		[
			"name: shiritori-smoke-test",
			"initial_step: start",
			"",
			"steps:",
			"  - name: start",
			"    agent: noctis",
			"    rules:",
			"      - condition: Started successfully",
			"        next: ignis-turn",
			"  - name: ignis-turn",
			"    agent: ignis",
			"    rules:",
			"      - condition: Ignis continued",
			"        next: COMPLETE",
		].join("\n"),
		"utf8"
	);
};

const seedOutputAwareWorkerDispatchOperation = (workspaceRoot: string) => {
	const operationsDir = join(
		workspaceRoot,
		FF15_WORKSPACE_RUNTIME_DIR_NAME,
		"operations"
	);
	mkdirSync(operationsDir, { recursive: true });
	writeFileSync(
		join(operationsDir, "shiritori-smoke-test.yaml"),
		[
			"name: shiritori-smoke-test",
			"initial_step: spec-planning",
			"",
			"steps:",
			"  - name: spec-planning",
			"    agent: noctis",
			"    output_contracts:",
			"      report:",
			"        - name: spec-plan.md",
			"          format:",
			"            inline: |",
			"              # Spec Plan",
			"    rules:",
			"      - condition: Spec plan is ready",
			"        next: implement",
			"  - name: implement",
			"    agent: gladiolus",
			"    instruction:",
			"      inline: |",
			'        Read {{ output("spec-planning", "latest", "spec-plan.md") }} before implementing.',
			"    rules:",
			"      - condition: Implementation complete",
			"        next: COMPLETE",
		].join("\n"),
		"utf8"
	);
};

const invokeBridge = async ({
	body,
	method,
	token,
	url,
}: {
	body?: unknown;
	method: "GET" | "POST";
	token: string;
	url: string;
}) =>
	new Promise<{ body: unknown; statusCode: number }>((resolve, reject) => {
		const target = new URL(url);
		const payload = body === undefined ? undefined : JSON.stringify(body);
		const req = request(
			{
				headers: {
					Authorization: `Bearer ${token}`,
					...(payload
						? {
								"Content-Length": Buffer.byteLength(payload).toString(),
								"Content-Type": "application/json",
							}
						: {}),
				},
				hostname: target.hostname,
				method,
				path: `${target.pathname}${target.search}`,
				port: target.port,
			},
			(res) => {
				let raw = "";
				res.setEncoding("utf8");
				res.on("data", (chunk) => {
					raw += chunk;
				});
				res.on("end", () => {
					resolve({
						body: raw.length > 0 ? JSON.parse(raw) : null,
						statusCode: res.statusCode ?? 0,
					});
				});
			}
		);

		req.on("error", reject);
		if (payload) {
			req.write(payload);
		}
		req.end();
	});

describe("createFf15OperationRuntimeProbeService", () => {
	it("auto-dispatches accepted Noctis-owned follow-up steps through the existing Noctis pane", async () => {
		const workspaceRoot = mkdtempSync(join(tmpdir(), "ff15-runtime-probe-"));

		try {
			seedTransitionOperation(workspaceRoot);
			const storage = {
				get: vi.fn().mockReturnValue(undefined),
				update: vi.fn().mockResolvedValue(undefined),
			};
			const store = createWorkspaceStateFf15MissionsStore(storage, {
				createId: () => "mission-1",
				getNow: vi.fn().mockReturnValue("2026-05-30T09:00:00.000Z"),
				getWorkspaceRoot: () => workspaceRoot,
			});
			await store.createMission();
			await store.updateMission("mission-1", {
				agentPanes: {
					gladiolus: null,
					ignis: null,
					noctis: "terminal_0",
					prompto: null,
				},
				operationRef: "builtin:idea-to-prd-and-issues",
				sessionName: "ff15-session",
				status: "active",
				workflow: {
					activeTask: "Clarify Requirements",
					currentStep: "clarify-requirements",
					lastReportSummary: null,
					probe: {
						checkedAt: "2026-05-30T08:59:00.000Z",
						summary: "Runtime already prepared for Noctis follow-up dispatch.",
						verdict: "go",
					},
					runtimeStatus: "ready",
				},
				workspaceRoot,
			});

			const sendPrompt = vi.fn().mockResolvedValue(undefined);
			const service = createFf15OperationRuntimeProbeService({
				getNow: () => "2026-05-30T09:01:00.000Z",
				missionsStore: store,
				missionTransport: {
					reconcileMissionAgentPanes: vi.fn().mockResolvedValue({
						gladiolus: "terminal_1",
						ignis: "terminal_2",
						noctis: "terminal_0",
						prompto: "terminal_3",
					}),
					sendPrompt,
				},
			});

			try {
				await service.ensureMissionRuntime("mission-1");

				const bridgeDir = join(
					workspaceRoot,
					FF15_WORKSPACE_RUNTIME_DIR_NAME,
					FF15_WORKSPACE_BRIDGE_DIR_NAME
				);
				const manifest = JSON.parse(
					readFileSync(join(bridgeDir, FF15_BRIDGE_MANIFEST_FILE_NAME), "utf8")
				) as {
					baseUrl: string;
					token: string;
				};

				const reportResponse = await invokeBridge({
					body: {
						message: "Requirements are settled. Draft the PRD next.",
						next: "draft-prd",
						taskId: "task-clarify-requirements",
					},
					method: "POST",
					token: manifest.token,
					url: `${manifest.baseUrl}/reports/mission-1`,
				});

				expect(reportResponse.statusCode).toBe(200);
				expect(sendPrompt).toHaveBeenCalledWith(
					expect.objectContaining({
						paneId: "terminal_0",
						prompt: expect.stringContaining("step: draft-prd"),
						sessionName: "ff15-session",
					})
				);
				expect(sendPrompt).toHaveBeenCalledWith(
					expect.objectContaining({
						prompt: expect.stringContaining(
							"previous_step: clarify-requirements"
						),
					})
				);
				expect(store.getMissionRecord("mission-1")).toEqual(
					expect.objectContaining({
						lastError: null,
						workflow: expect.objectContaining({
							currentStep: "draft-prd",
						}),
					})
				);
			} finally {
				await service.dispose();
			}
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	for (const providerId of ["github-copilot-cli", "opencode"] as const) {
		it(`reuses the pinned ${providerId} mission provider adapter for runtime follow-up dispatch`, async () => {
			const workspaceRoot = mkdtempSync(join(tmpdir(), "ff15-runtime-probe-"));

			try {
				seedWorkerDispatchOperation(workspaceRoot);
				const storage = {
					get: vi.fn().mockReturnValue(undefined),
					update: vi.fn().mockResolvedValue(undefined),
				};
				const store = createWorkspaceStateFf15MissionsStore(storage, {
					createId: () => "mission-1",
					getNow: vi.fn().mockReturnValue("2026-06-04T10:00:00.000Z"),
					getWorkspaceRoot: () => workspaceRoot,
				});
				await store.createMission({ providerId });
				await store.updateMission("mission-1", {
					agentPanes: {
						gladiolus: null,
						ignis: null,
						noctis: "terminal_0",
						prompto: null,
					},
					operationRef: "builtin:shiritori-smoke-test",
					sessionName: "ff15-session",
					workflow: {
						activeTask: "Start",
						currentStep: "start",
						lastReportSummary: null,
						probe: {
							checkedAt: "2026-06-04T09:59:00.000Z",
							summary: "Runtime already prepared for worker dispatch.",
							verdict: "go",
						},
						runtimeStatus: "ready",
					},
					workspaceRoot,
				});

				const reconcileMissionAgentPanes = vi.fn().mockResolvedValue({
					gladiolus: "terminal_3",
					ignis: "terminal_2",
					noctis: "terminal_0",
					prompto: "terminal_4",
				});
				const sendPrompt = vi.fn().mockResolvedValue(undefined);
				const adapter = resolveFf15MissionProviderAdapter(providerId);
				const deliverOperationFollowupPrompt = vi
					.spyOn(adapter, "deliverOperationFollowupPrompt")
					.mockResolvedValue({
						agentPanes: {
							gladiolus: "adapter_3",
							ignis: "adapter_2",
							noctis: "adapter_0",
							prompto: "adapter_4",
						},
						paneId: "adapter_2",
					});

				const service = createFf15OperationRuntimeProbeService({
					getNow: () => "2026-06-04T10:01:00.000Z",
					missionsStore: store,
					missionTransport: {
						reconcileMissionAgentPanes,
						sendPrompt,
					},
					resolveRuntimeContext: () => ({
						activeProjects: ["frontend"],
						executionRoot: workspaceRoot,
						openspecRoot: join(workspaceRoot, "selected-project", "openspec"),
					}),
				});

				try {
					await service.ensureMissionRuntime("mission-1");

					const bridgeDir = join(
						workspaceRoot,
						FF15_WORKSPACE_RUNTIME_DIR_NAME,
						FF15_WORKSPACE_BRIDGE_DIR_NAME
					);
					const manifest = JSON.parse(
						readFileSync(
							join(bridgeDir, FF15_BRIDGE_MANIFEST_FILE_NAME),
							"utf8"
						)
					) as {
						baseUrl: string;
						token: string;
					};

					const reportResponse = await invokeBridge({
						body: {
							message: "りんご",
							next: "ignis-turn",
							taskId: "task-start",
						},
						method: "POST",
						token: manifest.token,
						url: `${manifest.baseUrl}/reports/mission-1`,
					});

					expect(reportResponse.statusCode).toBe(200);
					expect(deliverOperationFollowupPrompt).toHaveBeenCalledWith(
						expect.objectContaining({
							agentId: "ignis",
							sessionName: "ff15-session",
							workspaceRoot,
						})
					);
					expect(reconcileMissionAgentPanes).not.toHaveBeenCalled();
					expect(sendPrompt).not.toHaveBeenCalled();
					expect(store.getMissionRecord("mission-1")).toEqual(
						expect.objectContaining({
							agentPanes: {
								gladiolus: "adapter_3",
								ignis: "adapter_2",
								noctis: "adapter_0",
								prompto: "adapter_4",
							},
							providerId,
						})
					);
				} finally {
					deliverOperationFollowupPrompt.mockRestore();
					await service.dispose();
				}
			} finally {
				rmSync(workspaceRoot, { force: true, recursive: true });
			}
		});
	}

	it("auto-dispatches worker steps with newly recorded step outputs available to placeholder resolution", async () => {
		const workspaceRoot = mkdtempSync(join(tmpdir(), "ff15-runtime-probe-"));

		try {
			seedOutputAwareWorkerDispatchOperation(workspaceRoot);
			const outputPath = getWorkspaceMissionOutputFilePath({
				fileName: "spec-plan.md",
				missionId: "mission-1",
				stepName: "spec-planning",
				taskId: "task-spec-planning",
				workspaceRoot,
			});
			mkdirSync(dirname(outputPath), { recursive: true });
			writeFileSync(outputPath, "---\nchange_name: test-change\n---\n", "utf8");

			const storage = {
				get: vi.fn().mockReturnValue(undefined),
				update: vi.fn().mockResolvedValue(undefined),
			};
			const store = createWorkspaceStateFf15MissionsStore(storage, {
				createId: () => "mission-1",
				getNow: vi.fn().mockReturnValue("2026-05-30T08:00:00.000Z"),
				getWorkspaceRoot: () => workspaceRoot,
			});
			await store.createMission();
			await store.updateMission("mission-1", {
				agentPanes: {
					gladiolus: null,
					ignis: null,
					noctis: "terminal_0",
					prompto: null,
				},
				operationRef: "builtin:shiritori-smoke-test",
				sessionName: "ff15-session",
				status: "active",
				workflow: {
					activeTask: "Spec Planning",
					currentStep: "spec-planning",
					lastReportSummary: null,
					probe: {
						checkedAt: "2026-05-30T07:59:00.000Z",
						summary: "Runtime already prepared for worker dispatch.",
						verdict: "go",
					},
					runtimeStatus: "ready",
				},
				workspaceRoot,
			});

			const reconcileMissionAgentPanes = vi.fn().mockResolvedValue({
				gladiolus: "terminal_1",
				ignis: "terminal_2",
				noctis: "terminal_0",
				prompto: "terminal_3",
			});
			const sendPrompt = vi.fn().mockResolvedValue(undefined);

			const service = createFf15OperationRuntimeProbeService({
				getNow: () => "2026-05-30T08:01:00.000Z",
				missionsStore: store,
				missionTransport: {
					reconcileMissionAgentPanes,
					sendPrompt,
				},
			});

			try {
				await service.ensureMissionRuntime("mission-1");

				const bridgeDir = join(
					workspaceRoot,
					FF15_WORKSPACE_RUNTIME_DIR_NAME,
					FF15_WORKSPACE_BRIDGE_DIR_NAME
				);
				const manifest = JSON.parse(
					readFileSync(join(bridgeDir, FF15_BRIDGE_MANIFEST_FILE_NAME), "utf8")
				) as {
					baseUrl: string;
					token: string;
				};

				const reportResponse = await invokeBridge({
					body: {
						message: "Spec plan is ready.",
						next: "implement",
						taskId: "task-spec-planning",
					},
					method: "POST",
					token: manifest.token,
					url: `${manifest.baseUrl}/reports/mission-1`,
				});

				expect(reportResponse.statusCode).toBe(200);
				expect(sendPrompt).toHaveBeenCalledWith(
					expect.objectContaining({
						paneId: "terminal_1",
						prompt: expect.stringContaining(outputPath),
						sessionName: "ff15-session",
					})
				);
				expect(store.getMissionRecord("mission-1")).toEqual(
					expect.objectContaining({
						lastError: null,
						workflow: expect.objectContaining({
							currentStep: "implement",
						}),
					})
				);
			} finally {
				await service.dispose();
			}
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("accepts a repeated step attempt with an incremented task id and dispatches the latest attempt artifact", async () => {
		const workspaceRoot = mkdtempSync(join(tmpdir(), "ff15-runtime-probe-"));

		try {
			seedOutputAwareWorkerDispatchOperation(workspaceRoot);
			const firstAttemptOutputPath = getWorkspaceMissionOutputFilePath({
				fileName: "spec-plan.md",
				missionId: "mission-1",
				stepName: "spec-planning",
				taskId: "task-spec-planning",
				workspaceRoot,
			});
			mkdirSync(dirname(firstAttemptOutputPath), { recursive: true });
			writeFileSync(
				firstAttemptOutputPath,
				"---\nchange_name: first-attempt\n---\n",
				"utf8"
			);

			const secondAttemptOutputPath = getWorkspaceMissionOutputFilePath({
				fileName: "spec-plan.md",
				missionId: "mission-1",
				stepName: "spec-planning",
				taskId: "task-spec-planning-2",
				workspaceRoot,
			});
			mkdirSync(dirname(secondAttemptOutputPath), { recursive: true });
			writeFileSync(
				secondAttemptOutputPath,
				"---\nchange_name: second-attempt\n---\n",
				"utf8"
			);

			const storage = {
				get: vi.fn().mockReturnValue(undefined),
				update: vi.fn().mockResolvedValue(undefined),
			};
			const store = createWorkspaceStateFf15MissionsStore(storage, {
				createId: () => "mission-1",
				getNow: vi.fn().mockReturnValue("2026-05-30T08:30:00.000Z"),
				getWorkspaceRoot: () => workspaceRoot,
			});
			await store.createMission();
			await store.updateMission("mission-1", {
				agentPanes: {
					gladiolus: null,
					ignis: null,
					noctis: "terminal_0",
					prompto: null,
				},
				operationRef: "builtin:shiritori-smoke-test",
				sessionName: "ff15-session",
				status: "active",
				workflow: {
					activeTask: "Spec Planning",
					currentStep: "spec-planning",
					lastReportSummary: null,
					probe: {
						checkedAt: "2026-05-30T08:29:00.000Z",
						summary: "Runtime prepared for repeated step dispatch.",
						verdict: "go",
					},
					runtimeStatus: "ready",
					stepHistory: [
						{
							completedAt: "2026-05-30T08:28:00.000Z",
							fromAgent: "noctis",
							fromStep: "spec-planning",
							handoffSummary: "First attempt completed.",
							next: "implement",
							taskId: "task-spec-planning",
						},
					],
				},
				workspaceRoot,
			});

			const sendPrompt = vi.fn().mockResolvedValue(undefined);
			const service = createFf15OperationRuntimeProbeService({
				getNow: () => "2026-05-30T08:31:00.000Z",
				missionsStore: store,
				missionTransport: {
					reconcileMissionAgentPanes: vi.fn().mockResolvedValue({
						gladiolus: "terminal_1",
						ignis: "terminal_2",
						noctis: "terminal_0",
						prompto: "terminal_3",
					}),
					sendPrompt,
				},
			});

			try {
				await service.ensureMissionRuntime("mission-1");

				const bridgeDir = join(
					workspaceRoot,
					FF15_WORKSPACE_RUNTIME_DIR_NAME,
					FF15_WORKSPACE_BRIDGE_DIR_NAME
				);
				const manifest = JSON.parse(
					readFileSync(join(bridgeDir, FF15_BRIDGE_MANIFEST_FILE_NAME), "utf8")
				) as {
					baseUrl: string;
					token: string;
				};

				const reportResponse = await invokeBridge({
					body: {
						message: "Second spec attempt is ready.",
						next: "implement",
						taskId: "task-spec-planning-2",
					},
					method: "POST",
					token: manifest.token,
					url: `${manifest.baseUrl}/reports/mission-1`,
				});

				expect(reportResponse.statusCode).toBe(200);
				expect(sendPrompt).toHaveBeenCalledWith(
					expect.objectContaining({
						paneId: "terminal_1",
						prompt: expect.stringContaining(secondAttemptOutputPath),
						sessionName: "ff15-session",
					})
				);
				expect(store.getMissionRecord("mission-1")).toEqual(
					expect.objectContaining({
						lastError: null,
						workflow: expect.objectContaining({
							currentStep: "implement",
							stepHistory: [
								expect.objectContaining({
									taskId: "task-spec-planning",
								}),
								expect.objectContaining({
									taskId: "task-spec-planning-2",
								}),
							],
						}),
					})
				);
			} finally {
				await service.dispose();
			}
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("rejects a report transition when the current step's required output artifact is missing", async () => {
		const workspaceRoot = mkdtempSync(join(tmpdir(), "ff15-runtime-probe-"));

		try {
			seedOutputAwareWorkerDispatchOperation(workspaceRoot);
			const storage = {
				get: vi.fn().mockReturnValue(undefined),
				update: vi.fn().mockResolvedValue(undefined),
			};
			const store = createWorkspaceStateFf15MissionsStore(storage, {
				createId: () => "mission-1",
				getNow: vi.fn().mockReturnValue("2026-05-30T08:10:00.000Z"),
				getWorkspaceRoot: () => workspaceRoot,
			});
			await store.createMission();
			await store.updateMission("mission-1", {
				agentPanes: {
					gladiolus: null,
					ignis: null,
					noctis: "terminal_0",
					prompto: null,
				},
				operationRef: "builtin:shiritori-smoke-test",
				sessionName: "ff15-session",
				status: "active",
				workflow: {
					activeTask: "Spec Planning",
					currentStep: "spec-planning",
					lastReportSummary: null,
					probe: {
						checkedAt: "2026-05-30T08:09:00.000Z",
						summary: "Runtime already prepared for worker dispatch.",
						verdict: "go",
					},
					runtimeStatus: "ready",
				},
				workspaceRoot,
			});

			const sendPrompt = vi.fn().mockResolvedValue(undefined);
			const service = createFf15OperationRuntimeProbeService({
				getNow: () => "2026-05-30T08:11:00.000Z",
				missionsStore: store,
				missionTransport: {
					reconcileMissionAgentPanes: vi.fn().mockResolvedValue({
						gladiolus: "terminal_1",
						ignis: "terminal_2",
						noctis: "terminal_0",
						prompto: "terminal_3",
					}),
					sendPrompt,
				},
			});

			try {
				await service.ensureMissionRuntime("mission-1");

				const bridgeDir = join(
					workspaceRoot,
					FF15_WORKSPACE_RUNTIME_DIR_NAME,
					FF15_WORKSPACE_BRIDGE_DIR_NAME
				);
				const manifest = JSON.parse(
					readFileSync(join(bridgeDir, FF15_BRIDGE_MANIFEST_FILE_NAME), "utf8")
				) as {
					baseUrl: string;
					token: string;
				};

				const reportResponse = await invokeBridge({
					body: {
						message: "Spec plan is ready.",
						next: "implement",
						taskId: "task-spec-planning",
					},
					method: "POST",
					token: manifest.token,
					url: `${manifest.baseUrl}/reports/mission-1`,
				});

				expect(reportResponse.statusCode).toBe(400);
				expect(reportResponse.body).toEqual(
					expect.objectContaining({
						error: "Invalid report",
						missionId: "mission-1",
					})
				);
				expect(sendPrompt).not.toHaveBeenCalled();
				expect(store.getMissionRecord("mission-1")).toEqual(
					expect.objectContaining({
						lastError: expect.stringContaining("Missing required output"),
						workflow: expect.objectContaining({
							currentStep: "spec-planning",
						}),
					})
				);
			} finally {
				await service.dispose();
			}
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("rejects a report transition when taskId does not match the current workflow step", async () => {
		const workspaceRoot = mkdtempSync(join(tmpdir(), "ff15-runtime-probe-"));

		try {
			seedOutputAwareWorkerDispatchOperation(workspaceRoot);
			const outputPath = getWorkspaceMissionOutputFilePath({
				fileName: "spec-plan.md",
				missionId: "mission-1",
				stepName: "spec-planning",
				taskId: "task-spec-planning",
				workspaceRoot,
			});
			mkdirSync(dirname(outputPath), { recursive: true });
			writeFileSync(outputPath, "---\nchange_name: test-change\n---\n", "utf8");

			const storage = {
				get: vi.fn().mockReturnValue(undefined),
				update: vi.fn().mockResolvedValue(undefined),
			};
			const store = createWorkspaceStateFf15MissionsStore(storage, {
				createId: () => "mission-1",
				getNow: vi.fn().mockReturnValue("2026-05-30T08:20:00.000Z"),
				getWorkspaceRoot: () => workspaceRoot,
			});
			await store.createMission();
			await store.updateMission("mission-1", {
				agentPanes: {
					gladiolus: null,
					ignis: null,
					noctis: "terminal_0",
					prompto: null,
				},
				operationRef: "builtin:shiritori-smoke-test",
				sessionName: "ff15-session",
				status: "active",
				workflow: {
					activeTask: "Spec Planning",
					currentStep: "spec-planning",
					lastReportSummary: null,
					probe: {
						checkedAt: "2026-05-30T08:19:00.000Z",
						summary: "Runtime already prepared for worker dispatch.",
						verdict: "go",
					},
					runtimeStatus: "ready",
				},
				workspaceRoot,
			});

			const sendPrompt = vi.fn().mockResolvedValue(undefined);
			const service = createFf15OperationRuntimeProbeService({
				getNow: () => "2026-05-30T08:21:00.000Z",
				missionsStore: store,
				missionTransport: {
					reconcileMissionAgentPanes: vi.fn().mockResolvedValue({
						gladiolus: "terminal_1",
						ignis: "terminal_2",
						noctis: "terminal_0",
						prompto: "terminal_3",
					}),
					sendPrompt,
				},
			});

			try {
				await service.ensureMissionRuntime("mission-1");

				const bridgeDir = join(
					workspaceRoot,
					FF15_WORKSPACE_RUNTIME_DIR_NAME,
					FF15_WORKSPACE_BRIDGE_DIR_NAME
				);
				const manifest = JSON.parse(
					readFileSync(join(bridgeDir, FF15_BRIDGE_MANIFEST_FILE_NAME), "utf8")
				) as {
					baseUrl: string;
					token: string;
				};

				const reportResponse = await invokeBridge({
					body: {
						message: "Spec plan is ready.",
						next: "implement",
						taskId: "task-clarify-requirements",
					},
					method: "POST",
					token: manifest.token,
					url: `${manifest.baseUrl}/reports/mission-1`,
				});

				expect(reportResponse.statusCode).toBe(400);
				expect(reportResponse.body).toEqual(
					expect.objectContaining({
						error: "Invalid report",
						missionId: "mission-1",
					})
				);
				expect(sendPrompt).not.toHaveBeenCalled();
				expect(store.getMissionRecord("mission-1")).toEqual(
					expect.objectContaining({
						lastError: expect.stringContaining("Invalid taskId"),
						workflow: expect.objectContaining({
							currentStep: "spec-planning",
						}),
					})
				);
			} finally {
				await service.dispose();
			}
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("auto-dispatches worker-owned next steps through the existing mission transport after an accepted report", async () => {
		const workspaceRoot = mkdtempSync(join(tmpdir(), "ff15-runtime-probe-"));

		try {
			seedWorkerDispatchOperation(workspaceRoot);
			const storage = {
				get: vi.fn().mockReturnValue(undefined),
				update: vi.fn().mockResolvedValue(undefined),
			};
			const store = createWorkspaceStateFf15MissionsStore(storage, {
				createId: () => "mission-1",
				getNow: vi.fn().mockReturnValue("2026-05-28T10:00:00.000Z"),
				getWorkspaceRoot: () => workspaceRoot,
			});
			await store.createMission();
			await store.updateMission("mission-1", {
				agentPanes: {
					gladiolus: null,
					ignis: null,
					noctis: "terminal_0",
					prompto: null,
				},
				operationRef: "builtin:shiritori-smoke-test",
				sessionName: "ff15-session",
				workflow: {
					activeTask: "Start",
					currentStep: "start",
					lastReportSummary: null,
					probe: {
						checkedAt: "2026-05-28T09:59:00.000Z",
						summary: "Runtime already prepared for worker dispatch.",
						verdict: "go",
					},
					runtimeStatus: "ready",
				},
				workspaceRoot,
			});

			const reconcileMissionAgentPanes = vi.fn().mockResolvedValue({
				gladiolus: "terminal_3",
				ignis: "terminal_2",
				noctis: "terminal_0",
				prompto: "terminal_4",
			});
			const sendPrompt = vi.fn().mockResolvedValue(undefined);

			const service = createFf15OperationRuntimeProbeService({
				getNow: () => "2026-05-28T10:01:00.000Z",
				missionsStore: store,
				missionTransport: {
					reconcileMissionAgentPanes,
					sendPrompt,
				},
				resolveRuntimeContext: () => ({
					activeProjects: ["frontend", "backend"],
					executionRoot: workspaceRoot,
					openspecRoot: join(workspaceRoot, "selected-project", "openspec"),
				}),
			});

			try {
				await service.ensureMissionRuntime("mission-1");

				const bridgeDir = join(
					workspaceRoot,
					FF15_WORKSPACE_RUNTIME_DIR_NAME,
					FF15_WORKSPACE_BRIDGE_DIR_NAME
				);
				const manifest = JSON.parse(
					readFileSync(join(bridgeDir, FF15_BRIDGE_MANIFEST_FILE_NAME), "utf8")
				) as {
					baseUrl: string;
					token: string;
				};

				const reportResponse = await invokeBridge({
					body: {
						message: "りんご",
						next: "ignis-turn",
						taskId: "task-start",
					},
					method: "POST",
					token: manifest.token,
					url: `${manifest.baseUrl}/reports/mission-1`,
				});

				expect(reportResponse.statusCode).toBe(200);
				expect(reconcileMissionAgentPanes).toHaveBeenCalledWith({
					agentPanes: {
						gladiolus: null,
						ignis: null,
						noctis: "terminal_0",
						prompto: null,
					},
					sessionName: "ff15-session",
					workspaceRoot,
				});
				expect(sendPrompt).toHaveBeenCalledWith({
					paneId: "terminal_2",
					prompt: expect.stringContaining("<operation-prompt>"),
					sessionName: "ff15-session",
				});
				expect(sendPrompt).toHaveBeenCalledWith(
					expect.objectContaining({
						prompt: expect.stringContaining("operation: shiritori-smoke-test"),
					})
				);
				expect(sendPrompt).toHaveBeenCalledWith(
					expect.objectContaining({
						prompt: expect.stringContaining("<handoff-context>"),
					})
				);
				expect(sendPrompt).toHaveBeenCalledWith(
					expect.objectContaining({
						prompt: expect.stringContaining("previous_step: start"),
					})
				);
				expect(sendPrompt).toHaveBeenCalledWith(
					expect.objectContaining({
						prompt: expect.stringContaining("previous_step_owner: noctis"),
					})
				);
				expect(sendPrompt).toHaveBeenCalledWith(
					expect.objectContaining({
						prompt: expect.stringContaining("task_id: task-start"),
					})
				);
				expect(sendPrompt).toHaveBeenCalledWith(
					expect.objectContaining({
						prompt: expect.stringContaining("selected_next: ignis-turn"),
					})
				);
				expect(sendPrompt).toHaveBeenCalledWith(
					expect.objectContaining({
						prompt: expect.stringContaining("handoff_summary: りんご"),
					})
				);
				expect(sendPrompt).toHaveBeenCalledWith(
					expect.objectContaining({
						prompt: expect.stringContaining("<step-completion-contract>"),
					})
				);
				expect(sendPrompt).toHaveBeenCalledWith(
					expect.objectContaining({
						prompt: expect.stringContaining("submit-report.ps1"),
					})
				);
				expect(sendPrompt).toHaveBeenCalledWith(
					expect.objectContaining({
						prompt: expect.stringContaining(`execution_root: ${workspaceRoot}`),
					})
				);
				expect(sendPrompt).toHaveBeenCalledWith(
					expect.objectContaining({
						prompt: expect.stringContaining(
							"active_projects:\n  - frontend\n  - backend"
						),
					})
				);
				expect(sendPrompt).toHaveBeenCalledWith(
					expect.objectContaining({
						prompt: expect.stringContaining(
							`openspec_root: ${join(workspaceRoot, "selected-project", "openspec")}`
						),
					})
				);
				expect(store.getMissionRecord("mission-1")).toEqual(
					expect.objectContaining({
						lastError: null,
						workflow: expect.objectContaining({
							activeTask: "Ignis Turn",
							currentStep: "ignis-turn",
							stepHistory: [
								expect.objectContaining({
									fromAgent: "noctis",
									fromStep: "start",
									handoffSummary: "りんご",
									next: "ignis-turn",
									taskId: "task-start",
								}),
							],
						}),
					})
				);
			} finally {
				await service.dispose();
			}
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("preserves the progressed worker-owned step and records an actionable error when worker auto-dispatch fails", async () => {
		const workspaceRoot = mkdtempSync(join(tmpdir(), "ff15-runtime-probe-"));

		try {
			seedWorkerDispatchOperation(workspaceRoot);
			const storage = {
				get: vi.fn().mockReturnValue(undefined),
				update: vi.fn().mockResolvedValue(undefined),
			};
			const store = createWorkspaceStateFf15MissionsStore(storage, {
				createId: () => "mission-1",
				getNow: vi.fn().mockReturnValue("2026-05-28T10:00:00.000Z"),
				getWorkspaceRoot: () => workspaceRoot,
			});
			await store.createMission();
			await store.updateMission("mission-1", {
				agentPanes: {
					gladiolus: null,
					ignis: null,
					noctis: "terminal_0",
					prompto: null,
				},
				operationRef: "builtin:shiritori-smoke-test",
				sessionName: "ff15-session",
				workflow: {
					activeTask: "Start",
					currentStep: "start",
					lastReportSummary: null,
					probe: {
						checkedAt: "2026-05-28T09:59:00.000Z",
						summary: "Runtime already prepared for worker dispatch.",
						verdict: "go",
					},
					runtimeStatus: "ready",
				},
				workspaceRoot,
			});

			const reconcileMissionAgentPanes = vi.fn().mockResolvedValue({
				gladiolus: "terminal_3",
				ignis: null,
				noctis: "terminal_0",
				prompto: "terminal_4",
			});
			const sendPrompt = vi.fn().mockResolvedValue(undefined);

			const service = createFf15OperationRuntimeProbeService({
				getNow: () => "2026-05-28T10:01:00.000Z",
				missionsStore: store,
				missionTransport: {
					reconcileMissionAgentPanes,
					sendPrompt,
				},
			});

			try {
				await service.ensureMissionRuntime("mission-1");

				const bridgeDir = join(
					workspaceRoot,
					FF15_WORKSPACE_RUNTIME_DIR_NAME,
					FF15_WORKSPACE_BRIDGE_DIR_NAME
				);
				const manifest = JSON.parse(
					readFileSync(join(bridgeDir, FF15_BRIDGE_MANIFEST_FILE_NAME), "utf8")
				) as {
					baseUrl: string;
					token: string;
				};

				const reportResponse = await invokeBridge({
					body: {
						message: "りんご",
						next: "ignis-turn",
						taskId: "task-start",
					},
					method: "POST",
					token: manifest.token,
					url: `${manifest.baseUrl}/reports/mission-1`,
				});

				expect(reportResponse.statusCode).toBe(200);
				expect(sendPrompt).not.toHaveBeenCalled();
				expect(store.getMissionRecord("mission-1")).toEqual(
					expect.objectContaining({
						lastError:
							"Automatic dispatch failed: FF15 could not resolve a live Ignis pane for this mission.",
						workflow: expect.objectContaining({
							activeTask: "Ignis Turn",
							currentStep: "ignis-turn",
						}),
					})
				);
			} finally {
				await service.dispose();
			}
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("accepts report submissions with taskId, next, and message and advances to the allowed next step", async () => {
		const workspaceRoot = mkdtempSync(join(tmpdir(), "ff15-runtime-probe-"));

		try {
			seedTransitionOperation(workspaceRoot);
			const storage = {
				get: vi.fn().mockReturnValue(undefined),
				update: vi.fn().mockResolvedValue(undefined),
			};
			const store = createWorkspaceStateFf15MissionsStore(storage, {
				createId: () => "mission-1",
				getNow: vi.fn().mockReturnValue("2026-05-28T09:00:00.000Z"),
				getWorkspaceRoot: () => workspaceRoot,
			});
			await store.createMission();
			await store.updateMission("mission-1", {
				operationRef: "builtin:idea-to-prd-and-issues",
				workflow: {
					activeTask: "Clarify Requirements",
					currentStep: "clarify-requirements",
					lastReportSummary: null,
					probe: {
						checkedAt: "2026-05-28T08:59:00.000Z",
						summary: "Runtime already prepared for report handling.",
						verdict: "go",
					},
					runtimeStatus: "ready",
				},
			});

			const service = createFf15OperationRuntimeProbeService({
				getNow: () => "2026-05-28T09:01:00.000Z",
				missionsStore: store,
			});

			try {
				await service.ensureMissionRuntime("mission-1");

				const bridgeDir = join(
					workspaceRoot,
					FF15_WORKSPACE_RUNTIME_DIR_NAME,
					FF15_WORKSPACE_BRIDGE_DIR_NAME
				);
				const reportScript = readFileSync(
					join(bridgeDir, "submit-report.ps1"),
					"utf8"
				);
				expect(reportScript).toContain("[string]$TaskId");
				expect(reportScript).toContain("[string]$Next");
				expect(reportScript).toContain("[string]$Message");

				const manifest = JSON.parse(
					readFileSync(join(bridgeDir, FF15_BRIDGE_MANIFEST_FILE_NAME), "utf8")
				) as {
					baseUrl: string;
					token: string;
				};

				const reportResponse = await invokeBridge({
					body: {
						message: "Requirements are settled. Draft the PRD next.",
						next: "draft-prd",
						taskId: "task-clarify-requirements",
					},
					method: "POST",
					token: manifest.token,
					url: `${manifest.baseUrl}/reports/mission-1`,
				});

				expect(reportResponse.statusCode).toBe(200);
				expect(reportResponse.body).toEqual(
					expect.objectContaining({
						acknowledged: true,
						missionId: "mission-1",
						runtimeStatus: "ready",
					})
				);
				expect(store.getMissionRecord("mission-1")).toEqual(
					expect.objectContaining({
						lastError: null,
						workflow: expect.objectContaining({
							currentStep: "draft-prd",
							lastReportSummary:
								"Requirements are settled. Draft the PRD next.",
							runtimeStatus: "ready",
						}),
					})
				);
			} finally {
				await service.dispose();
			}
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("preserves actionable mission failure state when a report requests a disallowed next step", async () => {
		const workspaceRoot = mkdtempSync(join(tmpdir(), "ff15-runtime-probe-"));

		try {
			seedTransitionOperation(workspaceRoot);
			const storage = {
				get: vi.fn().mockReturnValue(undefined),
				update: vi.fn().mockResolvedValue(undefined),
			};
			const store = createWorkspaceStateFf15MissionsStore(storage, {
				createId: () => "mission-1",
				getNow: vi.fn().mockReturnValue("2026-05-28T09:10:00.000Z"),
				getWorkspaceRoot: () => workspaceRoot,
			});
			await store.createMission();
			await store.updateMission("mission-1", {
				operationRef: "builtin:idea-to-prd-and-issues",
				workflow: {
					activeTask: "Clarify Requirements",
					currentStep: "clarify-requirements",
					lastReportSummary: null,
					probe: {
						checkedAt: "2026-05-28T09:09:00.000Z",
						summary: "Runtime already prepared for report handling.",
						verdict: "go",
					},
					runtimeStatus: "ready",
				},
			});

			const service = createFf15OperationRuntimeProbeService({
				getNow: () => "2026-05-28T09:11:00.000Z",
				missionsStore: store,
			});

			try {
				await service.ensureMissionRuntime("mission-1");

				const bridgeDir = join(
					workspaceRoot,
					FF15_WORKSPACE_RUNTIME_DIR_NAME,
					FF15_WORKSPACE_BRIDGE_DIR_NAME
				);
				const manifest = JSON.parse(
					readFileSync(join(bridgeDir, FF15_BRIDGE_MANIFEST_FILE_NAME), "utf8")
				) as {
					baseUrl: string;
					token: string;
				};

				const reportResponse = await invokeBridge({
					body: {
						message: "Skip straight to implementation.",
						next: "implement",
						taskId: "task-clarify-requirements",
					},
					method: "POST",
					token: manifest.token,
					url: `${manifest.baseUrl}/reports/mission-1`,
				});

				expect(reportResponse.statusCode).toBe(400);
				expect(reportResponse.body).toEqual(
					expect.objectContaining({
						error: "Invalid next",
						missionId: "mission-1",
					})
				);
				expect(store.getMissionRecord("mission-1")).toEqual(
					expect.objectContaining({
						lastError: "Invalid next for clarify-requirements: implement",
						workflow: expect.objectContaining({
							activeTask: "Clarify Requirements",
							currentStep: "clarify-requirements",
							lastReportSummary: "Skip straight to implementation.",
							runtimeStatus: "ready",
						}),
					})
				);
			} finally {
				await service.dispose();
			}
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("materializes workspace bridge assets and acknowledges mission, workflow, task, and report runtime entry points", async () => {
		const workspaceRoot = mkdtempSync(join(tmpdir(), "ff15-runtime-probe-"));

		try {
			const storage = {
				get: vi.fn().mockReturnValue(undefined),
				update: vi.fn().mockResolvedValue(undefined),
			};
			const store = createWorkspaceStateFf15MissionsStore(storage, {
				createId: () => "mission-1",
				getNow: vi.fn().mockReturnValue("2026-05-27T15:00:00.000Z"),
				getWorkspaceRoot: () => workspaceRoot,
			});
			await store.createMission();
			await store.updateMission("mission-1", {
				operationRef: "builtin:noctis-autonomous",
			});

			const service = createFf15OperationRuntimeProbeService({
				getNow: () => "2026-05-27T15:01:00.000Z",
				missionsStore: store,
			});

			try {
				await service.ensureMissionRuntime("mission-1");

				const bridgeDir = join(
					workspaceRoot,
					FF15_WORKSPACE_RUNTIME_DIR_NAME,
					FF15_WORKSPACE_BRIDGE_DIR_NAME
				);
				const manifestPath = join(bridgeDir, FF15_BRIDGE_MANIFEST_FILE_NAME);

				expect(existsSync(join(bridgeDir, "get-mission.ps1"))).toBe(true);
				expect(existsSync(join(bridgeDir, "get-workflow.ps1"))).toBe(true);
				expect(existsSync(join(bridgeDir, "submit-task.ps1"))).toBe(true);
				expect(existsSync(join(bridgeDir, "submit-report.ps1"))).toBe(true);

				const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
					baseUrl: string;
					token: string;
				};

				const missionResponse = await invokeBridge({
					method: "GET",
					token: manifest.token,
					url: `${manifest.baseUrl}/missions/mission-1`,
				});
				expect(missionResponse.statusCode).toBe(200);
				expect(missionResponse.body).toEqual(
					expect.objectContaining({
						id: "mission-1",
						operationRef: "builtin:noctis-autonomous",
					})
				);

				const workflowResponse = await invokeBridge({
					method: "GET",
					token: manifest.token,
					url: `${manifest.baseUrl}/workflows/mission-1`,
				});
				expect(workflowResponse.statusCode).toBe(200);
				expect(workflowResponse.body).toEqual(
					expect.objectContaining({
						probe: expect.objectContaining({
							verdict: "go",
						}),
						runtimeStatus: "ready",
					})
				);

				const taskResponse = await invokeBridge({
					body: {
						step: "step-2",
						task: "Review follow-up runtime step",
					},
					method: "POST",
					token: manifest.token,
					url: `${manifest.baseUrl}/tasks/mission-1`,
				});
				expect(taskResponse.statusCode).toBe(200);
				expect(taskResponse.body).toEqual(
					expect.objectContaining({
						acknowledged: true,
						missionId: "mission-1",
					})
				);

				const reportResponse = await invokeBridge({
					body: {
						step: "step-2",
						summary: "Runtime bridge accepted the follow-up report.",
					},
					method: "POST",
					token: manifest.token,
					url: `${manifest.baseUrl}/reports/mission-1`,
				});
				expect(reportResponse.statusCode).toBe(200);
				expect(reportResponse.body).toEqual(
					expect.objectContaining({
						acknowledged: true,
						missionId: "mission-1",
					})
				);

				expect(store.getMissionRecord("mission-1")).toEqual(
					expect.objectContaining({
						workflow: expect.objectContaining({
							activeTask: "Review follow-up runtime step",
							currentStep: "step-2",
							lastReportSummary:
								"Runtime bridge accepted the follow-up report.",
							probe: expect.objectContaining({
								verdict: "go",
							}),
							runtimeStatus: "ready",
						}),
					})
				);
			} finally {
				await service.dispose();
			}
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("rebuilds bridge assets for a hydrated ready mission after runtime service reload without losing workflow identity", async () => {
		const workspaceRoot = mkdtempSync(join(tmpdir(), "ff15-runtime-probe-"));

		try {
			seedWorkerDispatchOperation(workspaceRoot);
			const storage = {
				get: vi.fn().mockReturnValue(undefined),
				update: vi.fn().mockResolvedValue(undefined),
			};
			const store = createWorkspaceStateFf15MissionsStore(storage, {
				createId: () => "mission-1",
				getNow: vi.fn().mockReturnValue("2026-05-28T11:00:00.000Z"),
				getWorkspaceRoot: () => workspaceRoot,
			});
			await store.createMission();
			await store.updateMission("mission-1", {
				agentPanes: {
					gladiolus: "terminal_1",
					ignis: "terminal_2",
					noctis: "terminal_0",
					prompto: "terminal_3",
				},
				operationRef: "builtin:shiritori-smoke-test",
				sessionName: "ff15-session",
				status: "active",
				workflow: {
					activeTask: "Ignis Turn",
					currentStep: "ignis-turn",
					lastReportSummary: "りんご",
					probe: {
						checkedAt: "2026-05-28T10:59:00.000Z",
						summary:
							"Extension-host bridge is viable for the next runtime slice.",
						verdict: "go",
					},
					runtimeStatus: "ready",
				},
				workspaceRoot,
			});

			const initialService = createFf15OperationRuntimeProbeService({
				getNow: () => "2026-05-28T11:01:00.000Z",
				missionsStore: store,
			});

			try {
				await initialService.ensureMissionRuntime("mission-1");
			} finally {
				await initialService.dispose();
			}

			rmSync(
				join(
					workspaceRoot,
					FF15_WORKSPACE_RUNTIME_DIR_NAME,
					FF15_WORKSPACE_BRIDGE_DIR_NAME
				),
				{ force: true, recursive: true }
			);

			const recoveredService = createFf15OperationRuntimeProbeService({
				getNow: () => "2026-05-28T11:02:00.000Z",
				missionsStore: store,
			});

			try {
				await recoveredService.ensureMissionRuntime("mission-1");

				const bridgeDir = join(
					workspaceRoot,
					FF15_WORKSPACE_RUNTIME_DIR_NAME,
					FF15_WORKSPACE_BRIDGE_DIR_NAME
				);

				expect(
					existsSync(join(bridgeDir, FF15_BRIDGE_MANIFEST_FILE_NAME))
				).toBe(true);
				expect(store.getMissionRecord("mission-1")).toEqual(
					expect.objectContaining({
						workflow: expect.objectContaining({
							activeTask: "Ignis Turn",
							currentStep: "ignis-turn",
							lastReportSummary: "りんご",
							runtimeStatus: "ready",
						}),
					})
				);
			} finally {
				await recoveredService.dispose();
			}
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});
});
