import type { ComponentType } from "react";
import type { WebviewPageId } from "@/types/webview-page-id";
import Ff15LaunchRoute from "./ff15-launch/route";
import Ff15SettingsRoute from "./ff15-settings/route";
import InteractiveViewRoute from "./interactive-view/route";
import SimpleViewRoute from "./simple-view/route";

const routeComponents: Record<WebviewPageId, ComponentType> = {
	"ff15-launch": Ff15LaunchRoute,
	"ff15-settings": Ff15SettingsRoute,
	interactive: InteractiveViewRoute,
	simple: SimpleViewRoute,
};

export const resolveRouteComponent = (
	page: string | undefined
): ComponentType | null => {
	if (!page) {
		return routeComponents.simple;
	}

	return routeComponents[page as WebviewPageId] ?? null;
};
