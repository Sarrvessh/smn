from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# apps/api/app/core/config.py → repo root is parents[4]
ROOT = Path(__file__).resolve().parents[4]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/lenny"
    cors_origins: str = "http://localhost:5173"

    default_llm_provider: str = "ollama"

    ollama_base_url: str = "http://localhost:11434"
    ollama_chat_model: str = "qwen2.5:7b"
    ollama_embed_model: str = "embeddinggemma"
    embedding_dim: int = 768

    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-20250514"

    llm_request_timeout_seconds: int = 300
    llm_max_retries: int = 1

    rag_vector_candidates: int = 20
    rag_keyword_candidates: int = 20
    rag_final_chunks: int = 12
    rag_max_chunks_per_episode: int = 3
    rag_fusion_constant: int = 60

    max_user_message_characters: int = 12000
    max_artifact_characters: int = 100000

    corpus_repo_url: str = "https://github.com/ChatPRD/lennys-podcast-transcripts.git"
    corpus_path: str = "data/lennys-podcast-transcripts"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def corpus_dir(self) -> Path:
        path = Path(self.corpus_path)
        if not path.is_absolute():
            path = ROOT / path
        return path


@lru_cache
def get_settings() -> Settings:
    return Settings()
