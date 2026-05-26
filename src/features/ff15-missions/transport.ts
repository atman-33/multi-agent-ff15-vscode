import { spawn } from "node:child_process";
import {
	FF15_AGENT_IDS,
	type Ff15AgentId,
	type Ff15PaneLaunchPlanEntry,
} from "../ff15-launch/launch-client";
import {
	createEmptyFf15MissionAgentPanes,
	type Ff15MissionAgentPanes,
} from "./state";

const NOCTIS_PANE_NAME = "noctis";
const LIST_PANES_COMMAND = ["action", "list-panes", "--json"] as const;
const FF15_PROMPT_INPUT_DELAY_MS = 500;
const AGENT_ARGUMENT_REGEX = /(?:^|\s)--agent\s+([a-z0-9-]+)(?=\s|$)/i;

interface ZellijPane {
	id?: number | string;
	exited?: boolean;
	is_plugin?: boolean;
	is_selectable?: boolean;
	pane_command?: string;
	terminal_command?: string;
	title?: string;
}

interface RunZellijCommandInput {
	args: string[];
	cwd?: string;
}

interface RunZellijCommandResult {
	stdout: string;
}

interface CreateFf15MissionZellijTransportDependencies {
	runZellijCommand?: (
		input: RunZellijCommandInput
	) => Promise<RunZellijCommandResult>;
	waitForPromptDelivery?: () => Promise<void>;
}

const runZellijCommand = ({
	args,
	cwd,
}: RunZellijCommandInput): Promise<RunZellijCommandResult> =>
	new Promise((resolve, reject) => {
		const command = spawn("zellij", args, {
			cwd,
			stdio: ["ignore", "pipe", "pipe"],
		});
		let stdout = "";
		let stderr = "";

		command.stdout.on("data", (chunk) => {
			stdout += chunk.toString();
		});

		command.stderr.on("data", (chunk) => {
			stderr += chunk.toString();
		});

		command.once("error", reject);
		command.once("exit", (code) => {
			if (code === 0) {
				resolve({ stdout });
				return;
			}

			reject(
				new Error(
					stderr.trim() ||
						`zellij ${args.join(" ")} failed with exit code ${code}`
				)
			);
		});
	});

const toPaneId = (pane: ZellijPane): string | null => {
	if (typeof pane.id === "string" && pane.id.length > 0) {
		return pane.id;
	}

	if (typeof pane.id === "number") {
		return `terminal_${pane.id}`;
	}

	return null;
};

const resolvePaneIdHint = (
	panes: readonly ZellijPane[],
	paneIdHint: string | null | undefined
): string | null => {
	if (typeof paneIdHint !== "string" || paneIdHint.length === 0) {
		return null;
	}

	return panes.some((pane) => toPaneId(pane) === paneIdHint)
		? paneIdHint
		: null;
};

const resolvePaneCommand = (pane: ZellijPane): string | null => {
	if (typeof pane.pane_command === "string" && pane.pane_command.length > 0) {
		return pane.pane_command;
	}

	if (
		typeof pane.terminal_command === "string" &&
		pane.terminal_command.length > 0
	) {
		return pane.terminal_command;
	}

	return null;
};

const findNoctisPaneId = (
	panes: ZellijPane[],
	agentPanes?: Ff15MissionAgentPanes
): string | null => {
	const hintedPaneId = resolvePaneIdHint(panes, agentPanes?.noctis);
	if (hintedPaneId) {
		return hintedPaneId;
	}

	for (const pane of panes) {
		if (
			pane.exited ||
			pane.is_plugin ||
			pane.is_selectable === false ||
			resolveAgentId(pane) !== NOCTIS_PANE_NAME
		) {
			continue;
		}

		const paneId = toPaneId(pane);
		if (paneId) {
			return paneId;
		}
	}

	return null;
};

const resolveAgentId = (pane: ZellijPane): Ff15AgentId | null => {
	const paneCommand = resolvePaneCommand(pane);
	if (paneCommand) {
		const matchedAgentId =
			AGENT_ARGUMENT_REGEX.exec(paneCommand)?.[1]?.toLowerCase();
		if (matchedAgentId) {
			return (
				FF15_AGENT_IDS.find((agentId) => agentId === matchedAgentId) ?? null
			);
		}
	}

	const normalizedTitle = pane.title?.toLowerCase();
	if (!normalizedTitle) {
		return null;
	}

	return FF15_AGENT_IDS.find((agentId) => agentId === normalizedTitle) ?? null;
};

