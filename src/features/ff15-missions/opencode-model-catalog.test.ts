import { EventEmitter } from "node:events";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const { spawnMock } = vi.hoisted(() => ({
	spawnMock: vi.fn(),
}));

vi.mock("cross-spawn", () => ({
	default: spawnMock,
}));

interface FakeSpawnResult {
	code?: number;
	error?: Error;
	stderr?: string;
	stdout?: string;
}

// Build a minimal ChildProcess stand-in whose stdout/stderr are EventEmitters,
// emitting their data (as UTF-8 buffers) and a terminal event on the next
// microtask so the production listeners are attached first.
const createFakeChild = (result: FakeSpawnResult) => {
	const child = new EventEmitter() as EventEmitter & {
		kill: () => void;
		stderr: EventEmitter;
		stdout: EventEmitter;
	};
	child.stdout = new EventEmitter();
	child.stderr = new EventEmitter();
	child.kill = vi.fn();

	queueMicrotask(() => {
		if (result.error) {
			child.emit("error", result.error);
			return;
		}
		if (result.stdout) {
			child.stdout.emit("data", Buffer.from(result.stdout, "utf-8"));
		}
		if (result.stderr) {
			child.stderr.emit("data", Buffer.from(result.stderr, "utf-8"));
		}
		child.emit("close", result.code ?? 0);
	});

	return child;
};

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
	spawnMock.mockImplementation((file: string, args: string[]) => {
		if (file !== "opencode") {
			return createFakeChild({ code: 1, stderr: `Unexpected file: ${file}` });
		}

		if (args[0] === "models" && args[1] === "--verbose") {
			return createFakeChild({ stdout: output });
		}

		if (args[0] === "--version") {
			return createFakeChild({ stdout: "1.2.3\n" });
		}

		return createFakeChild({
			code: 1,
			stderr: `Unexpected args: ${args.join(" ")}`,
		});
	});
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
	spawnMock.mockReset();

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

		spawnMock.mockImplementation((_file: string, args: string[]) => {
			if (args[0] === "--version") {
				return createFakeChild({ stdout: "1.2.3\n" });
			}

			return createFakeChild({ code: 1, stderr: "refresh failed" });
		});

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
		expect(result.lastError).toContain("refresh failed");
	});

	it("spawns OpenCode without a shell on Windows", async () => {
		const root = createTempRoot();

		spawnMock.mockImplementation(
			(file: string, args: string[], options: { shell?: boolean }) => {
				expect(file).toBe("opencode");
				expect(options).toMatchObject({ cwd: root, windowsHide: true });
				// Running without a shell keeps cmd.exe (and its locale-encoded
				// errors) out of the pipeline, preventing mojibake on Windows.
				expect(options.shell).toBeUndefined();

				if (args[0] === "models" && args[1] === "--verbose") {
					return createFakeChild({ stdout: verboseOutput() });
				}

				if (args[0] === "--version") {
					return createFakeChild({ stdout: "1.2.3\n" });
				}

				return createFakeChild({
					code: 1,
					stderr: `Unexpected args: ${args.join(" ")}`,
				});
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
