"""Direct Tavily and AviationStack calls. No MCP."""
import requests
from tavily import TavilyClient
from app.core.config import get_settings


def tavily_search(query):
    """Research destination guidance and approximate prices on the web."""
    key = get_settings().tavily_api_key

    if not key:
        return "Tavily key missing; live travel research is unavailable."

    try:
        results = TavilyClient(api_key=key).search(
            query=query,
            max_results=5,
        ).get("results", [])

        lines = []
        for item in results:
            lines.append(
                f"{item.get('title', '')}\n"
                f"{item.get('url', '')}\n"
                f"{item.get('content', '')[:400]}"
            )

        return "\n\n".join(lines)
    except Exception as error:
        return f"Search unavailable: {error}"


def search_flights(query):
    """Look up live flight statuses, not airfare prices or seat availability."""
    key = get_settings().aviationstack_api_key

    if not key:
        return "AviationStack key missing; live flight statuses are unavailable."

    try:
        response = requests.get(
            "http://api.aviationstack.com/v1/flights",
            params={"access_key": key, "limit": 5},
            timeout=15,
        )
        response.raise_for_status()
        data = response.json()

        if "error" in data:
            return f"Flight status provider error: {data['error']}"

        flights = []
        for item in data.get("data", [])[:5]:
            flights.append(
                f"Airline: {item.get('airline', {}).get('name', 'Unknown')}; "
                f"Departure: {item.get('departure', {}).get('airport', 'Unknown')}; "
                f"Arrival: {item.get('arrival', {}).get('airport', 'Unknown')}; "
                f"Status: {item.get('flight_status', 'Unknown')}"
            )

        return "\n".join(flights) or "No flight-status records returned."
    except Exception as error:
        return f"Flight-status data unavailable: {error}"
