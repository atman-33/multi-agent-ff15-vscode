import { exec } from "child_process";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import {
	env,
	Uri,
	type OutputChannel,
	type Uri as UriType,
	type WebviewView,
	type WebviewViewProvider,
	type WebviewViewResolveContext,
} from "vscode";
import {
	OPENCODE_ERROR_TEMPLATE,
	OPENCODE_IFRAME_TEMPLATE,
	OPENCODE_LOADING_TEMPLATE,
} from "./templates";

const AUDIO_DATA_URI_REGEX = /^data:audio\/([a-zA-Z0-9.+-]+);base64,(.+)$/;

export class OpencodeViewProvider implements WebviewViewProvider {
	private readonly _extensionUri: UriType;
	private readonly _logger: OutputChannel;
	private _view?: WebviewView;
	private _serverUrl?: string;
	private _error?: { message: string; showInstallHint: boolean };
	private _sidebarType: "primary" | "auxiliary" | null = null;
	private _isDevMode = false;

	constructor(extensionUri: UriType, logger: OutputChannel) {
		this._extensionUri = extensionUri;
		this._logger = logger;
	}

	setDevMode(enabled: boolean) {
		this._isDevMode = enabled;
	}

	get isViewVisible(): boolean {
		return !!this._view?.visible;
	}

	get sidebarType(): "primary" | "auxiliary" | null {
		return this._sidebarType;
	}

	set sidebarType(type: "primary" | "auxiliary" | null) {
		this._sidebarType = type;
	}

	resolveWebviewView(
		webviewView: WebviewView,
		_context: WebviewViewResolveContext
	) {
		this._logger.appendLine("[OpenCode] resolveWebviewView called");
		this._view = webviewView;
		webviewView.webview.options = { enableScripts: true };

		webviewView.webview.onDidReceiveMessage(async (message) => {
			if (message.type === "paste-request") {
				const text = await env.clipboard.readText();
				webviewView.webview.postMessage({ type: "paste-response", text });
			}
			if (message.type === "copy-request" && typeof message.text === "string") {
				await env.clipboard.writeText(message.text);
			}
			if (message.type === "play-audio" && typeof message.src === "string") {
				this._playAudioDataUri(message.src).catch(() => {
					// Audio playback failures are logged inside _playAudioDataUri.
				});
			}
			if (message.type === "open-external" && typeof message.url === "string") {
				env.openExternal(Uri.parse(message.url));
			}
		});

		this._renderCurrentState();
	}

	setServerUrl(url: string) {
		this._logger.appendLine(`[OpenCode] Setting server URL: ${url}`);
		this._serverUrl = url;
		this._error = undefined;
		this._renderCurrentState();
	}

	addToChat(filePath: string) {
		this._view?.webview.postMessage({ type: "insert-text", text: filePath });
	}

	setError(message: string, showInstallHint = true) {
		this._logger.appendLine(`[OpenCode] Setting error: ${message}`);
		this._error = { message, showInstallHint };
		this._serverUrl = undefined;
		this._renderCurrentState();
	}

	setLoading() {
		this._logger.appendLine("[OpenCode] Setting loading state");
		this._serverUrl = undefined;
		this._error = undefined;
		this._renderCurrentState();
	}

	private _renderCurrentState() {
		if (!this._view) {
			this._logger.appendLine(
				"[OpenCode] _renderCurrentState called before view resolved; deferring."
			);
			return;
		}

		try {
			if (this._error) {
				this._logger.appendLine("[OpenCode] Rendering error state");
				this._view.webview.html = this._getErrorHtml(
					this._error.message,
					this._error.showInstallHint
				);
				return;
			}

			if (this._serverUrl) {
				this._logger.appendLine(
					`[OpenCode] Rendering iframe state for: ${this._serverUrl}`
				);
				this._view.webview.html = this._getIframeHtml(this._serverUrl);
				return;
			}

			this._logger.appendLine("[OpenCode] Rendering loading state");
			this._view.webview.html = this._processTemplate(
				OPENCODE_LOADING_TEMPLATE
			);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this._logger.appendLine(
				`[OpenCode] Failed to render view state: ${message}`
			);
			try {
				this._view.webview.html = this._getErrorHtml(
					`Failed to render view: ${message}`,
					false
				);
			} catch {
				// Last resort: show a plain error so the view is not stuck loading.
				this._view.webview.html = `<!doctype html><html><body style="color:var(--vscode-foreground);font-family:var(--vscode-font-family);padding:20px;">Failed to render OpenCode view: ${message}</body></html>`;
			}
		}
	}

	private _processTemplate(template: string): string {
		return template.replaceAll(
			"{{DEV_MODE}}",
			this._isDevMode ? "flex" : "none"
		);
	}

	private _getIframeHtml(serverUrl: string): string {
		let serverOrigin = serverUrl;
		try {
			serverOrigin = new URL(serverUrl).origin;
		} catch {
			// Keep the original URL if parsing fails.
		}

		this._logger.appendLine(
			`[OpenCode] iframe src=${serverUrl} | CSP frame-src origin=${serverOrigin}`
		);

		return this._processTemplate(OPENCODE_IFRAME_TEMPLATE)
			.replaceAll("{{SERVER_URL}}", serverUrl)
			.replaceAll("{{SERVER_ORIGIN}}", serverOrigin);
	}

	private _getErrorHtml(message: string, showInstallHint: boolean): string {
		const installHint = showInstallHint
			? "<p>Make sure <code>opencode</code> is installed and available in your PATH.</p>"
			: "";

		return this._processTemplate(OPENCODE_ERROR_TEMPLATE)
			.replaceAll("{{ERROR_MESSAGE}}", message)
			.replaceAll("{{INSTALL_HINT}}", installHint);
	}

	private async _playAudioDataUri(dataUri: string) {
		try {
			const match = dataUri.match(AUDIO_DATA_URI_REGEX);
			if (!match) {
				return;
			}

			const ext = match[1];
			const base64 = match[2];
			const buffer = Buffer.from(base64, "base64");

			const tmpFile = join(tmpdir(), `opencode-audio-${Date.now()}.${ext}`);
			await writeFile(tmpFile, buffer);

			const cleanup = async () => {
				try {
					await unlink(tmpFile);
				} catch {
					// Ignore cleanup failures.
				}
			};

			let cmd: string;
			switch (process.platform) {
				case "darwin":
					cmd = `afplay "${tmpFile}"`;
					break;
				case "linux":
					cmd = `paplay "${tmpFile}" 2>/dev/null || aplay "${tmpFile}"`;
					break;
				case "win32":
					cmd = `powershell -c "(New-Object Media.SoundPlayer '${tmpFile}').PlaySync()"`;
					break;
				default:
					await cleanup();
					return;
			}

			exec(cmd, { timeout: 10_000 }, (err) => {
				cleanup().catch(() => {
					// Ignore cleanup failures.
				});
				if (err) {
					console.error(
						"[OpenCode] System audio playback failed:",
						err.message
					);
				}
			});
		} catch (err) {
			console.error("[OpenCode] Failed to play audio data URI:", err);
		}
	}
}
