from langgraph.types import interrupt
from app.state import TravelState


def human_approval_agent(state: TravelState):
    """Pause the graph until the traveller approves or requests changes."""
    feedback = interrupt(
        {
            "question": "Do you approve this itinerary?",
            "draft_itinerary": state.get("itinerary", ""),
            "expected_response": {
                "approved": True,
                "feedback": "",
            },
        }
    )

    return {
        "approved": bool(feedback.get("approved", False)),
        "human_feedback": str(feedback.get("feedback", "")),
    }
