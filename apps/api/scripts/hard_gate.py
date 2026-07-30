"""Day-2 hard-gate checks against a running API."""

from __future__ import annotations

import asyncio
import json
import sys

import httpx

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8001"


async def read_stream(response: httpx.Response) -> list[dict]:
    events: list[dict] = []
    async for line in response.aiter_lines():
        if line.strip():
            events.append(json.loads(line))
    return events


async def main() -> int:
    ok = True
    async with httpx.AsyncClient(base_url=BASE, timeout=600.0) as client:
        live = await client.get("/health/live")
        ready = await client.get("/health/ready")
        kb = (await client.get("/api/v1/knowledge/status")).json()
        providers = (await client.get("/api/v1/providers/health")).json()
        print("live", live.status_code, live.json())
        print("ready", ready.status_code, ready.json())
        print("knowledge", kb)
        chat_models = providers["providers"][0]["models"]
        print("chat_models", chat_models)
        if any("embed" in m.lower() for m in chat_models):
            print("FAIL: embedding models leaked into provider list")
            ok = False
        if not kb.get("ready"):
            print("FAIL: knowledge base not ready")
            ok = False

        user = (await client.post("/api/v1/users/anonymous")).json()
        headers = {"X-User-Id": user["id"]}
        model = "qwen2.5:7b" if "qwen2.5:7b" in chat_models else (chat_models[0] if chat_models else "qwen2.5:7b")

        s1 = (
            await client.post(
                "/api/v1/sessions",
                headers=headers,
                json={"title": "Gate Q&A", "provider": "ollama", "model": model},
            )
        ).json()
        s2 = (
            await client.post(
                "/api/v1/sessions",
                headers=headers,
                json={"title": "Gate Other", "provider": "ollama", "model": model},
            )
        ).json()
        print("sessions", s1["id"], s2["id"])

        async with client.stream(
            "POST",
            f"/api/v1/sessions/{s1['id']}/messages/stream",
            headers=headers,
            json={
                "content": "What do guests say about product-market fit?",
                "mode": "transcript_qa",
                "provider": "ollama",
                "model": model,
            },
        ) as resp:
            events = await read_stream(resp)

        types = [e["event"] for e in events]
        print("qa events", sorted(set(types)))
        tokens = "".join(e.get("text", "") for e in events if e["event"] == "token")
        sources = next((e["sources"] for e in events if e["event"] == "sources"), [])
        print("qa tokens_len", len(tokens), "sources", len(sources))
        if "completed" not in types or len(tokens) < 20 or len(sources) == 0:
            print("FAIL: Q&A stream incomplete")
            print("sample tokens", tokens[:200])
            ok = False
        else:
            print("PASS: grounded Q&A")

        # Persistence / isolation
        msgs = (
            await client.get(f"/api/v1/sessions/{s1['id']}/messages", headers=headers)
        ).json()
        other = (
            await client.get(f"/api/v1/sessions/{s2['id']}/messages", headers=headers)
        ).json()
        print("s1 messages", len(msgs), "s2 messages", len(other))
        if len(msgs) < 2:
            print("FAIL: session persistence")
            ok = False
        if len(other) != 0:
            print("FAIL: session isolation")
            ok = False
        else:
            print("PASS: persistence + isolation")

        # Ship30
        async with client.stream(
            "POST",
            f"/api/v1/sessions/{s1['id']}/messages/stream",
            headers=headers,
            json={
                "content": "Turn the PMF insights into a short Ship30 essay for founders.",
                "mode": "ship30_essay",
                "provider": "ollama",
                "model": model,
            },
        ) as resp:
            essay_events = await read_stream(resp)
        essay_types = [e["event"] for e in essay_events]
        artifact = next((e for e in essay_events if e["event"] == "artifact"), None)
        print("ship30 events", sorted(set(essay_types)), "artifact", bool(artifact))
        if artifact:
            art = (
                await client.get(f"/api/v1/artifacts/{artifact['artifact_id']}", headers=headers)
            ).json()
            print("artifact type", art.get("type"), "chars", len(art.get("content", "")))
            if art.get("type") != "markdown" or len(art.get("content", "")) < 100:
                print("FAIL: ship30 artifact")
                ok = False
            else:
                print("PASS: ship30 markdown artifact")
        else:
            print("FAIL: no ship30 artifact event")
            ok = False

        # HTML artifact
        async with client.stream(
            "POST",
            f"/api/v1/sessions/{s1['id']}/messages/stream",
            headers=headers,
            json={
                "content": "Create an HTML growth experiment dashboard.",
                "mode": "artifact",
                "provider": "ollama",
                "model": model,
            },
        ) as resp:
            html_events = await read_stream(resp)
        html_art = next((e for e in html_events if e["event"] == "artifact"), None)
        if html_art:
            art = (
                await client.get(f"/api/v1/artifacts/{html_art['artifact_id']}", headers=headers)
            ).json()
            print("html artifact", art.get("type"), "has_script", "<script" in art.get("content", "").lower())
            if art.get("type") != "html":
                print("FAIL: expected html artifact")
                ok = False
            elif "<script" in art.get("content", "").lower():
                print("FAIL: html contains script")
                ok = False
            else:
                print("PASS: html artifact")
        else:
            # may fail validation; still report
            err = next((e for e in html_events if e["event"] == "error"), None)
            print("FAIL: no html artifact", err)
            ok = False

    print("HARD_GATE", "PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
