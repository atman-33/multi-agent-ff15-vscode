import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	prepareFf15LaunchLayout,
	renderFf15LayoutTemplate,
	resolveBundledFf15LayoutTemplatePath,
	resolveWindowsNpmShimExecutablePath,
} from "./layout";

const paneLaunchPlan = [
	{
		agentId: "noctis",
		args: ["--agent", "noctis"],
		executable: "C:/tools/opencode.exe",
	},
	{
		agentId: "ignis",
		args: ["--agent", "ignis"],
		executable: "C:/tools/opencode.exe",
	},
	{
		agentId: "gladiolus",
		args: [],
		executable: "copilot",
	},
	{
		agentId: "prompto",
		args: [],
		executable: "copilot",
	},
] as const;

describe("resolveBundledFf15LayoutTemplatePath", () => {
	it("resolves the bundled roster layout beneath the extension root", () => {
		expect(resolveBundledFf15LayoutTemplatePath(process.cwd())).toBe(
			join(
				process.cwd(),
				"src",
				"features",
				"ff15-launch",
				"assets",
				"ff15-roster.kdl"
			)
		);
	});

	it("bundles the fixed four-agent layout template", () => {
		const layoutPath = resolveBundledFf15LayoutTemplatePath(process.cwd());
		const contents = readFileSync(layoutPath, "utf8");

		expect(contents).toContain('cwd "__FF15_WORKSPACE_ROOT__"');
		expect(contents).toContain("__FF15_NOCTIS_PANE__");
		expect(contents).toContain("__FF15_IGNIS_PANE__");
		expect(contents).toContain("__FF15_GLADIOLUS_PANE__");
		expect(contents).toContain("__FF15_PROMPTO_PANE__");
		expect(contents).toContain('split_direction="vertical"');
		expect(contents).toContain('split_direction="horizontal"');
	});
});

describe("renderFf15LayoutTemplate", () => {
	it("injects the workspace root and pane launch plan into the template", () => {
		const rendered = renderFf15LayoutTemplate({
			paneLaunchPlan,
			template: [
				"layout {",
				'    cwd "__FF15_WORKSPACE_ROOT__"',
				"    __FF15_NOCTIS_PANE__",
				"    __FF15_IGNIS_PANE__",
				"    __FF15_GLADIOLUS_PANE__",
				"    __FF15_PROMPTO_PANE__",
				"}",
			].join("\n"),
			workspaceRoot: "C:/repo path",
		});

		expect(rendered).toContain('cwd "C:/repo path"');
		expect(rendered).toContain('command="C:/tools/opencode.exe"');
		expect(rendered).toContain('args "--agent" "noctis"');
		expect(rendered).toContain('args "--agent" "ignis"');
		expect(rendered).toContain('command="copilot"');
	});
});

describe("resolveWindowsNpmShimExecutablePath", () => {
	it("parses an npm-generated .cmd shim to the backing executable path", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "ff15-layout-test-"));
		const shimPath = join(tempDir, "opencode.cmd");
		const expectedExecutablePath = join(
			tempDir,
			"node_modules",
			"opencode-ai",
			"bin",
			"opencode.exe"
		);

		try {
			writeFileSync(
				shimPath,
				[
					"@ECHO off",
					'"%dp0%\\node_modules\\opencode-ai\\bin\\opencode.exe"   %*',
				].join("\n"),
				"utf8"
			);

			expect(resolveWindowsNpmShimExecutablePath(shimPath)).toBe(
				expectedExecutablePath
			);
		} finally {
			rmSync(tempDir, { force: true, recursive: true });
		}
	});
});

describe("prepareFf15LaunchLayout", () => {
	it("writes a rendered launch layout for the workspace root", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "ff15-layout-test-"));
		const extensionRoot = join(tempDir, "extension");
		const templatePath = join(
			extensionRoot,
			"src",
			"features",
			"ff15-launch",
			"assets",
			"ff15-roster.kdl"
		);

		try {
			mkdirSync(dirname(templatePath), { recursive: true });
			writeFileSync(
				templatePath,
				[
					"layout {",
					'    cwd "__FF15_WORKSPACE_ROOT__"',
					"    __FF15_NOCTIS_PANE__",
					"    __FF15_IGNIS_PANE__",
					"    __FF15_GLADIOLUS_PANE__",
					"    __FF15_PROMPTO_PANE__",
					"}",
				].join("\n"),
				"utf8"
			);

			const renderedLayoutPath = prepareFf15LaunchLayout({
				extensionRoot,
				paneLaunchPlan,
				workspaceRoot: "C:/repo path",
			});
			const rendered = readFileSync(renderedLayoutPath, "utf8");

			expect(dirname(renderedLayoutPath)).toContain("multi-agent-ff15-vscode");
			expect(rendered).toContain('cwd "C:/repo path"');
			expect(rendered).toContain('command="C:/tools/opencode.exe"');
			expect(rendered).toContain('command="copilot"');
		} finally {
			rmSync(tempDir, { force: true, recursive: true });
		}
	});
});
