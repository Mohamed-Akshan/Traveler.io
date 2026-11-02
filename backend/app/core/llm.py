"""Use Gemini for generation, with Groq as a fallback provider."""
from datetime import date

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from app.core.config import get_settings


def today_context() -> str:
    """Simple current-date awareness appended to every model call.

    Keeps suggestions in the present: never propose a month, week or date
    that has already passed (e.g. asking to 'surprise me' in November must
    not return an October trip).
    """
    today = date.today()
    return (
        f"\n\n[System context: today is {today.strftime('%A, %d %B %Y')}. "
        "Never suggest a month, week, season or date that has already passed. "
        "When no period is specified, propose the current month or later; "
        "treat the current month as the earliest available option.]"
    )


def _text(content):
    """Flatten string or content-block responses into plain text."""
    if isinstance(content, str):
        return content

    blocks = content if isinstance(content, list) else [content]
    parts = []
    for block in blocks:
        if isinstance(block, dict):
            parts.append(str(block.get("text", "")))
        else:
            parts.append(str(block))
    return "\n".join(part for part in parts if part)


def ask_llm(system, prompt):
    """Ask Gemini first and retry with Groq if Gemini fails."""
    settings = get_settings()
    messages = [
        SystemMessage(content=system),
        HumanMessage(content=prompt + today_context()),
    ]
    errors = []

    if settings.google_api_key:
        try:
            llm = ChatGoogleGenerativeAI(
                model=settings.gemini_model,
                google_api_key=settings.google_api_key,
                temperature=0.5,
                max_retries=0,
                timeout=35,
            )
            return _text(llm.invoke(messages).content)
        except Exception as error:
            errors.append(f"Gemini: {error}")

    if settings.groq_api_key:
        try:
            llm = ChatGroq(
                model=settings.groq_model,
                api_key=settings.groq_api_key,
                temperature=0.5,
                max_retries=0,
                timeout=25,
            )
            return _text(llm.invoke(messages).content)
        except Exception as error:
            errors.append(f"Groq: {error}")

    raise RuntimeError(
        "No working LLM. Check GOOGLE_API_KEY and GROQ_API_KEY. "
        + "; ".join(errors)
    )
