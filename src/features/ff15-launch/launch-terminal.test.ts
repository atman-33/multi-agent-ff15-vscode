import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";

const { createTerminalMock, remoteNameState, spawnMock } = vi.hoisted(() => ({
	createTerminalMock: vi.fn(),
	remoteNameState: { current: undefined as string | undefined },
	spawnMock: vi.fn(),
}));

vi.mock("vscode", () => ({
	env: {
		get remoteName() {
			return remoteNameState.current;
		},
	},
	window: {
		createTerminal: createTerminalMock,
	},
}));

vi.mock("node:child_process", () => ({
	spawn: spawnMock,
}));

const loadModule = () => {
	vi.resetModules();
	return import("./launch-terminal");
};

afterEach(() => {
	vi.clearAllMocks();
	remoteNameState.current = undefined;
	Reflect.deleteProperty(process.env, "WSL_DISTRO_NAME");
});

describe("buildTerminalCommand", () => {
	it("quotes arguments with spaces for the integrated terminal", async () => {
		const { buildTerminalCommand } = await loadModule();

		expect(
			buildTerminalCommand({
				executable: "zellij",
				args: ["--layout", "C:/repo path/ff15-roster.kdl"],
			})
		).toBe("zellij --layout 'C:/repo path/ff15-roster.kdl'");
	});
});

describe("buildWindowsStartProcessScript", () => {
	it("uses Start-Process with an explicit argument list", async () => {
		const { buildWindowsStartProcessScript } = await loadModule();

		expect(
			buildWindowsStartProcessScript({
				cwd: "C:/repo path",
				executable: "zellij",
				args: ["--layout", "C:/repo path/ff15-roster.kdl"],
				name: "FF15",
			})
		).toContain(
			"Start-Process -FilePath 'zellij' -ArgumentList @('--layout', 'C:/repo path/ff15-roster.kdl') -WorkingDirectory 'C:/repo path'"
		);
	});

	it("omits the PowerShell working directory when none is provided", async () => {
		const { buildWindowsStartProcessScript } = await loadModule();

		expect(
			buildWindowsStartProcessScript({
				executable: "wsl.exe",
				args: [
					"-d",
					"Ubuntu-24.04",
					"--cd",
					"/home/atman/repo",
					"zellij",
					"--layout",
					"/home/atman/repo/ff15-roster.kdl",
				],
			})
		).toBe(
			"$ErrorActionPreference = 'Stop'; Start-Process -FilePath 'wsl.exe' -ArgumentList @('-d', 'Ubuntu-24.04', '--cd', '/home/atman/repo', 'zellij', '--layout', '/home/atman/repo/ff15-roster.kdl')"
		);
	});
});

describe("buildRemoteWslLaunchArgs", () => {
	it("builds a wsl.exe command line for the active distro", async () => {
		process.env.WSL_DISTRO_NAME = "Ubuntu-24.04";

		const { buildRemoteWslLaunchArgs } = await loadModule();

		expect(
			buildRemoteWslLaunchArgs({
				cwd: "/home/atman/repo",
				executable: "zellij",
				args: ["--layout", "/home/atman/repo/ff15-roster.kdl"],
				name: "FF15",
			})
		).toEqual([
			"-d",
			"Ubuntu-24.04",
			"--cd",
			"/home/atman/repo",
			"zellij",
			"--layout",
			"/home/atman/repo/ff15-roster.kdl",
		]);
	});
});

describe("launchZellijTerminal", () => {
	it("uses the Windows host bridge for Remote - WSL launches", async () => {
		remoteNameState.current = "wsl";
		process.env.WSL_DISTRO_NAME = "Ubuntu-24.04";

		const helper = new EventEmitter();
		spawnMock.mockImplementation(() => {
			queueMicrotask(() => helper.emit("exit", 0));
			return helper;
		});

		const { launchZellijTerminal } = await loadModule();

		await launchZellijTerminal({
			cwd: "/home/atman/repo",
			executable: "zellij",
			args: ["--layout", "/home/atman/repo/ff15-roster.kdl"],
			name: "FF15",
		});

		const script = spawnMock.mock.calls[0]?.[1]?.[3];

		expect(createTerminalMock).not.toHaveBeenCalled();
		expect(spawnMock).toHaveBeenCalledWith(
			"powershell.exe",
			[
				"-NoProfile",
				"-NonInteractive",
				"-Command",
				expect.stringContaining(
					"Start-Process -FilePath 'wsl.exe' -ArgumentList @('-d', 'Ubuntu-24.04', '--cd', '/home/atman/repo', 'zellij', '--layout', '/home/atman/repo/ff15-roster.kdl')"
				),
			],
			{
				cwd: undefined,
				stdio: "ignore",
				windowsHide: true,
			}
		);
		expect(script).not.toContain("-WorkingDirectory '/home/atman/repo'");
	});

	it("fails fast when WSL_DISTRO_NAME is unavailable in Remote - WSL", async () => {
		remoteNameState.current = "wsl";

		const { launchZellijTerminal, MISSING_REMOTE_WSL_DISTRO_MESSAGE } =
			await loadModule();

		await expect(
			launchZellijTerminal({
				cwd: "/home/atman/repo",
				executable: "zellij",
				args: ["--layout", "/home/atman/repo/ff15-roster.kdl"],
				name: "FF15",
			})
		).rejects.toThrow(MISSING_REMOTE_WSL_DISTRO_MESSAGE);
		expect(spawnMock).not.toHaveBeenCalled();
		expect(createTerminalMock).not.toHaveBeenCalled();
	});
});
