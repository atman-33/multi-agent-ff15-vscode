## ADDED Requirements

### Requirement: Local proxy forwards OpenCode traffic
The extension SHALL start a local HTTP proxy on a persisted random port that forwards requests to the OpenCode server.

#### Scenario: Proxy is active
- **WHEN** the proxy receives an HTTP request
- **THEN** it forwards the request to the OpenCode server port
- **AND** it returns the upstream response

### Requirement: Proxy injects webview compatibility script into HTML
The proxy SHALL buffer HTML responses and inject a script before `</head>` that patches clipboard, keyboard, audio, and link behavior for the VS Code webview.

#### Scenario: HTML response passes through proxy
- **WHEN** the OpenCode server returns an HTML document
- **THEN** the response body contains the injected compatibility script

### Requirement: Proxy handles WebSocket upgrade
The proxy SHALL transparently forward WebSocket upgrade requests to the OpenCode server.

#### Scenario: Live-reload WebSocket connection
- **WHEN** the OpenCode client opens a WebSocket through the proxy
- **THEN** the proxy establishes a corresponding WebSocket to the OpenCode server
