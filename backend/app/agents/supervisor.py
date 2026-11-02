from langchain_core.messages import AIMessage
from app.state import TravelState
from app.core.llm import ask_llm
from app import prompts
from app.agents.guardrails import input_guardrail, read_json

AGENTS = {"flight_agent", "hotel_agent", "weather_agent", "budget_agent", "itinerary_agent"}


def supervisor_agent(state: TravelState):
    """Validate the request and choose the agents needed to plan the trip."""
    allowed, reason = input_guardrail(state["user_query"])

    if not allowed:
        return {
            "blocked": True,
            "selected_agents": [],
            "final_response": reason,
            "messages": [AIMessage(content=reason)],
        }

    history_lines = []

    for message in state.get("messages", [])[-8:]:
        history_lines.append(f"{message.type}: {str(message.content)[:500]}")

    history = "\n".join(history_lines)
    request = f"Conversation:\n{history}\n\nCurrent request:\n{state['user_query']}"
    parsed = read_json(ask_llm(prompts.SUPERVISOR, request))
    selected = []

    for agent in parsed.get("selected_agents", []):
        if agent in AGENTS:
            selected.append(agent)

    # A complete trip plan needs research from every specialist.
    for agent in [
        "flight_agent",
        "hotel_agent",
        "weather_agent",
        "budget_agent",
        "itinerary_agent",
    ]:
        if agent not in selected:
            selected.append(agent)

    return {
        "blocked": False,
        "selected_agents": selected,
        "trip_constraints": parsed.get("trip_constraints", {}),
        "supervisor_reasoning": parsed.get("reasoning", ""),
        "messages": [AIMessage(content="Supervisor prepared the travel plan workflow.")],
    }
