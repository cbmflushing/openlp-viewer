---
version: alpha
name: Sketchbook
description: A warm, hand-drawn interface language with readable, accessible controls.
colors:
  primary: "#D8D0ED"
  primary-hover: "#C6BAE4"
  secondary: "#ECE8DE"
  secondary-hover: "#DED9CC"
  destructive: "#EFD6CE"
  destructive-hover: "#E5BDB2"
  surface: "#FAF7EF"
  field: "#FFFDF7"
  ink: "#302D35"
  outline: "#39343B"
  link: "#433080"
  focus: "#6554A4"
  error: "#862525"
  error-surface: "#FFF1EB"
typography:
  heading-lg:
    fontFamily: '"Comic Sans MS", "Chalkboard SE", "Bradley Hand", system-ui, "Microsoft YaHei", "PingFang SC", sans-serif'
    fontSize: 32px
    fontWeight: 700
    lineHeight: 1.2
  heading-md:
    fontFamily: '"Comic Sans MS", "Chalkboard SE", "Bradley Hand", system-ui, "Microsoft YaHei", "PingFang SC", sans-serif'
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: 'system-ui, "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif'
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: 'system-ui, "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif'
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.4
  caption:
    fontFamily: 'system-ui, "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif'
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
rounded:
  control: 8px
  panel: 16px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  target: 44px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "{spacing.md}"
    height: "{spacing.target}"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.ink}"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "{spacing.md}"
    height: "{spacing.target}"
  button-secondary-hover:
    backgroundColor: "{colors.secondary-hover}"
    textColor: "{colors.ink}"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "{spacing.md}"
    height: "{spacing.target}"
  button-destructive-hover:
    backgroundColor: "{colors.destructive-hover}"
    textColor: "{colors.ink}"
  link:
    textColor: "{colors.link}"
    typography: "{typography.body}"
  field:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "{spacing.sm}"
    height: "{spacing.target}"
  field-error:
    backgroundColor: "{colors.error-surface}"
    textColor: "{colors.ink}"
  notice:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "{spacing.lg}"
  dialog:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "{spacing.lg}"
---

# Sketchbook

## Overview

Sketchbook is a welcoming, practical interface language: warm paper, dark ink, slightly irregular edges, restrained offset shadows and muted lavender accents. It is inspired by Excalidraw, not an official Excalidraw specification or affiliation. The personality is playful but never at the expense of legibility or predictable behavior.

These are reusable target values, not a claim that every existing application already implements them. The system is framework-neutral and needs no external fonts, images or assets.

## Colors

Use `surface` as paper, `field` for inputs, `ink` for ordinary text, and `outline` for structural edges. `primary` and its hover color mark the main action; `secondary` is quieter and `destructive` signals a consequential action alongside explicit wording. Use `link` for underlined links and `error` on `error-surface` for errors. Do not use lavender fill alone as text or as the only indicator of state.

Verified opaque foreground/background pairs, WCAG contrast ratios rounded to two decimals:

| Foreground | Background | Ratio |
| --- | --- | ---: |
| ink | surface / field | 12.64 / 13.30:1 |
| ink | primary / primary-hover | 9.12 / 7.44:1 |
| ink | secondary / secondary-hover | 11.06 / 9.60:1 |
| ink | destructive / destructive-hover | 9.78 / 7.89:1 |
| link | surface | 9.94:1 |
| error | error-surface | 8.26:1 |
| outline | surface / primary | 11.35 / 8.20:1 |
| focus | surface / field | 5.84 / 6.15:1 |

Normal text requires at least 4.5:1; large text and meaningful control boundaries, icons and focus indicators require at least 3:1 against adjacent colors. Large text means at least 24px regular or 18.66px bold. Verify every new pairing, state, custom swatch and underlying surface; the table does not validate arbitrary combinations.

## Typography

Use the hand-written stack sparingly for headings; if none is installed, the system sans and CJK fallbacks remain usable. Body copy, labels, fields and links use the system sans stack. Keep text left-aligned for reading, avoid all-caps blocks, and allow wrapping and user text scaling. Token sizes are starting points, not fixed-height clipping rules.

## Layout

