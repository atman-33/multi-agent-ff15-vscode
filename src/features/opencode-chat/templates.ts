import { FF15_TOKENS } from "./ff15-theme";

// The OpenCode wrapper chrome (loading/error screens + the seam around the
// iframe) uses the FF15 palette so it matches the reskinned chat and the other
// FF15 views, rather than the plain VSCode editor theme.
export const FF15_THEME = {
	surface: FF15_TOKENS.base,
	foreground: FF15_TOKENS.text,
	fontFamily: FF15_TOKENS.fontFamily,
} as const;

export const OPENCODE_LOADING_TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      body {
        margin: 0;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
        background: ${FF15_THEME.surface};
        color: ${FF15_THEME.foreground};
        font-family: ${FF15_THEME.fontFamily};
        font-size: var(--vscode-font-size);
      }
      .container {
        text-align: center;
        padding: 20px;
      }
      .icon {
        width: 48px;
        height: 48px;
        margin: 0 auto 16px;
        color: ${FF15_TOKENS.gold};
        filter: drop-shadow(0 0 10px ${FF15_TOKENS.goldSoft});
        animation: pulse 2s infinite ease-in-out;
      }
      @keyframes pulse {
        0%,
        100% {
          opacity: 0.3;
        }
        50% {
          opacity: 1;
        }
      }
      p {
        margin: 0;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: ${FF15_TOKENS.gold};
        opacity: 0.85;
      }
      .dev-badge {
        position: fixed;
        bottom: 8px;
        right: 8px;
        background: #e74c3c;
        color: white;
        font-family: sans-serif;
        font-size: 10px;
        font-weight: bold;
        padding: 2px 6px;
        border-radius: 4px;
        z-index: 9999;
        pointer-events: none;
        display: {{DEV_MODE}};
      }
    </style>
  </head>
  <body>
    <div class="dev-badge">DEV</div>
    <div class="container">
      <svg
        class="icon"
        viewBox="96 96 320 320"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M320 224V352H192V224H320Z" fill="currentColor" opacity="0.6" />
        <path
          fill-rule="evenodd"
          clip-rule="evenodd"
          d="M384 416H128V96H384V416ZM320 160H192V352H320V160Z"
          fill="currentColor"
        />
      </svg>
      <p>Starting opencode server...</p>
    </div>
  </body>
</html>
`;

export const OPENCODE_IFRAME_TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; frame-src {{SERVER_ORIGIN}}; media-src {{SERVER_ORIGIN}} data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline';"
    />
    <style>
      body {
        margin: 0 auto;
        padding: 0;
        overflow: hidden;
        height: 100vh;
        width: 100vw;
        max-width: 640px;
        background: ${FF15_THEME.surface};
      }
      iframe {
        width: 100%;
        height: 100%;
        border: none;
      }
      .dev-badge {
        position: fixed;
        bottom: 8px;
        right: 8px;
        background: #e74c3c;
        color: white;
        font-family: sans-serif;
        font-size: 10px;
        font-weight: bold;
        padding: 2px 6px;
        border-radius: 4px;
        z-index: 9999;
        pointer-events: none;
        display: {{DEV_MODE}};
      }
    </style>
  </head>
  <body>
    <div class="dev-badge">DEV</div>
    <iframe
      src="{{SERVER_URL}}"
      allow="clipboard-read; clipboard-write; autoplay"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
    ></iframe>
    <script>
      (function () {
        var vscode = acquireVsCodeApi();
        var iframe = document.querySelector("iframe");

        window.addEventListener("message", function (e) {
          if (e.data && e.data.type === "copy-request") {
            vscode.postMessage({ type: "copy-request", text: e.data.text });
          }
          if (e.data && e.data.type === "play-audio") {
            vscode.postMessage({ type: "play-audio", src: e.data.src });
          }
          if (e.data && e.data.type === "open-external") {
            vscode.postMessage({ type: "open-external", url: e.data.url });
          }
        });

        window.addEventListener("message", function (e) {
          if (!e.data || e.data.type !== "paste-request") return;

          if (navigator.clipboard && navigator.clipboard.read) {
            navigator.clipboard
              .read()
              .then(function (items) {
                var imageFound = false;
                for (var i = 0; i < items.length; i++) {
                  var types = items[i].types;
                  for (var j = 0; j < types.length; j++) {
                    if (types[j].startsWith("image/")) {
                      imageFound = true;
                      (function (mime) {
                        items[i].getType(mime).then(function (blob) {
                          var reader = new FileReader();
                          reader.onload = function () {
                            iframe.contentWindow.postMessage(
                              {
                                type: "paste-response",
                                image: reader.result,
                                mimeType: mime,
                              },
                              "*"
                            );
                          };
                          reader.readAsDataURL(blob);
                        });
                      })(types[j]);
                      break;
                    }
                  }
                  if (imageFound) break;
                }
                if (!imageFound) {
                  vscode.postMessage({ type: "paste-request" });
                }
              })
              .catch(function () {
                vscode.postMessage({ type: "paste-request" });
              });
          } else {
            vscode.postMessage({ type: "paste-request" });
          }
        });

        window.addEventListener("message", function (e) {
          if (
            e.data &&
            (e.data.type === "paste-response" || e.data.type === "insert-text")
          ) {
            iframe.contentWindow.postMessage(e.data, "*");
          }
        });
      })();
    </script>
  </body>
</html>
`;

export const OPENCODE_ERROR_TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      body {
        margin: 0;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
        background: ${FF15_THEME.surface};
        color: ${FF15_THEME.foreground};
        font-family: ${FF15_THEME.fontFamily};
        font-size: var(--vscode-font-size);
      }
      .container {
        position: relative;
        text-align: center;
        max-width: 360px;
        margin: 16px;
        padding: 24px;
        border: 1px solid ${FF15_TOKENS.borderSoft};
        border-radius: 1rem;
        background: ${FF15_TOKENS.panel};
        backdrop-filter: blur(10px);
        box-shadow: 0 18px 48px -24px rgba(0, 0, 0, 0.9);
      }
      .container::before {
        content: "";
        position: absolute;
        inset: 0 1.25rem auto 1.25rem;
        top: 0;
        height: 1px;
        background: linear-gradient(
          90deg,
          transparent,
          ${FF15_TOKENS.goldSoft} 22%,
          ${FF15_TOKENS.cyan} 50%,
          ${FF15_TOKENS.goldSoft} 78%,
          transparent
        );
        opacity: 0.7;
      }
      .icon {
        font-size: 32px;
        margin-bottom: 12px;
        color: ${FF15_TOKENS.gold};
      }
      p {
        margin: 0 0 8px;
        color: ${FF15_TOKENS.textMuted};
      }
      code {
        font-family: var(--vscode-editor-font-family);
        color: ${FF15_TOKENS.gold};
        background: ${FF15_TOKENS.goldFaint};
        padding: 2px 6px;
        border-radius: 3px;
      }
      .dev-badge {
        position: fixed;
        bottom: 8px;
        right: 8px;
        background: #e74c3c;
        color: white;
        font-family: sans-serif;
        font-size: 10px;
        font-weight: bold;
        padding: 2px 6px;
        border-radius: 4px;
        z-index: 9999;
        pointer-events: none;
        display: {{DEV_MODE}};
      }
    </style>
  </head>
  <body>
    <div class="dev-badge">DEV</div>
    <div class="container">
      <div class="icon">⚠</div>
      <p>{{ERROR_MESSAGE}}</p>
      {{INSTALL_HINT}}
    </div>
  </body>
</html>
`;
