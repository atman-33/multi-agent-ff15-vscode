## ADDED Requirements

### Requirement: OpenCode activity-bar container is registered
The extension SHALL register a new activity-bar container named "OpenCode" with a single "Chat" webview view.

#### Scenario: Container appears in the activity bar
- **WHEN** the extension is activated
- **THEN** the activity bar contains an "OpenCode" container
- **AND** the container contains a "Chat" webview view

### Requirement: Chat view renders the OpenCode web UI
The Chat view SHALL render an iframe that loads the proxied OpenCode server URL once the server is ready.

#### Scenario: Server URL is set
- **WHEN** the view provider receives a server URL
- **THEN** the webview HTML contains an iframe whose `src` is the provided URL

#### Scenario: Server is starting
- **WHEN** the view provider has no server URL and no error
- **THEN** the webview displays the loading template

#### Scenario: Server fails to start
- **WHEN** the view provider receives an error message
- **THEN** the webview displays the error template with the message

### Requirement: Chat view supports adding text to the prompt
The Chat view SHALL relay text messages from the extension host into the iframe so they can be inserted into the OpenCode prompt input.

#### Scenario: Add file path to chat
- **WHEN** the extension posts an `insert-text` message to the view provider
- **THEN** the webview forwards the text to the iframe
