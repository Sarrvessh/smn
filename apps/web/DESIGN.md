---
name: Signal
description: Conversation-first growth research workspace grounded in podcast transcript evidence
colors:
  background: "hsl(240 6% 97%)"
  foreground: "hsl(240 10% 8%)"
  surface: "hsl(0 0% 100%)"
  surface-elevated: "hsl(0 0% 100%)"
  surface-hover: "hsl(240 6% 94%)"
  surface-active: "hsl(234 60% 96%)"
  border: "hsl(240 8% 90%)"
  muted: "hsl(240 6% 94%)"
  muted-foreground: "hsl(240 5% 42%)"
  accent: "hsl(234 68% 59%)"
  accent-foreground: "hsl(0 0% 100%)"
  success: "hsl(152 55% 36%)"
  warning: "hsl(38 92% 45%)"
  destructive: "hsl(4 72% 50%)"
  background-dark: "hsl(240 6% 7%)"
  surface-dark: "hsl(240 5% 10%)"
  accent-dark: "hsl(234 78% 70%)"
typography:
  ui:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "-0.011em"
  brand:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  brand-tagline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.75
    letterSpacing: "-0.011em"
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-foreground}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
    height: "32px"
  button-secondary:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
    height: "32px"
  composer:
    backgroundColor: "{colors.surface-elevated}"
    rounded: "{rounded.xl}"
    padding: "8px"
---

## Overview

Signal is a conversation-first growth research workspace. Brand lockup: indigo mark with rising signal bars + wordmark “Signal” / “Growth research”. The visual system follows a **Linear × ChatGPT × Apple** craft bar: cool zinc neutrals, indigo accent, Inter with tight tracking, premium spacing, and a sticky floating composer. The conversation column stays primary; sessions and artifacts are secondary rails.

## Colors

Restrained palette. Light mode uses cool gray paper (`background`) with white surfaces and indigo accent for primary actions and citation chips. Dark mode uses deep charcoal surfaces without pure black as the page ground. Semantic colors cover success, warning, and destructive states. Accent is reserved for actions, selection, and citations — not decoration.

## Typography

Single family: Inter (Linear craft). UI chrome sits at 11–13px medium; conversation body at 15px / 1.75; empty-state display at ~1.75–2rem semibold with tight tracking (−0.02em). Brand lockup uses 14px semibold wordmark + 11px medium tagline. Avoid display serifs and costume monospace outside code.

## Layout

Desktop three-pane grid: ~16.5rem sessions · fluid chat · ~22rem artifacts. Chat measure capped near `max-w-3xl`. Composer is sticky at the bottom with safe-area padding. Tablet/mobile: conversation first; sessions and artifacts as overlays. Source evidence opens as a floating panel above the composer (never covering it).

## Elevation & Depth

Hierarchy from surface color and hairline borders. Soft offset shadows (`--composer-shadow`, `--panel-shadow`) only on the composer and floating panels. No decorative glow.

## Shapes

Controls use 6–8px radii; composer and sheets use 12–16px. Consistent icon buttons at 32×32.

## Components

Shared classes: `btn-primary`, `btn-secondary`, `btn-ghost`, `icon-button`, `input-field`, `select-field`, `segmented`. SVG icons share one stroke weight. Loading uses skeletons; streaming uses a status dot + caret. Message actions (copy / retry / sources) appear on hover/focus. Session search is an icon / nav row that opens a centered command-palette dialog (`search-dialog`). Library opens archived chats for restore. Artifacts opens a dialog listing every generated artifact with its source chat title; selecting one switches to that chat and opens the artifact workspace. Pinned chats are client-persisted and listed above Recents. Do not invent Projects, Scheduled, or Plugins in the sidebar.

## Do's and Don'ts

**Do**
- Keep the composer always mounted and focusable after retry/stop.
- Keep previous messages visible during refetch (`keepPreviousData`).
- Use semantic tokens from `src/index.css`.
- Make provider, knowledge, and failure states explicit in copy.

**Don't**
- Don't cover the composer with source sheets.
- Don't use warm cream + terracotta AI-default palettes.
- Don't nest cards inside message bubbles.
- Don't expose retrieval scores, DB ids, or stack traces in the default UI.
