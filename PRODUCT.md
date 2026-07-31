# Product Context - Signal

## Platform

Adaptive web application designed for local desktop use, with complete tablet and mobile behavior.

## Primary Users

Product managers, growth practitioners, founders, and evaluators researching product and growth questions. They are often comparing advice across long podcast transcripts and need to move quickly from evidence to a useful written deliverable.

## User Situation

Users run the application locally, choose an available AI provider, and work across persistent chat sessions. They need answers they can verify, sources they can inspect without losing their place, and artifacts they can review beside the conversation.

## Product Purpose

Signal turns Lenny's Podcast transcript corpus into grounded product research. It answers questions with validated citations, compares advice across episodes, and converts sourced insights into Ship30for30 essays or Markdown and HTML/CSS artifacts. Product display name is Signal (short, independent of the corpus host).

## Positioning

Unlike a general-purpose chatbot, every research answer can be traced to the podcast transcript evidence that supports it, then carried directly into a safe, editable artifact workspace.

## Operating Context

- The primary setup is a reproducible local stack with PostgreSQL, pgvector, a Python API, and a Vite/React frontend.
- Ollama is the default local provider; Anthropic is optional when configured.
- The transcript knowledge base must be ingested before grounded answers are available.
- Sessions, messages, provider choices, citations, and artifacts persist through the backend.
- The interface must remain useful when providers, models, the database, or the knowledge base are unavailable.

## Core Capabilities

- Create, rename, archive, restore, search, and switch persistent chat sessions.
- Ask transcript-grounded questions and receive validated `[S#]` citations.
- Inspect guest, episode, excerpt, publication date, and source link context.
- Generate Ship30for30-style Markdown essays.
- Generate and preview Markdown or HTML/CSS artifacts beside the chat.
- Switch between configured Ollama and Anthropic models.
- Stop streaming generation and recover from provider or persistence failures.

## Durable Constraints

- Preserve the API, streaming, schema, and architecture contracts in `docs/`.
- Ground transcript Q&A in retrieved evidence and abstain when evidence is insufficient.
- Never expose raw database identifiers, embedding scores, stack traces, or secrets in the normal interface.
- HTML artifacts must run without JavaScript in a sandboxed iframe and must not affect the parent application.
- Do not imply authentication, collaboration, uploads, billing, voice, public sharing, or artifact version history.
- Keep the conversation as the primary visual focus across desktop, tablet, and mobile.

## Brand Commitments

- Display name: **Signal**. Tagline: Growth research. Mark: rising signal bars (not letter initials).
- Calm, direct, evidence-led, and professionally useful.
- Confident without overstating what the corpus supports.
- Clear about unavailable providers, missing models, and incomplete evidence.
- Craft bar: Linear typography and spacing, ChatGPT conversation usability, Apple-level polish.
- Prefer concise product language over technical implementation language.

## Evidence On Hand

- The ChatPRD Lenny's Podcast transcript corpus is the sole documented knowledge source.
- Retrieved transcript excerpts, guest names, episode titles, and source links are available as citation evidence.
- The repository includes working API, streaming, schema, architecture, and threat-model contracts.
- The product has no documented customer logos, usage metrics, testimonials, or public deployment claims; future work must not invent them.

## Design Principles

- Conversation first: keep reading, asking, and iterating central.
- Evidence nearby: citations should reveal useful source context with minimal interruption.
- Progressive disclosure: surface recovery actions and essential metadata while keeping diagnostics secondary.
- Artifact collaboration: generated work should feel inspectable and usable, not like an attachment.
- Stable under stress: loading, empty, streaming, failure, long-content, and narrow-screen states must remain coherent.
- Accessible by default: semantic controls, keyboard operation, visible focus, sufficient contrast, and reduced motion are product requirements.

