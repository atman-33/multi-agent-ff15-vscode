/**
 * FF15 design tokens for the OpenCode chat surface.
 *
 * The OpenCode chat is an external web app embedded via an iframe (see
 * `webview-proxy.ts`), so it cannot import the webview-ui design system
 * (`webview-ui/src/app/app.css`). These token values are duplicated here to
 * match `app.css` (`.ff15-screen`, lines 159-172) so the chat reskin stays in
 * sync with the rest of the FF15 views.
 */
export const FF15_TOKENS = {
	base: "#070a12",
	baseSoft: "#0b0f1a",
	layer02: "#0e1320",
	layer03: "#121829",
	layer04: "#161d31",
	panel: "rgba(10, 13, 20, 0.72)",
	panelStrong: "rgba(8, 10, 16, 0.86)",
	gold: "#e8c170",
	goldHover: "#f1d8a4",
	goldSoft: "rgba(232, 193, 112, 0.55)",
	goldFaint: "rgba(232, 193, 112, 0.12)",
	border: "rgba(232, 193, 112, 0.22)",
	borderStrong: "rgba(232, 193, 112, 0.32)",
	borderSoft: "rgba(224, 231, 255, 0.1)",
	cyan: "#7dd3fc",
	blue: "#8f9ce0",
	text: "rgba(231, 235, 248, 0.94)",
	textMuted: "rgba(206, 214, 236, 0.62)",
	textFaint: "rgba(206, 214, 236, 0.4)",
	fontFamily: "var(--vscode-font-family)",
} as const;

/**
 * Builds the `<style id="ff15-theme">` block injected into the OpenCode app's
 * HTML by the webview proxy.
 *
 * Strategy (variable-first, robust):
 *
 * 1. **Token layer** — OpenCode exposes its palette as `--v2-*` CSS custom
 *    properties (semantic tokens map to grey/blue scales per `data-color-scheme`).
 *    We override the *semantic* tokens at `:root` with `!important` so the FF15
 *    navy + gold palette wins regardless of the active scheme, without touching
 *    the raw palette scales other parts of the UI rely on. This is resilient to
 *    OpenCode markup changes because it does not depend on class names.
 *
 * 2. **Decorative layer** — a deliberately small set of selectors (gold
 *    scrollbars, a gold hairline on the prompt input) layered on top. Kept
 *    minimal so OpenCode updates are unlikely to break it.
 */
export function buildFf15InjectionStyle(): string {
	const t = FF15_TOKENS;
	return /*html*/ `
<style id="ff15-theme">
  /* === Token layer: remap OpenCode semantic tokens to the FF15 palette === */
  :root {
    color-scheme: dark !important;

    /* Backgrounds → near-black navy, layered surfaces lift slightly. */
    --v2-background-bg-deep: ${t.base} !important;
    --v2-background-bg-base: ${t.baseSoft} !important;
    --v2-background-bg-layer-01: ${t.baseSoft} !important;
    --v2-background-bg-layer-02: ${t.layer02} !important;
    --v2-background-bg-layer-03: ${t.layer03} !important;
    --v2-background-bg-layer-04: ${t.layer04} !important;
    --v2-background-bg-button-neutral: rgba(224, 231, 255, 0.06) !important;

    /* Accent → FF15 gold (primary buttons render gold with dark text). */
    --v2-background-bg-accent: ${t.gold} !important;

    /* Text → FF15 blue-white, accents/links → gold, on-accent text → navy. */
    --v2-text-text-base: ${t.text} !important;
    --v2-text-text-muted: ${t.textMuted} !important;
    --v2-text-text-faint: ${t.textFaint} !important;
    --v2-text-text-inverse: ${t.base} !important;
    --v2-text-text-accent: ${t.gold} !important;
    --v2-text-text-accent-hover: ${t.goldHover} !important;

    /* Icons mirror the text palette. */
    --v2-icon-icon-base: ${t.text} !important;
    --v2-icon-icon-muted: ${t.textMuted} !important;
    --v2-icon-icon-inverse: ${t.base} !important;
    --v2-icon-icon-accent: ${t.gold} !important;
    --v2-icon-icon-accent-hover: ${t.goldHover} !important;

    /* Borders → gold hairlines. */
    --v2-border-border-muted: ${t.borderSoft} !important;
    --v2-border-border-base: ${t.border} !important;
    --v2-border-border-strong: ${t.borderStrong} !important;
    --v2-border-border-focus: ${t.gold} !important;
  }

  /* The theme preload script sets an inline near-black bg on <html>; align it. */
  html {
    background-color: ${t.base} !important;
  }

  /* === Decorative layer: a few gold accents on top of the token remap === */
  *::-webkit-scrollbar-thumb {
    background: ${t.goldSoft} !important;
  }
  *::-webkit-scrollbar-thumb:hover {
    background: ${t.gold} !important;
  }
  ::selection {
    background: ${t.goldFaint};
    color: ${t.text};
  }

  /* Gold hairline along the top of the prompt input, echoing .ff15-panel. */
  [data-component="prompt-input"] {
    position: relative;
    border-top: 1px solid ${t.border} !important;
  }
  [data-component="prompt-input"]::before {
    content: "";
    position: absolute;
    inset: 0 1rem auto 1rem;
    top: 0;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      ${t.goldSoft} 22%,
      ${t.cyan} 50%,
      ${t.goldSoft} 78%,
      transparent
    );
    opacity: 0.7;
    pointer-events: none;
  }
</style>
`;
}
