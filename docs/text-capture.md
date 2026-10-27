# Capture incomplete chat or scoreboard text

Refresh the updated client, open the browser developer console, and run:

```js
window.textCapture = game.captureText();
```

Reproduce the incomplete message or scoreboard. Then run:

```js
textCapture.download();
textCapture.stop();
```

Attach the downloaded `minecraftjs-text-capture.json` and describe which visible
part was missing. Existing chat history is included immediately; raw scoreboard
packets are recorded after capture starts, so start before the scoreboard changes
or before joining the affected server. You can start the capture on the title
screen once `game` is available. It remains active across a connection.

The file contains chat, team/objective/player-list/title packets, formatted text,
scoreboard snapshots and referenced translations. Authentication and connection
packets are excluded. Nothing is uploaded by the helper. The capture retains the
last 100 packets; `game.captureText({limit: 300})` changes this up to 500.
