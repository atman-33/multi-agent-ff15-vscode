export const FF15_AGENT_IDS = [
	"noctis",
	"ignis",
	"gladiolus",
	"prompto",
] as const;

export const FF15_AGENT_DISPLAY_NAMES = {
	gladiolus: "Gladiolus",
	ignis: "Ignis",
	noctis: "Noctis",
	prompto: "Prompto",
} as const satisfies Record<Ff15AgentId, string>;

export type Ff15AgentId = (typeof FF15_AGENT_IDS)[number];
export type Ff15LaunchClientId = "github-copilot-cli" | "opencode";

export interface ResolvedLaunchCommand {
	executable: string;
	args: string[];
}

export interface Ff15PaneLaunchPlanEntry {
	agentId: Ff15AgentId;
	args: readonly string[];
	executable: string;
}

export interface Ff15LaunchClient {
	id: Ff15LaunchClientId;
	ensureDependenciesAvailable: () => Promise<void>;
	getMissingDependencyMessage: () => string;
	getPaneLaunchPlan: () => Ff15PaneLaunchPlanEntry[];
}

export interface CreateFf15LaunchClientDependencies {
	ensureCommandAvailable: (command: string) => Promise<void>;
	resolveCopilotCommand: () => ResolvedLaunchCommand;
	resolveOpenCodeCommand: () => string;
}

export const DEFAULT_FF15_LAUNCH_CLIENT_ID = "opencode";
const FF15_COPILOT_PERMISSION_ARGS = [
	"--allow-all-tools",
	"--deny-tool=shell(git push)",
] as const;

const buildPaneLaunchPlan = (
	command: ResolvedLaunchCommand,
	getArgs: (agentId: Ff15AgentId) => string[]
): Ff15PaneLaunchPlanEntry[] =>
	FF15_AGENT_IDS.map((agentId) => ({
		agentId,
		args: [...command.args, ...getArgs(agentId)],
		executable: command.executable,
	}));

export const resolveFf15LaunchClientId = (
	value: unknown
): Ff15LaunchClientId =>
	value === "github-copilot-cli" || value === "opencode"
		? value
		: DEFAULT_FF15_LAUNCH_CLIENT_ID;

export const createFf15LaunchClient = (
	id: Ff15LaunchClientId,
	dependencies: CreateFf15LaunchClientDependencies
): Ff15LaunchClient => {
	if (id === "opencode") {
		return {
			id,
			ensureDependenciesAvailable: () =>
				dependencies.ensureCommandAvailable("opencode"),
			getMissingDependencyMessage: () =>
				"FF15 launch requires `opencode` on PATH.",
			getPaneLaunchPlan: () => {
				const executable = dependencies.resolveOpenCodeCommand();

				return buildPaneLaunchPlan({ args: [], executable }, (agentId) => [
					"--agent",
					agentId,
				]);
			},
		};
	}

	return {
		id,
		ensureDependenciesAvailable: () =>
			dependencies.ensureCommandAvailable("copilot"),
		getMissingDependencyMessage: () =>
			"FF15 launch requires GitHub Copilot CLI `copilot` on PATH.",
		getPaneLaunchPlan: () =>
			buildPaneLaunchPlan(dependencies.resolveCopilotCommand(), (agentId) => [
				...FF15_COPILOT_PERMISSION_ARGS,
				"--agent",
				agentId,
			]),
	};
};
