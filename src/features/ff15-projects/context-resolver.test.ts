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
import {
	resolveFf15ProjectsContext,
	saveFf15ProjectsContext,
} from "./context-resolver";

const MISSING_PROFILE_PATTERN = /missing-profile/;

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
			mkdirSync(join(workspaceRoot, "beta"), { recursive: true });
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
			mkdirSync(join(workspaceRoot, "beta"), { recursive: true });
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

	it("normalizes saved active_projects while preserving yaml comments and key order", () => {
		const workspaceRoot = createTmpWorkspace();
		const agentsHarnessRoot = join(workspaceRoot, ".agents", "harness");
		const configPath = join(agentsHarnessRoot, "config", "agent-harness.yaml");

		try {
			writeFile(
				configPath,
				[
					"version: 3",
					"",
					"# Project ids to include in the active session context.",
					"active_projects:",
					"  - beta",
					"",
					"# OpenSpec source to use for the current session.",
					"openspec:",
					"  mode: project",
					"  project_id: source-project",
					"",
				].join("\n")
			);
			writeFile(
				join(agentsHarnessRoot, "projects", "alpha.yaml"),
				[
					"id: alpha",
					"openspec_root: .",
					"repos:",
					"  - id: extension",
					"    root: .",
					"",
				].join("\n")
			);
			writeFile(
				join(agentsHarnessRoot, "projects", "beta.yaml"),
				[
					"id: beta",
					"openspec_root: .",
					"repos:",
					"  - id: extension",
					"    root: .",
					"",
				].join("\n")
			);
			writeFile(
				join(agentsHarnessRoot, "projects", "source-project.yaml"),
				[
					"id: source-project",
					"openspec_root: .",
					"repos:",
					"  - id: extension",
					"    root: .",
					"",
				].join("\n")
			);

			const snapshot = saveFf15ProjectsContext({
				draft: {
					activeProjects: ["beta", "alpha", "beta"],
					openspec: {
						mode: "project",
						projectId: "source-project",
					},
				},
				workspaceRoot,
			});

			expect(snapshot.status).toBe("ready");
			if (snapshot.status !== "ready") {
				throw new Error("Expected ready projects context snapshot.");
			}

			expect(snapshot.activeProjects).toEqual(["alpha", "beta"]);
			expect(snapshot.openspec.mode).toBe("project");
			expect(snapshot.openspec.sourceProjectId).toBe("source-project");

			const savedConfig = readFileSync(configPath, "utf8");
			expect(savedConfig).toContain(
				"# Project ids to include in the active session context."
			);
			expect(savedConfig).toContain(
				"# OpenSpec source to use for the current session."
			);
			expect(savedConfig.indexOf("version:")).toBeLessThan(
				savedConfig.indexOf("active_projects:")
			);
			expect(savedConfig.indexOf("active_projects:")).toBeLessThan(
				savedConfig.indexOf("openspec:")
			);
			expect(savedConfig).toContain("  - alpha");
			expect(savedConfig).toContain("  - beta");
			expect(savedConfig).toContain("  project_id: source-project");
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("loads known profiles and keeps path/default-check issues as warnings", () => {
		const workspaceRoot = createTmpWorkspace();
		const agentsHarnessRoot = join(workspaceRoot, ".agents", "harness");

		try {
			mkdirSync(join(workspaceRoot, "beta"), { recursive: true });
			writeFile(
				join(agentsHarnessRoot, "config", "agent-harness.yaml"),
				[
					"version: 3",
					"active_projects:",
					"  - alpha",
					"openspec:",
					"  mode: project",
					"  project_id: alpha",
					"",
				].join("\n")
			);
			writeFile(
				join(agentsHarnessRoot, "projects", "alpha.yaml"),
				["id: alpha", "repos:", "  - id: extension", "    root: .", ""].join(
					"\n"
				)
			);
			writeFile(
				join(agentsHarnessRoot, "projects", "beta.yaml"),
				[
					"id: beta",
					"openspec_root: beta",
					"repos:",
					"  - id: extension",
					"    root: beta",
					"    default_checks:",
					"      - npm run test",
					"",
				].join("\n")
			);

			const snapshot = resolveFf15ProjectsContext({ workspaceRoot });

			expect(snapshot.status).toBe("ready");
			if (snapshot.status !== "ready") {
				throw new Error("Expected ready projects context snapshot.");
			}

			expect(snapshot.openspec.mode).toBe("project");
			expect(snapshot.openspec.path).toBeNull();
			expect(snapshot.profiles.map((profile) => profile.id)).toEqual([
				"alpha",
				"beta",
			]);
			expect(snapshot.profiles[0]?.warnings).toEqual([
				expect.stringContaining("openspec_root"),
				expect.stringContaining("default_checks"),
			]);
			expect(snapshot.profiles[1]?.warnings).toEqual([]);
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("rejects unknown openspec.project_id during save without changing the file", () => {
		const workspaceRoot = createTmpWorkspace();
		const agentsHarnessRoot = join(workspaceRoot, ".agents", "harness");
		const configPath = join(agentsHarnessRoot, "config", "agent-harness.yaml");

		try {
			writeFile(
				configPath,
				[
					"version: 3",
					"active_projects:",
					"  - alpha",
					"openspec:",
					"  mode: project",
					"  project_id: alpha",
					"",
				].join("\n")
			);
			writeFile(
				join(agentsHarnessRoot, "projects", "alpha.yaml"),
				[
					"id: alpha",
					"openspec_root: .",
					"repos:",
					"  - id: extension",
					"    root: .",
					"",
				].join("\n")
			);

			const beforeSave = readFileSync(configPath, "utf8");

			expect(() =>
				saveFf15ProjectsContext({
					draft: {
						activeProjects: ["alpha"],
						openspec: {
							mode: "project",
							projectId: "missing-profile",
						},
					},
					workspaceRoot,
				})
			).toThrowError(MISSING_PROFILE_PATTERN);

			expect(readFileSync(configPath, "utf8")).toBe(beforeSave);
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
