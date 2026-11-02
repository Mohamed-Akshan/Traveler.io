from app.state import TravelState
from app.tools.search import tavily_search
from app.core.llm import ask_llm
from app import prompts


def hotel_agent(state: TravelState):
    """Research areas to stay using Tavily and summarize hotel options."""
    research = tavily_search(f"best hotels and areas to stay {state['user_query']}")

    request = f"""
    Trip: {state['user_query']}
    Preferences: {state.get('trip_constraints')}
    Web findings: {research}
    """
    result = ask_llm(prompts.HOTELS, request)

    return {
        "hotel_results": result,
    }
