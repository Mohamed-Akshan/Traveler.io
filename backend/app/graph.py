"""Explicit LangGraph supervisor routing (no loops in build_graph)."""
from langgraph.graph import StateGraph, START, END
from app.state import TravelState
from app.agents.supervisor import supervisor_agent
from app.agents.flight import flight_agent
from app.agents.hotel import hotel_agent
from app.agents.weather import weather_agent
from app.agents.budget import budget_agent
from app.agents.itinerary import itinerary_agent
from app.agents.human_approval import human_approval_agent
from app.agents.final import final_agent


def selected_agent_route(state: TravelState, remaining):
    """Select the next requested specialist in its correct execution order."""
    if state.get("blocked"):
        return END

    selected_agents = state.get("selected_agents", [])

    for agent in remaining:
        if agent in selected_agents:
            return agent

    return "human_approval_agent"


def route_from_supervisor(state: TravelState):
    """Start at the first specialist selected by the supervisor."""
    return selected_agent_route(
        state,
        ["flight_agent", "hotel_agent", "weather_agent", "budget_agent", "itinerary_agent"],
    )


def route_from_flight(state: TravelState):
    """Move on from flight research to the next selected agent."""
    return selected_agent_route(state, ["hotel_agent", "weather_agent", "budget_agent", "itinerary_agent"])


def route_from_hotel(state: TravelState):
    """Move on from hotel research to the next selected agent."""
    return selected_agent_route(state, ["weather_agent", "budget_agent", "itinerary_agent"])


def route_from_weather(state: TravelState):
    """Move on from weather research to the next selected agent."""
    return selected_agent_route(state, ["budget_agent", "itinerary_agent"])


def route_from_budget(state: TravelState):
    """Move on from budget research to drafting the itinerary."""
    return selected_agent_route(state, ["itinerary_agent"])


def route_after_final(state: TravelState):
    """Ask for approval again after a revision, with a safe retry limit."""
    if not state.get("approved") and state.get("revision_count", 0) < 3:
        return "human_approval_agent"
    return END


def build_graph(checkpointer):
    """Create explicit nodes and edges; use PostgreSQL for checkpoint memory."""
    graph = StateGraph(TravelState)

    graph.add_node("supervisor_agent", supervisor_agent)
    graph.add_node("flight_agent", flight_agent)
    graph.add_node("hotel_agent", hotel_agent)
    graph.add_node("weather_agent", weather_agent)
    graph.add_node("budget_agent", budget_agent)
    graph.add_node("itinerary_agent", itinerary_agent)
    graph.add_node("human_approval_agent", human_approval_agent)
    graph.add_node("final_agent", final_agent)

    graph.add_edge(START, "supervisor_agent")
    graph.add_conditional_edges("supervisor_agent", route_from_supervisor)
    graph.add_conditional_edges("flight_agent", route_from_flight)
    graph.add_conditional_edges("hotel_agent", route_from_hotel)
    graph.add_conditional_edges("weather_agent", route_from_weather)
    graph.add_conditional_edges("budget_agent", route_from_budget)
    graph.add_edge("itinerary_agent", "human_approval_agent")
    graph.add_edge("human_approval_agent", "final_agent")
    # Rejected drafts return to human approval after the revision.
    graph.add_conditional_edges("final_agent", route_after_final)

    return graph.compile(checkpointer=checkpointer)