Use the 4px-based spacing scale: 8px within compact groups, 16px between related controls, and 24–32px between sections. Center content in a fluid container up to 960px wide with 16px side gutters; increase gutters to 24px when space permits. On narrow screens stack columns and actions, allow labels to wrap, and avoid horizontal scrolling at 320 CSS pixels or 200% text zoom. Honor device safe areas. Interactive targets are at least 44 by 44 CSS pixels, with spacing that prevents accidental activation; the token `height` is a minimum, not a fixed height.

## Elevation & Depth

Use flat, hard ink shadows rather than blurred ambient elevation. Controls use `2px 2px 0 #39343B`; panels and dialogs use `5px 5px 0 #39343B`. Keep inline notices visually subordinate where needed by using the control shadow or none. On press, a button moves `1px 1px` and its shadow becomes `1px 1px 0 #39343B`; its layout box does not move. Avoid piling shadows or using them as the sole boundary cue.

## Shapes

Use a `2px solid #39343B` outline. Base radius tokens are portable approximations; to achieve the sketchbook silhouette, use deterministic CSS corner radii of `8px 6px 9px 5px` for controls and `16px 12px 17px 11px` for panels, in top-left, top-right, bottom-right, bottom-left order. Fields can use `7px 5px 8px 6px`. Keep edges clean and consistent, never randomly wobbling or redrawn on interaction.

## Components

- **Buttons:** Primary uses lavender, secondary uses warm gray, and destructive uses muted peach. Use at least 44px height, 16px horizontal padding and labels that describe the action. Hover changes the fill to the corresponding hover token; pressed uses the depth treatment above. Disabled controls do not respond and are visibly marked and programmatically disabled; do not rely on opacity alone. Maintain legible disabled labels, although inactive controls are exempt from WCAG contrast requirements.
- **Links:** Use `link` on `surface`, underlined at rest and on hover, with descriptive text. Expand standalone link targets to at least 44px without disrupting inline prose. Do not make links look like plain body text.
- **Fields:** Place a persistent associated label above each field, with helper text where needed. Use `field` and `ink`, the common outline and 8px padding; do not use placeholder text as the label. For errors, use `error` text on `error-surface`, a 2px `error` border and an explicit associated message; expose invalid state programmatically.
- **Notices:** Use a paper panel with an informative heading, concise text and, when useful, a clearly labeled action. Convey urgency with wording and semantics, not color alone; reserve assertive announcements for urgent information.
- **Dialogs:** Use a paper panel and the panel shadow, with a visible title and close or cancel action. Constrain width to the viewport with 16px gutters and allow internal scrolling. Move focus in on open, contain it while modal, support Escape when appropriate, and return focus to the invoker on close. Use native dialog semantics or equivalent accessible behavior.
- **Swatches and toggles:** Provide an accessible name and programmatic checked or pressed state. Use a visible checkmark or label as well as color for selection. Give a small visual swatch or toggle a 44px minimum hit area. Swatches may be arbitrary colors: use a contrasting double outline and checkmark, checking contrast against the chosen fill; never depend on a single fixed color to work on every swatch.

For keyboard focus, draw a `3px solid #6554A4` outline with `2px` offset against `surface` or `field`; preserve it on hover and pressed states. On other backgrounds, add a `2px #FAF7EF` separating halo around the control, then the focus outline, and verify 3:1 contrast against adjacent colors. Never remove focus visibility. Keep native keyboard behavior and visible labels; support screen readers and do not convey meaning by color alone.

Use `150ms ease` transitions for background color and shadow only; avoid hover movement. Under `prefers-reduced-motion: reduce`, remove transitions and the pressed translation while retaining the pressed shadow and other state cues. No jitter, randomization or continuous decorative motion.

## Do's and Don'ts

- Do check contrast in every actual state and context, including custom colors, and test keyboard, touch, zoom and screen-reader use.
- Do keep the hand-drawn character subtle and the reading experience calm.
- Don't substitute decorative fonts for body or CJK text, or require downloaded assets.
- Don't rely on color, motion or a shadow alone to communicate an action, selection or error.
- Don't sacrifice focus, target size or wrapping to preserve a sketchy silhouette.
