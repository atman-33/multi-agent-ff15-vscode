import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";

// Single-entry build for all webviews. Pages are selected at runtime via
// data-page on #root and resolved through src/app/routes.
export default defineConfig({
	base: "./",
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: {
			"@": resolve(__dirname, "src/app"),
		},
	},
	build: {
		outDir: resolve(__dirname, "../dist/webview/app"),
		emptyOutDir: true,
		rollupOptions: {
			input: resolve(__dirname, "index.html"),
			output: {
				entryFileNames: "index.js",
				chunkFileNames: "chunks/[name].js",
				assetFileNames: "assets/[name][extname]",
			},
		},
	},
});
