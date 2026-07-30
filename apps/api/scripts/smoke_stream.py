import asyncio
import json
import os
import sys

import httpx

BASE_URL = os.environ.get("SMOKE_API", "http://127.0.0.1:8001")


async def main() -> None:
    print("base", BASE_URL)
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=180.0) as client:
        user = (await client.post("/api/v1/users/anonymous")).json()
        headers = {"X-User-Id": user["id"]}
        session = (
            await client.post(
                "/api/v1/sessions",
                headers=headers,
                json={"title": "E2E", "provider": "ollama", "model": "qwen2.5:7b"},
            )
        ).json()
        print("session", session["id"])
        events: list[str] = []
        tokens = 0
        async with client.stream(
            "POST",
            f"/api/v1/sessions/{session['id']}/messages/stream",
            headers=headers,
            json={
                "content": "What signals indicate strong product-market fit according to Lenny guests?",
                "mode": "transcript_qa",
                "provider": "ollama",
                "model": "qwen2.5:7b",
            },
        ) as response:
            print("http", response.status_code)
            async for line in response.aiter_lines():
                if not line.strip():
                    continue
                event = json.loads(line)
                events.append(event["event"])
                name = event["event"]
                if name == "status":
                    print("status:", event.get("stage"), "-", event.get("label"))
                elif name == "sources":
                    srcs = event.get("sources", [])
                    print("sources:", len(srcs))
                    for s in srcs[:3]:
                        print(
                            " ",
                            s.get("id"),
                            s.get("guest"),
                            "comb",
                            round(float(s.get("score") or 0), 4),
                            "vec",
                            s.get("vector_score"),
                            "kr",
                            s.get("keyword_rank"),
                        )
                elif name == "token":
                    tokens += 1
                    if tokens <= 3:
                        print("token:", repr(event.get("text")))
                elif name in {"completed", "error"}:
                    print(event)
        print("event_types", sorted(set(events)))
        print("token_events", tokens)
        if tokens <= 5 and any("could not find enough" in json.dumps(e) for e in []):
            pass


if __name__ == "__main__":
    asyncio.run(main())
