import { describe, expect, it, vi } from "vitest";
import { resolveFf15ProjectRuntimeContext } from "./runtime-context";

describe("resolveFf15ProjectRuntimeContext", () => {
	it("uses the resolved Projects openspec path for project mode", () => {
		const runtimeContext = resolveFf15ProjectRuntimeContext({
			resolveProjectsContext: vi.fn().mockReturnValue({
				activeProjects: ["project-a"],
				configVersion: 3,
				error: null,
				openspec: {
					mode: "project",
					path: "C:/workspace/selected-project/openspec",
					sourceProjectId: "project-a",
				},
				profiles: [{ id: "project-a", warnings: [] }],
				sourceKind: "agents",
				sourcePath: "C:/workspace/.agents/harness",
				status: "ready",
			}),
			workspaceRoot: "C:/workspace",
		});

		expect(runtimeContext).toEqual(
			expect.objectContaining({
				activeProjects: ["project-a"],
				executionRoot: "C:/workspace",
				openspecRoot: "C:/workspace/selected-project/openspec",
			})
		);
	});

	it("uses the resolved Projects openspec path for harness mode", () => {
		const runtimeContext = resolveFf15ProjectRuntimeContext({
			resolveProjectsContext: vi.fn().mockReturnValue({
				activeProjects: ["default"],
				configVersion: 3,
				error: null,
				openspec: {
					mode: "harness",
					path: "C:/workspace/openspec",
					sourceProjectId: null,
				},
				profiles: [{ id: "default", warnings: [] }],
				sourceKind: "ff15",
				sourcePath: "C:/workspace/.ff15/harness",
				status: "ready",
			}),
			workspaceRoot: "C:/workspace",
		});

		expect(runtimeContext).toEqual(
			expect.objectContaining({
				activeProjects: ["default"],
				executionRoot: "C:/workspace",
				openspecRoot: "C:/workspace/openspec",
			})
		);
	});

	it("keeps execution root even when Projects context is in error", () => {
		const runtimeContext = resolveFf15ProjectRuntimeContext({
			resolveProjectsContext: vi.fn().mockReturnValue({
				activeProjects: [],
				configVersion: null,
				error: "Missing profile.",
				openspec: {
					mode: null,
					path: null,
					sourceProjectId: null,
				},
				profiles: [],
				sourceKind: null,
				sourcePath: null,
				status: "error",
			}),
			workspaceRoot: "C:/workspace",
		});

		expect(runtimeContext.executionRoot).toBe("C:/workspace");
		expect(runtimeContext.activeProjects).toEqual([]);
		expect(runtimeContext.openspecRoot).toBeNull();
		expect(runtimeContext.projectsSnapshot.status).toBe("error");
	});
});
