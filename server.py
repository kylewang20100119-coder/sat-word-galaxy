#!/usr/bin/env python3
"""Local static server plus a small OpenAI-backed DSAT passage endpoint."""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent
HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8000"))
MODEL = os.environ.get("OPENAI_MODEL", "gpt-5.4-mini")
API_KEY = os.environ.get("OPENAI_API_KEY", "").strip()
MOCK_MODE = os.environ.get("LEXIVERSE_MOCK", "") == "1"
MAX_BODY = 64 * 1024


OUTPUT_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "title": {"type": "string"},
        "passage": {"type": "string"},
        "question": {"type": "string"},
        "choices": {
            "type": "array",
            "items": {"type": "string"},
            "minItems": 4,
            "maxItems": 4,
        },
        "answer": {"type": "integer", "minimum": 0, "maximum": 3},
        "explanation": {"type": "string"},
        "vocabulary": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "word": {"type": "string"},
                    "meaning_in_context": {"type": "string"},
                    "sentence_excerpt": {"type": "string"},
                },
                "required": ["word", "meaning_in_context", "sentence_excerpt"],
            },
        },
    },
    "required": ["title", "passage", "question", "choices", "answer", "explanation", "vocabulary"],
}


def output_text(response: dict) -> str:
    for item in response.get("output", []):
        if item.get("type") != "message":
            continue
        for content in item.get("content", []):
            if content.get("type") == "output_text":
                return content.get("text", "")
    raise ValueError("OpenAI response did not contain output text")


def mock_practice(words: list[dict], genre: str) -> dict:
    ids = [word["id"] for word in words]
    preview_terms = ", ".join(ids)
    passage = (
        f"Researchers examining a {genre} question adopted an {ids[0]} approach, but the evidence soon "
        f"proved more {ids[1]} than expected. Their initial claim appeared {ids[2]}, while a later data set "
        f"offered a {ids[3]} account. Rather than dismiss the discrepancy, the team used it to refine the "
        f"study, showing how careful interpretation can transform an apparently settled conclusion. "
        f"This offline interface preview highlights every selected target term: {preview_terms}."
    )
    return {
        "title": "Evidence, Revision, and a Changing Conclusion",
        "passage": passage,
        "question": "Which choice best states the main purpose of the passage?",
        "choices": [
            "To describe how unexpected evidence prompted researchers to revise an interpretation",
            "To argue that all scientific disagreements result from poor data collection",
            "To compare two unrelated methods of memorizing technical vocabulary",
            "To show that an early conclusion was accepted without further examination",
        ],
        "answer": 0,
        "explanation": "The passage focuses on researchers revising their account after encountering evidence that complicated the original claim.",
        "vocabulary": [
            {"word": word["id"], "meaning_in_context": word.get("zh", "目标词"), "sentence_excerpt": passage}
            for word in words
        ],
        "model": "mock-preview",
    }


class Handler(SimpleHTTPRequestHandler):
    server_version = "LexiverseLocal/1.0"

    def send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path.split("?", 1)[0] == "/api/health":
            if MOCK_MODE:
                self.send_json(200, {"ok": True, "model": "mock-preview"})
            elif API_KEY:
                self.send_json(200, {"ok": True, "model": MODEL})
            else:
                self.send_json(503, {"ok": False, "error": "OPENAI_API_KEY is not configured"})
            return
        super().do_GET()

    def do_POST(self) -> None:
        if self.path.split("?", 1)[0] != "/api/generate-passage":
            self.send_json(404, {"error": "Not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BODY:
                raise ValueError("请求内容过大或为空")
            request_data = json.loads(self.rfile.read(length).decode("utf-8"))
            words = request_data.get("words")
            if not isinstance(words, list) or not 4 <= len(words) <= 16:
                raise ValueError("请选择 4–16 个目标单词")
            cleaned_words = []
            for word in words:
                word_id = str(word.get("id", "")).strip().lower()
                if not re.fullmatch(r"[a-z][a-z '\-]{0,39}", word_id):
                    raise ValueError("目标单词格式不正确")
                cleaned_words.append({
                    "id": word_id,
                    "definition": str(word.get("definition", ""))[:280],
                    "zh": str(word.get("zh", ""))[:160],
                    "pos": str(word.get("pos", ""))[:40],
                })
            difficulty = request_data.get("difficulty", "standard")
            genre = request_data.get("genre", "science")
            if difficulty not in {"standard", "hard"} or genre not in {"science", "social", "humanities", "literary"}:
                raise ValueError("练习参数不正确")
        except (ValueError, TypeError, json.JSONDecodeError) as error:
            self.send_json(400, {"error": str(error)})
            return

        if MOCK_MODE:
            self.send_json(200, mock_practice(cleaned_words, genre))
            return
        if not API_KEY:
            self.send_json(503, {"error": "未配置 OPENAI_API_KEY。请按照 README 的方式启动服务器。"})
            return

        instructions = (
            "You are an expert Digital SAT Reading and Writing item writer. Create an original passage and one "
            "multiple-choice question inspired by the skills and compact format of the DSAT, without copying any "
            "real College Board material. Use every supplied target word naturally and accurately. The passage must "
            "be coherent, academically appropriate for a high-school student, and 180–260 words for standard or "
            "230–330 words for hard. The question should test central idea, inference, text structure, or vocabulary "
            "in context. Provide exactly four plausible choices and one unambiguous answer. Keep the explanation concise."
        )
        prompt = json.dumps({"difficulty": difficulty, "genre": genre, "target_words": cleaned_words}, ensure_ascii=False)
        payload = {
            "model": MODEL,
            "instructions": instructions,
            "input": prompt,
            "max_output_tokens": 2600,
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "dsat_vocabulary_practice",
                    "strict": True,
                    "schema": OUTPUT_SCHEMA,
                }
            },
        }
        api_request = urllib.request.Request(
            "https://api.openai.com/v1/responses",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(api_request, timeout=90) as response:
                api_response = json.loads(response.read().decode("utf-8"))
            result = json.loads(output_text(api_response))
            result["model"] = MODEL
            self.send_json(200, result)
        except urllib.error.HTTPError as error:
            try:
                detail = json.loads(error.read().decode("utf-8")).get("error", {}).get("message", "OpenAI 请求失败")
            except Exception:
                detail = "OpenAI 请求失败"
            self.send_json(error.code if 400 <= error.code < 600 else 502, {"error": detail})
        except (urllib.error.URLError, TimeoutError):
            self.send_json(502, {"error": "无法连接 OpenAI，请检查网络后重试。"})
        except (ValueError, json.JSONDecodeError):
            self.send_json(502, {"error": "OpenAI 返回的练习格式无法读取，请重试。"})


def main() -> None:
    handler = partial(Handler, directory=str(ROOT))
    server = ThreadingHTTPServer((HOST, PORT), handler)
    mode = "mock preview" if MOCK_MODE else MODEL
    print(f"Lexiverse running at http://{HOST}:{PORT} ({mode})")
    if not API_KEY and not MOCK_MODE:
        print("OPENAI_API_KEY is not set; the vocabulary galaxy works, but AI generation is disabled.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
