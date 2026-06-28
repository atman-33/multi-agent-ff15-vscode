import {
	resolveFf15ProjectsContext,
	type Ff15ProjectsContextSnapshot,
} from "./context-resolver";

export interface Ff15ProjectRuntimeContext {
	activeProjects: string[];
	executionRoot: string;
	languageName: "en" | "ja";
	openspecRoot: string | null;
	projectsSnapshot: Ff15ProjectsContextSnapshot;
}

export const resolveFf15ProjectRuntimeContext = (input: {
	resolveProjectsContext?: (input: {
		workspaceRoot: string;
	}) => Ff15ProjectsContextSnapshot;
	workspaceRoot: string;
}): Ff15ProjectRuntimeContext => {
	const projectsSnapshot =
		input.resolveProjectsContext?.({ workspaceRoot: input.workspaceRoot }) ??
		resolveFf15ProjectsContext({ workspaceRoot: input.workspaceRoot });

	return {
		activeProjects: projectsSnapshot.activeProjects,
		executionRoot: input.workspaceRoot,
		languageName:
			projectsSnapshot.status === "ready"
				? projectsSnapshot.languageName
				: "en",
		openspecRoot:
			projectsSnapshot.status === "ready"
				? projectsSnapshot.openspec.path
				: null,
		projectsSnapshot,
	};
};
