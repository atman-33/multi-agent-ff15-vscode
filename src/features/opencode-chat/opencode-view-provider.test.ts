import { beforeEach, describe, expect, it, vi } from "vitest";
import { OpencodeViewProvider } from "./opencode-view-provider";

describe("OpencodeViewProvider", () => {
	let provider: OpencodeViewProvider;
	let messageHandler:
		| ((message: { type?: string }) => void | Promise<void>)
		| undefined;
	let webviewView: {
		webview: {
			html: string;
			options: unknown;
			postMessage: ReturnType<typeof vi.fn>;
			onDidReceiveMessage: ReturnType<typeof vi.fn>;
		};
	};

	const createWebviewView = () => ({
		webview: {
			html: "",
			options: undefined,
			postMessage: vi.fn(),
			onDidReceiveMessage: vi.fn((listener) => {
				messageHandler = listener;
				return { dispose: vi.fn() };
			}),
		},
	});

	beforeEach(() => {
		messageHandler = undefined;
		provider = new OpencodeViewProvider(
			{} as never,
			{
				appendLine: vi.fn(),
			} as never
		);
		webviewView = createWebviewView();
	});

	it("renders the loading template before a server URL is set", () => {
		provider.resolveWebviewView(webviewView as never, {} as never, {} as never);

		expect(webviewView.webview.html).toContain("Starting opencode server");
	});

	it("renders the loading wrapper on the themed editor surface", () => {
		provider.resolveWebviewView(webviewView as never, {} as never, {} as never);

		expect(webviewView.webview.html).toContain(
			"background: var(--vscode-editor-background)"
		);
		expect(webviewView.webview.html).not.toContain("background: transparent");
	});

	it("renders an iframe when the server URL is set", () => {
		provider.resolveWebviewView(webviewView as never, {} as never, {} as never);
		provider.setServerUrl("http://localhost:1234/base64");

		expect(webviewView.webview.html).toContain(
			'src="http://localhost:1234/base64"'
		);
		expect(webviewView.webview.html).toContain(
			"frame-src http://localhost:1234"
		);
	});

	it("renders the iframe wrapper on the themed editor surface", () => {
		provider.resolveWebviewView(webviewView as never, {} as never, {} as never);
		provider.setServerUrl("http://localhost:1234/base64");

		expect(webviewView.webview.html).toContain(
			"background: var(--vscode-editor-background)"
		);
	});

	it("renders the error template when an error is set", () => {
		provider.resolveWebviewView(webviewView as never, {} as never, {} as never);
		provider.setError("Could not find the opencode CLI.");

		expect(webviewView.webview.html).toContain(
			"Could not find the opencode CLI."
		);
		expect(webviewView.webview.html).toContain(
			"Make sure <code>opencode</code> is installed"
		);
	});

	it("renders the error wrapper on the themed editor surface", () => {
		provider.resolveWebviewView(webviewView as never, {} as never, {} as never);
		provider.setError("boom");

		expect(webviewView.webview.html).toContain(
			"background: var(--vscode-editor-background)"
		);
		expect(webviewView.webview.html).not.toContain("background: transparent");
	});

	it("posts insert-text messages to the webview when addToChat is called", () => {
		provider.resolveWebviewView(webviewView as never, {} as never, {} as never);
		provider.addToChat("src/index.ts:12");

		expect(webviewView.webview.postMessage).toHaveBeenCalledWith({
			type: "insert-text",
			text: "src/index.ts:12",
		});
	});
});
