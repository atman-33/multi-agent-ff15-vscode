import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const { execFileMock } = vi.hoisted(() => ({
	execFileMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
	execFile: execFileMock,
}));

const tempRoots: string[] = [];

const createTempRoot = () => {
	const root = mkdtempSync(join(tmpdir(), "ff15-vscode-opencode-catalog-"));
	tempRoots.push(root);
	return root;
};

const verboseOutput = () =>
	[
		"github-copilot/gpt-5.4",
		"{",
		'  "id": "gpt-5.4",',
		'  "name": "GPT-5.4",',
		'  "variants": {',
		'    "medium": {},',
		'    "high": {}',
		"  }",
		"}",
		"anthropic/claude-haiku-4.5",
		"{",
		'  "id": "claude-haiku-4.5",',
		'  "name": "Claude Haiku 4.5"',
		"}",
		"",
	].join("\n");

const installExecSuccess = (output = verboseOutput()) => {
	execFileMock.mockImplementation(
		(
			file: string,
			args: string[],
			options: unknown,
			callback?: (error: Error | null, stdout: string, stderr: string) => void
		) => {
			const done = typeof options === "function" ? options : callback;
			if (!done) {
				throw new Error("Missing callback");
			}

			if (file !== "opencode") {
				done(new Error(`Unexpected file: ${file}`), "", "");
				return;
			}

			if (args[0] === "models" && args[1] === "--verbose") {
				done(null, output, "");
				return;
			}

			if (args[0] === "--version") {
				done(null, "1.2.3\n", "");
				return;
			}

			done(new Error(`Unexpected args: ${args.join(" ")}`), "", "");
		}
	);
};

const loadModule = () => {
	vi.resetModules();
	return import("./opencode-model-catalog");
};

const withProcessPlatform = async <T>(
	platform: NodeJS.Platform,
	run: () => Promise<T>
): Promise<T> => {
	const descriptor = Object.getOwnPropertyDescriptor(process, "platform");
	Object.defineProperty(process, "platform", {
		configurable: true,
		value: platform,
	});

	try {
		return await run();
	} finally {
		if (descriptor) {
			Object.defineProperty(process, "platform", descriptor);
		}
	}
};

afterEach(() => {
	execFileMock.mockReset();

	while (tempRoots.length > 0) {
		const root = tempRoots.pop();
		if (root) {
			rmSync(root, { force: true, recursive: true });
		}
	}
});

describe("opencode-model-catalog", () => {
	it("parses verbose output into workbench model definitions", async () => {
		const { parseOpencodeModelsVerboseOutput } = await loadModule();

		expect(parseOpencodeModelsVerboseOutput(verboseOutput())).toEqual([
			{
				efforts: [
					{ label: "medium", value: "medium" },
					{ label: "high", value: "high" },
				],
				id: "github-copilot/gpt-5.4",
				name: "GPT-5.4",
			},
			{
				efforts: [],
				id: "anthropic/claude-haiku-4.5",
				name: "Claude Haiku 4.5",
			},
		]);
	});

	it("writes the latest workspace snapshot to .ff15 cache", async () => {
		installExecSuccess();
		const root = createTempRoot();
		const module = await loadModule();

		const snapshot = await module.refreshFf15OpenCodeModelCatalog(root);
		const filePath = module.getFf15OpenCodeModelCatalogPath(root);

		expect(snapshot).not.toBeNull();
		expect(existsSync(filePath)).toBe(true);
		expect(JSON.parse(readFileSync(filePath, "utf-8"))).toMatchObject({
			models: expect.arrayContaining([
				expect.objectContaining({
					id: "github-copilot/gpt-5.4",
					name: "GPT-5.4",
				}),
			]),
			opencodeVersion: "1.2.3",
			sourceCommand: "opencode models --verbose",
		});
	});

	it("keeps the last successful workspace snapshot when refresh fails", async () => {
		const root = createTempRoot();
		installExecSuccess();
		const module = await loadModule();

		await module.refreshFf15OpenCodeModelCatalog(root);

		execFileMock.mockImplementation(
			(
				_file: string,
				args: string[],
				options: unknown,
				callback?: (error: Error | null, stdout: string, stderr: string) => void
			) => {
				const done = typeof options === "function" ? options : callback;
				if (!done) {
					throw new Error("Missing callback");
				}

				if (args[0] === "--version") {
					done(null, "1.2.3\n", "");
					return;
				}

				done(new Error("refresh failed"), "", "");
			}
		);

		await expect(module.refreshFf15OpenCodeModelCatalog(root)).rejects.toThrow(
			"refresh failed"
		);

		const result = await module.readFf15OpenCodeModelCatalog({
			waitForLatest: false,
			workspaceRoot: root,
		});

		expect(result.snapshot?.models).toEqual([
			expect.objectContaining({ id: "github-copilot/gpt-5.4" }),
			expect.objectContaining({ id: "anthropic/claude-haiku-4.5" }),
		]);
		expect(result.refreshState).toBe("error");
		expect(result.stale).toBe(true);
		expect(result.lastError).toBe("refresh failed");
	});

	it("uses shell execution for OpenCode refresh on Windows", async () => {
		const root = createTempRoot();

		execFileMock.mockImplementation(
			(
				file: string,
				args: string[],
				options: unknown,
				callback?: (error: Error | null, stdout: string, stderr: string) => void
			) => {
				const done = typeof options === "function" ? options : callback;
				if (!done) {
					throw new Error("Missing callback");
				}

				expect(file).toBe("opencode");
				expect(options).toMatchObject({ cwd: root, shell: true });

				if (args[0] === "models" && args[1] === "--verbose") {
					done(null, verboseOutput(), "");
					return;
				}

				if (args[0] === "--version") {
					done(null, "1.2.3\n", "");
					return;
				}

				done(new Error(`Unexpected args: ${args.join(" ")}`), "", "");
			}
		);

		await withProcessPlatform("win32", async () => {
			const module = await loadModule();
			await expect(
				module.refreshFf15OpenCodeModelCatalog(root)
			).resolves.not.toBeNull();
		});
	});
});
