import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

export interface Ff15WorkspaceTemplateFileDefinition {
	relativePath: readonly string[];
}

export const FF15_WORKSPACE_TEMPLATE_FILE_DEFINITIONS = [
	{
		relativePath: [".github", "agents", "gladiolus.agent.md"],
	},
	{
		relativePath: [".github", "agents", "ignis.agent.md"],
	},
	{
		relativePath: [".github", "agents", "iris.agent.md"],
	},
	{
		relativePath: [".github", "agents", "lunafreya.agent.md"],
	},
	{
		relativePath: [".github", "agents", "noctis.agent.md"],
	},
	{
		relativePath: [".github", "agents", "prompto.agent.md"],
	},
	{
		relativePath: [".opencode", "agents", "gladiolus.md"],
	},
	{
		relativePath: [".opencode", "agents", "ignis.md"],
	},
	{
		relativePath: [".opencode", "agents", "iris.md"],
	},
	{
		relativePath: [".opencode", "agents", "lunafreya.md"],
	},
	{
		relativePath: [".opencode", "agents", "noctis.md"],
	},
	{
		relativePath: [".opencode", "agents", "prompto.md"],
	},
	{
		relativePath: [
			".claude",
			"skills",
			"ff15-workspace-operation-customization",
			"SKILL.md",
		],
	},
	{
		relativePath: [
			".claude",
			"skills",
			"ff15-workspace-operation-customization",
			"scripts",
			"validate-operation-yaml.py",
		],
	},
] as const satisfies readonly Ff15WorkspaceTemplateFileDefinition[];

const getWorkspaceTemplateRoot = (extensionRoot: string) =>
	join(extensionRoot, "src", "resources", "workspace-template");

export const materializeBundledFf15WorkspaceTemplateFiles = (input: {
	bundledFiles?: readonly Ff15WorkspaceTemplateFileDefinition[];
	extensionRoot: string;
	workspaceRoot: string;
}) => {
	const bundledFiles =
		input.bundledFiles ?? FF15_WORKSPACE_TEMPLATE_FILE_DEFINITIONS;

	for (const bundledFile of bundledFiles) {
		const sourcePath = join(
			getWorkspaceTemplateRoot(input.extensionRoot),
			...bundledFile.relativePath
		);
		const targetPath = join(input.workspaceRoot, ...bundledFile.relativePath);
		const targetDir = dirname(targetPath);
		mkdirSync(targetDir, { recursive: true });
		copyFileSync(sourcePath, targetPath);
	}
};
