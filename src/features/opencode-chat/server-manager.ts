import type { Server as HttpServer } from "http";
import type { ChildProcess } from "child_process";
import spawn from "cross-spawn";
import treeKill from "tree-kill";
import {
	env,
	Uri,
	workspace,
	type ExtensionContext,
	type OutputChannel,
} from "vscode";
import type { OpencodeViewProvider } from "./opencode-view-provider";
import { startWebviewProxy } from "./webview-proxy";

const SERVER_URL_REGEX = /https?:\/\/[^\s]+/;

export class ServerManager {
	private serverProcess: ChildProcess | undefined;
	private proxyServer: HttpServer | undefined;
	private readonly _logger: OutputChannel;

	constructor(logger: OutputChannel) {
		this._logger = logger;
	}

	// biome-ignore lint/nursery/useMaxParams: preserves the original opencode-chat API.
	async start(
		provider: OpencodeViewProvider,
		context: ExtensionContext,
		port: number,
		proxyPort: number,
		exposeToNetwork = false,
		opencodePath = ""
	): Promise<void> {
		const cwd = workspace.workspaceFolders?.[0]?.uri.fsPath;
		this._logger.appendLine(
			`[OpenCode] Starting server (port=${port}, proxyPort=${proxyPort}, exposeToNetwork=${exposeToNetwork}, opencodePath=${opencodePath || "<PATH>"})`
		);

		if (!cwd) {
			this._logger.appendLine("[OpenCode] No workspace folder open");
			provider.setError("No workspace folder open.", false);
			return;
		}
		this._logger.appendLine(`[OpenCode] Workspace: ${cwd}`);

		await context.globalState.update(
			"multi-agent-ff15-vscode.openCode.serverPort",
			port
		);
		await context.globalState.update(
			"multi-agent-ff15-vscode.openCode.proxyPort",
			proxyPort
		);

		const workspacePath = `/${Buffer.from(cwd).toString("base64url")}`;

		const setWebviewServerUrl = async (url: URL) => {
			url.pathname = workspacePath;
			this._logger.appendLine(
				`[OpenCode] Resolving external URI: ${url.toString()}`
			);
			const externalUri = await env.asExternalUri(Uri.parse(url.toString()));
			this._logger.appendLine(
				`[OpenCode] External URI resolved: ${externalUri.toString()}`
			);
			provider.setServerUrl(externalUri.toString());
		};

		// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ported from opencode-chat.
		const serveViaProxy = async (serverUrl: string) => {
			this._logger.appendLine(`[OpenCode] Serving via proxy: ${serverUrl}`);
			try {
				const parsed = new URL(serverUrl);
				const realPort = Number.parseInt(parsed.port, 10);

				if (
					proxyPort > 0 &&
					(await this.isServerAlive(`http://localhost:${proxyPort}`))
				) {
					this._logger.appendLine(
						`[OpenCode] Reusing existing proxy on port ${proxyPort}`
					);
					await setWebviewServerUrl(new URL(`http://localhost:${proxyPort}`));
					return;
				}

				this._logger.appendLine(
					`[OpenCode] Starting webview proxy on port ${proxyPort}`
				);
				const result = await startWebviewProxy(realPort, proxyPort);
				this.proxyServer = result.server;
				this._logger.appendLine(
					`[OpenCode] Webview proxy listening on port ${result.port}`
				);

				if (result.port !== proxyPort) {
					await context.globalState.update(
						"multi-agent-ff15-vscode.openCode.proxyPort",
						result.port
					);
				}

				await setWebviewServerUrl(new URL(`http://localhost:${result.port}`));
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				this._logger.appendLine(
					`[OpenCode] Proxy failed: ${message}. Falling back to direct URL.`
				);
				try {
					const u = new URL(serverUrl);
					if (u.hostname === "0.0.0.0" || u.hostname === "::") {
						u.hostname = "localhost";
					}
					await setWebviewServerUrl(u);
				} catch {
					provider.setServerUrl(serverUrl);
				}
			}
		};

		const existingUrl = `http://localhost:${port}`;
		this._logger.appendLine(
			`[OpenCode] Checking for existing server: ${existingUrl}`
		);
		if (await this.isServerAlive(existingUrl)) {
			this._logger.appendLine("[OpenCode] Existing server found; reusing");
			await serveViaProxy(existingUrl);
			return;
		}
		this._logger.appendLine(
			"[OpenCode] No existing server found; spawning opencode"
		);

		try {
			const args = ["serve", "--port", port.toString()];
			if (exposeToNetwork) {
				args.push("--mdns");
			}
			const opencodeCommand = opencodePath.trim() || "opencode";
			this._logger.appendLine(
				`[OpenCode] Spawning: ${opencodeCommand} ${args.join(" ")}`
			);

			this.serverProcess = spawn(opencodeCommand, args, {
				cwd,
				stdio: "pipe",
				env: {
					...process.env,
					OPENCODE_CALLER: "vscode",
				},
			});

			let resolved = false;

			const onUrl = (url: string) => {
				if (resolved) {
					return;
				}
				resolved = true;
				serveViaProxy(url);
			};

			const handleOutput = (data: Buffer) => {
				const output = data.toString();
				this._logger.appendLine(`[OpenCode] opencode output: ${output.trim()}`);
				const match = output.match(SERVER_URL_REGEX);
				if (match) {
					onUrl(match[0]);
				}
			};

			this.serverProcess.stdout?.on("data", handleOutput);
			this.serverProcess.stderr?.on("data", handleOutput);

			this.serverProcess.on("error", (err) => {
				const message = err instanceof Error ? err.message : String(err);
				this._logger.appendLine(
					`[OpenCode] opencode process error: ${message}`
				);
				if (resolved) {
					return;
				}
				resolved = true;
				if ((err as NodeJS.ErrnoException).code === "ENOENT") {
					if (opencodePath.trim()) {
						provider.setError(
							"Could not find the configured <code>opencode.path</code> executable."
						);
					} else {
						provider.setError("Could not find the <code>opencode</code> CLI.");
					}
				} else {
					provider.setError(`Failed to start server: ${err.message}`);
				}
			});

			this.serverProcess.on("exit", (code) => {
				this._logger.appendLine(
					`[OpenCode] opencode process exited with code ${code}`
				);
				if (code !== null && code !== 0 && !resolved) {
					resolved = true;
					provider.setError(
						`OpenCode server exited with code ${code}. Check that your opencode installation is working.`
					);
				}
			});

			setTimeout(() => {
				this._logger.appendLine(
					`[OpenCode] Fallback: trying expected URL http://localhost:${port}`
				);
				onUrl(`http://localhost:${port}`);
			}, 5000);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this._logger.appendLine(`[OpenCode] Failed to start server: ${message}`);
			provider.setError("Failed to start the OpenCode server.");
		}
	}

	dispose(): void {
		if (this.proxyServer) {
			this.proxyServer.close();
			this.proxyServer = undefined;
		}
		if (this.serverProcess?.pid) {
			treeKill(this.serverProcess.pid);
			this.serverProcess = undefined;
		}
	}

	private async isServerAlive(url: string): Promise<boolean> {
		try {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 1000);
			const res = await fetch(url, { signal: controller.signal });
			clearTimeout(timeout);
			return res.ok;
		} catch {
			return false;
		}
	}
}
