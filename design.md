# Design - Lenny Growth Assistant

## Design Principles

Lenny Growth Assistant is a conversation-first product research workspace. The UI keeps visual noise low, centers long-form reading, makes source inspection feel native, and treats generated artifacts as a collaborative side workspace rather than a detached preview card.

## Information Architecture

The application has three primary surfaces: session history, conversation, and artifact workspace. Provider/model controls live in the chat header because they affect the next response. Sources are contextual to the conversation and open as a drawer from citations or message actions.

## Desktop Layout

Desktop uses a three-pane grid: collapsible session sidebar, centered conversation column, and optional artifact workspace. The conversation text remains capped at a readable width. The artifact panel can be hidden or made fullscreen without losing chat state.

## Tablet Layout

Tablet keeps the conversation as the default surface. The session sidebar opens as an overlay sheet, and the artifact workspace opens as a large overlay. Header controls wrap without horizontal overflow.

## Mobile Layout

Mobile starts in conversation view with a compact top bar. Sessions open as a sheet, sources open as a bottom sheet, and artifacts open as a full-screen workspace. The composer uses `100dvh` layout and safe-area padding so mobile keyboards do not trap controls.

## Color Tokens

Colors are semantic CSS variables consumed by Tailwind: `background`, `foreground`, `surface`, `surface-elevated`, `surface-hover`, `surface-active`, `border`, `border-strong`, `muted`, `muted-foreground`, `accent`, `accent-foreground`, `success`, `warning`, and `destructive`.

Light mode uses warm paper surfaces with blue-gray muted areas and a restrained teal accent. Dark mode uses deep neutral surfaces without pure black as the main background. Theme selection follows saved preference, then system preference.

## Typography Scale

The UI uses IBM Plex Sans with system fallbacks. Conversation content uses 0.96rem text with 1.75 line height for readability. Compact controls use 12-14px text. Code uses a monospaced stack and line-numbered blocks in artifact code view.

## Spacing Scale

The workspace uses compact 8-16px control spacing, 24px message row rhythm, and a centered max-width conversation column. Panels use restrained 8-12px radii and avoid nested card layouts.

## Component Patterns

Buttons share `btn-primary`, `btn-secondary`, `btn-ghost`, and `icon-button` classes. Form controls share `input-field`, `select-field`, and segmented mode controls. Loading skeletons, status dots, focus rings, and markdown styles are centralized in `src/index.css`.

## Elevation

The interface establishes hierarchy primarily through surface color and restrained borders. The conversation remains on the base background, controls sit on `surface`, and menus, sheets, and the composer use `surface-elevated`. Shadows are reserved for overlays and the floating composer; they remain small and low contrast in both themes.

## Do

- Keep the conversation column centered and comfortable for long-form reading.
- Use semantic tokens and shared control classes before introducing component-specific values.
- Make provider, knowledge, streaming, and failure states explicit in text as well as color.
- Keep source evidence and artifact actions close to the message that produced them.
- Preserve stable dimensions for toolbars, panels, and icon controls across state changes.
- Use concise language that helps a product practitioner decide what to do next.

## Do Not

- Do not turn page sections or assistant messages into nested cards.
- Do not use gradients, decorative blobs, oversized shadows, or a single-hue palette as visual filler.
- Do not expose retrieval scores, database identifiers, stack traces, or provider internals in the default UI.
- Do not invent customer evidence, testimonials, usage metrics, or capabilities absent from `PRODUCT.md`.
- Do not allow secondary panels to obscure the composer or create horizontal page overflow.
- Do not execute JavaScript in generated HTML artifacts.

## Chat Interaction Model

The empty state presents four starter prompts for grounded Q&A, comparison, Ship30 essays, and HTML artifacts. User messages are compact right-aligned bubbles. Assistant messages render open markdown with subtle metadata and contextual copy, retry, and source actions.

## Source Interaction Model

Inline citations like `[S1]` render as keyboard-focusable buttons. Activating a citation opens the source drawer, highlights the matching source, and scrolls it into view. Source cards show label, guest, episode, publish date when returned, excerpt, and a safe outbound source link.

## Artifact Interaction Model

Artifacts open in the right workspace. The header includes title, type, preview/code tabs, copy, download, fullscreen, and close. Markdown artifacts render as document-style previews. HTML artifacts render in an empty-sandbox iframe with a restrictive CSP and no script execution.

## Loading States

Initial user setup shows a branded skeleton. Session history, messages, provider health, and artifact loading all use inline skeletons. The app avoids full-page spinners once the shell is ready.

## Empty States

Empty states exist for new conversation, no sessions, no session search results, no sources, no selected artifact, and artifact load failure. Each state explains the next useful action.

## Error States

Provider and knowledge-base readiness surface as compact warning bars above the conversation and composer. Message failures preserve content and offer retry. Artifact failures explain recovery without exposing stack traces.

## Accessibility Decisions

Interactive controls use semantic buttons, labels, `aria-live` for streaming/provider states, accessible tab roles, visible focus rings, and named icon buttons with `title` tooltips. Motion is reduced under `prefers-reduced-motion`.

## Responsive Decisions

The app uses `100dvh`, safe-area composer padding, overlay sheets for secondary panes, capped message width, stable grid columns, and horizontal overflow controls for markdown tables and code.

## Known Limitations

The UI does not implement uploads, authentication, billing, collaboration, artifact version history, or JavaScript artifact execution. Component tests are not configured in this repo; primary workflow coverage is implemented with Playwright.
