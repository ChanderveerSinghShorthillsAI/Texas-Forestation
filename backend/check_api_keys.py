#!/usr/bin/env python3
"""
check_api_keys.py

Quick connectivity checker for:
- Google Gemini (via GOOGLE_API_KEY)
- Weaviate Cloud (via WEAVIATE_CLUSTER_URL and WEAVIATE_API_KEY)

Usage:
  python check_api_keys.py            # checks both
  python check_api_keys.py --gemini   # check only Gemini
  python check_api_keys.py --weaviate # check only Weaviate

Exits with non-zero status if any requested check fails.
"""
from __future__ import annotations

import sys
import argparse
import logging
from typing import Tuple

# Local config (loads .env on import)
from config import config

# External deps
import google.generativeai as genai
import weaviate
from weaviate.classes.init import Auth

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger("api-key-checker")


def _mask(s: str) -> str:
    if not s:
        return "<missing>"
    s = str(s)
    if len(s) <= 8:
        return "*" * max(0, len(s) - 2) + s[-2:]
    return s[:2] + "*" * (len(s) - 6) + s[-4:]


def _gemini_has_any_text(resp) -> bool:
    try:
        candidates = getattr(resp, 'candidates', None)
        if not candidates:
            # Some library versions use 'result' attribute
            result = getattr(resp, 'result', None)
            candidates = getattr(result, 'candidates', None) if result is not None else None
        if not candidates:
            return False
        for cand in candidates:
            content = getattr(cand, 'content', None)
            if not content:
                continue
            parts = getattr(content, 'parts', None)
            if not parts:
                continue
            for part in parts:
                if getattr(part, 'text', None):
                    return True
        return False
    except Exception:
        return False


def check_gemini(timeout_s: int = 20) -> Tuple[bool, str]:
    try:
        if not config.GOOGLE_API_KEY:
            return False, "GOOGLE_API_KEY is missing"
        genai.configure(api_key=config.GOOGLE_API_KEY)
        # Prefer configured model, fallback to a lightweight one
        model_name = getattr(config, 'PLAN_GENERATION_MODEL', None) or 'gemini-1.5-flash'
        model = genai.GenerativeModel(model_name)
        logger.info("Connecting to Gemini model: %s (key: %s)", model_name, _mask(config.GOOGLE_API_KEY))
        # Minimal test call
        resp = model.generate_content("ping", generation_config=genai.types.GenerationConfig(max_output_tokens=8))
        if _gemini_has_any_text(resp):
            return True, "Gemini key OK"
        # As a secondary check, ensure no exception occurred and response has candidates
        if getattr(resp, 'candidates', None) or getattr(getattr(resp, 'result', None), 'candidates', None):
            return True, "Gemini responded (non-text parts); key looks OK"
        return False, "Gemini responded without candidates"
    except Exception as e:
        return False, f"Gemini check failed: {e}"


def check_weaviate(timeout_s: int = 15) -> Tuple[bool, str]:
    try:
        if not config.WEAVIATE_CLUSTER_URL:
            return False, "WEAVIATE_CLUSTER_URL is missing"
        if not config.WEAVIATE_API_KEY:
            return False, "WEAVIATE_API_KEY is missing"
        logger.info(
            "Connecting to Weaviate: %s (key: %s)",
            config.WEAVIATE_CLUSTER_URL,
            _mask(config.WEAVIATE_API_KEY),
        )
        client = weaviate.connect_to_weaviate_cloud(
            cluster_url=config.WEAVIATE_CLUSTER_URL,
            auth_credentials=Auth.api_key(config.WEAVIATE_API_KEY),
        )
        try:
            if not client.is_ready():
                return False, "Weaviate client not ready"
            _ = client.collections.list_all()
            return True, "Weaviate key/connection OK"
        finally:
            try:
                client.close()
            except Exception:
                pass
    except Exception as e:
        return False, f"Weaviate check failed: {e}"


def main():
    parser = argparse.ArgumentParser(description="Check API keys for Gemini and Weaviate")
    parser.add_argument("--gemini", action="store_true", help="Only check Google Gemini")
    parser.add_argument("--weaviate", action="store_true", help="Only check Weaviate")
    args = parser.parse_args()

    do_gemini = args.gemini or not (args.gemini or args.weaviate)
    do_weaviate = args.weaviate or not (args.gemini or args.weaviate)

    overall_ok = True

    if do_gemini:
        ok, msg = check_gemini()
        if ok:
            logger.info("✅ %s", msg)
        else:
            logger.error("❌ %s", msg)
        overall_ok = overall_ok and ok

    if do_weaviate:
        ok, msg = check_weaviate()
        if ok:
            logger.info("✅ %s", msg)
        else:
            logger.error("❌ %s", msg)
        overall_ok = overall_ok and ok

    sys.exit(0 if overall_ok else 1)


if __name__ == "__main__":
    main() 