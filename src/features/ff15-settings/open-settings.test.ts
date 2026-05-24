import { describe, expect, it, vi } from "vitest";

vi.mock("vscode", () => ({
	commands: {
		executeCommand: vi.fn(),
	},
}));

import { commands } from "vscode";
import { FF15_SETTINGS_QUERY, openFf15Settings } from "./open-settings";

describe("openFf15Settings", () => {
	it("opens VS Code Settings filtered to the FF15 settings namespace", async () => {
		await openFf15Settings();

		expect(commands.executeCommand).toHaveBeenCalledWith(
			"workbench.action.openSettings",
			FF15_SETTINGS_QUERY
		);
	});
});
