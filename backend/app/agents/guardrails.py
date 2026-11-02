import json
import re
from app.core.llm import ask_llm
from app import prompts


def read_json(text):
    match = re.search(r"\{.*\}", text, flags=re.S)
    if not match:
        raise ValueError("AI did not return valid JSON")
    return json.loads(match.group())


def input_guardrail(query):
    if not query.strip():
        return False, "Tell me where you'd love to travel!"
    if len(query) > 6000:
        return False, "That's a little long. Can you shorten your request?"
    result = read_json(ask_llm(prompts.GUARDRAIL, query))
    return bool(result.get("allowed", False)), result.get("reason", "I can help with travel-related requests.")


def output_guardrail(answer):
    # Use an LLM to check misleading claims in generated text.
    return ask_llm(prompts.OUTPUT, answer)
