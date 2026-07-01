export const FF15_VIEW_CONTAINER_ID = "multi-agent-ff15-vscode";
export const FF15_LAUNCH_VIEW_ID = `${FF15_VIEW_CONTAINER_ID}.launchView`;
export const FF15_MISSIONS_VIEW_ID = `${FF15_VIEW_CONTAINER_ID}.missionsView`;
export const FF15_PROJECTS_VIEW_ID = `${FF15_VIEW_CONTAINER_ID}.projectsView`;
export const FF15_SETTINGS_VIEW_ID = `${FF15_VIEW_CONTAINER_ID}.settingsView`;
export const FF15_OPEN_SETTINGS_COMMAND_ID = `${FF15_VIEW_CONTAINER_ID}.openSettings`;
export const FF15_INITIALIZE_WORKSPACE_COMMAND_ID = `${FF15_VIEW_CONTAINER_ID}.initializeWorkspace`;
export const FF15_PROJECTS_RELOAD_COMMAND_ID = `${FF15_VIEW_CONTAINER_ID}.reloadProjectsConfig`;

// View container ids must contain only alphanumeric characters, '_' and '-'
// (no dots), otherwise VSCode rejects the whole viewsContainers contribution.
export const OPENCODE_VIEW_CONTAINER_ID =
	"multi-agent-ff15-vscode-openCodeSidebar";
// View ids may contain dots; keep the chat view id stable so the
// `<viewId>.focus` command and existing references remain unchanged.
export const OPENCODE_CHAT_VIEW_ID =
	"multi-agent-ff15-vscode.openCodeSidebar.chatView";

const OPENCODE_COMMAND_PREFIX = "multi-agent-ff15-vscode.openCode";
export const OPENCODE_ADD_TO_CHAT_COMMAND_ID = `${OPENCODE_COMMAND_PREFIX}.addToChat`;
export const OPENCODE_TOGGLE_CHAT_VIEW_COMMAND_ID = `${OPENCODE_COMMAND_PREFIX}.toggleChatView`;
export const OPENCODE_RESTART_COMMAND_ID = `${OPENCODE_COMMAND_PREFIX}.restart`;
export const OPENCODE_ADD_SELECTION_TO_CHAT_COMMAND_ID = `${OPENCODE_COMMAND_PREFIX}.addSelectionToChat`;
