# Account-backed social blocking

1.16.5 and 1.17.1 now load the selected Microsoft account's native block list and
privileges through the configured MinecraftJS proxy. The service uses the same
`/privacy/blocklist` and `/privileges` routes and Minecraft bearer token as the
pinned authlib YggdrasilSocialInteractionsService. Failed list requests respect
its 120-second retry cooldown. Successful lists remain cached for the account;
local hiding stays separate. Account changes discard old responses and cached
privileges. Offline accounts perform no service requests.

UUIDs normalize before lookup, and the nil system-message UUID is exempt.
Blocked senders are suppressed before chat history/narration. The Blocked tab
filters known online players through the account list. Known account privileges
control multiplayer access and chat input, including clickable run-command
messages. Optional native privileges absent from a successful response default
to false. Missing/unavailable service responses remain unknown and retryable.

The client features apply only to 1.16.5/1.17.1, following
[1.16.4's introduction](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-16-4).
The fixed-URL proxy routes are shared across all versions because those proxies
can serve modern clients too; older clients receive no new social GUI behavior.
Tokens stay in authorization headers to the native service, never query URLs.

The asynchronous account refresh exposed an existing connection-cancellation
race. Canceled/superseded attempts now stop before opening a late connection or
displaying a late error; this correction is backported to all seven clients.

`test-social-blocking.mjs` covers account isolation, concurrent requests, retries,
UUID normalization, chat/narrator suppression, privileges and chat transmission.
Transport/validation and connection-cancellation tests pass on every branch.
These are mocked account-service responses, not an authenticated Microsoft
integration run; no user account was signed in or changed during these checks.
