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
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
	createWorkspaceStateFf15MissionsStore,
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
});
