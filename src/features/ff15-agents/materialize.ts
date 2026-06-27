import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

export interface Ff15WorkspaceTemplateFileDefinition {
	/** Path of the bundled source file, relative to the workspace-template root. */
	source: readonly string[];
	/** Workspace-relative paths the source file is materialized into. */
	destinations: readonly (readonly string[])[];
}

const FF15_AGENT_NAMES = [
	"gladiolus",
	"ignis",
	"iris",
	"lunafreya",
	"noctis",
	"prompto",
] as const;

const agentTemplateDefinitions = FF15_AGENT_NAMES.map((name) => ({
	source: ["agents", `${name}.md`],
	destinations: [
		[".github", "agents", `${name}.agent.md`],
		[".opencode", "agents", `${name}.md`],
	],
})) satisfies readonly Ff15WorkspaceTemplateFileDefinition[];

export const FF15_WORKSPACE_TEMPLATE_FILE_DEFINITIONS = [
	...agentTemplateDefinitions,
	{
		source: ["skills", "ff15-workspace-operation-customization", "SKILL.md"],
		destinations: [
			[
				".claude",
				"skills",
				"ff15-workspace-operation-customization",
				"SKILL.md",
			],
		],
	},
	{
		source: [
			"skills",
			"ff15-workspace-operation-customization",
			"scripts",
			"validate-operation-yaml.py",
		],
		destinations: [
			[
				".claude",
				"skills",
				"ff15-workspace-operation-customization",
				"scripts",
				"validate-operation-yaml.py",
			],
		],
	},
] satisfies readonly Ff15WorkspaceTemplateFileDefinition[];

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
			...bundledFile.source
		);
		for (const destination of bundledFile.destinations) {
			const targetPath = join(input.workspaceRoot, ...destination);
			const targetDir = dirname(targetPath);
			mkdirSync(targetDir, { recursive: true });
			copyFileSync(sourcePath, targetPath);
		}
	}
};
