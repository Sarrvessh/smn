from __future__ import annotations

import re

SCRIPT_RE = re.compile(r"<script\b", re.IGNORECASE)
EVENT_HANDLER_RE = re.compile(r"\son\w+\s*=", re.IGNORECASE)
JS_URL_RE = re.compile(r"javascript:", re.IGNORECASE)
IFRAME_RE = re.compile(r"<iframe\b", re.IGNORECASE)
OBJECT_RE = re.compile(r"<(object|embed|form)\b", re.IGNORECASE)
EXTERNAL_SRC_RE = re.compile(
    r"""<(script|link|iframe)\b[^>]*(src|href)\s*=\s*['"]https?://""",
    re.IGNORECASE,
)

CSP_META = (
    '<meta http-equiv="Content-Security-Policy" content="'
    "default-src 'none'; style-src 'unsafe-inline'; img-src data:; "
    "font-src data:; connect-src 'none'; script-src 'none'; "
    "frame-src 'none'; object-src 'none;"
    '">'
)


def sanitize_html_artifact(content: str) -> str:
    if (
        SCRIPT_RE.search(content)
        or EVENT_HANDLER_RE.search(content)
        or JS_URL_RE.search(content)
        or IFRAME_RE.search(content)
        or OBJECT_RE.search(content)
        or EXTERNAL_SRC_RE.search(content)
    ):
        raise ValueError("HTML artifact contains forbidden elements")

    cleaned = content
    if "<html" in cleaned.lower():
        if "Content-Security-Policy" not in cleaned:
            cleaned = cleaned.replace("<head>", f"<head>{CSP_META}", 1)
            if CSP_META not in cleaned:
                cleaned = CSP_META + cleaned
    else:
        cleaned = f"<!DOCTYPE html><html><head>{CSP_META}</head><body>{cleaned}</body></html>"
    return cleaned


def validate_artifact_content(artifact_type: str, content: str, max_chars: int) -> str:
    if not content or not content.strip():
        raise ValueError("Artifact content is empty")
    if len(content) > max_chars:
        raise ValueError("Artifact exceeds max size")
    if artifact_type == "html":
        return sanitize_html_artifact(content)
    return content
