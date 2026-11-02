import json

from app.state import TravelState
from app.tools.search import tavily_search
from app.core.llm import ask_llm
from app import prompts


def parse_budget(text):
    """Read the JSON budget object, falling back to raw prose on failure."""
    try:
        cleaned = text.strip()
        if "```" in cleaned:
            parts = cleaned.split("```")
            for part in parts:
                if "{" in part:
                    cleaned = part
                    break
        start = cleaned.index("{")
        end = cleaned.rindex("}") + 1
        data = json.loads(cleaned[start:end])
        if isinstance(data, dict) and isinstance(data.get("items"), list):
            data.setdefault("currency", "USD")
            return json.dumps(data)
    except (ValueError, TypeError):
        pass
    return text


def budget_agent(state: TravelState):
    research = tavily_search(
        f"typical daily food transit activities costs {state['user_query']}"
    )
    request = f"""
    Trip: {state['user_query']}
    Preferences: {state.get('trip_constraints')}
    Flights: {state.get('flight_results', '')}
    Hotels: {state.get('hotel_results', '')}
    Weather: {state.get('weather_results', '')}
    Recent cost research: {research}
    """
    result = ask_llm(prompts.BUDGET, request)
    return {
        "budget_results": parse_budget(result),
    }
