import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveFf15ProjectsContext } from "./context-resolver";

const createTmpWorkspace = () =>
	join(tmpdir(), `ff15-projects-context-${crypto.randomUUID()}`);

const writeFile = (filePath: string, content: string) => {
	mkdirSync(dirname(filePath), { recursive: true });
	writeFileSync(filePath, content, "utf8");
};

describe("resolveFf15ProjectsContext", () => {
	it("prefers valid .agents/harness over .ff15/harness", () => {
		const workspaceRoot = createTmpWorkspace();
		const agentsHarnessRoot = join(workspaceRoot, ".agents", "harness");
		const ff15HarnessRoot = join(workspaceRoot, ".ff15", "harness");

		try {
			writeFile(
				join(agentsHarnessRoot, "config", "agent-harness.yaml"),
				[
					"version: 2",
					"active_projects:",
					"  - primary",
					"openspec:",
					"  mode: project",
					"  project_id: primary",
					"",
				].join("\n")
			);
			writeFile(
				join(agentsHarnessRoot, "projects", "primary.yaml"),
				[
					"id: primary",
					"openspec_root: .",
					"repos:",
					"  - id: extension",
					"    root: .",
					"",
				].join("\n")
			);

			writeFile(
				join(ff15HarnessRoot, "config", "agent-harness.yaml"),
				[
					"version: 2",
					"active_projects:",
					"  - fallback",
					"openspec:",
					"  mode: project",
					"  project_id: fallback",
					"",
				].join("\n")
			);
			writeFile(
				join(ff15HarnessRoot, "projects", "fallback.yaml"),
				[
					"id: fallback",
					"openspec_root: .",
					"repos:",
					"  - id: extension",
					"    root: .",
					"",
				].join("\n")
			);

			const snapshot = resolveFf15ProjectsContext({ workspaceRoot });

			expect(snapshot.status).toBe("ready");
			if (snapshot.status !== "ready") {
				throw new Error("Expected ready projects context snapshot.");
			}

			expect(snapshot.sourceKind).toBe("agents");
			expect(snapshot.sourcePath).toBe(agentsHarnessRoot);
			expect(snapshot.activeProjects).toEqual(["primary"]);
			expect(snapshot.openspec.mode).toBe("project");
			expect(snapshot.openspec.path).toBe(join(workspaceRoot, "openspec"));
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("bootstraps .ff15/harness when no harness directory exists", () => {
		const workspaceRoot = createTmpWorkspace();

		try {
			const snapshot = resolveFf15ProjectsContext({ workspaceRoot });

			expect(snapshot.status).toBe("ready");
			if (snapshot.status !== "ready") {
				throw new Error("Expected ready projects context snapshot.");
			}

			expect(snapshot.sourceKind).toBe("ff15");
			expect(snapshot.sourcePath).toBe(join(workspaceRoot, ".ff15", "harness"));
			expect(snapshot.activeProjects).toEqual(["default"]);
			expect(snapshot.openspec.mode).toBe("project");
			expect(snapshot.openspec.path).toBe(join(workspaceRoot, "openspec"));
			expect(
				existsSync(
					join(
						workspaceRoot,
						".ff15",
						"harness",
						"config",
						"agent-harness.yaml"
					)
				)
			).toBe(true);
			expect(
				existsSync(
					join(workspaceRoot, ".ff15", "harness", "projects", "default.yaml")
				)
			).toBe(true);
			expect(
				existsSync(
					join(workspaceRoot, ".ff15", "harness", "projects", "_template.yaml")
				)
			).toBe(true);
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("returns an explicit error when .agents/harness is invalid and does not fall back", () => {
		const workspaceRoot = createTmpWorkspace();
		const agentsHarnessRoot = join(workspaceRoot, ".agents", "harness");
		const ff15HarnessRoot = join(workspaceRoot, ".ff15", "harness");

		try {
			writeFile(
				join(agentsHarnessRoot, "config", "agent-harness.yaml"),
				"this-is-not-valid-yaml: ["
			);
			writeFile(
				join(ff15HarnessRoot, "config", "agent-harness.yaml"),
				[
					"version: 2",
					"active_projects:",
					"  - fallback",
					"openspec:",
					"  mode: project",
					"  project_id: fallback",
					"",
				].join("\n")
			);
			writeFile(
				join(ff15HarnessRoot, "projects", "fallback.yaml"),
				[
					"id: fallback",
					"openspec_root: .",
					"repos:",
					"  - id: extension",
					"    root: .",
					"",
				].join("\n")
			);

			const snapshot = resolveFf15ProjectsContext({ workspaceRoot });

			expect(snapshot.status).toBe("error");
			if (snapshot.status !== "error") {
				throw new Error("Expected error projects context snapshot.");
			}

			expect(snapshot.sourceKind).toBe("agents");
			expect(snapshot.sourcePath).toBe(agentsHarnessRoot);
			expect(snapshot.error).toContain(".agents");
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});
});
