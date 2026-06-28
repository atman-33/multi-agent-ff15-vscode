declare global {
	interface Window {
		__FF15_WEBVIEW_ASSET_BASE__?: string;
	}
}

/**
 * Resolves a path under the webview asset base into a URI the webview can
 * load. The base is injected as `window.__FF15_WEBVIEW_ASSET_BASE__` by the
 * extension host (see src/lib/webview/get-webview-content.ts). Falls back to a
 * root-relative path for non-webview contexts (e.g. Vite dev / tests).
 */
export const getWebviewAssetUri = (path: string): string => {
	const assetBase =
		typeof window === "undefined"
			? undefined
			: window.__FF15_WEBVIEW_ASSET_BASE__;

	return assetBase ? new URL(path, assetBase).toString() : `/${path}`;
};
