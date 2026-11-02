from typing import TypedDict, Annotated
import operator
from langchain_core.messages import AnyMessage

class TravelState(TypedDict, total=False):
    messages: Annotated[list[AnyMessage], operator.add]
    user_query: str
    selected_agents: list[str]
    trip_constraints: dict
    supervisor_reasoning: str
    flight_results: str
    hotel_results: str
    weather_results: str
    budget_results: str
    itinerary: str
    plan_data: dict
    revision_count: int
    final_response: str
    approved: bool
    human_feedback: str
    approval_request: str
    blocked: bool
    llm_calls: int
