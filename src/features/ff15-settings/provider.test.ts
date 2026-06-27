import { beforeEach, describe, expect, it, vi } from "vitest";
import { Ff15SettingsViewProvider } from "./provider";

vi.mock("../../lib/webview/get-webview-content", () => ({
	getWebviewContent: vi
		.fn()
		.mockReturnValue('<div id="root" data-page="ff15-settings"></div>'),
}));

describe("Ff15SettingsViewProvider", () => {
	let messageHandler:
		| ((message: { command?: string }) => void | Promise<void>)
		| undefined;

	beforeEach(() => {
		messageHandler = undefined;
	});

	it("renders the FF15 settings page and handles the open-settings action", async () => {
		const openSettings = vi.fn().mockResolvedValue(undefined);
		const launchController = {
			launch: vi.fn().mockResolvedValue({
				cwd: "C:/workspace",
				status: "launched",
			}),
		};
		const provider = new Ff15SettingsViewProvider(
			{} as never,
			false,
			openSettings,
			launchController as never
		);
		const webviewView = {
			webview: {
				html: "",
				localResourceRoots: [],
				options: undefined,
				postMessage: vi.fn(),
				onDidReceiveMessage: vi.fn((listener) => {
					messageHandler = listener;
					return { dispose: vi.fn() };
				}),
			},
		};

		provider.resolveWebviewView(webviewView as never, {} as never, {} as never);

		expect(webviewView.webview.html).toContain('data-page="ff15-settings"');
		expect(messageHandler).toBeTypeOf("function");
		expect(webviewView.webview.postMessage).toHaveBeenCalledWith({
			command: "ff15-settings.devMode",
			devMode: false,
		});

		await messageHandler?.({ command: "ff15-settings.open" });

		expect(openSettings).toHaveBeenCalledTimes(1);
	});

	it("launches FF15 from settings and posts launch status updates", async () => {
		const openSettings = vi.fn().mockResolvedValue(undefined);
		const launchController = {
			launch: vi.fn().mockResolvedValue({
				cwd: "C:/workspace",
				status: "launched",
			}),
		};
		const provider = new Ff15SettingsViewProvider(
			{} as never,
			false,
			openSettings,
			launchController as never
		);
		const webviewView = {
			webview: {
				html: "",
				localResourceRoots: [],
				options: undefined,
				postMessage: vi.fn(),
				onDidReceiveMessage: vi.fn((listener) => {
					messageHandler = listener;
					return { dispose: vi.fn() };
				}),
			},
		};

		provider.resolveWebviewView(webviewView as never, {} as never, {} as never);

		await messageHandler?.({ command: "ff15-launch.start" });

		expect(launchController.launch).toHaveBeenCalledTimes(1);
		expect(webviewView.webview.postMessage).toHaveBeenNthCalledWith(1, {
			command: "ff15-settings.devMode",
			devMode: false,
		});
		expect(webviewView.webview.postMessage).toHaveBeenNthCalledWith(2, {
			command: "ff15-launch.status",
			message: "Checking dependencies and opening Zellij...",
			state: "launching",
		});
		expect(webviewView.webview.postMessage).toHaveBeenNthCalledWith(3, {
			command: "ff15-launch.status",
			message: "FF15 launch started in C:/workspace",
			state: "launched",
		});
		expect(openSettings).not.toHaveBeenCalled();
	});
});
