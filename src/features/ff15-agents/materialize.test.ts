import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	FF15_WORKSPACE_TEMPLATE_FILE_DEFINITIONS,
	type Ff15WorkspaceTemplateFileDefinition,
	materializeBundledFf15WorkspaceTemplateFiles,
} from "./materialize";

describe("materializeBundledFf15WorkspaceTemplateFiles", () => {
	it("copies bundled workspace-template files into matching workspace paths", () => {
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
				relativePath: [".github", "agents", "noctis.agent.md"],
			},
			{
				relativePath: [".opencode", "skills", "shared", "SKILL.md"],
			},
		];

		try {
			mkdirSync(
				join(
					extensionRoot,
					"src",
					"resources",
					"workspace-template",
					".github",
					"agents"
				),
				{
					recursive: true,
				}
			);
			mkdirSync(
				join(
					extensionRoot,
					"src",
					"resources",
					"workspace-template",
					".opencode",
					"skills",
					"shared"
				),
				{
					recursive: true,
				}
			);
			mkdirSync(workspaceRoot, { recursive: true });
			writeFileSync(
				join(
					extensionRoot,
					"src",
					"resources",
					"workspace-template",
					".github",
					"agents",
					"noctis.agent.md"
				),
				"github-noctis\n",
				"utf8"
			);
			writeFileSync(
				join(
					extensionRoot,
					"src",
					"resources",
					"workspace-template",
					".opencode",
					"skills",
					"shared",
					"SKILL.md"
				),
				"opencode-skill\n",
				"utf8"
			);

			materializeBundledFf15WorkspaceTemplateFiles({
				bundledFiles,
				extensionRoot,
				workspaceRoot,
			});

			expect(
				existsSync(join(workspaceRoot, ".github", "agents", "noctis.agent.md"))
			).toBe(true);
			expect(
				existsSync(
					join(workspaceRoot, ".opencode", "skills", "shared", "SKILL.md")
				)
			).toBe(true);
			expect(
				readFileSync(
					join(workspaceRoot, ".github", "agents", "noctis.agent.md"),
					"utf8"
				)
			).toBe("github-noctis\n");
			expect(
				readFileSync(
					join(workspaceRoot, ".opencode", "skills", "shared", "SKILL.md"),
					"utf8"
				)
			).toBe("opencode-skill\n");
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
				relativePath: [".github", "agents", "ignis.agent.md"],
			},
		];

		try {
			mkdirSync(
				join(
					extensionRoot,
					"src",
					"resources",
					"workspace-template",
					".github",
					"agents"
				),
				{
					recursive: true,
				}
			);
			mkdirSync(join(workspaceRoot, ".github", "agents"), { recursive: true });
			writeFileSync(
				join(
					extensionRoot,
					"src",
					"resources",
					"workspace-template",
					".github",
					"agents",
					"ignis.agent.md"
				),
				"fresh-bundled-content\n",
				"utf8"
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

	it("includes workspace operation customization skills in the default template list", () => {
		const bundledPaths = FF15_WORKSPACE_TEMPLATE_FILE_DEFINITIONS.map(
			(definition) => definition.relativePath.join("/")
		);

		expect(bundledPaths).toEqual(
			expect.arrayContaining([
				".claude/skills/ff15-workspace-operation-customization/SKILL.md",
				".claude/skills/ff15-workspace-operation-customization/scripts/validate-operation-yaml.py",
			])
		);
	});
});
