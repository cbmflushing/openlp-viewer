Here's my evaluation:

  Overall Assessment

  Solid single-file app for its purpose. Clean structure, reasonable CSS, functional JS. A few issues worth addressing.

  ---
  Bugs

  1. closeModal(false) doesn't save settings before closing

  When the user clicks "Skip", firstRun is set to false and saved, but the settings object still has firstRun: true at that point in the function — the
   line settings.firstRun = false runs, but the object spread from DEFAULT_SETTINGS at init means subsequent calls behave correctly. Not technically
  broken but confusing.

  2. Footer CCLI number is hardcoded in fetchAndDisplay

  let footerHtml = 'CBM Flushing © CCLI# 26557';  // hardcoded!

  The settings have a ccliNumber field and updateFooter() respects it, but fetchAndDisplay ignores settings.ccliNumber entirely and uses a hardcoded
  value. This means the settings UI CCLI field has no effect once lyrics start displaying.

  3. prefix === 'ch' is unreachable

  if (prefix === 'c') { ... }
  else if (prefix === 'h') { ... }
  else if (prefix === 'ch') { ... }  // never reached — 'ch' starts with 'c'

  The regex ^([a-z]+)(\d+) will capture ch as the prefix, but the 'c' branch runs first only for titles starting with exactly c followed by digits.
  Actually ch would NOT match 'c' — wait, it matches the full prefix ch. So 'ch' === 'c' is false. But the intent seems to be ch = Chorus and c =
  something else? The labels suggest c = Chorus, h = Hymnary, ch = Songbook — the naming is confusing but the logic is actually correct. Just poorly
  named.

  ---
  Security Issues

  4. XSS via innerHTML with unsanitized server data

  htmlContent += `<p class="english">${processed}</p>`;
  // ...
  document.getElementById('content').innerHTML = htmlContent;

  English lines go through .replace() but those regexes passthrough arbitrary HTML. If the OpenLP server returns malicious content (or is compromised),
   it gets injected directly. The Chinese lines use escapeHtml() correctly — apply the same treatment or a proper sanitizer to English lines.

  5. updateFooter uses .innerHTML with ccliNumber from user input

  footerHtml += ' © CCLI# ' + ccliNum;
  document.getElementById('footer').innerHTML = footerHtml;

  If a user enters <script> in the CCLI field, it executes. Use textContent or escape it.

  ---
  Design Issues

  6. 1-second polling with no debounce or visibility check

  setInterval(fetchAndDisplay, 1000) runs even when the tab is hidden. Use document.visibilityState or Page Visibility API to pause when backgrounded.

  7. localStorage.getItem result is parsed without try/catch

  settings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };

  Corrupt localStorage data will throw and crash the app silently. Wrap in try/catch.

  8. applySettings() is called in both closeModal(true) paths

  closeModal(true) calls saveSettings() which calls applySettings(), but closeModal itself doesn't call applySettings — that's fine. However
  closeModal(false) does NOT call saveSettings(), so settings entered in the form but not saved are lost, which is the intended behavior but not
  obvious.

  ---
  Minor Issues

  - The modal-overlay starts visible in HTML (no hidden class), relying on JS to hide it if not firstRun. If JS is slow/fails, the modal stays open.
  - #title-display visibility is toggled via inline style in applySettings but never updated when fetchAndDisplay clears the title — the element stays
  visible showing stale content.
  - No way to close the modal with Escape key.

  ---
  Summary Table

  ┌────────────────────────────────────┬──────────┐
  │               Issue                │ Severity │
  ├────────────────────────────────────┼──────────┤
  │ Hardcoded CCLI# overrides settings │ High     │
  ├────────────────────────────────────┼──────────┤
  │ XSS via English line innerHTML     │ High     │
  ├────────────────────────────────────┼──────────┤
  │ XSS via footer innerHTML           │ Medium   │
  ├────────────────────────────────────┼──────────┤
  │ localStorage parse uncaught        │ Medium   │
  ├────────────────────────────────────┼──────────┤
  │ Polling ignores tab visibility     │ Low      │
  ├────────────────────────────────────┼──────────┤
  │ Escape key doesn't close modal     │ Low      │
  ├────────────────────────────────────┼──────────┤
  │ ch prefix label confusion          │ Low      │
