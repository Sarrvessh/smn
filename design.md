# Design — Lenny Growth Assistant

## Layout

Desktop three-pane workspace:

1. **Sessions** — New Chat, search, history grouped Today / Previous 7 Days / Older
2. **Conversation** — header (title, provider, model), messages, sources, composer
3. **Artifact viewer** — Preview | Code tabs, copy/download

Tablet: collapsible sidebar and artifact panel.  
Mobile: primary chat; Sources and Artifacts as bottom sheets.

## Visual direction

- Calm product-research workspace, not a generic purple AI dashboard.
- Brand signal: **Lenny Growth Assistant** as a strong header mark.
- Typography: distinctive sans for UI (`IBM Plex Sans` or `Source Sans 3`); readable serif optional for long essays in the artifact preview only.
- Atmosphere: soft paper/ink gradient background, not flat white.
- Cards only for interactive source and artifact containers.

## Composer modes

`Auto` | `Ask Lenny` | `Ship30 Essay` | `Create Artifact`

Suggested prompts for empty state:

- What patterns do Lenny's guests recommend for finding product-market fit?
- Compare onboarding advice across multiple guests.
- Turn this answer into a Ship30for30 essay.
- Create an HTML growth strategy dashboard from this discussion.

## Motion

- Streaming cursor / subtle status stage transitions
- Artifact panel slide-in when an artifact event arrives
- Source highlight when an inline citation is clicked

## Accessibility

Keyboard focus visible; labels on icon buttons; Stop generation reachable without mouse.
