# Traveler.io — visual and connectivity repair

## Changes
- Replaced the previously used screenshot-as-background (which duplicated logo, text, and input) with normal scenic image assets and a clean pastel gradient overlay.
- Restored readable destination-card titles and improved hero/header spacing; Mira and the itinerary dashboard are retained.
- Added `frontend/vite.config.js`: local `/api` requests are proxied to FastAPI at `http://127.0.0.1:8000`, so browser development requests do not depend on cross-port CORS settings.
- Changed frontend `.env.example` to leave `VITE_API_URL` unset locally (for hosted deployments configure a real backend URL).
- Added a 120-second browser request timeout with clearer diagnostic messages rather than an endless wait.
- Changed the default Gemini model from an unlisted `gemini-3.5-flash` to documented `gemini-3.5-flash-lite`. Existing `.env` values override this: change `GEMINI_MODEL` there too if it was set earlier.
- Disabled automatic retries and added per-call client timeouts (35 seconds for Gemini; 25 seconds for Groq).
- No change to LangGraph agent nodes, supervisor routing, PostgreSQL checkpointer, or human-review endpoints.

## Run locally
1. Ensure PostgreSQL exists and your backend `.env` contains the right `DATABASE_URL`, `GOOGLE_API_KEY`, `GROQ_API_KEY`, `TAVILY_API_KEY` and `OPENWEATHER_API_KEY`. If your old `.env` says `GEMINI_MODEL=gemini-3.5-flash`, replace it with `gemini-3.5-flash-lite`.
2. Backend terminal:
   ```powershell
   cd backend
   python -m venv .venv
   .venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   Copy-Item .env.example .env
   python run.py
   ```
   Only use `Copy-Item` the first time, before you fill in `.env`. Do NOT overwrite an existing populated `.env`.
3. Open `http://127.0.0.1:8000/api/health`. It must return JSON. If it doesn't, inspect the backend terminal; failure at startup may mean bad PostgreSQL credentials or an uninitialized database.
4. Frontend terminal:
   ```powershell
   cd frontend
   npm install
   npm run dev
   ```
   **Delete/rename an older `frontend/.env` that sets `VITE_API_URL=http://localhost:8000`**, or clear that variable, so local requests use Vite's proxy.
5. Open `http://localhost:5173`; refresh once after changing Vite config.

## Why planning can still take time
All five specialist agents make external model or search calls sequentially. The new timeouts avoid unbounded browser waiting, but do not promise a fast complete trip. Detailed server errors will appear in the backend terminal. A healthy `/api/health` response does not guarantee your external keys or model quotas work.

## Verification limits
Python syntax checked and ZIP archive validated. Frontend packages could not be installed in the build environment due to registry DNS being unavailable, so a real React production build and authenticated end-to-end run were not verified.
