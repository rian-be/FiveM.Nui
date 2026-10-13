# Security

NUI messages come from the client-side interface, so treat them as untrusted.

Protocol-level safeguards in FiveM.Nui:

- Malformed JSON is handled gracefully.
- Unknown callbacks get an error response.
- Stack traces are never sent to the page.
- Payload logging is opt-in and off by default.

These do not replace application-level security. In particular:

- Validate every incoming payload before using it.
- Never trust client-provided prices, permissions, player identifiers, or inventory state.
- Keep authoritative game operations and permission checks on the server.
- A successful callback proves the message arrived, not that server-side action is authorized.
- Be careful logging payloads that may contain sensitive data.
