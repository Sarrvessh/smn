import asyncio

from sqlalchemy import text

from app.db.session import engine


async def main() -> None:
    async with engine.begin() as conn:
        result = await conn.execute(
            text("UPDATE chat_sessions SET model = 'qwen2.5:7b' WHERE model LIKE 'qwen3%'")
        )
        print("updated_sessions", result.rowcount)


if __name__ == "__main__":
    asyncio.run(main())
