from app.state import TravelState
from app.tools.search import search_flights, tavily_search
from app.core.llm import ask_llm
from app import prompts


def flight_agent(state: TravelState):
    """Research airports, routes and rough fare estimates without inventing live prices."""
    query = state["user_query"]
    constraints = state.get("trip_constraints", {}) or {}
    origin = str(constraints.get("origin", "") or "").strip()
    destination = str(constraints.get("destination", "") or "").strip()

    flight_data = search_flights(query)
    research = tavily_search(f"airports flight routes for {query}")

    route = f"{origin} to {destination}" if origin and destination else query
    dates = str(constraints.get("dates", "") or constraints.get("duration", "") or "")
    fare_research = tavily_search(
        f"average round trip flight ticket price cost {route} {dates}".strip()
    )

    request = f"""
    Trip: {query}
    Constraints: {state.get('trip_constraints')}
    Flight-status API: {flight_data}
    Route research: {research}
    Fare research (use only if it gives real price figures): {fare_research}
    """
    result = ask_llm(prompts.FLIGHTS, request)

    return {
        "flight_results": result,
    }
