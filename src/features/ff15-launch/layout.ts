import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
	FF15_AGENT_DISPLAY_NAMES,
	FF15_AGENT_IDS,
	type Ff15AgentId,
	type Ff15PaneLaunchPlanEntry,
	type ResolvedLaunchCommand,
} from "./launch-client";

const FF15_LAYOUT_TEMPLATE_PATH_SEGMENTS = [
	"src",
	"features",
	"ff15-launch",
	"assets",
	"ff15-roster.kdl",
] as const;
const FF15_LAYOUT_TEMP_DIR_SEGMENTS = [
	"multi-agent-ff15-vscode",
	"ff15-launch",
] as const;
const FF15_WORKSPACE_ROOT_PLACEHOLDER = "__FF15_WORKSPACE_ROOT__";
const NEWLINE_SPLIT_REGEX = /\r?\n/;
const NPM_CMD_SHIM_EXECUTABLE_REGEX = /"%dp0%\\([^"]+)"/i;
const NPM_CMD_SHIM_SCRIPT_REGEX = /"%dp0%\\([^"]+\.(?:cjs|js|mjs))"/i;
const FF15_PANE_PLACEHOLDERS: Record<Ff15AgentId, string> = {
	gladiolus: "__FF15_GLADIOLUS_PANE__",
	ignis: "__FF15_IGNIS_PANE__",
	noctis: "__FF15_NOCTIS_PANE__",
	prompto: "__FF15_PROMPTO_PANE__",
};

const escapeKdlStringValue = (value: string): string =>
	JSON.stringify(value).slice(1, -1);

const escapeRegExp = (value: string): string =>
	value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const replaceLayoutPlaceholder = (
	template: string,
	placeholder: string,
	value: string
): string => template.replaceAll(placeholder, escapeKdlStringValue(value));

const replaceIndentedPlaceholder = (
	template: string,
	placeholder: string,
	value: string
): string =>
	template.replace(
		new RegExp(`^([\\t ]*)${escapeRegExp(placeholder)}$`, "m"),
		(_, indentation: string) =>
			value
				.split("\n")
				.map((line) => (line.length === 0 ? line : `${indentation}${line}`))
				.join("\n")
	);

const buildPaneLayoutSnippet = (
	paneLaunchPlanEntry: Ff15PaneLaunchPlanEntry
): string => {
	const commandLine = `pane name="${escapeKdlStringValue(
		FF15_AGENT_DISPLAY_NAMES[paneLaunchPlanEntry.agentId]
	)}" command="${escapeKdlStringValue(paneLaunchPlanEntry.executable)}"`;

	if (paneLaunchPlanEntry.args.length === 0) {
		return commandLine;
	}

	return [
		`${commandLine} {`,
		`\targs ${paneLaunchPlanEntry.args
			.map((arg) => `"${escapeKdlStringValue(arg)}"`)
			.join(" ")}`,
		"}",
	].join("\n");
};

const getPaneLaunchPlanEntry = (
	paneLaunchPlan: readonly Ff15PaneLaunchPlanEntry[],
	agentId: Ff15AgentId
): Ff15PaneLaunchPlanEntry => {
	const paneLaunchPlanEntry = paneLaunchPlan.find(
		(pane) => pane.agentId === agentId
	);

	if (!paneLaunchPlanEntry) {
		throw new Error(`Missing FF15 pane launch plan for agent: ${agentId}`);
	}

	return paneLaunchPlanEntry;
};

const getFirstResolvedPath = (command: string): string | undefined => {
	const result = spawnSync("where.exe", [command], {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "ignore"],
	});

	if (result.error || result.status !== 0) {
		return;
	}

	return result.stdout
		.split(NEWLINE_SPLIT_REGEX)
		.map((line) => line.trim())
		.find((line) => line.length > 0);
};

const getRenderedLayoutPath = (workspaceRoot: string): string => {
	const workspaceHash = createHash("sha256")
		.update(workspaceRoot)
		.digest("hex")
		.slice(0, 12);

	return join(
		tmpdir(),
		...FF15_LAYOUT_TEMP_DIR_SEGMENTS,
		`ff15-roster-${workspaceHash}.kdl`
	);
};

export const resolveBundledFf15LayoutTemplatePath = (
	extensionRoot: string
): string => {
	const layoutPath = join(extensionRoot, ...FF15_LAYOUT_TEMPLATE_PATH_SEGMENTS);

	if (!existsSync(layoutPath)) {
		throw new Error(`Bundled FF15 layout template not found: ${layoutPath}`);
	}

	return layoutPath;
};

