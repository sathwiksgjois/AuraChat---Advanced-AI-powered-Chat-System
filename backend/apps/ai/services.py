import json
import os
import logging
from openai import OpenAI
import re

logger = logging.getLogger(__name__)

class GroqService:
    def __init__(self):
        # Load multiple keys from a comma-separated environment variable
        keys_str = os.getenv("GROQ_API_KEYS", os.getenv("GROQ_API_KEY", ""))
        self.api_keys = [k.strip() for k in keys_str.split(",") if k.strip()]
        if not self.api_keys:
            raise ValueError("No Groq API keys found in environment")
        self.key_failures = {key: 0 for key in self.api_keys}
        self.model = "llama-3.3-70b-versatile"

    def _get_working_key(self):
        """Select a key with the fewest failures (simple round-robin)."""
        # Sort by failure count, pick one with minimum failures
        valid_keys = [k for k in self.api_keys if self.key_failures[k] < 3]  # allow up to 3 failures
        if not valid_keys:
            raise Exception("All API keys have failed too many times.")
        return min(valid_keys, key=lambda k: self.key_failures[k])

    def _call_groq(self, prompt, max_tokens=100, temperature=0.7):
        last_error = None
        for attempt in range(len(self.api_keys)):
            key = self._get_working_key()
            client = OpenAI(
                base_url="https://api.groq.com/openai/v1",
                api_key=key
            )
            try:
                response = client.chat.completions.create(
                    model=self.model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=temperature,
                    max_tokens=max_tokens
                )
                # Success – reset failure count for this key
                self.key_failures[key] = 0
                return response.choices[0].message.content
            except Exception as e:
                logger.warning(f"Key {key[:8]}... failed: {e}")
                self.key_failures[key] += 1
                last_error = e
                # If it's an auth error (401), mark as permanently failed
                if hasattr(e, 'status_code') and e.status_code == 401:
                    self.key_failures[key] = 999  # essentially blacklist
                continue
        # If all keys failed, raise the last error
        raise last_error or Exception("All API keys exhausted")
    def analyze_conversation(self, conversation, lang='en'):
        language_instruction = f"Respond in {lang} language." if lang != 'en' else ""
        prompt = f"""{language_instruction}
    Analyze the following conversation and return a **valid JSON object** with exactly three fields:
    - "mood": an object with "score" (0-100) and "label" (string: positive/neutral/negative)
    - "replies": a list of 3 short, casual, friendly replies to the last message, considering context
    - "suggestions": a list of 1 activity suggestion based on keywords

    Conversation:
    {conversation}

    JSON:"""
        result = self._call_groq(prompt, max_tokens=400, temperature=0.7)
        if result:
            print(f"Raw analyze_conversation response: {result}")  # DEBUG
            # Try to extract JSON if wrapped in markdown code blocks
            import re
            json_match = re.search(r'```json\s*(\{.*?\})\s*```', result, re.DOTALL)
            if json_match:
                json_str = json_match.group(1)
            else:
                json_str = result
            try:
                data = json.loads(json_str)
                if all(k in data for k in ('mood', 'replies', 'suggestions')):
                    return data
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse analyze_conversation JSON: {e}")
        return {
            'mood': {'score': 50, 'label': 'neutral'},
            'replies': ["Got it!", "Interesting", "Tell me more"],
            'suggestions': ["That's great!"]
        }
    def generate_continuation(self, partial_message, recent_context, lang='en'):
        """Generate ghost suggestion for typing."""
        language_instruction = f"Respond in {lang} language." if lang != 'en' else ""
        prompt = f"""{language_instruction}
You are a smart typing assistant. Continue the user's current message naturally.

Rules:
- Return only the continuation.
- Do NOT repeat the user's text.
- Maximum 12 words.
- Keep tone consistent with conversation.

Recent conversation:
{recent_context}

User is typing:
"{partial_message}"

Continuation:"""
        result = self._call_groq(prompt, max_tokens=30, temperature=0.5)
        return result.strip() if result else ""

    def summarize_conversation(self, messages, lang='en'):
        """Summarize a list of messages."""
        language_instruction = f"Respond in {lang} language." if lang != 'en' else ""
        conversation = "\n".join(messages)
        prompt = f"""{language_instruction}
Summarize the following conversation in 2-3 sentences.
Conversation:
{conversation}
Summary:"""
        result = self._call_groq(prompt, max_tokens=100, temperature=0.3)
        return result.strip() if result else "No summary available."

    def translate_batch(self, messages_dict, target_lang):
        """Translate a dict of {id: content} to target language."""
        msg_list = "\n".join([f'{msg_id}: "{content}"' for msg_id, content in messages_dict.items()])

        # Optional example for the target language
        examples = {
            'hi': 'Example: "Hello" -> "नमस्ते"',
            'kn': 'Example: "Hello" -> "ನಮಸ್ಕಾರ"',
            'en': 'Example: "नमस्ते" -> "Hello"'
        }
        example = examples.get(target_lang, '')

        prompt_template = """You are a translator. Translate each of the following messages to **{target_lang}**.
{example}

Return a JSON object where keys are message IDs (as strings) and values are the translated text in {target_lang}.
Do NOT include any other text, explanation, or markdown. ONLY output the raw JSON.

Messages:
{msg_list}

JSON:"""
        prompt = prompt_template.format(target_lang=target_lang, example=example, msg_list=msg_list)

        original_model = self.model
        self.model = "llama-3.3-70b-versatile"  # ensure we use the current model
        try:
            result = self._call_groq(prompt, max_tokens=2000, temperature=0.2)
            if result:
                logger.debug(f"Raw translation response for {target_lang}: {result[:200]}")
                try:
                    translations = json.loads(result)
                    if isinstance(translations, dict):
                        return {str(k): v for k, v in translations.items()}
                except json.JSONDecodeError as e:
                    logger.error(f"Translation JSON parse error: {e}")
            return None
        finally:
            self.model = original_model