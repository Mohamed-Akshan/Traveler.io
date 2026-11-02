"""Final user response and human-requested revisions."""

from langchain_core.messages import AIMessage
from app.state import TravelState
from app.core.llm import ask_llm
from app.agents.guardrails import output_guardrail
from app.agents.itinerary import create_dashboard
from app import prompts


def final_agent(state: TravelState):
    """Keep approved plans, or revise the draft for a new human review."""
    if state.get("approved"):
        request = f"""
The traveler approved the draft. Summarize it warmly without changing choices.
Draft: {state.get('itinerary', '')}
Budget: {state.get('budget_results', '')}
"""
        result = output_guardrail(ask_llm(prompts.FINAL, request))
        return {
            "final_response": result,
            "messages": [AIMessage(content=result)],
        }

    request = f"""
The traveler requests a revised draft, which must be reviewed again.
Original request: {state.get('user_query', '')}
Current itinerary: {state.get('itinerary', '')}
Human feedback: {state.get('human_feedback', '')}
Budget: {state.get('budget_results', '')}
Rewrite the entire day-by-day draft incorporating feedback.
"""
    revised = output_guardrail(ask_llm(prompts.FINAL, request))
    dashboard = create_dashboard(state, revised)

    return {
        "itinerary": revised,
        "plan_data": dashboard,
        "final_response": revised,
        "revision_count": state.get("revision_count", 0) + 1,
        "messages": [AIMessage(content="Revised draft is ready for review.")],
    }
