import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	FF15_MANAGED_OPERATIONS_MANIFEST_FILE_NAME,
	FF15_WORKSPACE_OPERATIONS_DIR_NAME,
	loadBundledOperationsCatalog,
} from "./catalog";

describe("loadBundledOperationsCatalog", () => {
	it("materializes bundled operations into the workspace runtime and classifies supported versus unsupported entries", async () => {
		const extensionRoot = join(
			tmpdir(),
			`ff15-extension-${crypto.randomUUID()}`
		);
		const workspaceRoot = join(
			tmpdir(),
			`ff15-workspace-${crypto.randomUUID()}`
		);

		try {
			mkdirSync(join(extensionRoot, "src", "resources", "operations"), {
				recursive: true,
			});
			mkdirSync(join(extensionRoot, "src", "resources", "facets", "jobs"), {
				recursive: true,
			});
			mkdirSync(workspaceRoot, { recursive: true });
			writeFileSync(
				join(extensionRoot, "src", "resources", "operations", "supported.yaml"),
				"name: supported\n",
				"utf8"
			);
			writeFileSync(
				join(extensionRoot, "src", "resources", "facets", "jobs", "planner.md"),
				"Plan the current issue into a spec-ready brief.\n",
				"utf8"
			);
			writeFileSync(
				join(
					extensionRoot,
					"src",
					"resources",
					"operations",
					"unsupported.yaml"
				),
				"name: unsupported\n",
				"utf8"
			);

			const catalog = await loadBundledOperationsCatalog({
				bundledOperations: [
					{
						fileName: "supported.yaml",
						initialStepAgent: "noctis",
						name: "supported",
						requiredAgents: ["noctis"],
						ref: "builtin:supported",
					},
					{
						fileName: "unsupported.yaml",
						initialStepAgent: "noctis",
						name: "unsupported",
						requiredAgents: ["lunafreya"],
						ref: "builtin:unsupported",
					},
				],
				extensionRoot,
				supportedAgentIds: ["noctis", "ignis", "gladiolus", "prompto"],
				workspaceRoot,
			});

			expect(
				existsSync(join(workspaceRoot, ".ff15", "facets", "jobs", "planner.md"))
			).toBe(true);
			expect(
				readFileSync(
					join(workspaceRoot, ".ff15", "facets", "jobs", "planner.md"),
					"utf8"
				)
			).toBe("Plan the current issue into a spec-ready brief.\n");
			expect(
				existsSync(
					join(
						workspaceRoot,
						".ff15",
						FF15_WORKSPACE_OPERATIONS_DIR_NAME,
						"supported.yaml"
					)
				)
			).toBe(true);
			expect(
				existsSync(
					join(
						workspaceRoot,
						".ff15",
						FF15_WORKSPACE_OPERATIONS_DIR_NAME,
						"unsupported.yaml"
					)
				)
			).toBe(true);
			expect(catalog.supported).toEqual([
				expect.objectContaining({
					initialStepAgent: "noctis",
					name: "supported",
					ref: "builtin:supported",
					supported: true,
				}),
			]);
			expect(catalog.unsupported).toEqual([
				expect.objectContaining({
					name: "unsupported",
					ref: "builtin:unsupported",
					supported: false,
					unavailableReason: expect.stringContaining("lunafreya"),
				}),
			]);
			expect(
				JSON.parse(
					readFileSync(
						join(
							workspaceRoot,
							".ff15",
							FF15_WORKSPACE_OPERATIONS_DIR_NAME,
							FF15_MANAGED_OPERATIONS_MANIFEST_FILE_NAME
						),
						"utf8"
					)
				)
			).toEqual(
				expect.objectContaining({
					managedFiles: ["supported.yaml", "unsupported.yaml"],
				})
			);
		} finally {
			rmSync(extensionRoot, { force: true, recursive: true });
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("refreshes only managed operation files and preserves unrelated runtime state", async () => {
		const extensionRoot = join(
			tmpdir(),
			`ff15-extension-${crypto.randomUUID()}`
		);
		const workspaceRoot = join(
			tmpdir(),
			`ff15-workspace-${crypto.randomUUID()}`
		);
		const operationsDir = join(
			workspaceRoot,
			".ff15",
			FF15_WORKSPACE_OPERATIONS_DIR_NAME
		);

		try {
			mkdirSync(join(extensionRoot, "src", "resources", "operations"), {
				recursive: true,
			});
			mkdirSync(join(workspaceRoot, ".ff15", "missions", "mission-1"), {
				recursive: true,
			});
			mkdirSync(operationsDir, { recursive: true });
			writeFileSync(
				join(extensionRoot, "src", "resources", "operations", "new.yaml"),
				"name: new\n",
				"utf8"
			);
			writeFileSync(join(operationsDir, "old.yaml"), "name: old\n", "utf8");
			writeFileSync(
				join(operationsDir, "custom-user-file.yaml"),
				"name: custom\n",
				"utf8"
			);
			writeFileSync(
				join(workspaceRoot, ".ff15", "missions", "mission-1", "mission.json"),
				'{"id":"mission-1"}\n',
				"utf8"
			);
			writeFileSync(
				join(operationsDir, FF15_MANAGED_OPERATIONS_MANIFEST_FILE_NAME),
				JSON.stringify({ managedFiles: ["old.yaml"] }, null, 2),
				"utf8"
			);

			await loadBundledOperationsCatalog({
				bundledOperations: [
					{
						fileName: "new.yaml",
						initialStepAgent: "noctis",
						name: "new",
						requiredAgents: ["noctis"],
						ref: "builtin:new",
					},
				],
				extensionRoot,
				supportedAgentIds: ["noctis", "ignis", "gladiolus", "prompto"],
				workspaceRoot,
			});

			expect(existsSync(join(operationsDir, "old.yaml"))).toBe(false);
			expect(existsSync(join(operationsDir, "new.yaml"))).toBe(true);
			expect(existsSync(join(operationsDir, "custom-user-file.yaml"))).toBe(
				true
			);
			expect(
				existsSync(
					join(workspaceRoot, ".ff15", "missions", "mission-1", "mission.json")
				)
			).toBe(true);
		} finally {
			rmSync(extensionRoot, { force: true, recursive: true });
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});
});
