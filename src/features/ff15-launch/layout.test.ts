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
		expect(contents).toContain('command="__FF15_OPENCODE_COMMAND__"');
		expect(contents).toContain('split_direction="vertical"');
		expect(contents).toContain('split_direction="horizontal"');
		expect(contents).toContain('args "--agent" "noctis"');
		expect(contents).toContain('args "--agent" "ignis"');
		expect(contents).toContain('args "--agent" "gladiolus"');
		expect(contents).toContain('args "--agent" "prompto"');
	});
});

describe("renderFf15LayoutTemplate", () => {
	it("injects the workspace root and opencode executable path into the template", () => {
		const rendered = renderFf15LayoutTemplate({
			opencodeCommand:
				"C:/Users/gpbjk/AppData/Roaming/npm/node_modules/opencode-ai/bin/opencode.exe",
			template: [
				"layout {",
				'    cwd "__FF15_WORKSPACE_ROOT__"',
				'    pane command="__FF15_OPENCODE_COMMAND__" {',
				'        args "--agent" "noctis"',
				"    }",
				"}",
			].join("\n"),
			workspaceRoot: "C:/repo path",
		});

		expect(rendered).toContain('cwd "C:/repo path"');
		expect(rendered).toContain(
			'command="C:/Users/gpbjk/AppData/Roaming/npm/node_modules/opencode-ai/bin/opencode.exe"'
		);
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
					'    pane command="__FF15_OPENCODE_COMMAND__" {',
					'        args "--agent" "noctis"',
					"    }",
					"}",
				].join("\n"),
				"utf8"
			);

			const renderedLayoutPath = prepareFf15LaunchLayout({
				extensionRoot,
				opencodeCommand: "C:/tools/opencode.exe",
				workspaceRoot: "C:/repo path",
			});
			const rendered = readFileSync(renderedLayoutPath, "utf8");

			expect(dirname(renderedLayoutPath)).toContain("multi-agent-ff15-vscode");
			expect(rendered).toContain('cwd "C:/repo path"');
			expect(rendered).toContain('command="C:/tools/opencode.exe"');
		} finally {
			rmSync(tempDir, { force: true, recursive: true });
		}
	});
});
