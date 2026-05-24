import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(
	readFileSync(join(__dirname, "..", "package.json"), "utf-8")
);

describe("extension manifest", () => {
	it("contributes the FF15 settings view and open-settings command", () => {
		expect(packageJson.contributes.views["multi-agent-ff15-vscode"]).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "multi-agent-ff15-vscode.launchView",
				}),
				expect.objectContaining({
					id: "multi-agent-ff15-vscode.settingsView",
					name: "Settings",
					type: "webview",
				}),
			])
		);

		expect(packageJson.contributes.commands).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					command: "multi-agent-ff15-vscode.openSettings",
					title: "Open FF15 Settings",
				}),
			])
		);
	});
});
