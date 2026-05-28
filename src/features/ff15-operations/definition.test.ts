import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FF15_WORKSPACE_RUNTIME_DIR_NAME } from "../ff15-missions/state";
import {
	buildOperationAwarePrompt,
	loadMissionOperationActivation,
	loadMissionOperationDefinition,
} from "./definition";

const seedRichOperationBundle = (workspaceRoot: string) => {
	const runtimeRoot = join(workspaceRoot, FF15_WORKSPACE_RUNTIME_DIR_NAME);
	const operationsDir = join(runtimeRoot, "operations");
	const facetsDir = join(runtimeRoot, "facets");
	mkdirSync(join(facetsDir, "jobs"), { recursive: true });
	mkdirSync(join(facetsDir, "policies"), { recursive: true });
	mkdirSync(join(facetsDir, "output-contracts"), { recursive: true });
	mkdirSync(join(facetsDir, "skills", "agent-relationships"), {
		recursive: true,
	});
	mkdirSync(operationsDir, { recursive: true });

	writeFileSync(
		join(facetsDir, "jobs", "planner.md"),
		"Plan the current issue into a spec-ready brief.\n",
		"utf8"
	);
	writeFileSync(
		join(facetsDir, "jobs", "implementer.md"),
		"Implement the approved change.\n",
		"utf8"
	);
	writeFileSync(
		join(facetsDir, "policies", "coding-standards.md"),
		"Follow repository coding standards.\n",
		"utf8"
	);
	writeFileSync(
		join(facetsDir, "output-contracts", "spec-plan.md"),
		"## Format\n\n- Include the accepted plan.\n",
		"utf8"
	);
	writeFileSync(
		join(facetsDir, "skills", "agent-relationships", "SKILL.md"),
		[
			"---",
			"name: agent-relationships",
			"description: Coordinate with the FF15 roster safely.",
			"---",
			"",
			"# Agent Relationships",
		].join("\n"),
		"utf8"
	);
	writeFileSync(
		join(operationsDir, "github-issue-openspec-dev.yaml"),
		[
			"name: github-issue-openspec-dev",
			"description: >",
			"  Drive spec planning for an incoming GitHub issue.",
			"initial_step: spec-planning",
			"",
			"steps:",
			"  - name: spec-planning",
			"    agent: noctis",
			"    job:",
			"      file: ../facets/jobs/planner.md",
			"    instruction:",
			"      inline: |",
			"        Draft the spec plan and prepare the handoff.",
			"    skills:",
			"      - file: ../facets/skills/agent-relationships/SKILL.md",
			"    policies:",
			"      - file: ../facets/policies/coding-standards.md",
			"    output_contracts:",
			"      report:",
			"        - name: spec-plan.md",
			"          format:",
			"            file: ../facets/output-contracts/spec-plan.md",
			"    rules:",
			"      - condition: Spec plan is ready for implementation",
			"        next: implement",
			"  - name: implement",
			"    agent: gladiolus",
			"    job:",
			"      file: ../facets/jobs/implementer.md",
			"    rules:",
			"      - condition: Implementation is complete",
			"        next: COMPLETE",
		].join("\n"),
		"utf8"
	);
};

describe("ff15 operation definition", () => {
	it("loads rich active-step content from workspace-local operation assets", () => {
		const workspaceRoot = join(
			tmpdir(),
			`ff15-definition-${crypto.randomUUID()}`
		);

		try {
			seedRichOperationBundle(workspaceRoot);

			const definition = loadMissionOperationDefinition(
				workspaceRoot,
				"builtin:github-issue-openspec-dev"
			);

			expect(definition).toEqual(
				expect.objectContaining({
					initialStep: "spec-planning",
					name: "github-issue-openspec-dev",
				})
			);
			expect(definition?.steps[0]).toEqual(
				expect.objectContaining({
					agent: "noctis",
					instruction: "Draft the spec plan and prepare the handoff.",
					job: "Plan the current issue into a spec-ready brief.",
					name: "spec-planning",
					policies: ["Follow repository coding standards."],
					rules: [
						expect.objectContaining({
							condition: "Spec plan is ready for implementation",
							next: "implement",
						}),
					],
				})
			);
			expect(definition?.steps[0]?.skills).toEqual([
				join(
					workspaceRoot,
					FF15_WORKSPACE_RUNTIME_DIR_NAME,
					"facets",
					"skills",
					"agent-relationships",
					"SKILL.md"
				),
			]);
			expect(definition?.steps[0]?.outputContracts).toEqual([
				expect.objectContaining({
					format: "## Format\n\n- Include the accepted plan.",
					name: "spec-plan.md",
				}),
			]);
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("builds an XML operation prompt for the active Noctis step", () => {
		const workspaceRoot = join(tmpdir(), `ff15-prompt-${crypto.randomUUID()}`);

		try {
			seedRichOperationBundle(workspaceRoot);
			const activation = loadMissionOperationActivation(
				workspaceRoot,
				"builtin:github-issue-openspec-dev"
			);
			expect(activation).not.toBeNull();

			const prompt = buildOperationAwarePrompt({
				activation: activation!,
				missionId: "mission-1",
				prompt: "Draft the first response",
				workspaceRoot,
			});

			expect(prompt).toContain("<operation-prompt>");
			expect(prompt).toContain("<workspace-context>");
			expect(prompt).toContain(`project_root: ${workspaceRoot}`);
			expect(prompt).toContain("<tooling-context>");
			expect(prompt).toContain(`activate_project: ${workspaceRoot}`);
			expect(prompt).toContain(`openspec_root: ${workspaceRoot}`);
			expect(prompt).toContain("<workflow-context>");
			expect(prompt).toContain("operation: github-issue-openspec-dev");
			expect(prompt).toContain("step: spec-planning");
			expect(prompt).toContain("task: Spec Planning");
			expect(prompt).toContain("<job>");
			expect(prompt).toContain(
				"Plan the current issue into a spec-ready brief."
			);
			expect(prompt).toContain("<reference-files>");
			expect(prompt).toContain("agent-relationships");
			expect(prompt).toContain("<instruction>");
			expect(prompt).toContain("Draft the spec plan and prepare the handoff.");
			expect(prompt).toContain("<policy>");
			expect(prompt).toContain("Follow repository coding standards.");
			expect(prompt).toContain("<output-contract>");
			expect(prompt).toContain("Include the accepted plan.");
			expect(prompt).toContain("<step-completion-contract>");
			expect(prompt).toContain(
				join(
					workspaceRoot,
					FF15_WORKSPACE_RUNTIME_DIR_NAME,
					"bridge",
					"submit-report.ps1"
				)
			);
			expect(prompt).toContain("task-spec-planning");
			expect(prompt).toContain('<user-request from="user" to="noctis">');
			expect(prompt).toContain("Draft the first response");
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});
});
