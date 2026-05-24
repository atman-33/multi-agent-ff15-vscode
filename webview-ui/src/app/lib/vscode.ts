interface VsCodeApi {
	postMessage: (message: any) => void;
	getState: () => any;
	setState: (state: any) => void;
}

declare global {
	interface Window {
		acquireVsCodeApi?: () => VsCodeApi;
	}
}

const DEV_ECHO_TIMEOUT_MS = 50;

let vscodeApi: VsCodeApi;
if (
	typeof window !== "undefined" &&
	typeof window.acquireVsCodeApi === "function"
) {
	vscodeApi = window.acquireVsCodeApi();
} else {
	vscodeApi = {
		postMessage: (msg: any) => {
			window.setTimeout(() => {
				window.dispatchEvent(
					new MessageEvent("message", {
						data: {
							type: "codex.chat/echoResult",
							id: msg.id,
							text: msg.text,
							ts: Date.now(),
						},
					})
				);
			}, DEV_ECHO_TIMEOUT_MS);
		},
		getState: () => ({}),
		setState: () => ({}),
	};
}

export const vscode = vscodeApi;
