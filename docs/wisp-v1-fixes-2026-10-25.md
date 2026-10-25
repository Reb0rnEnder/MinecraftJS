# Wisp v1 interoperability fixes (2026-10-25)

The maintained clients now normalize Wisp endpoint paths to end in `/` for both
relay testing and TCP connections. wisp-python selects its Wisp handler only for
paths ending in `/`; a path such as `/wisp` otherwise selects its wsproxy handler.
No `wisp-v2` WebSocket subprotocol is requested: wisp-python v1 remains supported.

The browser socket previously discarded messages arriving before the caller had
attached listeners. Wisp sends its initial CONTINUE immediately on opening, so
server-first greetings must be retained. The socket now retains early events,
and the Wisp stream also retains data/close events until its consumer subscribes.

The old transport invented a 128-frame allowance after 1.5 seconds without a
CONTINUE and could send CONNECT after closing. It now waits for the actual stream-0
allowance, reports a timeout if it never arrives, cancels timers on close, and
never sends queued data after closing. Subsequent allowances must belong to
stream 1. Credit values are unsigned and malformed control frames are ignored.
Close reason labels follow the upstream protocol values.

Validation: `node tools/test-wisp-regressions.mjs` covers immediate greetings,
endpoint normalization, buffer credit exhaustion/resumption, malformed and
unrelated control frames, and close-before-handshake behavior. The optional
`WISP_TEST_URL=ws://127.0.0.1:18888/wisp` test was run against unmodified
wisp-server-python 0.9.0, with loopback enabled. It tests the relay probe and a
600 KiB TCP echo transfer sent as 600 DATA frames across multiple flow-control
windows. The same tests and fix run on 1.13.2, 1.12.2 and 1.8.9.

The 1.13.2 creative search category tooltip also now uses plain blue. In the
pinned vanilla jar, `clh.a(ate,int,int)` inserts BOLD followed by BLUE; BLUE resets
the bold flag. Our previous BLUE followed by BOLD reversed that effect. An exact
formatting assertion supplements the existing translated-tooltip test. Older
clients do not use this category tooltip path, so they need no styling patch.

References:
- https://github.com/MercuryWorkshop/wisp-server-python
- https://github.com/MercuryWorkshop/wisp-js
