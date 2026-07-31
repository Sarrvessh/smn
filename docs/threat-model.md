# Threat Model — Lenny Growth Assistant

## Assets

- Anthropic API key (server env only)
- OpenRouter API key (server env only)
- Anonymous user session data and chat history
- Transcript corpus and embeddings
- Generated artifacts (Markdown / HTML)

## Trust boundaries

1. Browser ↔ FastAPI (CORS-limited origins)
2. FastAPI ↔ PostgreSQL
3. FastAPI ↔ Ollama / Anthropic / OpenRouter
4. Sandboxed iframe ↔ parent React app

## Threats and mitigations

| Threat | Mitigation |
|--------|------------|
| API key leakage to browser | Keys only in server `.env`; never returned by `/providers` |
| Prompt injection via transcripts | Passages treated as untrusted data; system prompts instruct ignore-as-instructions |
| XSS via HTML artifacts | Sandboxed iframe (`sandbox=""`), CSP meta, no scripts/handlers/remote media; inline SVG/CSS charts allowed; `foreignObject` blocked; no `dangerouslySetInnerHTML` |
| Markdown XSS | `rehype-sanitize` |
| Session hijack / IDOR | Shared local workspace — all clients see the same sessions; treat as single-user deploy |
| Citation hallucination | Post-generation citation validation; invalid `[S#]` stripped |
| Oversized payloads | `MAX_USER_MESSAGE_CHARACTERS`, `MAX_ARTIFACT_CHARACTERS` |
| Provider abuse / hang | Timeouts, retries=1, clear error codes |
| Secret commit | `.gitignore` for `.env` and corpus; CI should not print secrets |
| Dependency compromise | Pin deps; review upgrades |

## Non-goals (accepted risk for v1)

- No OAuth; shared workspace is intentionally open for local single-tenant use
- No rate limiting beyond request size caps
- Local Ollama trust model assumes localhost attacker is out of scope

## Residual risk

Small local models may still produce weakly grounded prose; citations and abstention reduce but do not eliminate hallucination risk. Evaluation report documents observed behavior rather than claiming zero hallucinations.
