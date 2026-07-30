import type { StreamEvent } from '../types/api';

export async function* parseNdjsonStream(
  body: ReadableStream<Uint8Array> | null,
): AsyncGenerator<StreamEvent> {
  if (!body) return;

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          yield JSON.parse(trimmed) as StreamEvent;
        } catch {
          console.warn('Skipping malformed NDJSON line:', trimmed);
        }
      }
    }

    const tail = buffer.trim();
    if (tail) {
      try {
        yield JSON.parse(tail) as StreamEvent;
      } catch {
        console.warn('Skipping malformed NDJSON tail:', tail);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function consumeStream(
  response: Response,
  onEvent: (event: StreamEvent) => void,
): Promise<void> {
  if (!response.ok) {
    let message = `Stream failed with status ${response.status}`;
    try {
      const err = (await response.json()) as { error?: { message?: string } };
      if (err.error?.message) message = err.error.message;
    } catch {
      /* empty */
    }
    throw new Error(message);
  }

  for await (const event of parseNdjsonStream(response.body)) {
    onEvent(event);
  }
}
