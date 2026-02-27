import httpx
import logging

logger = logging.getLogger(__name__)

async def translate_text(text, target_lang, source_lang='en'):
    """Translate text using LibreTranslate with fallback."""
    if not text or target_lang == source_lang:
        return text

    # You can replace this URL with your own translation service
    url = "https://libretranslate.com/translate"
    payload = {
        "q": text,
        "source": source_lang,
        "target": target_lang,
        "format": "text"
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            result = response.json()
            return result.get("translatedText", text)
    except httpx.TimeoutException:
        logger.error(f"Translation timeout for text: {text[:50]}...")
    except httpx.HTTPStatusError as e:
        logger.error(f"Translation HTTP error {e.response.status_code}: {e.response.text}")
    except Exception as e:
        logger.error(f"Translation unexpected error: {e}")

    return text  # fallback