const resolveAgentPanes = (panes: ZellijPane[]): Ff15MissionAgentPanes => {
	const agentPanes = createEmptyFf15MissionAgentPanes();

	for (const pane of panes) {
		if (pane.exited || pane.is_plugin || pane.is_selectable === false) {
			continue;
		}

		const agentId = resolveAgentId(pane);
		const paneId = toPaneId(pane);
		if (!(agentId && paneId)) {
			continue;
		}

		agentPanes[agentId] = paneId;
	}

	return agentPanes;
};

const reconcileMissionAgentPanes = (
	panes: readonly ZellijPane[],
	agentPanes?: Ff15MissionAgentPanes
): Ff15MissionAgentPanes => {
	const resolvedAgentPanes = resolveAgentPanes([...panes]);
	if (!agentPanes) {
		return resolvedAgentPanes;
	}

	for (const agentId of FF15_AGENT_IDS) {
		if (resolvedAgentPanes[agentId]) {
			continue;
		}

		resolvedAgentPanes[agentId] = resolvePaneIdHint(panes, agentPanes[agentId]);
	}

	return resolvedAgentPanes;
};

const parsePaneList = (stdout: string): ZellijPane[] => {
	const parsed = JSON.parse(stdout) as unknown;
	if (!Array.isArray(parsed)) {
		throw new Error("FF15 could not parse Zellij pane metadata.");
	}

	return parsed.filter(
		(value): value is ZellijPane => value !== null && typeof value === "object"
	);
};

const listPanes = async (
	runCommand: (input: RunZellijCommandInput) => Promise<RunZellijCommandResult>,
	sessionName: string,
	workspaceRoot: string
): Promise<ZellijPane[]> => {
	const result = await runCommand({
		args: ["--session", sessionName, ...LIST_PANES_COMMAND],
		cwd: workspaceRoot,
	});

	return parsePaneList(result.stdout);
};

export const createFf15MissionZellijTransport = (
	dependencies: CreateFf15MissionZellijTransportDependencies = {}
) => {
	const runCommand = dependencies.runZellijCommand ?? runZellijCommand;
	const waitForPromptDelivery =
		dependencies.waitForPromptDelivery ??
		(() =>
			new Promise<void>((resolve) => {
				setTimeout(resolve, FF15_PROMPT_INPUT_DELAY_MS);
			}));

	return {
		async ensureMissionSession(input: {
			agentPanes?: Ff15MissionAgentPanes;
			missionId: string;
			paneLaunchPlanEntry: Ff15PaneLaunchPlanEntry;
			sessionName: string;
			workspaceRoot: string;
		}) {
			let panes: ZellijPane[];

			try {
				panes = await listPanes(
					runCommand,
					input.sessionName,
					input.workspaceRoot
				);
			} catch {
				await runCommand({
					args: ["attach", "--create-background", input.sessionName],
					cwd: input.workspaceRoot,
				});
				panes = [];
			}

			let agentPanes = reconcileMissionAgentPanes(panes, input.agentPanes);
			const existingPaneId = findNoctisPaneId(panes, input.agentPanes);
			if (existingPaneId) {
				agentPanes = {
					...agentPanes,
					noctis: existingPaneId,
				};

				return {
					agentPanes,
					paneId: existingPaneId,
				};
			}

			const result = await runCommand({
				args: [
					"--session",
					input.sessionName,
					"action",
					"new-pane",
					"--name",
					NOCTIS_PANE_NAME,
					"--cwd",
					input.workspaceRoot,
					"--",
					input.paneLaunchPlanEntry.executable,
					...input.paneLaunchPlanEntry.args,
				],
				cwd: input.workspaceRoot,
			});

			const paneId = result.stdout.trim();
			if (paneId.length === 0) {
				throw new Error(
					"FF15 could not resolve the Noctis pane in the mission session."
				);
			}

			agentPanes = {
				...agentPanes,
				noctis: paneId,
			};

			return {
				agentPanes,
				paneId,
			};
		},

		async reconcileMissionAgentPanes(input: {
			agentPanes?: Ff15MissionAgentPanes;
			sessionName: string;
			workspaceRoot: string;
		}) {
			const panes = await listPanes(
				runCommand,
				input.sessionName,
				input.workspaceRoot
			);

			return reconcileMissionAgentPanes(panes, input.agentPanes);
		},

		async sendPrompt(input: {
			paneId: string;
			prompt: string;
			sessionName: string;
		}) {
			await runCommand({
				args: [
					"--session",
					input.sessionName,
					"action",
					"write-chars",
					"--pane-id",
					input.paneId,
					input.prompt,
				],
			});
			await waitForPromptDelivery();

			return runCommand({
				args: [
					"--session",
					input.sessionName,
					"action",
					"send-keys",
					"--pane-id",
					input.paneId,
					"Enter",
				],
			});
		},
	};
};
