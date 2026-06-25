import {
	cpSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	createEmptyFf15MissionWorkflowState,
	getWorkspaceMissionOutputFilePath,
	FF15_WORKSPACE_RUNTIME_DIR_NAME,
} from "../ff15-missions/state";
import {
	buildOperationAwarePrompt,
	buildWorkerOperationAwarePrompt,
	loadMissionOperationActivation,
	loadMissionOperationDefinition,
} from "./definition";

const MISSING_FILE_ERROR_PATTERN = /missing file/i;
const MISSING_OUTPUT_CONTRACT_ERROR_PATTERN =
	/does not declare output contract/i;
const MISSING_FACET_SKILL_ERROR_PATTERN =
	/Could not resolve facet_skill placeholder for "does-not-exist"/u;

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

const seedBundledPromptResolutionOperation = (
	workspaceRoot: string,
	options?: {
		operationFileName?: string;
		transformFacetFiles?: Array<{
			relativePath: string[];
			transform: (content: string) => string;
		}>;
		transformOperation?: (content: string) => string;
	}
) => {
	const runtimeRoot = join(workspaceRoot, FF15_WORKSPACE_RUNTIME_DIR_NAME);
	const operationsDir = join(runtimeRoot, "operations");
	const facetsDir = join(runtimeRoot, "facets");
	const repoRoot = process.cwd();
	const operationFileName =
		options?.operationFileName ?? "idea-to-prd-and-issues.yaml";
	const operationSourcePath = join(
		repoRoot,
		"src",
		"resources",
		"operations",
		operationFileName
	);
	const operationTargetPath = join(operationsDir, operationFileName);

	mkdirSync(operationsDir, { recursive: true });
	mkdirSync(facetsDir, { recursive: true });
	const operationContent = options?.transformOperation
		? options.transformOperation(readFileSync(operationSourcePath, "utf8"))
		: readFileSync(operationSourcePath, "utf8");
	writeFileSync(operationTargetPath, operationContent, "utf8");
	cpSync(join(repoRoot, "src", "resources", "facets"), facetsDir, {
		recursive: true,
	});

	for (const facetTransform of options?.transformFacetFiles ?? []) {
		const facetPath = join(facetsDir, ...facetTransform.relativePath);
		writeFileSync(
			facetPath,
			facetTransform.transform(readFileSync(facetPath, "utf8")),
			"utf8"
		);
	}
};

const createCompletedStepWorkflow = (
	fromStep: string,
	next: string,
	taskId: string
) => {
	const workflow = createEmptyFf15MissionWorkflowState();
	workflow.stepHistory = [
		{
			completedAt: "2026-05-29T00:00:00.000Z",
			fromAgent: "noctis",
			fromStep,
			handoffSummary: `${fromStep} completed.`,
			next,
			taskId,
		},
	];

	return workflow;
};

