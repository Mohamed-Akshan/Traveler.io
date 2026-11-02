# Traveler.io — Mira frontend

A frontend-only replacement for the existing Traveler.io FastAPI/LangGraph backend.

## Run

1. Replace your existing `frontend` folder with this folder.
2. In a new terminal, run:

```powershell
cd frontend
npm install
npm run dev
```

3. Open the URL printed by Vite (normally http://127.0.0.1:5173).
4. Start your **unchanged** Python backend separately, normally on http://localhost:8000.

The frontend calls the existing endpoints:

- `POST /api/chat` — `{ thread_id, message, mode: "chat" | "plan" }`
- `POST /api/review` — `{ thread_id, approved, feedback }`

To change the backend URL, create `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
```

**Important:** Your FastAPI `CORSMiddleware` must allow your frontend origin (`http://localhost:5173` or `http://127.0.0.1:5173`). No backend route modifications are necessary.

## Visual summary and data accuracy

The dashboard displays day cards when the backend itinerary has `Day 1`, `Day 2`, etc. headings. Weather, budget, flight and hotel details are shown when the response includes separate `Weather`, `Budget`, `Flights`, and `Hotels` sections. If your existing backend returns a different format, use **Full AI plan** to view the complete original text. It never inserts invented prices, hotel names, live weather, or confirmed bookings.

Images are illustrative, loaded from Unsplash over the internet. Fonts are loaded from Google Fonts. For an offline/self-hosted deployment, replace those URLs with your own locally licensed assets.

The progress text rotates entirely in the frontend. It represents a friendly experience, **not real-time agent execution telemetry**.

The UI has: a welcome landing page, Mira chat page, visual itinerary dashboard, review/approve controls, chat suggestions, a new-trip option, and responsive styles. It intentionally has no navigation bar, account menu or notification controls.
