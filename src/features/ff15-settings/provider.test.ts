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
		const provider = new Ff15SettingsViewProvider({} as never, openSettings);
		const webviewView = {
			webview: {
				html: "",
				localResourceRoots: [],
				options: undefined,
				onDidReceiveMessage: vi.fn((listener) => {
					messageHandler = listener;
					return { dispose: vi.fn() };
				}),
			},
		};

		provider.resolveWebviewView(webviewView as never, {} as never, {} as never);

		expect(webviewView.webview.html).toContain('data-page="ff15-settings"');
		expect(messageHandler).toBeTypeOf("function");

		await messageHandler?.({ command: "ff15-settings.open" });

		expect(openSettings).toHaveBeenCalledTimes(1);
	});
});