const writeMissionOutputFile = (input: {
	content: string;
	fileName: string;
	missionId: string;
	stepName: string;
	taskId: string;
	workspaceRoot: string;
}): string => {
	const outputPath = getWorkspaceMissionOutputFilePath({
		fileName: input.fileName,
		missionId: input.missionId,
		stepName: input.stepName,
		taskId: input.taskId,
		workspaceRoot: input.workspaceRoot,
	});
	mkdirSync(dirname(outputPath), { recursive: true });
	writeFileSync(outputPath, input.content, "utf8");
	return outputPath;
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

	it("loads the bundled idea-to-openspec-dev spec step driven by facet skills", () => {
		const workspaceRoot = join(
			tmpdir(),
			`ff15-bundled-local-planning-${crypto.randomUUID()}`
		);

		try {
			seedBundledPromptResolutionOperation(workspaceRoot, {
				operationFileName: "idea-to-openspec-dev.yaml",
			});

			const definition = loadMissionOperationDefinition(
				workspaceRoot,
				"builtin:idea-to-openspec-dev"
			);
			const specStep =
				definition?.steps.find((step) => step.name === "spec") ?? null;

			expect(definition?.initialStep).toBe("spec");
			expect(specStep?.agent).toBe("noctis");
			expect(specStep?.instruction).toContain(
				"create and switch to a `feature/<change-name>` branch"
			);
			expect(specStep?.instruction).toContain(
				'{{ facet_skill("grill-with-docs") }}'
			);
			expect(specStep?.instruction).toContain(
				'{{ facet_skill("openspec-propose") }}'
			);
			expect(specStep?.skills).toEqual([]);
			expect(specStep?.rules).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ next: "implement" }),
					expect.objectContaining({ next: "cancelled" }),
				])
			);
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
				activeProjects: ["frontend", "backend"],
				missionId: "mission-1",
				openspecRoot: join(workspaceRoot, "selected-project", "openspec"),
				prompt: "Draft the first response",
				workspaceRoot,
			});

			expect(prompt).toContain("<operation-prompt>");
			expect(prompt).toContain("<workspace-context>");
			expect(prompt).toContain(`execution_root: ${workspaceRoot}`);
			expect(prompt).toContain("<tooling-context>");
			expect(prompt).toContain("active_projects:\n  - frontend\n  - backend");
			expect(prompt).toContain(
				`openspec_root: ${join(workspaceRoot, "selected-project", "openspec")}`
			);
			expect(prompt).not.toContain("activate_project:");
			expect(prompt).not.toContain("project_root:");
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
			expect(prompt).toContain(
				getWorkspaceMissionOutputFilePath({
					fileName: "spec-plan.md",
					missionId: "mission-1",
					stepName: "spec-planning",
					taskId: "task-spec-planning",
					workspaceRoot,
				})
			);
			expect(prompt).toContain("Include the accepted plan.");
			expect(prompt).toContain("<step-completion-contract>");
			expect(prompt).toContain(
				join(
					workspaceRoot,
					FF15_WORKSPACE_RUNTIME_DIR_NAME,
					"bridge",
					"submit-report.py"
				)
			);
			expect(prompt).toContain("task-spec-planning");
			expect(prompt).toContain('<user-request from="user" to="noctis">');
			expect(prompt).toContain("Draft the first response");
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("uses a resolved openspec root in tooling context when provided", () => {
		const workspaceRoot = join(
			tmpdir(),
			`ff15-openspec-root-${crypto.randomUUID()}`
		);
		const openspecRoot = join(workspaceRoot, "selected-project", "openspec");

		try {
			seedRichOperationBundle(workspaceRoot);
			const activation = loadMissionOperationActivation(
				workspaceRoot,
				"builtin:github-issue-openspec-dev"
			);
			expect(activation).not.toBeNull();

			const prompt = buildOperationAwarePrompt({
				activation: activation!,
				activeProjects: ["frontend", "backend"],
				missionId: "mission-1",
				openspecRoot,
				prompt: "Use the resolved OpenSpec root",
				workspaceRoot,
			});

			expect(prompt).toContain(`execution_root: ${workspaceRoot}`);
			expect(prompt).toContain("active_projects:\n  - frontend\n  - backend");
			expect(prompt).toContain(`openspec_root: ${openspecRoot}`);
			expect(prompt).not.toContain(`openspec_root: ${workspaceRoot}\n`);
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("uses a distinct task id and output directory for repeated attempts of the same step", () => {
		const workspaceRoot = join(
			tmpdir(),
			`ff15-prompt-retry-${crypto.randomUUID()}`
		);

		try {
			seedRichOperationBundle(workspaceRoot);
			const activation = loadMissionOperationActivation(
				workspaceRoot,
				"builtin:github-issue-openspec-dev"
			);
			expect(activation).not.toBeNull();

			const workflow = createCompletedStepWorkflow(
				"spec-planning",
				"implement",
				"task-spec-planning"
			);
			const prompt = buildOperationAwarePrompt({
				activation: activation!,
				missionId: "mission-1",
				prompt: "Retry spec planning",
				workflow,
				workspaceRoot,
			});

			const expectedSecondAttemptOutputPath = getWorkspaceMissionOutputFilePath(
				{
					fileName: "spec-plan.md",
					missionId: "mission-1",
					stepName: "spec-planning",
					taskId: "task-spec-planning-2",
					workspaceRoot,
				}
			);

			expect(prompt).toContain(expectedSecondAttemptOutputPath);
			expect(prompt).toContain("task-spec-planning-2");
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("resolves bundled output and language placeholders before XML prompt delivery", () => {
		const workspaceRoot = join(
			tmpdir(),
			`ff15-bundled-resolution-${crypto.randomUUID()}`
		);

		try {
			seedBundledPromptResolutionOperation(workspaceRoot);
			const expectedOutputPath = writeMissionOutputFile({
				content: "# Requirements Brief\n",
				fileName: "requirements-brief.md",
				missionId: "mission-1",
				stepName: "clarify-requirements",
				taskId: "task-clarify-requirements",
				workspaceRoot,
			});

			const activation = loadMissionOperationActivation(
				workspaceRoot,
				"builtin:idea-to-prd-and-issues",
				"draft-prd"
			);
			expect(activation).not.toBeNull();

			const prompt = buildOperationAwarePrompt({
				activation: activation!,
				missionId: "mission-1",
				prompt: "Continue the workflow",
				settings: {
					languageName: "japanese",
				},
				workflow: createCompletedStepWorkflow(
					"clarify-requirements",
					"draft-prd",
					"task-clarify-requirements"
				),
				workspaceRoot,
			});

			expect(prompt).toContain(expectedOutputPath);
			expect(prompt).not.toContain(
				'{{ output("clarify-requirements", "latest", "requirements-brief.md") }}'
			);
			expect(prompt).not.toContain('{{ setting("language", "name") }}');
			expect(prompt).toContain("japanese");
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("fails bundled prompt delivery when a declared output artifact is missing", () => {
		const workspaceRoot = join(
			tmpdir(),
			`ff15-bundled-missing-output-${crypto.randomUUID()}`
		);

		try {
			seedBundledPromptResolutionOperation(workspaceRoot);

			const activation = loadMissionOperationActivation(
				workspaceRoot,
				"builtin:idea-to-prd-and-issues",
				"draft-prd"
			);
			expect(activation).not.toBeNull();

			expect(() =>
				buildOperationAwarePrompt({
					activation: activation!,
					missionId: "mission-1",
					prompt: "Continue the workflow",
					workflow: createCompletedStepWorkflow(
						"clarify-requirements",
						"draft-prd",
						"task-clarify-requirements"
					),
					workspaceRoot,
				})
			).toThrow(MISSING_FILE_ERROR_PATTERN);
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("fails bundled prompt delivery when an output placeholder references an undeclared contract", () => {
		const workspaceRoot = join(
			tmpdir(),
			`ff15-bundled-missing-contract-${crypto.randomUUID()}`
		);

		try {
			seedBundledPromptResolutionOperation(workspaceRoot, {
				transformOperation: (content) =>
					content.replace(
						'{{ output("clarify-requirements", "latest", "requirements-brief.md") }}',
						'{{ output("clarify-requirements", "latest", "missing-output.md") }}'
					),
			});
			writeMissionOutputFile({
				content: "# Missing Output\n",
				fileName: "missing-output.md",
				missionId: "mission-1",
				stepName: "clarify-requirements",
				taskId: "task-clarify-requirements",
				workspaceRoot,
			});

			const activation = loadMissionOperationActivation(
				workspaceRoot,
				"builtin:idea-to-prd-and-issues",
				"draft-prd"
			);
			expect(activation).not.toBeNull();

			expect(() =>
				buildOperationAwarePrompt({
					activation: activation!,
					missionId: "mission-1",
					prompt: "Continue the workflow",
					workflow: createCompletedStepWorkflow(
						"clarify-requirements",
						"draft-prd",
						"task-clarify-requirements"
					),
					workspaceRoot,
				})
			).toThrow(MISSING_OUTPUT_CONTRACT_ERROR_PATTERN);
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("resolves workspace-root placeholders before XML prompt delivery", () => {
		const workspaceRoot = join(
			tmpdir(),
			`ff15-bundled-root-${crypto.randomUUID()}`
		);

		try {
			seedBundledPromptResolutionOperation(workspaceRoot, {
				transformOperation: (content) =>
					content.replace(
						"2. In this step, draft `prd-draft.md` only; do not publish or update the GitHub issue yet.",
						'2. Confirm the execution root at `{{ root("execution_root") }}`. In this step, draft `prd-draft.md` only; do not publish or update the GitHub issue yet.'
					),
			});
			writeMissionOutputFile({
				content: "# Requirements Brief\n",
				fileName: "requirements-brief.md",
				missionId: "mission-1",
				stepName: "clarify-requirements",
				taskId: "task-clarify-requirements",
				workspaceRoot,
			});

			const activation = loadMissionOperationActivation(
				workspaceRoot,
				"builtin:idea-to-prd-and-issues",
				"draft-prd"
			);
			expect(activation).not.toBeNull();

			const prompt = buildOperationAwarePrompt({
				activation: activation!,
				missionId: "mission-1",
				prompt: "Continue the workflow",
				workflow: createCompletedStepWorkflow(
					"clarify-requirements",
					"draft-prd",
					"task-clarify-requirements"
				),
				workspaceRoot,
			});

			expect(prompt).toContain(workspaceRoot);
			expect(prompt).not.toContain('{{ root("execution_root") }}');
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("resolves facet_skill placeholders to the workspace skill path before XML prompt delivery", () => {
		const workspaceRoot = join(
			tmpdir(),
			`ff15-bundled-facet-skill-${crypto.randomUUID()}`
		);

		try {
			seedBundledPromptResolutionOperation(workspaceRoot, {
				transformOperation: (content) =>
					content.replace(
						"In this step draft `prd-draft.md` only; do not publish or update the GitHub issue yet.",
						'Read the handoff skill at `{{ facet_skill("handoff") }}`. In this step draft `prd-draft.md` only; do not publish or update the GitHub issue yet.'
					),
			});
			writeMissionOutputFile({
				content: "# Requirements Brief\n",
				fileName: "requirements-brief.md",
				missionId: "mission-1",
				stepName: "clarify-requirements",
				taskId: "task-clarify-requirements",
				workspaceRoot,
			});

			const activation = loadMissionOperationActivation(
				workspaceRoot,
				"builtin:idea-to-prd-and-issues",
				"draft-prd"
			);
			expect(activation).not.toBeNull();

			const prompt = buildOperationAwarePrompt({
				activation: activation!,
				missionId: "mission-1",
				prompt: "Continue the workflow",
				workflow: createCompletedStepWorkflow(
					"clarify-requirements",
					"draft-prd",
					"task-clarify-requirements"
				),
				workspaceRoot,
			});

			expect(prompt).toContain(
				join(
					workspaceRoot,
					FF15_WORKSPACE_RUNTIME_DIR_NAME,
					"facets",
					"skills",
					"handoff",
					"SKILL.md"
				)
			);
			expect(prompt).not.toContain('{{ facet_skill("handoff") }}');
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("fails facet_skill resolution when the referenced skill is missing", () => {
		const workspaceRoot = join(
			tmpdir(),
			`ff15-bundled-facet-skill-missing-${crypto.randomUUID()}`
		);

		try {
			seedBundledPromptResolutionOperation(workspaceRoot, {
				transformOperation: (content) =>
					content.replace(
						"In this step draft `prd-draft.md` only; do not publish or update the GitHub issue yet.",
						'Read the skill at `{{ facet_skill("does-not-exist") }}`. In this step draft `prd-draft.md` only; do not publish or update the GitHub issue yet.'
					),
			});
			writeMissionOutputFile({
				content: "# Requirements Brief\n",
				fileName: "requirements-brief.md",
				missionId: "mission-1",
				stepName: "clarify-requirements",
				taskId: "task-clarify-requirements",
				workspaceRoot,
			});

			const activation = loadMissionOperationActivation(
				workspaceRoot,
				"builtin:idea-to-prd-and-issues",
				"draft-prd"
			);
			expect(activation).not.toBeNull();

			expect(() =>
				buildOperationAwarePrompt({
					activation: activation!,
					missionId: "mission-1",
					prompt: "Continue the workflow",
					workflow: createCompletedStepWorkflow(
						"clarify-requirements",
						"draft-prd",
						"task-clarify-requirements"
					),
					workspaceRoot,
				})
			).toThrow(MISSING_FACET_SKILL_ERROR_PATTERN);
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});

	it("resolves bundled output placeholders in worker prompts", () => {
		const workspaceRoot = join(
			tmpdir(),
			`ff15-bundled-worker-resolution-${crypto.randomUUID()}`
		);

		try {
			seedBundledPromptResolutionOperation(workspaceRoot, {
				operationFileName: "github-issue-openspec-dev.yaml",
			});
			const expectedOutputPath = writeMissionOutputFile({
				content: "---\nchange_name: test-change\n---\n",
				fileName: "spec-plan.md",
				missionId: "mission-1",
				stepName: "spec",
				taskId: "task-spec",
				workspaceRoot,
			});

			const activation = loadMissionOperationActivation(
				workspaceRoot,
				"builtin:github-issue-openspec-dev",
				"implement"
			);
			expect(activation).not.toBeNull();

			const prompt = buildWorkerOperationAwarePrompt({
				activation: activation!,
				activeProjects: ["frontend", "backend"],
				handoff: null,
				missionId: "mission-1",
				openspecRoot: join(workspaceRoot, "selected-project", "openspec"),
				workflow: createCompletedStepWorkflow("spec", "implement", "task-spec"),
				workspaceRoot,
			});

			expect(prompt).toContain(expectedOutputPath);
			expect(prompt).toContain(`execution_root: ${workspaceRoot}`);
			expect(prompt).toContain("active_projects:\n  - frontend\n  - backend");
			expect(prompt).toContain(
				`openspec_root: ${join(workspaceRoot, "selected-project", "openspec")}`
			);
			expect(prompt).not.toContain(
				'{{ output("spec", "latest", "spec-plan.md") }}'
			);
		} finally {
			rmSync(workspaceRoot, { force: true, recursive: true });
		}
	});
});
