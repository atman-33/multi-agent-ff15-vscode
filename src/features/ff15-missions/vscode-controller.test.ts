import { describe, expect, it, vi } from "vitest";
import { terminateZellijMissionSession } from "./vscode-controller";

describe("terminateZellijMissionSession", () => {
	it("uses delete-session --force so live and exited sessions are removed by one command", async () => {
		const runCommand = vi.fn().mockResolvedValue(undefined);

		await terminateZellijMissionSession({
			runCommand,
			sessionName: "ff15-session",
			workspaceRoot: "C:/repo",
		});

		expect(runCommand).toHaveBeenCalledWith({
			args: ["delete-session", "--force", "ff15-session"],
			cwd: "C:/repo",
		});
	});

	it("ignores session-not-found teardown errors because the mission metadata can still be removed", async () => {
		const runCommand = vi
			.fn()
			.mockRejectedValue(new Error('Session: "ff15-session" not found.'));

		await expect(
			terminateZellijMissionSession({
				runCommand,
				sessionName: "ff15-session",
				workspaceRoot: "C:/repo",
			})
		).resolves.toBeUndefined();
	});
});
