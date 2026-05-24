import { describe, expect, it } from "vitest";
import { window, workspace } from "vscode";
import { resolveActiveWorkspaceRoot } from "./workspace-root";

describe("resolveActiveWorkspaceRoot", () => {
	it("prefers the workspace folder for the active editor", () => {
		const activeUri = { fsPath: "C:/repo-b/src/file.ts" } as any;
		window.activeTextEditor = { document: { uri: activeUri } } as any;
		workspace.workspaceFolders = [{ uri: { fsPath: "C:/repo-a" } }] as any;
		workspace.getWorkspaceFolder = () =>
			({ uri: { fsPath: "C:/repo-b" } }) as any;

		expect(resolveActiveWorkspaceRoot()).toBe("C:/repo-b");
	});

	it("falls back to the first workspace folder when there is no active editor", () => {
		window.activeTextEditor = undefined;
		workspace.workspaceFolders = [{ uri: { fsPath: "C:/repo-a" } }] as any;
		workspace.getWorkspaceFolder = () => workspace.workspaceFolders?.[1] as any;

		expect(resolveActiveWorkspaceRoot()).toBe("C:/repo-a");
	});

	it("returns undefined when the window has no workspace folders", () => {
		window.activeTextEditor = undefined;
		workspace.workspaceFolders = undefined;
		workspace.getWorkspaceFolder = () => workspace.workspaceFolders?.[0] as any;

		expect(resolveActiveWorkspaceRoot()).toBeUndefined();
	});
});
