import { describe, expect, it } from "vitest";
import {
	buildTerminalCommand,
	buildWindowsStartProcessScript,
} from "./launch-terminal";

describe("buildTerminalCommand", () => {
	it("quotes arguments with spaces for the integrated terminal", () => {
		expect(
			buildTerminalCommand({
				executable: "zellij",
				args: ["--layout", "C:/repo path/ff15-roster.kdl"],
			})
		).toBe("zellij --layout 'C:/repo path/ff15-roster.kdl'");
	});
});

describe("buildWindowsStartProcessScript", () => {
	it("uses Start-Process with an explicit argument list", () => {
		expect(
			buildWindowsStartProcessScript({
				cwd: "C:/repo path",
				executable: "zellij",
				args: ["--layout", "C:/repo path/ff15-roster.kdl"],
				name: "FF15",
			})
		).toContain(
			"Start-Process -FilePath 'zellij' -ArgumentList @('--layout', 'C:/repo path/ff15-roster.kdl') -WorkingDirectory 'C:/repo path'"
		);
	});
});
