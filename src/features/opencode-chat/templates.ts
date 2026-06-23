// FF15 fixed dark theme — ported from multi-agent-ff15/web/app/app.css (:root).
// Keep in sync manually. The OpenCode wrapper chrome uses these so the seam
// around the iframe matches the original app's dark slate/blue look.
export const FF15_THEME = {
	surface: "hsl(222 47% 5%)",
	foreground: "hsl(215 20% 93%)",
	fontFamily:
		'"Noto Sans CJK JP", "Noto Sans JP", "Hiragino Kaku Gothic ProN", "Hiragino Sans", "Yu Gothic UI", "Meiryo UI", system-ui, -apple-system, sans-serif',
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
        opacity: 0.7;
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
        text-align: center;
        padding: 20px;
      }
      .icon {
        font-size: 32px;
        margin-bottom: 12px;
        opacity: 0.5;
      }
      p {
        margin: 0 0 8px;
        opacity: 0.7;
      }
      code {
        font-family: var(--vscode-editor-font-family);
        background: var(--vscode-textBlockQuote-background);
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
