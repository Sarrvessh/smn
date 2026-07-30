import asyncio

import httpx
from sqlalchemy import text

from app.db.session import engine


async def main() -> None:
    async with httpx.AsyncClient(base_url="http://127.0.0.1:8000", timeout=30.0) as client:
        print("providers", (await client.get("/api/v1/providers/health")).json())
        print("knowledge", (await client.get("/api/v1/knowledge/status")).json())

    async with engine.connect() as conn:
        rows = (
            await conn.execute(
                text(
                    "SELECT role, left(content, 500) AS snippet, status, skill, "
                    "latency_ms, error_code FROM messages ORDER BY created_at DESC LIMIT 6"
                )
            )
        ).mappings().all()
        for row in rows:
            print(dict(row))
            print("---")


if __name__ == "__main__":
    asyncio.run(main())
