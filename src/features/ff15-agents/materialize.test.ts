import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	FF15_WORKSPACE_TEMPLATE_FILE_DEFINITIONS,
	type Ff15WorkspaceTemplateFileDefinition,
	materializeBundledFf15WorkspaceTemplateFiles,
} from "./materialize";

const writeTemplateSource = (
	extensionRoot: string,
	source: readonly string[],
	contents: string
) => {
	const sourcePath = join(
		extensionRoot,
		"src",
		"resources",
		"workspace-template",
		...source
	);
	mkdirSync(dirname(sourcePath), { recursive: true });
	writeFileSync(sourcePath, contents, "utf8");
};

describe("materializeBundledFf15WorkspaceTemplateFiles", () => {
	it("materializes each bundled source into all of its destinations", () => {
		const extensionRoot = join(
			tmpdir(),
			`ff15-extension-${crypto.randomUUID()}`
		);
		const workspaceRoot = join(
			tmpdir(),
			`ff15-workspace-${crypto.randomUUID()}`
		);
		const bundledFiles: Ff15WorkspaceTemplateFileDefinition[] = [
			{
				source: ["agents", "noctis.md"],
				destinations: [
					[".github", "agents", "noctis.agent.md"],
					[".opencode", "agents", "noctis.md"],
				],
			},
			{
				source: ["skills", "shared", "SKILL.md"],
				destinations: [[".claude", "skills", "shared", "SKILL.md"]],
			},
		];

		try {
			mkdirSync(workspaceRoot, { recursive: true });
			writeTemplateSource(extensionRoot, ["agents", "noctis.md"], "noctis\n");
			writeTemplateSource(
				extensionRoot,
				["skills", "shared", "SKILL.md"],
				"skill\n"
			);

			materializeBundledFf15WorkspaceTemplateFiles({
				bundledFiles,
				extensionRoot,
				workspaceRoot,
			});

			// Single agent source fans out to both tool destinations with identical content.
			expect(
				readFileSync(
					join(workspaceRoot, ".github", "agents", "noctis.agent.md"),
					"utf8"
				)
			).toBe("noctis\n");
			expect(
				readFileSync(
					join(workspaceRoot, ".opencode", "agents", "noctis.md"),
					"utf8"
				)
			).toBe("noctis\n");
			expect(
				readFileSync(
					join(workspaceRoot, ".claude", "skills", "shared", "SKILL.md"),
					"utf8"
				)
			).toBe("skill\n");
		} finally {
			rmSync(extensionRoot, { force: true, recursive: true });
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("overwrites previously materialized files with the bundled contents", () => {
		const extensionRoot = join(
			tmpdir(),
			`ff15-extension-${crypto.randomUUID()}`
		);
		const workspaceRoot = join(
			tmpdir(),
			`ff15-workspace-${crypto.randomUUID()}`
		);
		const bundledFiles: Ff15WorkspaceTemplateFileDefinition[] = [
			{
				source: ["agents", "ignis.md"],
				destinations: [[".github", "agents", "ignis.agent.md"]],
			},
		];

		try {
			mkdirSync(join(workspaceRoot, ".github", "agents"), { recursive: true });
			writeTemplateSource(
				extensionRoot,
				["agents", "ignis.md"],
				"fresh-bundled-content\n"
			);
			writeFileSync(
				join(workspaceRoot, ".github", "agents", "ignis.agent.md"),
				"stale-workspace-content\n",
				"utf8"
			);

			materializeBundledFf15WorkspaceTemplateFiles({
				bundledFiles,
				extensionRoot,
				workspaceRoot,
			});

			expect(
				readFileSync(
					join(workspaceRoot, ".github", "agents", "ignis.agent.md"),
					"utf8"
				)
			).toBe("fresh-bundled-content\n");
		} finally {
			rmSync(extensionRoot, { force: true, recursive: true });
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("routes agents to both tool folders and skills to .claude in the default list", () => {
		const destinationPaths = FF15_WORKSPACE_TEMPLATE_FILE_DEFINITIONS.flatMap(
			(definition) =>
				definition.destinations.map((destination) => destination.join("/"))
		);

		expect(destinationPaths).toEqual(
			expect.arrayContaining([
				".github/agents/noctis.agent.md",
				".opencode/agents/noctis.md",
				".claude/skills/ff15-workspace-operation-customization/SKILL.md",
				".claude/skills/ff15-workspace-operation-customization/scripts/validate-operation-yaml.mjs",
				".claude/skills/ff15-workspace-project-setup/SKILL.md",
				".claude/skills/ff15-workspace-project-setup/scripts/validate-project-yaml.mjs",
			])
		);

		// Every agent source fans out to exactly the .github and .opencode folders.
		const agentDefinitions = FF15_WORKSPACE_TEMPLATE_FILE_DEFINITIONS.filter(
			(definition) => definition.source[0] === "agents"
		);
		for (const definition of agentDefinitions) {
			const destinationRoots = definition.destinations.map(
				(destination) => destination[0]
			);
			expect(destinationRoots).toEqual([".github", ".opencode"]);
		}

		// Skills only ever land under .claude.
		const skillDefinitions = FF15_WORKSPACE_TEMPLATE_FILE_DEFINITIONS.filter(
			(definition) => definition.source[0] === "skills"
		);
		for (const definition of skillDefinitions) {
			for (const destination of definition.destinations) {
				expect(destination[0]).toBe(".claude");
			}
		}
	});
});
