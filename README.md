# OpenLP Viewer

A standalone browser page for displaying live OpenLP lyrics on a projector or secondary screen. No build or installation required.

## Quick start

1. Start OpenLP and enable its remote API/server (default HTTP port: `4316`). The viewer expects access without a login.
2. Open [`lyrics-display.html`](lyrics-display.html) in a browser.
3. In the settings dialog, enter the **OpenLP Server IP** as a host and port, without `http://`:
   - Same computer as OpenLP: `localhost:4316`
   - Another computer: for example, `192.168.1.160:4316`
4. Choose the display language, colors, and fonts, optionally enable the song title, and enter the CCLI license number (`26557` for CBM Flushing).
5. Click **Save & Start**.
6. Send a song live in OpenLP. Move the browser to the display screen and use the browser's full-screen mode.

The viewer checks for the selected live slide every second. Settings are saved in the current browser.

## Controls

- **Settings button:** reopen settings to change the server, display language, appearance, title, or CCLI number. Save to apply changes; Skip, Escape, or clicking outside the dialog discards unsaved changes.
- **`.` (period):** toggle local blackout. This affects only this viewer, not OpenLP or other displays.
- **Reset:** restore the default settings.

## Display behavior

- The default display language is **English + Chinese**; **English only** hides lines classified as Chinese. The saved choice persists in the browser, and Reset restores bilingual display.
- English lines appear first, followed by Chinese lines when enabled.
- Chinese is detected from the text itself, not HTML formatting: a line is Chinese when more than 30% of its non-whitespace characters are Chinese characters.
- Chinese lines have whitespace removed and duplicates collapsed. Keep English and Chinese on separate lines; mixed-language lines are classified as a whole.
- Empty slides, including slides with no visible lyrics after language filtering, fade to black in about 300 ms; lyrics returning restores the display. This is **not** synchronization with OpenLP's blackout button.
- Network errors preserve the last display state rather than treating the slide as empty.

## Troubleshooting

- **No lyrics:** make sure a song slide is live and selected in OpenLP. An empty slide intentionally shows black. Also check whether local blackout (`.`) is enabled.
- **Connection error:** check the host, port, remote API settings, network, and firewall. On another computer, `localhost` refers to that computer—not the OpenLP computer.
- **Check the API:** open `http://HOST:4316/api/controller/live/text` in the browser, replacing `HOST` with the OpenLP computer's address. It should return JSON.
- **Browser blocks requests:** check the browser console for CORS or mixed-content errors. The viewer uses an HTTP API; do not host the page over HTTPS without a suitable proxy.

Use only trusted OpenLP content: English slide formatting is rendered as HTML. Keep the remote API on a trusted network.

## Tests

From this directory, run offline regression tests (requires Node.js):

```sh
node test_viewer.cjs
```

The integration script additionally requires Python 3 and a live OpenLP server at `http://192.168.1.160:4316`:

```sh
python3 test_integration.py
```
