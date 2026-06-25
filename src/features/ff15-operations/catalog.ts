import {
	cpSync,
	copyFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { FF15_AGENT_IDS } from "../ff15-launch/launch-client";
import { FF15_WORKSPACE_RUNTIME_DIR_NAME } from "../ff15-missions/state";
import type { Ff15MissionWorkbenchCatalog } from "../ff15-missions/workbench-controller";

export const FF15_WORKSPACE_OPERATIONS_DIR_NAME = "operations";
export const FF15_MANAGED_OPERATIONS_MANIFEST_FILE_NAME =
	".ff15-managed-operations.json";

export interface Ff15BundledOperationDefinition {
	fileName: string;
	name: string;
	requiredAgents: string[];
	ref: string;
}

interface LoadBundledOperationsCatalogOptions {
	bundledOperations?: readonly Ff15BundledOperationDefinition[];
	extensionRoot: string;
	supportedAgentIds?: readonly string[];
	workspaceRoot: string | null;
}

interface ManagedOperationsManifest {
	managedFiles: string[];
}

export const FF15_BUNDLED_OPERATION_DEFINITIONS = [
	{
		fileName: "github-issue-to-openspec-dev.yaml",
		name: "github-issue-to-openspec-dev",
		requiredAgents: ["noctis", "gladiolus", "ignis", "prompto"],
		ref: "builtin:github-issue-to-openspec-dev",
	},
	{
		fileName: "idea-to-openspec-dev.yaml",
		name: "idea-to-openspec-dev",
		requiredAgents: ["noctis", "gladiolus", "ignis", "prompto"],
		ref: "builtin:idea-to-openspec-dev",
	},
	{
		fileName: "idea-to-prd-and-issues.yaml",
		name: "idea-to-prd-and-issues",
		requiredAgents: ["noctis"],
		ref: "builtin:idea-to-prd-and-issues",
	},
	{
		fileName: "shiritori-smoke-test.yaml",
		name: "shiritori-smoke-test",
		requiredAgents: ["noctis", "ignis", "gladiolus", "prompto"],
		ref: "builtin:shiritori-smoke-test",
	},
] as const satisfies readonly Ff15BundledOperationDefinition[];

const getPackagedOperationsDir = (extensionRoot: string) =>
	join(extensionRoot, "src", "resources", "operations");

const getPackagedFacetsDir = (extensionRoot: string) =>
	join(extensionRoot, "src", "resources", "facets");

const getWorkspaceOperationsDir = (workspaceRoot: string) =>
	join(
		workspaceRoot,
		FF15_WORKSPACE_RUNTIME_DIR_NAME,
		FF15_WORKSPACE_OPERATIONS_DIR_NAME
	);

const getWorkspaceFacetsDir = (workspaceRoot: string) =>
	join(workspaceRoot, FF15_WORKSPACE_RUNTIME_DIR_NAME, "facets");

const getManagedOperationsManifestPath = (workspaceRoot: string) =>
	join(
		getWorkspaceOperationsDir(workspaceRoot),
		FF15_MANAGED_OPERATIONS_MANIFEST_FILE_NAME
	);

const readManagedOperationsManifest = (
	workspaceRoot: string
): ManagedOperationsManifest => {
	const manifestPath = getManagedOperationsManifestPath(workspaceRoot);
	if (!existsSync(manifestPath)) {
		return { managedFiles: [] };
	}

	try {
		const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as {
			managedFiles?: unknown;
		};

		return {
			managedFiles: Array.isArray(parsed.managedFiles)
				? parsed.managedFiles.filter(
						(fileName): fileName is string => typeof fileName === "string"
					)
				: [],
		};
	} catch {
		return { managedFiles: [] };
	}
};

const writeManagedOperationsManifest = (
	workspaceRoot: string,
	manifest: ManagedOperationsManifest
) => {
	writeFileSync(
		getManagedOperationsManifestPath(workspaceRoot),
		`${JSON.stringify(manifest, null, 2)}\n`,
		"utf8"
	);
};

const materializeBundledOperations = (
	workspaceRoot: string,
	extensionRoot: string,
	bundledOperations: readonly Ff15BundledOperationDefinition[]
) => {
	const operationsDir = getWorkspaceOperationsDir(workspaceRoot);
	mkdirSync(operationsDir, { recursive: true });

	for (const operation of bundledOperations) {
		copyFileSync(
			join(getPackagedOperationsDir(extensionRoot), operation.fileName),
			join(operationsDir, operation.fileName)
		);
	}

	const nextManagedFiles = bundledOperations.map(
		(operation) => operation.fileName
	);
	const previousManifest = readManagedOperationsManifest(workspaceRoot);

	for (const fileName of previousManifest.managedFiles) {
		if (nextManagedFiles.includes(fileName)) {
			continue;
		}

		rmSync(join(operationsDir, fileName), {
			force: true,
			recursive: true,
		});
	}

	writeManagedOperationsManifest(workspaceRoot, {
		managedFiles: nextManagedFiles,
	});
};

const materializeBundledFacets = (
	workspaceRoot: string,
	extensionRoot: string
) => {
	const packagedFacetsDir = getPackagedFacetsDir(extensionRoot);
	if (!existsSync(packagedFacetsDir)) {
		return;
	}

	mkdirSync(getWorkspaceFacetsDir(workspaceRoot), { recursive: true });
	cpSync(packagedFacetsDir, getWorkspaceFacetsDir(workspaceRoot), {
		force: true,
		recursive: true,
	});
};

const classifyBundledOperation = (
	operation: Ff15BundledOperationDefinition,
	supportedAgentIds: readonly string[]
) => {
	const unsupportedAgents = operation.requiredAgents.filter(
		(agentId) => !supportedAgentIds.includes(agentId)
	);
	const supported = unsupportedAgents.length === 0;

	return {
		fileName: operation.fileName,
		name: operation.name,
		ref: operation.ref,
		supported,
		unavailableReason: supported
			? null
			: `Requires unsupported agents: ${unsupportedAgents.join(", ")}`,
	};
};

export const loadBundledOperationsCatalog = ({
	bundledOperations = FF15_BUNDLED_OPERATION_DEFINITIONS,
	extensionRoot,
	supportedAgentIds = FF15_AGENT_IDS,
	workspaceRoot,
}: LoadBundledOperationsCatalogOptions): Ff15MissionWorkbenchCatalog => {
	if (!workspaceRoot) {
		return {
			supported: [],
			unsupported: [],
		};
	}

	materializeBundledOperations(workspaceRoot, extensionRoot, bundledOperations);
	materializeBundledFacets(workspaceRoot, extensionRoot);
	const classifiedOperations = bundledOperations.map((operation) =>
		classifyBundledOperation(operation, supportedAgentIds)
	);

	return {
		supported: classifiedOperations.filter((operation) => operation.supported),
		unsupported: classifiedOperations.filter(
			(operation) => !operation.supported
		),
	};
};
