import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import {
	createServer,
	request,
	type IncomingMessage,
	type Server,
	type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import {
	FF15_AGENT_DISPLAY_NAMES,
	type Ff15AgentId,
} from "../ff15-launch/launch-client";
import {
	createEmptyFf15MissionWorkflowState,
	type Ff15MissionAgentPanes,
	type Ff15MissionRecord,
	type Ff15MissionWorkflowProbe,
	type Ff15MissionWorkflowStepHistoryEntry,
	type Ff15MissionWorkflowState,
	type Ff15MissionsStore,
	FF15_WORKSPACE_RUNTIME_DIR_NAME,
} from "../ff15-missions/state";
import {
	buildWorkerOperationAwarePrompt,
	type Ff15MissionOperationActivation,
	type Ff15MissionOperationStep,
	formatFf15OperationTaskLabel,
	loadMissionOperationDefinition,
} from "./definition";

export const FF15_WORKSPACE_BRIDGE_DIR_NAME = "bridge";
export const FF15_BRIDGE_MANIFEST_FILE_NAME = "ff15-bridge-manifest.json";

interface Ff15OperationRuntimeProbeServiceOptions {
	getNow?: () => string;
	missionTransport?: Ff15OperationRuntimeMissionTransport;
	missionsStore: Ff15MissionsStore;
}

interface Ff15OperationRuntimeMissionTransport {
	reconcileMissionAgentPanes: (input: {
		agentPanes: Ff15MissionAgentPanes;
		sessionName: string;
		workspaceRoot: string;
	}) => Promise<Ff15MissionAgentPanes>;
	sendPrompt: (input: {
		paneId: string;
		prompt: string;
		sessionName: string;
	}) => Promise<void>;
}

interface Ff15BridgeManifest {
	baseUrl: string;
	endpoints: {
		missionLookup: string;
		reportSubmission: string;
		taskSubmission: string;
		workflowLookup: string;
	};
	token: string;
	version: 1;
}

interface WorkspaceBridgeRuntime {
	baseUrl: string;
	missionBootstraps: Map<string, Promise<void>>;
	server: Server;
	token: string;
	workspaceRoot: string;
}

interface ResolvedMissionRequest {
	mission: Ff15MissionRecord;
	missionId: string;
	resource: string | null;
}

type WorkflowPatch = Partial<Omit<Ff15MissionWorkflowState, "probe">> & {
	probe?: Partial<Ff15MissionWorkflowProbe>;
};

export interface Ff15OperationRuntimeProbeService {
	dispose: () => Promise<void>;
	ensureMissionRuntime: (missionId: string) => Promise<void>;
}

type Ff15WorkerAgentId = Exclude<Ff15AgentId, "noctis">;

const FF15_WORKER_AGENT_IDS = new Set<Ff15WorkerAgentId>([
	"gladiolus",
	"ignis",
	"prompto",
]);

const createBridgeManifest = (
	baseUrl: string,
	token: string
): Ff15BridgeManifest => ({
	baseUrl,
	endpoints: {
		missionLookup: "/missions/{missionId}",
		reportSubmission: "/reports/{missionId}",
		taskSubmission: "/tasks/{missionId}",
		workflowLookup: "/workflows/{missionId}",
	},
	token,
	version: 1,
});

const getBridgeDir = (workspaceRoot: string) =>
	join(
		workspaceRoot,
		FF15_WORKSPACE_RUNTIME_DIR_NAME,
		FF15_WORKSPACE_BRIDGE_DIR_NAME
	);

const mergeWorkflowState = (
	existing: Ff15MissionWorkflowState | undefined,
	patch: WorkflowPatch
): Ff15MissionWorkflowState => {
	const base = existing ?? createEmptyFf15MissionWorkflowState();

	return {
		...base,
		...patch,
		probe: {
			...base.probe,
			...patch.probe,
		},
	};
};

const isWorkerAgentId = (
	value: string | null | undefined
): value is Ff15WorkerAgentId =>
	value === "gladiolus" || value === "ignis" || value === "prompto";

const getErrorMessage = (error: unknown, fallback: string): string =>
	error instanceof Error && error.message.length > 0 ? error.message : fallback;

const getWorkerStepTaskId = (stepName: string) => `task-${stepName}`;

const createWorkerStepActivation = (
	operationDefinition: NonNullable<
		ReturnType<typeof loadMissionOperationDefinition>
	>,
	step: Ff15MissionOperationStep
): Ff15MissionOperationActivation => ({
	activeTask: formatFf15OperationTaskLabel(step.name),
	definition: operationDefinition,
	operationName: operationDefinition.name,
	step,
	stepAgent: step.agent ?? null,
	stepName: step.name,
});

const getWorkerDispatchActivation = (
	operationDefinition: ReturnType<typeof loadMissionOperationDefinition>,
	step: Ff15MissionOperationStep | null
): Ff15MissionOperationActivation | null => {
	if (!operationDefinition) {
		return null;
	}

	const stepAgent = step?.agent;
	if (!(step && isWorkerAgentId(stepAgent))) {
		return null;
	}

	return createWorkerStepActivation(operationDefinition, step);
};

const createWorkflowStepHistoryEntry = (input: {
	activeStep: Ff15MissionOperationStep | null;
	currentStepName: string | null;
	next: string | null;
	recordedAt: string;
	reportMessage: string | null;
	taskId: string | null;
}): Ff15MissionWorkflowStepHistoryEntry | null => {
	if (
		input.activeStep == null &&
		input.currentStepName == null &&
		input.next == null &&
		input.reportMessage == null &&
		input.taskId == null
	) {
		return null;
	}

	return {
		completedAt: input.recordedAt,
		fromAgent: input.activeStep?.agent ?? null,
		fromStep: input.activeStep?.name ?? input.currentStepName,
		handoffSummary: input.reportMessage,
		next: input.next,
		taskId: input.taskId,
	};
};

const respondJson = (
	response: ServerResponse,
	statusCode: number,
	payload: unknown
) => {
	response.statusCode = statusCode;
	response.setHeader("Content-Type", "application/json; charset=utf-8");
	response.end(`${JSON.stringify(payload)}\n`);
};

const readJsonBody = async (
	requestMessage: IncomingMessage
): Promise<Record<string, unknown>> => {
	let raw = "";

	for await (const chunk of requestMessage) {
		raw += chunk;
	}

	if (raw.trim().length === 0) {
		return {};
	}

	const parsed = JSON.parse(raw);
	return parsed && typeof parsed === "object"
		? (parsed as Record<string, unknown>)
		: {};
};

const getStringBodyValue = (
	body: Record<string, unknown>,
	key: string
): string | null => {
	const value = body[key];
	return typeof value === "string" ? value : null;
};

const getReportMessage = (body: Record<string, unknown>): string | null =>
	getStringBodyValue(body, "message") ?? getStringBodyValue(body, "summary");

const createPowerShellScript = ({
	bodyExpression,
	method,
	pathExpression,
	parameters,
}: {
	bodyExpression?: string;
	method: "GET" | "POST";
	pathExpression: string;
	parameters: string;
}) => `param(${parameters})
$manifestPath = Join-Path $PSScriptRoot "${FF15_BRIDGE_MANIFEST_FILE_NAME}"
$manifest = Get-Content -Raw -Path $manifestPath | ConvertFrom-Json
$headers = @{ Authorization = "Bearer $($manifest.token)" }
$uri = "$($manifest.baseUrl)${pathExpression}"
${
	bodyExpression
		? `$body = ${bodyExpression}
Invoke-RestMethod -Headers $headers -Method ${method} -ContentType "application/json" -Body $body -Uri $uri`
		: `Invoke-RestMethod -Headers $headers -Method ${method} -Uri $uri`
}
`;

const writeBridgeAssets = (
	workspaceRoot: string,
	manifest: Ff15BridgeManifest
) => {
	const bridgeDir = getBridgeDir(workspaceRoot);
	mkdirSync(bridgeDir, { recursive: true });

	writeFileSync(
		join(bridgeDir, FF15_BRIDGE_MANIFEST_FILE_NAME),
		`${JSON.stringify(manifest, null, 2)}\n`,
		"utf8"
	);
	writeFileSync(
		join(bridgeDir, "get-mission.ps1"),
		createPowerShellScript({
			method: "GET",
			parameters: "[Parameter(Mandatory=$true)][string]$MissionId",
			pathExpression: "/missions/$MissionId",
		}),
		"utf8"
	);
	writeFileSync(
		join(bridgeDir, "get-workflow.ps1"),
		createPowerShellScript({
			method: "GET",
			parameters: "[Parameter(Mandatory=$true)][string]$MissionId",
			pathExpression: "/workflows/$MissionId",
		}),
		"utf8"
	);
	writeFileSync(
		join(bridgeDir, "submit-task.ps1"),
		createPowerShellScript({
			bodyExpression:
				"(@{ step = $Step; task = $Task } | ConvertTo-Json -Compress)",
			method: "POST",
			parameters:
				"[Parameter(Mandatory=$true)][string]$MissionId, [Parameter(Mandatory=$true)][string]$Task, [string]$Step = ''",
			pathExpression: "/tasks/$MissionId",
		}),
		"utf8"
	);
	writeFileSync(
		join(bridgeDir, "submit-report.ps1"),
		createPowerShellScript({
			bodyExpression:
				"(@{ taskId = $TaskId; next = $Next; message = $Message } | ConvertTo-Json -Compress)",
			method: "POST",
			parameters:
				"[Parameter(Mandatory=$true)][string]$MissionId, [Parameter(Mandatory=$true)][string]$TaskId, [Parameter(Mandatory=$true)][string]$Next, [Parameter(Mandatory=$true)][string]$Message",
			pathExpression: "/reports/$MissionId",
		}),
		"utf8"
	);
};

const invokeRuntime = async ({
	body,
	method,
	token,
	url,
}: {
	body?: Record<string, unknown>;
	method: "GET" | "POST";
	token: string;
	url: string;
}) =>
	new Promise<{ body: unknown; statusCode: number }>((resolve, reject) => {
		const target = new URL(url);
		const serialized = body ? JSON.stringify(body) : null;
		const requestMessage = request(
			{
				headers: {
					Authorization: `Bearer ${token}`,
					...(serialized
						? {
								"Content-Length": Buffer.byteLength(serialized).toString(),
								"Content-Type": "application/json",
							}
						: {}),
				},
				hostname: target.hostname,
				method,
				path: `${target.pathname}${target.search}`,
				port: target.port,
			},
			(response) => {
				let raw = "";
				response.setEncoding("utf8");
				response.on("data", (chunk) => {
					raw += chunk;
				});
				response.on("end", () => {
					resolve({
						body: raw.trim().length > 0 ? JSON.parse(raw) : null,
						statusCode: response.statusCode ?? 0,
					});
				});
			}
		);

		requestMessage.on("error", reject);
		if (serialized) {
			requestMessage.write(serialized);
		}
		requestMessage.end();
	});

export const createFf15OperationRuntimeProbeService = (
	options: Ff15OperationRuntimeProbeServiceOptions
): Ff15OperationRuntimeProbeService => {
	const getNow = options.getNow ?? (() => new Date().toISOString());
	const workspaces = new Map<string, WorkspaceBridgeRuntime>();

	const updateMissionWorkflow = async (
		missionId: string,
		patch: WorkflowPatch
	) => {
		const mission = options.missionsStore.getMissionRecord(missionId);
		if (!mission) {
			return;
		}

		await options.missionsStore.updateMission(missionId, {
			workflow: mergeWorkflowState(mission.workflow, patch),
		});
	};

	const persistMissionReportState = async (input: {
		agentPanes?: Ff15MissionAgentPanes;
		lastError: string | null;
		mission: Ff15MissionRecord;
		patch: WorkflowPatch;
	}) =>
		options.missionsStore.updateMission(input.mission.id, {
			...(input.agentPanes ? { agentPanes: input.agentPanes } : {}),
			lastError: input.lastError,
			workflow: mergeWorkflowState(input.mission.workflow, input.patch),
		});

	const respondAcknowledgedReport = (
		response: ServerResponse,
		missionId: string,
		nextStep: string | null = null
	) => {
		respondJson(response, 200, {
			acknowledged: true,
			missionId,
			nextStep,
			runtimeStatus: "ready",
		});
	};

	const handleProbeReportSubmission = async (input: {
		currentStepName: string;
		missionId: string;
		reportMessage: string | null;
		requestedNext: string | null;
		requestedStep: string | null;
		response: ServerResponse;
	}) => {
		await updateMissionWorkflow(input.missionId, {
			currentStep:
				input.requestedStep ?? input.requestedNext ?? input.currentStepName,
			lastReportSummary: input.reportMessage,
			runtimeStatus: "ready",
		});
		respondAcknowledgedReport(
			input.response,
			input.missionId,
			input.requestedStep ?? input.requestedNext
		);
	};

	const resolveMissionOperationStep = (mission: Ff15MissionRecord) => {
		if (!mission.operationRef) {
			return {
				activeStep: null,
				operationDefinition: null,
			};
		}

		if (!mission.workspaceRoot) {
			return {
				activeStep: null,
				operationDefinition: null,
			};
		}

		if (!mission.workflow.currentStep) {
			return {
				activeStep: null,
				operationDefinition: null,
			};
		}

		const operationDefinition = loadMissionOperationDefinition(
			mission.workspaceRoot,
			mission.operationRef
		);
		return {
			activeStep: operationDefinition
				? (operationDefinition.steps.find(
						(step) => step.name === mission.workflow.currentStep
					) ?? null)
				: null,
			operationDefinition,
		};
	};

	const handleInvalidReportTransition = async (input: {
		activeStep: NonNullable<
			ReturnType<typeof resolveMissionOperationStep>["activeStep"]
		>;
		mission: Ff15MissionRecord;
		reportMessage: string | null;
		requestedNext: string;
		response: ServerResponse;
	}) => {
		await persistMissionReportState({
			lastError: `Invalid next for ${input.activeStep.name}: ${input.requestedNext}`,
			mission: input.mission,
			patch: {
				lastReportSummary: input.reportMessage,
				runtimeStatus: "ready",
			},
		});
		respondJson(input.response, 400, {
			allowedNext: input.activeStep.rules.map((rule) => ({
				condition: rule.condition,
				next: rule.next,
			})),
			error: "Invalid next",
			missionId: input.mission.id,
		});
	};

	const autoDispatchWorkerStep = async (input: {
		activation: Ff15MissionOperationActivation;
		handoff: Ff15MissionWorkflowStepHistoryEntry | null;
		mission: Ff15MissionRecord;
	}) => {
		if (!options.missionTransport) {
			return null;
		}

		const { sessionName, workspaceRoot } = input.mission;
		if (!sessionName) {
			throw new Error(
				"Mission session is not ready for automatic worker handoff."
			);
		}

		if (!workspaceRoot) {
			throw new Error(
				"Mission session is not ready for automatic worker handoff."
			);
		}

		const reconciledAgentPanes =
			await options.missionTransport.reconcileMissionAgentPanes({
				agentPanes: input.mission.agentPanes,
				sessionName,
				workspaceRoot,
			});
		const stepAgent = input.activation.stepAgent;
		if (!(input.activation.step && isWorkerAgentId(stepAgent))) {
			throw new Error("Worker handoff requires a worker-owned step.");
		}

		const paneId = reconciledAgentPanes[stepAgent];

		if (!paneId) {
			throw new Error(
				`FF15 could not resolve a live ${FF15_AGENT_DISPLAY_NAMES[stepAgent]} pane for this mission.`
			);
		}

		const taskId = getWorkerStepTaskId(input.activation.stepName);
		await options.missionTransport.sendPrompt({
			paneId,
			prompt: buildWorkerOperationAwarePrompt({
				activation: input.activation,
				handoff: input.handoff,
				missionId: input.mission.id,
				workflow: input.mission.workflow,
				workspaceRoot,
			}),
			sessionName,
		});

		return {
			agentId: stepAgent,
			agentPanes: reconciledAgentPanes,
			taskId,
		};
	};

	const handleValidatedReportTransition = async (input: {
		activeStep: ReturnType<typeof resolveMissionOperationStep>["activeStep"];
		mission: Ff15MissionRecord;
		operationDefinition: ReturnType<typeof loadMissionOperationDefinition>;
		reportMessage: string | null;
		requestedNext: string | null;
		requestedStep: string | null;
		response: ServerResponse;
		taskId: string | null;
	}) => {
		const nextStepName = input.requestedNext ?? input.requestedStep;
		const nextStep =
			nextStepName && input.operationDefinition
				? (input.operationDefinition.steps.find(
						(step) => step.name === nextStepName
					) ?? null)
				: null;
		const nextStepAgent = nextStep?.agent ?? null;
		const handoff = createWorkflowStepHistoryEntry({
			activeStep: input.activeStep,
			currentStepName: input.mission.workflow.currentStep,
			next: nextStepName,
			recordedAt: getNow(),
			reportMessage: input.reportMessage,
			taskId: input.taskId,
		});
		const stepHistory = handoff
			? [...input.mission.workflow.stepHistory, handoff]
			: input.mission.workflow.stepHistory;
		const workerActivation = getWorkerDispatchActivation(
			input.operationDefinition,
			nextStep
		);
		let agentPanes: Ff15MissionAgentPanes | undefined;
		let lastError: string | null = null;

		if (workerActivation) {
			try {
				const dispatch = await autoDispatchWorkerStep({
					activation: workerActivation,
					handoff,
					mission: input.mission,
				});
				agentPanes = dispatch?.agentPanes;
			} catch (error) {
				lastError = `Automatic dispatch failed: ${getErrorMessage(
					error,
					"Worker handoff failed."
				)}`;
			}
		}

		await persistMissionReportState({
			agentPanes,
			lastError,
			mission: input.mission,
			patch: {
				activeTask: nextStep
					? formatFf15OperationTaskLabel(nextStep.name)
					: input.mission.workflow.activeTask,
				currentStep: nextStepName,
				lastReportSummary: input.reportMessage,
				runtimeStatus: "ready",
				stepHistory,
			},
		});
		respondAcknowledgedReport(input.response, input.mission.id, nextStepName);
	};

	const resolveMissionRequest = (
		requestMessage: IncomingMessage,
		runtime: WorkspaceBridgeRuntime
	): ResolvedMissionRequest | null => {
		const url = new URL(requestMessage.url ?? "/", runtime.baseUrl);
		const segments = url.pathname.split("/").filter(Boolean);
		const resource = segments[0] ?? null;
		const missionId = segments[1] ?? null;
		if (!missionId) {
			return null;
		}

		const mission = options.missionsStore.getMissionRecord(missionId);
		if (!mission) {
			return null;
		}

		return {
			mission,
			missionId,
			resource,
		};
	};

	const handleTaskSubmission = async (
		missionId: string,
		requestMessage: IncomingMessage,
		response: ServerResponse
	) => {
		const body = await readJsonBody(requestMessage);
		await updateMissionWorkflow(missionId, {
			activeTask: getStringBodyValue(body, "task"),
			currentStep: getStringBodyValue(body, "step"),
			runtimeStatus: "ready",
		});
		respondJson(response, 200, {
			acknowledged: true,
			missionId,
			runtimeStatus: "ready",
		});
	};

	const handleReportSubmission = async (
		mission: Ff15MissionRecord,
		requestMessage: IncomingMessage,
		response: ServerResponse
	) => {
		const body = await readJsonBody(requestMessage);
		const missionId = mission.id;
		const reportMessage = getReportMessage(body);
		const requestedNext = getStringBodyValue(body, "next");
		const requestedStep = getStringBodyValue(body, "step");
		const taskId = getStringBodyValue(body, "taskId");
		const currentStepName = mission.workflow.currentStep;

		if (currentStepName?.startsWith("probe:")) {
			await handleProbeReportSubmission({
				currentStepName,
				missionId,
				reportMessage,
				requestedNext,
				requestedStep,
				response,
			});
			return;
		}

		const { activeStep, operationDefinition } =
			resolveMissionOperationStep(mission);
		const nextRule =
			activeStep && requestedNext
				? (activeStep.rules.find((rule) => rule.next === requestedNext) ?? null)
				: null;

		if (
			activeStep &&
			activeStep.rules.length > 0 &&
			requestedNext &&
			!nextRule
		) {
			await handleInvalidReportTransition({
				activeStep,
				mission,
				reportMessage,
				requestedNext,
				response,
			});
			return;
		}

		await handleValidatedReportTransition({
			activeStep,
			mission,
			operationDefinition,
			reportMessage,
			requestedNext,
			requestedStep,
			response,
			taskId,
		});
	};

	const handleMissionScopedRequest = async (
		requestMessage: IncomingMessage,
		resolvedRequest: ResolvedMissionRequest,
		response: ServerResponse
	) => {
		if (
			requestMessage.method === "GET" &&
			resolvedRequest.resource === "missions"
		) {
			respondJson(response, 200, resolvedRequest.mission);
			return;
		}

		if (
			requestMessage.method === "GET" &&
			resolvedRequest.resource === "workflows"
		) {
			respondJson(response, 200, resolvedRequest.mission.workflow);
			return;
		}

		if (
			requestMessage.method === "POST" &&
			resolvedRequest.resource === "tasks"
		) {
			await handleTaskSubmission(
				resolvedRequest.missionId,
				requestMessage,
				response
			);
			return;
		}

		if (
			requestMessage.method === "POST" &&
			resolvedRequest.resource === "reports"
		) {
			await handleReportSubmission(
				resolvedRequest.mission,
				requestMessage,
				response
			);
			return;
		}

		respondJson(response, 404, { error: "Unknown runtime path" });
	};

	const handleRequest = async (
		runtime: WorkspaceBridgeRuntime,
		requestMessage: IncomingMessage,
		response: ServerResponse
	) => {
		const authHeader = requestMessage.headers.authorization;
		if (authHeader !== `Bearer ${runtime.token}`) {
			respondJson(response, 401, { error: "Unauthorized" });
			return;
		}

		const resolvedRequest = resolveMissionRequest(requestMessage, runtime);
		if (!resolvedRequest) {
			respondJson(response, 404, { error: "Mission not found" });
			return;
		}

		await handleMissionScopedRequest(requestMessage, resolvedRequest, response);
	};

	const handleRuntimeRequestError = (
		error: unknown,
		response: ServerResponse
	) => {
		respondJson(response, 500, {
			error: error instanceof Error ? error.message : "Runtime bridge failed",
		});
	};

	const bindRuntimeServer = (runtime: WorkspaceBridgeRuntime) =>
		createServer((requestMessage, response) => {
			handleRequest(runtime, requestMessage, response).catch((error) => {
				handleRuntimeRequestError(error, response);
			});
		});

	const ensureWorkspaceRuntime = async (workspaceRoot: string) => {
		const existing = workspaces.get(workspaceRoot);
		if (existing) {
			return existing;
		}

		const token = randomUUID();
		const runtime = {
			baseUrl: "",
			missionBootstraps: new Map<string, Promise<void>>(),
			server: undefined as unknown as Server,
			token,
			workspaceRoot,
		} satisfies WorkspaceBridgeRuntime;
		runtime.server = bindRuntimeServer(runtime);

		await new Promise<void>((resolve, reject) => {
			runtime.server.once("error", reject);
			runtime.server.listen(0, "127.0.0.1", () => {
				runtime.server.off("error", reject);
				resolve();
			});
		});

		const address = runtime.server.address() as AddressInfo | null;
		if (!address) {
			throw new Error("Runtime bridge did not expose a loopback address.");
		}

		runtime.baseUrl = `http://127.0.0.1:${address.port}`;
		writeBridgeAssets(
			workspaceRoot,
			createBridgeManifest(runtime.baseUrl, runtime.token)
		);
		workspaces.set(workspaceRoot, runtime);
		return runtime;
	};

	const runSelfCheck = async (
		runtime: WorkspaceBridgeRuntime,
		mission: Ff15MissionRecord
	) => {
		const token = runtime.token;
		const missionId = mission.id;
		const responses = await Promise.all([
			invokeRuntime({
				method: "GET",
				token,
				url: `${runtime.baseUrl}/missions/${missionId}`,
			}),
			invokeRuntime({
				method: "GET",
				token,
				url: `${runtime.baseUrl}/workflows/${missionId}`,
			}),
			invokeRuntime({
				body: {
					step: "probe:ready",
					task: "Validate loopback bridge readiness",
				},
				method: "POST",
				token,
				url: `${runtime.baseUrl}/tasks/${missionId}`,
			}),
			invokeRuntime({
				body: {
					step: "probe:ready",
					summary: "Bridge lookup and submission endpoints responded.",
				},
				method: "POST",
				token,
				url: `${runtime.baseUrl}/reports/${missionId}`,
			}),
		]);

		if (
			responses.some(
				(response) => response.statusCode < 200 || response.statusCode >= 300
			)
		) {
			throw new Error(
				"Runtime self-check did not receive successful responses from every bridge endpoint."
			);
		}
	};

	return {
		dispose: async () => {
			await Promise.all(
				[...workspaces.values()].map(
					(runtime) =>
						new Promise<void>((resolve, reject) => {
							runtime.server.close((error) => {
								if (error) {
									reject(error);
									return;
								}

								resolve();
							});
						})
				)
			);
			workspaces.clear();
		},
		ensureMissionRuntime: async (missionId: string) => {
			const mission = options.missionsStore.getMissionRecord(missionId);
			if (!mission) {
				return;
			}

			if (!mission.workspaceRoot) {
				return;
			}

			if (!mission.operationRef) {
				return;
			}

			const runtime = await ensureWorkspaceRuntime(mission.workspaceRoot);
			const existingBootstrap = runtime.missionBootstraps.get(missionId);
			if (existingBootstrap) {
				await existingBootstrap;
				return;
			}

			const currentMission = options.missionsStore.getMissionRecord(missionId);
			if (currentMission?.workflow.runtimeStatus === "ready") {
				return;
			}

			await updateMissionWorkflow(missionId, {
				activeTask: "Validate loopback bridge readiness",
				currentStep: "probe:starting",
				probe: {
					checkedAt: null,
					summary: null,
					verdict: null,
				},
				runtimeStatus: "starting",
			});

			const bootstrap = (async () => {
				try {
					const activeMission =
						options.missionsStore.getMissionRecord(missionId);
					if (!activeMission) {
						return;
					}

					await runSelfCheck(runtime, activeMission);
					await updateMissionWorkflow(missionId, {
						activeTask: "Validate loopback bridge readiness",
						currentStep: "probe:ready",
						lastReportSummary:
							"Bridge lookup and submission endpoints responded.",
						probe: {
							checkedAt: getNow(),
							summary:
								"Extension-host bridge is viable for the next runtime slice.",
							verdict: "go",
						},
						runtimeStatus: "ready",
					});
				} catch (error) {
					await updateMissionWorkflow(missionId, {
						currentStep: "probe:unavailable",
						probe: {
							checkedAt: getNow(),
							summary:
								error instanceof Error
									? error.message
									: "Runtime bridge probe failed.",
							verdict: "no-go",
						},
						runtimeStatus: "unavailable",
					});
				}
			})();

			runtime.missionBootstraps.set(missionId, bootstrap);
			try {
				await bootstrap;
			} finally {
				runtime.missionBootstraps.delete(missionId);
			}
		},
	};
};
