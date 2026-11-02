
"""FastAPI routes for chat, travel planning, and human approval."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from langchain_core.messages import HumanMessage
from langgraph.types import Command

from app.db.database import connect_memory
from app.graph import build_graph
from app.core.llm import ask_llm
from app.core.config import get_settings
from app.agents.guardrails import read_json
from app import prompts


# Connect PostgreSQL memory when FastAPI starts
@asynccontextmanager
async def lifespan(app: FastAPI):

    connection, saver = connect_memory()

    app.state.graph = build_graph(saver)

    yield

    connection.close()


# Create FastAPI application
app = FastAPI(
    title="Traveler.io API",
    lifespan=lifespan,
)


# Allow React frontend to communicate with FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Short-lived conversation memory per thread.
# Kept outside LangGraph on purpose: writing messages into graph state with
# as_node="final_agent" schedules the approval node and makes every later
# message on that thread hit the "pending itinerary" early-return.
CHAT_MEMORY: dict[str, list[str]] = {}


def remember(thread_id: str, line: str, limit: int = 24) -> None:
    bucket = CHAT_MEMORY.setdefault(thread_id, [])
    bucket.append(line)
    del bucket[:-limit]


def recall(thread_id: str) -> str:
    return "\n".join(CHAT_MEMORY.get(thread_id, []))


# Data received from React chat
class ChatInput(BaseModel):

    thread_id: str = Field(min_length=1, max_length=100)
    message: str = Field(min_length=1, max_length=6000)
    mode: str = "chat"


# Data received when user reviews an itinerary
class ReviewInput(BaseModel):

    thread_id: str = Field(min_length=1, max_length=100)
    approved: bool
    feedback: str = ""


# Check whether FastAPI is running
@app.get("/api/health")
def health():

    return {
        "status": "ok",
        "name": get_settings().app_name,
    }


# Handle normal chat and travel planning
@app.post("/api/chat")
def chat(body: ChatInput):

    # Thread ID identifies one conversation in PostgreSQL
    config = {
        "configurable": {
            "thread_id": body.thread_id,
        }
    }

    try:

        graph = app.state.graph

        # Get previous conversation memory
        snapshot = graph.get_state(config)

        # Check whether human approval is pending
        if snapshot.next:

            return {
                "status": "awaiting_approval",
                "reply": "Please review your pending itinerary first.",
                "draft": snapshot.values.get("itinerary", ""),
                "plan": snapshot.values.get("plan_data", {}),
            }

        # Normal buddy-style conversation
        if body.mode != "plan":

            history = recall(body.thread_id)

            # Ask Gemini, using Groq as fallback
            answer = ask_llm(
                prompts.CHAT,
                f"Conversation:\n{history}\n\nUser: {body.message}",
            )

            remember(body.thread_id, f"user: {body.message}")
            remember(body.thread_id, f"assistant: {answer}")

            return {
                "status": "chat",
                "reply": answer,
            }

        # Plan mode: ask for missing essentials ONCE before running the agents.
        history = recall(body.thread_id)

        check = read_json(
            ask_llm(
                prompts.CLARIFY,
                f"Conversation:\n{history}\n\nPlan request:\n{body.message}",
            )
        )

        if not check.get("ready"):
            reply = str(
                check.get("reply")
                or "Almost there — I just need the travel dates, number of days, and how many travellers are joining."
            )

            # Remember the exchange so the follow-up message has context.
            remember(body.thread_id, f"user: {body.message}")
            remember(body.thread_id, f"assistant: {reply}")

            return {
                "status": "clarify",
                "reply": reply,
                "missing": check.get("missing", []),
            }

        # Starting state for the multi-agent travel planner
        initial_state = {
            "messages": [
                HumanMessage(content=body.message)
            ],
            "user_query": body.message,
            "selected_agents": [],
            "trip_constraints": {},
            "flight_results": "",
            "hotel_results": "",
            "weather_results": "",
            "budget_results": "",
            "itinerary": "",
            "plan_data": {},
            "revision_count": 0,
            "final_response": "",
            "approved": False,
            "human_feedback": "",
            "blocked": False,
            "llm_calls": 0,
        }

        # Run LangGraph agents
        result = graph.invoke(
            initial_state,
            config=config,
        )

        # Get updated LangGraph state
        state = graph.get_state(config)

        # Return draft itinerary for human approval
        if state.next:

            return {
                "status": "awaiting_approval",
                "reply": "I drafted your trip! Take a look and tell me what you think. 🌿",
                "draft": state.values.get("itinerary", ""),
                "plan": state.values.get("plan_data", {}),
                "agents": state.values.get("selected_agents", []),
            }

        # Return completed response
        return {
            "status": "chat",
            "reply": result.get(
                "final_response",
                "I can help plan your next adventure.",
            ),
        }

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error),
        ) from error


# Handle human approval or revision
@app.post("/api/review")
def review(body: ReviewInput):

    # Use the same conversation thread
    config = {
        "configurable": {
            "thread_id": body.thread_id,
        }
    }

    try:

        graph = app.state.graph

        # Get paused workflow
        snapshot = graph.get_state(config)

        # Check whether human approval is pending
        if "human_approval_agent" not in snapshot.next:

            raise HTTPException(
                status_code=409,
                detail="No trip is awaiting approval.",
            )

        # Get approval and feedback from user
        feedback = {
            "approved": body.approved,
            "feedback": body.feedback,
        }

        # Resume LangGraph from the human approval interrupt
        result = graph.invoke(
            Command(resume=feedback),
            config=config,
        )

        updated = graph.get_state(config)

        if updated.next:
            return {
                "status": "awaiting_approval",
                "reply": "Mira updated your trip. Please review the new draft!",
                "draft": updated.values.get("itinerary", ""),
                "plan": updated.values.get("plan_data", {}),
            }

        return {
            "status": "completed" if body.approved else "revised",
            "reply": result.get("final_response", ""),
            "plan": updated.values.get("plan_data", {}),
            "draft": updated.values.get("itinerary", ""),
        }

    except HTTPException:

        raise

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error),
        ) from error
