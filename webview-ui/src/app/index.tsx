import { createRoot } from "react-dom/client";
import { DEFAULT_WEBVIEW_PAGE_ID } from "@/constants/page-ids";
import { resolveRouteComponent } from "@/routes";
import "./app.css";

export const renderWebviewApp = () => {
	const container = document.getElementById("root");
	if (!container) {
		throw new Error("Missing root container for webview app.");
	}

	const root = createRoot(container);
	const page = container.dataset.page ?? DEFAULT_WEBVIEW_PAGE_ID;
	const RouteComponent = resolveRouteComponent(page);

	if (!RouteComponent) {
		root.render(<div style={{ padding: 12 }}>Unknown page: {page}</div>);
		return;
	}

	root.render(<RouteComponent />);
};
