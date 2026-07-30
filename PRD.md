# Product Requirements Document — Lenny Growth Assistant

## Vision

Lenny Growth Assistant is a production-structured, full-stack AI application that answers product management and growth questions grounded strictly in Lenny’s Podcast transcripts, then converts insights into Ship30for30-style essays and Markdown/HTML artifacts.

## Goals

1. Persistent multi-session chat with PostgreSQL storage.
2. Transcript-grounded Q&A with validated citations.
3. Ship30for30 essay generation as Markdown artifacts.
4. Markdown and HTML/CSS artifact generation with a secure side panel viewer.
5. Switchable local Ollama and Anthropic Claude providers.
6. Fully reproducible local setup via documented commands.

## Users

Evaluators and product practitioners running the app locally (anonymous browser identity; no OAuth).

## Mandatory features

- Create, rename, archive, and restore chat sessions.
- Hybrid semantic + keyword retrieval over ingested transcripts.
- Answers cite sources as `[S1]`, `[S2]`, … with guest, episode, excerpt, and link.
- Abstain when evidence is insufficient.
- Auto / Ask Lenny / Ship30 Essay / Create Artifact modes.
- Artifact Preview and Code tabs; HTML in sandboxed iframe (no JS execution).
- Provider and model selection persisted per session.
- Clear recovery errors for missing Ollama, models, API keys, and empty knowledge base.

## Non-goals

OAuth, org accounts, Redis, Celery, Kubernetes, microservices, billing, collaboration, JavaScript artifacts, user-uploaded corpora, voice, fine-tuning, knowledge graphs, public sharing links.

## Success criteria

An evaluator can clone the repo, follow the README, ingest ChatPRD transcripts, and complete: grounded Q&A with sources, session persistence, Ship30 essay artifact, HTML artifact preview, and provider switching.

## Corpus

Source: [ChatPRD/lennys-podcast-transcripts](https://github.com/ChatPRD/lennys-podcast-transcripts)  
Local path: `data/lennys-podcast-transcripts/` (not committed).
