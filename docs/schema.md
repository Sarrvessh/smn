# Database Schema

PostgreSQL with `vector` extension (pgvector).

## `users`

| Column | Type |
|--------|------|
| id | UUID PK |
| created_at | TIMESTAMPTZ |
| last_seen_at | TIMESTAMPTZ |
| metadata | JSONB |

## `chat_sessions`

| Column | Type |
|--------|------|
| id | UUID PK |
| user_id | UUID FK users |
| title | TEXT |
| provider | TEXT |
| model | TEXT |
| summary | TEXT NULL |
| created_at | TIMESTAMPTZ |
| updated_at | TIMESTAMPTZ |
| archived_at | TIMESTAMPTZ NULL |

## `messages`

| Column | Type |
|--------|------|
| id | UUID PK |
| session_id | UUID FK chat_sessions |
| role | TEXT |
| content | TEXT |
| status | TEXT |
| skill | TEXT NULL |
| provider | TEXT NULL |
| model | TEXT NULL |
| latency_ms | INTEGER NULL |
| error_code | TEXT NULL |
| created_at | TIMESTAMPTZ |

Statuses: `pending` | `streaming` | `completed` | `failed` | `cancelled`

## `episodes`

| Column | Type |
|--------|------|
| id | UUID PK |
| slug | TEXT UNIQUE |
| guest | TEXT |
| title | TEXT |
| description | TEXT NULL |
| publish_date | DATE NULL |
| youtube_url | TEXT NULL |
| duration_seconds | INTEGER NULL |
| source_hash | TEXT |
| metadata | JSONB |
| created_at | TIMESTAMPTZ |
| updated_at | TIMESTAMPTZ |

## `transcript_chunks`

| Column | Type |
|--------|------|
| id | UUID PK |
| episode_id | UUID FK episodes |
| chunk_index | INTEGER |
| content | TEXT |
| token_count | INTEGER |
| embedding | VECTOR(N) |
| search_vector | TSVECTOR |
| content_hash | TEXT |
| metadata | JSONB |

Indexes: unique `(episode_id, chunk_index)`, GIN `search_vector`, HNSW cosine `embedding`, btree `episode_id`.

`N` must match `EMBEDDING_DIM` (detected from embedding model; expect 768 for embeddinggemma).

## `message_sources`

| Column | Type |
|--------|------|
| message_id | UUID FK messages |
| chunk_id | UUID FK transcript_chunks |
| citation_label | TEXT |
| rank | INTEGER |
| retrieval_score | FLOAT NULL |

PK: `(message_id, citation_label)`

## `artifacts`

| Column | Type |
|--------|------|
| id | UUID PK |
| session_id | UUID FK chat_sessions |
| message_id | UUID FK messages |
| type | TEXT |
| title | TEXT |
| content | TEXT |
| language | TEXT |
| created_at | TIMESTAMPTZ |
| updated_at | TIMESTAMPTZ |

## `agent_runs`

| Column | Type |
|--------|------|
| id | UUID PK |
| session_id | UUID FK chat_sessions |
| message_id | UUID NULL |
| skill | TEXT |
| routing_method | TEXT |
| provider | TEXT |
| model | TEXT |
| retrieved_chunks | INTEGER |
| status | TEXT |
| duration_ms | INTEGER NULL |
| error_code | TEXT NULL |
| metadata | JSONB |
| created_at | TIMESTAMPTZ |
