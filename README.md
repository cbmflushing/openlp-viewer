# OpenLP Viewer

A standalone browser page for displaying live OpenLP lyrics on a projector or secondary screen. No build or installation required.

## Quick start

1. Start OpenLP and enable its remote API/server (default HTTP port: `4316`). The viewer expects access without a login.
2. Open [`lyrics-display.html`](lyrics-display.html) in a browser.
3. In the settings dialog, enter the **OpenLP Server IP** as a host and port, without `http://`:
   - Same computer as OpenLP: `localhost:4316`
   - Another computer: for example, `192.168.1.212:4316`
4. Choose the display language, colors, and fonts, optionally enable the song title, and enter the CCLI license number (`26557` for CBM Flushing).
5. Click **Save & Start**.
6. Send a song live in OpenLP. Move the browser to the display screen and use the browser's full-screen mode.

The viewer refreshes immediately when OpenLP sends a WebSocket state notification, and also checks for the selected live slide every second as a fallback. Live-slide and port-discovery requests time out after five seconds, so stalled requests cannot block updates indefinitely. It discovers the WebSocket port from OpenLP's system API, defaulting to `4317` if discovery fails or times out, and reconnects automatically with bounded backoff. Settings are saved in the current browser.

## Controls

- **Settings button:** reopen settings to change the server, display language, appearance, title, or CCLI number. Save to apply changes; Skip, Escape, or clicking outside the dialog discards unsaved changes.
- **`.` (period):** toggle local blackout. This affects only this viewer, not OpenLP or other displays.
- **Colors:** choose a preset swatch for the background, English, Chinese, or footer. The selected HEX value appears beneath each palette, including for custom colors. Expand **Advanced** to use the custom picker, enter a six-digit HEX value (for example, `#12ab34`), or edit the red, green, and blue channels (whole numbers from 0 to 255). Invalid or incomplete values are highlighted and must be corrected before saving; choosing a preset or picker color also replaces them.
- **Reset:** restore the default settings.

## Display behavior

- The default display language is **English + Chinese**; **English only** hides lines classified as Chinese. The saved choice persists in the browser, and Reset restores bilingual display.
- **Automatically fit lyrics to screen** is on by default, including for existing settings. It scales both languages together to fit the available width and height, keeping the original line breaks and reserving space for the title and footer. Turn it off and save to restore the original responsive font sizes; Reset turns it back on. The fit is found within 0.05 CSS pixels of the measured maximum.
- Extremely small windows, exceptionally long lines, many lines, or oversized title/footer text may leave too little room for legible lyrics, or even for the fixed margins and title/footer themselves. Use a larger display or shorten the slide/title; browser font rendering and trusted slide formatting can also affect the result.
- English lines appear first, followed by Chinese lines when enabled.
- Chinese is detected from the text itself, not HTML formatting: a line is Chinese when more than 30% of its non-whitespace characters are Chinese characters.
- Chinese lines have whitespace removed and duplicates collapsed. Keep English and Chinese on separate lines; mixed-language lines are classified as a whole.
- Empty slides, including slides with no visible lyrics after language filtering, fade to black in about 300 ms; lyrics returning restores the display. This is **not** synchronization with OpenLP's blackout button.
- Network errors preserve the last display state rather than treating the slide as empty.

## Troubleshooting

- **No lyrics:** make sure a song slide is live and selected in OpenLP. An empty slide intentionally shows black. Also check whether local blackout (`.`) is enabled.
- **Connection error:** check the host, port, remote API settings, network, and firewall. On another computer, `localhost` refers to that computer—not the OpenLP computer.
- **Check the API:** open `http://HOST:4316/api/controller/live/text` in the browser, replacing `HOST` with the OpenLP computer's address. It should return JSON.
- **Push updates unavailable:** check that the discovered WebSocket port (normally `4317`) is reachable through the firewall. Polling continues every second if WebSockets or port discovery are unavailable; if discovery fails with a non-default WebSocket port, polling remains the fallback.
- **Browser blocks requests:** check the browser console for CORS or mixed-content errors. The viewer uses HTTP and unencrypted WebSockets; an HTTPS-hosted page can block them. A suitable proxy and compatible deployment configuration are needed for HTTPS.

Use only trusted OpenLP content: English slide formatting is rendered as HTML. Keep the remote API on a trusted network.

## Tests

From this directory, run offline regression tests (requires Node.js):

```sh
node test_viewer.cjs
node test_websocket.cjs
```

Real-browser layout checks additionally require Google Chrome (or pass a Chromium executable path):

```sh
node test_layout.cjs
node test_layout.cjs /path/to/chromium
node test_colors.cjs
node test_colors.cjs /path/to/chromium
```

The integration script additionally requires Python 3 and a live OpenLP server at `http://192.168.1.212:4316`:

```sh
python3 test_integration.py
```
