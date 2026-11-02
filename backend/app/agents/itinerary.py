"""Create the existing itinerary and structured dashboard data."""
import json
import re

from app.state import TravelState
from app.core.llm import ask_llm
from app import prompts


def parse_plan(text):
    """Read the JSON dashboard, keeping partial data instead of failing outright."""
    try:
        cleaned = str(text).strip()

        # Prefer the body of a ```json fence when the model wraps its answer.
        fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", cleaned)
        if fence:
            cleaned = fence.group(1)

        start = cleaned.index("{")
        end = cleaned.rindex("}") + 1
        data = json.loads(cleaned[start:end])

        if not isinstance(data, dict):
            return {}

        # Keep whatever sections are valid so the dashboard can still render.
        if not isinstance(data.get("days"), list):
            data["days"] = []
        if not isinstance(data.get("budget"), dict):
            data["budget"] = {}
        if not isinstance(data.get("weather"), dict):
            data["weather"] = {}

        has_identity = bool(data.get("title") or data.get("destination") or data.get("days"))
        return data if has_identity else {}
    except (ValueError, KeyError, TypeError):
        return {}


def create_dashboard(state: TravelState, itinerary):
    """Convert specialist findings into visual cards without changing other agents."""
    research = f"""
User request: {state.get('user_query', '')}
Constraints: {state.get('trip_constraints', {})}
Human feedback: {state.get('human_feedback', '')}
Draft itinerary: {itinerary}
Flight research: {state.get('flight_results', '')}
Hotel research: {state.get('hotel_results', '')}
OpenWeather findings: {state.get('weather_results', '')}
Budget research: {state.get('budget_results', '')}
"""

    result = parse_plan(ask_llm(prompts.DASHBOARD, research))

    # Retry with increasingly strict instructions if the JSON was unusable.
    for attempt in range(2):
        if result:
            break
        retry = ask_llm(
            prompts.DASHBOARD,
            "Return ONLY one valid JSON object matching the schema exactly — no prose, "
            f"no code fences. Attempt {attempt + 2}.\n" + research,
        )
        result = parse_plan(retry)

    return result


def itinerary_agent(state: TravelState):
    """Combine specialist findings into a draft for human review."""
    request = f"""
Trip: {state['user_query']}
Preferences: {state.get('trip_constraints')}
Flights: {state.get('flight_results', '')}
Hotels: {state.get('hotel_results', '')}
Weather: {state.get('weather_results', '')}
Budget: {state.get('budget_results', '')}
"""
    result = ask_llm(prompts.ITINERARY, request)
    dashboard = create_dashboard(state, result)

    return {
        "itinerary": result,
        "plan_data": dashboard,
        "approval_request": "Approve this plan or request changes?",
    }
