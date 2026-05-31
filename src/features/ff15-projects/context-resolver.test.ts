import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
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
					"version: 3",
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
			expect(snapshot.configVersion).toBe(3);
			expect(snapshot.openspec.mode).toBe("project");
			expect(snapshot.openspec.path).toBe(join(workspaceRoot, "openspec"));
			expect(snapshot.openspec.sourceProjectId).toBe("primary");
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("supports v2 config while using a non-active openspec.project_id", () => {
		const workspaceRoot = createTmpWorkspace();
		const agentsHarnessRoot = join(workspaceRoot, ".agents", "harness");

		try {
			writeFile(
				join(agentsHarnessRoot, "config", "agent-harness.yaml"),
				[
					"version: 2",
					"active_projects:",
					"  - primary",
					"openspec:",
					"  mode: project",
					"  project_id: context-only",
					"",
				].join("\n")
			);
			writeFile(
				join(agentsHarnessRoot, "projects", "context-only.yaml"),
				[
					"id: context-only",
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

			expect(snapshot.configVersion).toBe(2);
			expect(snapshot.activeProjects).toEqual(["primary"]);
			expect(snapshot.openspec.mode).toBe("project");
			expect(snapshot.openspec.sourceProjectId).toBe("context-only");
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
			expect(snapshot.configVersion).toBe(3);
			expect(snapshot.openspec.mode).toBe("project");
			expect(snapshot.openspec.path).toBe(join(workspaceRoot, "openspec"));
			expect(snapshot.openspec.sourceProjectId).toBe("default");
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
			expect(
				readFileSync(
					join(
						workspaceRoot,
						".ff15",
						"harness",
						"config",
						"agent-harness.yaml"
					),
					"utf8"
				)
			).toContain("version: 3");
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("returns explicit error when project-mode profile is missing", () => {
		const workspaceRoot = createTmpWorkspace();
		const agentsHarnessRoot = join(workspaceRoot, ".agents", "harness");

		try {
			writeFile(
				join(agentsHarnessRoot, "config", "agent-harness.yaml"),
				[
					"version: 3",
					"active_projects:",
					"  - primary",
					"openspec:",
					"  mode: project",
					"  project_id: missing-profile",
					"",
				].join("\n")
			);

			const snapshot = resolveFf15ProjectsContext({ workspaceRoot });

			expect(snapshot.status).toBe("error");
			if (snapshot.status !== "error") {
				throw new Error("Expected error projects context snapshot.");
			}

			expect(snapshot.error).toContain("missing-profile");
			expect(snapshot.error).toContain("openspec.project_id");
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("preserves non-v2/v3 config versions without failing resolution", () => {
		const workspaceRoot = createTmpWorkspace();
		const agentsHarnessRoot = join(workspaceRoot, ".agents", "harness");

		try {
			writeFile(
				join(agentsHarnessRoot, "config", "agent-harness.yaml"),
				[
					"version: 1",
					"active_projects:",
					"  - primary",
					"openspec:",
					"  mode: harness",
					"",
				].join("\n")
			);

			const snapshot = resolveFf15ProjectsContext({ workspaceRoot });

			expect(snapshot.status).toBe("ready");
			if (snapshot.status !== "ready") {
				throw new Error("Expected ready projects context snapshot.");
			}

			expect(snapshot.configVersion).toBe(1);
			expect(snapshot.openspec.mode).toBe("harness");
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("resolves harness mode from owner root and clears sourceProjectId", () => {
		const workspaceRoot = createTmpWorkspace();
		const agentsHarnessRoot = join(workspaceRoot, ".agents", "harness");

		try {
			writeFile(
				join(agentsHarnessRoot, "config", "agent-harness.yaml"),
				[
					"version: 3",
					"active_projects:",
					"  - primary",
					"openspec:",
					"  mode: harness",
					"",
				].join("\n")
			);

			const snapshot = resolveFf15ProjectsContext({ workspaceRoot });

			expect(snapshot.status).toBe("ready");
			if (snapshot.status !== "ready") {
				throw new Error("Expected ready projects context snapshot.");
			}

			expect(snapshot.openspec.mode).toBe("harness");
			expect(snapshot.openspec.path).toBe(join(workspaceRoot, "openspec"));
			expect(snapshot.openspec.sourceProjectId).toBeNull();
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
