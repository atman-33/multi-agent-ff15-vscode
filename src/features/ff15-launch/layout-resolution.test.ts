import { describe, expect, it, vi } from "vitest";

const { spawnSyncMock } = vi.hoisted(() => ({
	spawnSyncMock: vi.fn(),
}));

vi.mock("node:child_process", async () => {
	const actual =
		await vi.importActual<typeof import("node:child_process")>(
			"node:child_process"
		);

	return {
		...actual,
		spawnSync: spawnSyncMock,
	};
});

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

describe("launch command resolution", () => {
	it("resolves opencode to an absolute path outside Windows when which returns one", async () => {
		spawnSyncMock.mockReturnValue({
			error: undefined,
			status: 0,
			stdout: "/home/test/.local/bin/opencode\n",
		});

		const executable = await withProcessPlatform("linux", async () => {
			const { resolveLaunchableOpencodeCommand } = await import("./layout");
			return resolveLaunchableOpencodeCommand();
		});

		expect(executable).toBe("/home/test/.local/bin/opencode");
		expect(spawnSyncMock).toHaveBeenCalledWith("which", ["opencode"], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		});
	});

	it("resolves copilot to an absolute path outside Windows when which returns one", async () => {
		spawnSyncMock.mockReturnValue({
			error: undefined,
			status: 0,
			stdout: "/home/test/.local/bin/copilot\n",
		});

		const command = await withProcessPlatform("linux", async () => {
			const { resolveLaunchableCopilotCommand } = await import("./layout");
			return resolveLaunchableCopilotCommand();
		});

		expect(command).toEqual({
			args: [],
			executable: "/home/test/.local/bin/copilot",
		});
		expect(spawnSyncMock).toHaveBeenCalledWith("which", ["copilot"], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		});
	});
});
