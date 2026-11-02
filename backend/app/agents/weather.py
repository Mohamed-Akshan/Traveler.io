"""Destination fallback so weather never runs with a blank city."""
import re

from app.state import TravelState
from app.tools.weather import get_weather
from app.tools.search import tavily_search
from app.core.llm import ask_llm
from app import prompts


def guess_destination(query):
    """Pull a place name out of the raw request when the supervisor left it blank."""
    match = re.search(
        r"\b(?:to|in|visit(?:ing)?|around|across)\s+"
        r"([A-Z][\w'’.-]*(?:\s+[A-Z][\w'’.-]*){0,3})",
        str(query or ""),
    )
    if not match:
        return ""
    place = match.group(1)
    # Trim trailing filler words the greedy capture may include.
    place = re.sub(
        r"\s+(?:for|and|with|during|this|next|a|an|the)\b.*$",
        "",
        place,
        flags=re.IGNORECASE,
    )
    return place.strip(" ,.")


def weather_agent(state: TravelState):
    """Use OpenWeather observations plus Tavily seasonal travel research."""
    constraints = state.get("trip_constraints", {})
    destination = str(constraints.get("destination", "") or "").strip()

    if not destination:
        destination = guess_destination(state.get("user_query", ""))

    live_weather = get_weather(destination)
    seasonal_research = tavily_search(
        f"typical travel climate and weather in {destination or state.get('user_query', '')}"
    )
    travel_dates = constraints.get("dates") or constraints.get("duration") or ""

    request = f"""
    Traveller's request: {state['user_query']}
    Destination: {destination}
    Travel dates: {travel_dates}
    OpenWeather data: {live_weather}
    General seasonal research: {seasonal_research}
    """

    result = ask_llm(prompts.WEATHER, request)

    return {
        "weather_results": result,
    }
