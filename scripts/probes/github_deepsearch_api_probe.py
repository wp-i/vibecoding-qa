from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path.cwd()))

from fastapi.testclient import TestClient

from github_deep_search.web import app


def main() -> int:
    query = sys.argv[1] if len(sys.argv) > 1 else "我想找一个可以把网页内容总结并同步到 Notion 的开源浏览器插件"
    client = TestClient(app)
    response = client.post("/api/search", json={"query": query, "mode": "light"}, timeout=180)
    payload = {
        "status_code": response.status_code,
        "ok": response.status_code == 200,
        "data": response.json() if response.headers.get("content-type", "").startswith("application/json") else response.text,
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0 if response.status_code == 200 else 1


if __name__ == "__main__":
    raise SystemExit(main())