export const renderFf15LayoutTemplate = (input: {
	template: string;
	workspaceRoot: string;
	paneLaunchPlan: readonly Ff15PaneLaunchPlanEntry[];
}): string => {
	let renderedLayout = replaceLayoutPlaceholder(
		input.template,
		FF15_WORKSPACE_ROOT_PLACEHOLDER,
		input.workspaceRoot
	);

	for (const agentId of FF15_AGENT_IDS) {
		renderedLayout = replaceIndentedPlaceholder(
			renderedLayout,
			FF15_PANE_PLACEHOLDERS[agentId],
			buildPaneLayoutSnippet(
				getPaneLaunchPlanEntry(input.paneLaunchPlan, agentId)
			)
		);
	}

	return renderedLayout;
};

export const resolveWindowsNpmShimExecutablePath = (
	shimPath: string
): string => {
	const shimContents = readFileSync(shimPath, "utf8");
	const executableMatch = NPM_CMD_SHIM_EXECUTABLE_REGEX.exec(shimContents);

	if (!executableMatch) {
		throw new Error(`Could not resolve npm shim executable from: ${shimPath}`);
	}

	return join(dirname(shimPath), ...executableMatch[1].split("\\"));
};

export const resolveWindowsNpmShimLaunchCommand = (
	shimPath: string
): ResolvedLaunchCommand => {
	const shimContents = readFileSync(shimPath, "utf8");
	const scriptMatch = NPM_CMD_SHIM_SCRIPT_REGEX.exec(shimContents);

	if (!scriptMatch) {
		throw new Error(`Could not resolve npm shim script from: ${shimPath}`);
	}

	const shimDir = dirname(shimPath);
	const nodeExecutablePath = join(shimDir, "node.exe");
	const scriptPath = join(shimDir, ...scriptMatch[1].split("\\"));

	if (!existsSync(scriptPath)) {
		throw new Error(`Resolved npm shim script does not exist: ${scriptPath}`);
	}

	return {
		args: [scriptPath],
		executable: existsSync(nodeExecutablePath) ? nodeExecutablePath : "node",
	};
};

export const resolveLaunchableOpencodeCommand = (): string => {
	if (process.platform !== "win32") {
		return "opencode";
	}

	const executablePath = getFirstResolvedPath("opencode.exe");
	if (executablePath) {
		return executablePath;
	}

	const cmdShimPath = getFirstResolvedPath("opencode.cmd");
	if (!cmdShimPath) {
		throw new Error("Could not resolve opencode.cmd on PATH.");
	}

	const shimExecutablePath = resolveWindowsNpmShimExecutablePath(cmdShimPath);
	if (!existsSync(shimExecutablePath)) {
		throw new Error(
			`Resolved npm shim target does not exist: ${shimExecutablePath}`
		);
	}

	return shimExecutablePath;
};

export const resolveLaunchableCopilotCommand = (): ResolvedLaunchCommand => {
	if (process.platform !== "win32") {
		return {
			args: [],
			executable: "copilot",
		};
	}

	const executablePath = getFirstResolvedPath("copilot.exe");
	if (executablePath) {
		return {
			args: [],
			executable: executablePath,
		};
	}

	const cmdShimPath = getFirstResolvedPath("copilot.cmd");
	if (cmdShimPath) {
		return resolveWindowsNpmShimLaunchCommand(cmdShimPath);
	}

	throw new Error("Could not resolve a launchable copilot command on PATH.");
};

export const prepareFf15LaunchLayout = (input: {
	extensionRoot: string;
	workspaceRoot: string;
	paneLaunchPlan: readonly Ff15PaneLaunchPlanEntry[];
}): string => {
	const templatePath = resolveBundledFf15LayoutTemplatePath(
		input.extensionRoot
	);
	const renderedLayoutPath = getRenderedLayoutPath(input.workspaceRoot);
	const template = readFileSync(templatePath, "utf8");
	const renderedLayout = renderFf15LayoutTemplate({
		paneLaunchPlan: input.paneLaunchPlan,
		template,
		workspaceRoot: input.workspaceRoot,
	});

	mkdirSync(dirname(renderedLayoutPath), { recursive: true });
	writeFileSync(renderedLayoutPath, renderedLayout, "utf8");

	return renderedLayoutPath;
};
