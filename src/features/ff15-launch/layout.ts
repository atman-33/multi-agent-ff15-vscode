import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

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
const FF15_OPENCODE_COMMAND_PLACEHOLDER = "__FF15_OPENCODE_COMMAND__";
const FF15_WORKSPACE_ROOT_PLACEHOLDER = "__FF15_WORKSPACE_ROOT__";
const NEWLINE_SPLIT_REGEX = /\r?\n/;
const NPM_CMD_SHIM_EXECUTABLE_REGEX = /"%dp0%\\([^"]+)"/i;

const escapeKdlStringValue = (value: string): string =>
	JSON.stringify(value).slice(1, -1);

const replaceLayoutPlaceholder = (
	template: string,
	placeholder: string,
	value: string
): string => template.replaceAll(placeholder, escapeKdlStringValue(value));

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
	opencodeCommand: string;
}): string => {
	const withWorkspaceRoot = replaceLayoutPlaceholder(
		input.template,
		FF15_WORKSPACE_ROOT_PLACEHOLDER,
		input.workspaceRoot
	);

	return replaceLayoutPlaceholder(
		withWorkspaceRoot,
		FF15_OPENCODE_COMMAND_PLACEHOLDER,
		input.opencodeCommand
	);
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

export const prepareFf15LaunchLayout = (input: {
	extensionRoot: string;
	workspaceRoot: string;
	opencodeCommand: string;
}): string => {
	const templatePath = resolveBundledFf15LayoutTemplatePath(
		input.extensionRoot
	);
	const renderedLayoutPath = getRenderedLayoutPath(input.workspaceRoot);
	const template = readFileSync(templatePath, "utf8");
	const renderedLayout = renderFf15LayoutTemplate({
		opencodeCommand: input.opencodeCommand,
		template,
		workspaceRoot: input.workspaceRoot,
	});

	mkdirSync(dirname(renderedLayoutPath), { recursive: true });
	writeFileSync(renderedLayoutPath, renderedLayout, "utf8");

	return renderedLayoutPath;
};
