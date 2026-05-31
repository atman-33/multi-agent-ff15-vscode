import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(
	readFileSync(join(__dirname, "..", "package.json"), "utf-8")
);

describe("extension manifest", () => {
	it("contributes FF15 sidebar views in Projects/Missions/Settings order without a Launch view", () => {
		const views = packageJson.contributes.views["multi-agent-ff15-vscode"];
		expect(views).toHaveLength(3);
		expect(views.map((view: { id: string }) => view.id)).toEqual([
			"multi-agent-ff15-vscode.projectsView",
			"multi-agent-ff15-vscode.missionsView",
			"multi-agent-ff15-vscode.settingsView",
		]);

		expect(views).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "multi-agent-ff15-vscode.projectsView",
					name: "Projects",
					type: "webview",
				}),
				expect.objectContaining({
					id: "multi-agent-ff15-vscode.missionsView",
					name: "Missions",
					type: "webview",
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
