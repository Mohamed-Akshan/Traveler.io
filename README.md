# Traveler.io — Mira Travel Buddy

A cinematic two-screen React experience and your existing FastAPI + LangGraph multi-agent system. The design uses the two provided reference mockups, with no navigation bar, map, notifications, or profile.

## Changes to the uploaded backend

- **Unchanged architecture:** supervisor, flight, hotel, OpenWeather weather, budget, itinerary, human approval, final agent, guardrails, PostgreSQL LangGraph checkpointing, Gemini / Groq fallback, Tavily, FastAPI routes.
- **`app/prompts.py`:** adds `DASHBOARD`, a strict JSON format with daily activities, weather, hotels, flights, costs, and notes. Missing prices are null instead of invented.
- **`app/state.py`:** adds `plan_data` and `revision_count`.
- **`app/agents/itinerary.py`:** retains original text itinerary and adds a simple JSON dashboard formatter with one retry.
- **`app/agents/supervisor.py`:** makes sure all five specialists run for full itinerary planning, so flight, hotel, weather, and budget cards can be filled.
- **`app/agents/final.py`:** updates structured dashboard results when the human requests changes.
- **`app/graph.py`:** sends revised drafts back to human approval (up to three rounds), rather than treating an unapproved revision as final.
- **`app/main.py`:** returns a `plan` object alongside `draft` from the same two routes (`/api/chat` and `/api/review`). No new endpoints.
- **Frontend:** new screenshot-inspired landing page and itinerary dashboard, Mira assistant right sidebar, human review, animated progress, and **Download PDF** (client-side jsPDF). The PDF contains the full itinerary and available research details.

## Prerequisites

Python 3.11+, Node.js 20+, PostgreSQL with a `traveler` database, API keys for Gemini / Groq, Tavily, OpenWeather and optional AviationStack.

## Run backend (PowerShell, from project root)

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `backend/.env` with your own keys and PostgreSQL URL. The uploaded `.env` was intentionally removed from this deliverable so your real secrets do not leak.

Create database via pgAdmin or `CREATE DATABASE traveler;`, then start:

```powershell
python run.py
```

## Run frontend (new PowerShell terminal, from project root)

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. FastAPI defaults to http://localhost:8000. Override with `VITE_API_URL` in `frontend/.env` if necessary.

## How to use

Enter **Plan my Bali trip for 5 days. I love nature, beaches, and good food!** or choose a destination idea. Mira runs the full specialist workflow, displays the itinerary dashboard, and pauses for human approval. Approve, or write feedback then request changes. Revised plans return to human review. Use **Download PDF** on the itinerary dashboard to export the generated details.

## Important limits

The original UI screenshots are concept mockups, not real booking data. Destination images in the frontend are cropped from your supplied design screenshots and are illustrative. Backend prices are researched estimates, not verified bookings; absent price/date/forecast information stays unavailable. Weather observations are current/near-term, not reliable forecasts for distant travel dates. A missing city or origin should not be invented.

Python compilation and JSX parsing were checked. A full frontend Vite build and live API/PostgreSQL end-to-end run were **not** completed in this environment because npm installation timed out and credentials are not provided.
