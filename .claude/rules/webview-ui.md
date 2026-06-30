---
paths:
  - "webview-ui/src/**"
---
# Webview UI Rules

- `webview-ui/src/app/components/ui/` contains shadcn/ui generated components — do not edit these manually; re-generate via shadcn CLI if updates are needed.
- State management flows through VS Code `postMessage` / `acquireVsCodeApi()` — do not introduce a global store.
- Tailwind v4 is in use; utility classes are defined in CSS via `@theme` — no `tailwind.config.js` exists.
