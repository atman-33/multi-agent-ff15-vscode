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

const createTmpWorkspace = () =>
	join(tmpdir(), `ff15-projects-context-${crypto.randomUUID()}`);

const writeFile = (filePath: string, content: string) => {
	mkdirSync(dirname(filePath), { recursive: true });
	writeFileSync(filePath, content, "utf8");
};

describe("resolveFf15ProjectsContext", () => {
	it("reads existing .ff15 and ignores .agents/harness", () => {
		const workspaceRoot = createTmpWorkspace();
		const legacyAgentsHarnessRoot = join(workspaceRoot, ".agents", "harness");
		const ff15Root = join(workspaceRoot, ".ff15");

		try {
			// .agents/harness must be ignored entirely.
			writeFile(
				join(legacyAgentsHarnessRoot, "config", "config.yaml"),
				[
					"active_projects:",
					"  - legacy",
					"openspec:",
					"  mode: project",
					"  project_id: legacy",
					"",
				].join("\n")
			);
			writeFile(
				join(legacyAgentsHarnessRoot, "projects", "legacy.yaml"),
				[
					"id: legacy",
					"openspec_root: .",
					"repos:",
					"  - id: extension",
					"    root: .",
					"",
				].join("\n")
			);

			writeFile(
				join(ff15Root, "config", "config.yaml"),
				[
					"active_projects:",
					"  - primary",
					"openspec:",
					"  mode: project",
					"  project_id: primary",
					"",
				].join("\n")
			);
			writeFile(
				join(ff15Root, "projects", "primary.yaml"),
				[
					"id: primary",
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

			expect(snapshot.sourceKind).toBe("ff15");
			expect(snapshot.sourcePath).toBe(ff15Root);
			expect(snapshot.bootstrapped).toBe(false);
			expect(snapshot.activeProjects).toEqual(["primary"]);
			expect(snapshot.languageName).toBe("en");
			expect(snapshot.openspec.path).toBe(join(workspaceRoot, "openspec"));
			expect(snapshot.openspec.sourceProjectId).toBe("primary");
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("supports v2 config while using a non-active openspec.project_id", () => {
		const workspaceRoot = createTmpWorkspace();
		const ff15Root = join(workspaceRoot, ".ff15");

		try {
			mkdirSync(join(workspaceRoot, "beta"), { recursive: true });
			writeFile(
				join(ff15Root, "config", "config.yaml"),
				[
					"active_projects:",
					"  - primary",
					"openspec:",
					"  mode: project",
					"  project_id: context-only",
					"",
				].join("\n")
			);
			writeFile(
				join(ff15Root, "projects", "context-only.yaml"),
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

			expect(snapshot.activeProjects).toEqual(["primary"]);
			expect(snapshot.languageName).toBe("en");
			expect(snapshot.openspec.sourceProjectId).toBe("context-only");
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("bootstraps .ff15 when config is missing", () => {
		const workspaceRoot = createTmpWorkspace();

		try {
			const snapshot = resolveFf15ProjectsContext({ workspaceRoot });

			expect(snapshot.status).toBe("ready");
			if (snapshot.status !== "ready") {
				throw new Error("Expected ready projects context snapshot.");
			}

			expect(snapshot.sourceKind).toBe("ff15");
			expect(snapshot.sourcePath).toBe(join(workspaceRoot, ".ff15"));
			expect(snapshot.activeProjects).toEqual(["default"]);
			expect(snapshot.languageName).toBe("en");
			expect(snapshot.openspec.path).toBe(join(workspaceRoot, "openspec"));
			expect(snapshot.openspec.sourceProjectId).toBe("default");
			expect(
				existsSync(join(workspaceRoot, ".ff15", "config", "config.yaml"))
			).toBe(true);
			expect(
				existsSync(join(workspaceRoot, ".ff15", "projects", "default.yaml"))
			).toBe(true);
			expect(
				existsSync(join(workspaceRoot, ".ff15", "projects", "_template.yaml"))
			).toBe(true);
			expect(
				readFileSync(
					join(workspaceRoot, ".ff15", "config", "config.yaml"),
					"utf8"
				)
			).toContain("language: en");
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("falls back to the working directory when openspec.project_id has no profile", () => {
		const workspaceRoot = createTmpWorkspace();
		const ff15Root = join(workspaceRoot, ".ff15");

		try {
			writeFile(
				join(ff15Root, "config", "config.yaml"),
				[
					"active_projects:",
					"  - primary",
					"openspec:",
					"  project_id: missing-profile",
					"",
				].join("\n")
			);

			const snapshot = resolveFf15ProjectsContext({ workspaceRoot });

			expect(snapshot.status).toBe("ready");
			if (snapshot.status !== "ready") {
				throw new Error("Expected ready projects context snapshot.");
			}

			expect(snapshot.openspec.path).toBe(join(workspaceRoot, "openspec"));
			expect(snapshot.openspec.sourceProjectId).toBeNull();
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("defaults language to en when config omits language", () => {
		const workspaceRoot = createTmpWorkspace();
		const ff15Root = join(workspaceRoot, ".ff15");

		try {
			writeFile(
				join(ff15Root, "config", "config.yaml"),
				[
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

			expect(snapshot.languageName).toBe("en");
			expect(snapshot.openspec.sourceProjectId).toBeNull();
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("normalizes saved active_projects while preserving yaml comments and key order", () => {
		const workspaceRoot = createTmpWorkspace();
		const ff15Root = join(workspaceRoot, ".ff15");
		const configPath = join(ff15Root, "config", "config.yaml");

		try {
			writeFile(
				configPath,
				[
					"# Project ids to include in the active session context.",
					"active_projects:",
					"  - beta",
					"",
					"language: en",
					"",
					"# OpenSpec source to use for the current session.",
					"openspec:",
					"  mode: project",
					"  project_id: source-project",
					"",
				].join("\n")
			);
			writeFile(
				join(ff15Root, "projects", "alpha.yaml"),
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
				join(ff15Root, "projects", "beta.yaml"),
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
				join(ff15Root, "projects", "source-project.yaml"),
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
					languageName: "en",
					openspec: {
						projectId: "beta",
					},
				},
				workspaceRoot,
			});

			expect(snapshot.status).toBe("ready");
			if (snapshot.status !== "ready") {
				throw new Error("Expected ready projects context snapshot.");
			}

			expect(snapshot.activeProjects).toEqual(["alpha", "beta"]);
			expect(snapshot.languageName).toBe("en");
			expect(snapshot.openspec.sourceProjectId).toBe("beta");

			const savedConfig = readFileSync(configPath, "utf8");
			expect(savedConfig).toContain(
				"# Project ids to include in the active session context."
			);
			expect(savedConfig).toContain(
				"# OpenSpec source to use for the current session."
			);
			expect(savedConfig.indexOf("active_projects:")).toBeLessThan(
				savedConfig.indexOf("language:")
			);
			expect(savedConfig.indexOf("language:")).toBeLessThan(
				savedConfig.indexOf("openspec:")
			);
			expect(savedConfig).toContain("  - alpha");
			expect(savedConfig).toContain("  - beta");
			expect(savedConfig).toContain("language: en");
			expect(savedConfig).toContain("  project_id: beta");
			// The legacy `mode` key is dropped on save.
			expect(savedConfig).not.toContain("mode:");
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("loads known profiles and keeps path/default-check issues as warnings", () => {
		const workspaceRoot = createTmpWorkspace();
		const ff15Root = join(workspaceRoot, ".ff15");

		try {
			mkdirSync(join(workspaceRoot, "beta"), { recursive: true });
			writeFile(
				join(ff15Root, "config", "config.yaml"),
				[
					"active_projects:",
					"  - alpha",
					"openspec:",
					"  mode: project",
					"  project_id: alpha",
					"",
				].join("\n")
			);
			writeFile(
				join(ff15Root, "projects", "alpha.yaml"),
				["id: alpha", "repos:", "  - id: extension", "    root: .", ""].join(
					"\n"
				)
			);
			writeFile(
				join(ff15Root, "projects", "beta.yaml"),
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

			expect(snapshot.openspec.sourceProjectId).toBe("alpha");
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

	it("drops openspec.project_id on save when it is not an active project", () => {
		const workspaceRoot = createTmpWorkspace();
		const ff15Root = join(workspaceRoot, ".ff15");
		const configPath = join(ff15Root, "config", "config.yaml");

		try {
			writeFile(
				configPath,
				[
					"active_projects:",
					"  - alpha",
					"openspec:",
					"  mode: project",
					"  project_id: alpha",
					"",
				].join("\n")
			);
			writeFile(
				join(ff15Root, "projects", "alpha.yaml"),
				[
					"id: alpha",
					"openspec_root: .",
					"repos:",
					"  - id: extension",
					"    root: .",
					"",
				].join("\n")
			);

			const snapshot = saveFf15ProjectsContext({
				draft: {
					activeProjects: ["alpha"],
					languageName: "en",
					openspec: {
						// Not part of activeProjects -> falls back to working directory.
						projectId: "beta",
					},
				},
				workspaceRoot,
			});

			expect(snapshot.status).toBe("ready");
			if (snapshot.status !== "ready") {
				throw new Error("Expected ready projects context snapshot.");
			}

			expect(snapshot.openspec.sourceProjectId).toBeNull();
			expect(snapshot.openspec.path).toBe(join(workspaceRoot, "openspec"));

			const savedConfig = readFileSync(configPath, "utf8");
			expect(savedConfig).not.toContain("project_id:");
			expect(savedConfig).not.toContain("mode:");
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("resolves harness mode from owner root and clears sourceProjectId", () => {
		const workspaceRoot = createTmpWorkspace();
		const ff15Root = join(workspaceRoot, ".ff15");

		try {
			writeFile(
				join(ff15Root, "config", "config.yaml"),
				[
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

			expect(snapshot.openspec.path).toBe(join(workspaceRoot, "openspec"));
			expect(snapshot.openspec.sourceProjectId).toBeNull();
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("returns an explicit error when .ff15 config is invalid", () => {
		const workspaceRoot = createTmpWorkspace();
		const ff15Root = join(workspaceRoot, ".ff15");

		try {
			writeFile(
				join(ff15Root, "config", "config.yaml"),
				"this-is-not-valid-yaml: ["
			);

			const snapshot = resolveFf15ProjectsContext({ workspaceRoot });

			expect(snapshot.status).toBe("error");
			if (snapshot.status !== "error") {
				throw new Error("Expected error projects context snapshot.");
			}

			expect(snapshot.sourceKind).toBe("ff15");
			expect(snapshot.sourcePath).toBe(ff15Root);
			expect(snapshot.error).toContain(".ff15");
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("sets bootstrapped true and creates defaults only when .ff15 is absent", () => {
		const workspaceRoot = createTmpWorkspace();

		try {
			const created = resolveFf15ProjectsContext({ workspaceRoot });
			expect(created.status).toBe("ready");
			expect(created.bootstrapped).toBe(true);

			// Second resolution finds the existing config and must not re-bootstrap.
			const reused = resolveFf15ProjectsContext({ workspaceRoot });
			expect(reused.status).toBe("ready");
			expect(reused.bootstrapped).toBe(false);
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("reads language ja from config", () => {
		const workspaceRoot = createTmpWorkspace();
		const ff15Root = join(workspaceRoot, ".ff15");

		try {
			writeFile(
				join(ff15Root, "config", "config.yaml"),
				[
					"active_projects:",
					"  - primary",
					"language: ja",
					"openspec:",
					"  mode: project",
					"  project_id: primary",
					"",
				].join("\n")
			);
			writeFile(
				join(ff15Root, "projects", "primary.yaml"),
				[
					"id: primary",
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

			expect(snapshot.languageName).toBe("ja");
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("saves language changes back to config", () => {
		const workspaceRoot = createTmpWorkspace();
		const ff15Root = join(workspaceRoot, ".ff15");
		const configPath = join(ff15Root, "config", "config.yaml");

		try {
			writeFile(
				configPath,
				[
					"active_projects:",
					"  - alpha",
					"language: en",
					"openspec:",
					"  mode: project",
					"  project_id: alpha",
					"",
				].join("\n")
			);
			writeFile(
				join(ff15Root, "projects", "alpha.yaml"),
				[
					"id: alpha",
					"openspec_root: .",
					"repos:",
					"  - id: extension",
					"    root: .",
					"",
				].join("\n")
			);

			const snapshot = saveFf15ProjectsContext({
				draft: {
					activeProjects: ["alpha"],
					languageName: "ja",
					openspec: {
						projectId: "alpha",
					},
				},
				workspaceRoot,
			});

			expect(snapshot.status).toBe("ready");
			if (snapshot.status !== "ready") {
				throw new Error("Expected ready projects context snapshot.");
			}

			expect(snapshot.languageName).toBe("ja");
			expect(readFileSync(configPath, "utf8")).toContain("language: ja");
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("rejects invalid language values", () => {
		const workspaceRoot = createTmpWorkspace();
		const ff15Root = join(workspaceRoot, ".ff15");

		try {
			writeFile(
				join(ff15Root, "config", "config.yaml"),
				[
					"active_projects:",
					"  - primary",
					"language: fr",
					"openspec:",
					"  mode: harness",
					"",
				].join("\n")
			);

			const snapshot = resolveFf15ProjectsContext({ workspaceRoot });

			expect(snapshot.status).toBe("error");
			if (snapshot.status !== "error") {
				throw new Error("Expected error projects context snapshot.");
			}

			expect(snapshot.error).toContain("language");
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});
});
