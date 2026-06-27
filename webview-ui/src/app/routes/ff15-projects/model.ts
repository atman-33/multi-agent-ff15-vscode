export interface ProjectProfile {
	id: string;
	warnings: string[];
}

export type ProjectsSnapshot =
	| {
			status: "ready";
			sourceKind: "ff15";
			sourcePath: string;
			configVersion: number | string | null;
			activeProjects: string[];
			profiles: ProjectProfile[];
			openspec: {
				mode: "project" | "harness";
				path: string | null;
				sourceProjectId: string | null;
			};
			error: null;
	  }
	| {
			status: "error";
			sourceKind: "ff15" | null;
			sourcePath: string | null;
			configVersion: null;
			activeProjects: string[];
			profiles: [];
			openspec: {
				mode: null;
				path: null;
				sourceProjectId: null;
			};
			error: string;
	  };

export interface ProjectsDraft {
	activeProjects: string[];
	openspec: {
		mode: "project" | "harness";
		projectId: string | null;
	};
}

export type SaveState = "conflict" | "error" | "idle" | "saved" | "saving";

export const EMPTY_SNAPSHOT: ProjectsSnapshot = {
	activeProjects: [],
	configVersion: null,
	error: "Waiting for Projects context...",
	openspec: {
		mode: null,
		path: null,
		sourceProjectId: null,
	},
	profiles: [],
	sourceKind: null,
	sourcePath: null,
	status: "error",
};

export const EMPTY_DRAFT: ProjectsDraft = {
	activeProjects: [],
	openspec: {
		mode: "project",
		projectId: null,
	},
};

export const formatSourceKind = (
	sourceKind: ProjectsSnapshot["sourceKind"]
) => {
	if (sourceKind === "ff15") {
		return ".ff15/harness";
	}

	return "-";
};

export const buildDraftFromSnapshot = (
	snapshot: ProjectsSnapshot,
	previousDraft: ProjectsDraft
): ProjectsDraft => {
	if (snapshot.status !== "ready") {
		return previousDraft;
	}

	return {
		activeProjects: snapshot.activeProjects,
		openspec: {
			mode: snapshot.openspec.mode,
			projectId:
				snapshot.openspec.mode === "project"
					? snapshot.openspec.sourceProjectId
					: previousDraft.openspec.projectId,
		},
	};
};

export const getSaveStateColor = (state: SaveState) => {
	switch (state) {
		case "error":
			return "text-[color:var(--vscode-errorForeground,#f87171)]";
		case "conflict":
			return "text-[color:var(--vscode-warningForeground,#fbbf24)]";
		case "saved":
			return "text-[color:var(--vscode-testing-iconPassed,#4ade80)]";
		case "saving":
			return "text-[color:var(--vscode-textLink-foreground,#60a5fa)]";
		default:
			return "text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.75))]";
	}
};
