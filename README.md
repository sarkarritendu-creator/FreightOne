# FreightOne v6 — Preferred UI + Stable Backend

This package preserves the uploaded preferred frontend and fixes its actual runtime/backend issues.

## Important frontend fixes
- Added missing `useCallback` import (Tracker crashed because it used `useCallback` without importing it).
- Kept the preferred visual design and component structure.
- Vite proxy routes `/api/*` to FastAPI at `127.0.0.1:8000`.
- Fixed Procurement Planner to actually use the selected plant.
- Backend implements every endpoint the frontend calls.

## Backend
- FastAPI
- PostgreSQL through SQLAlchemy + psycopg
- Seeded managers, inventory and consignments
- Material-aware route decision engine
- Procurement intelligence
- Risk/news feed endpoint
- Forecast data
- Contingency/rerouting
- What-if simulation

## Start PostgreSQL
Make sure PostgreSQL is running and database `freightone` exists.

## Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL="postgresql+psycopg://tapassaha@localhost:5432/freightone"
uvicorn main:app --reload
```

Check:
`http://127.0.0.1:8000/api/health`

## Frontend
In a second terminal:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173`.

## Demo credentials
- `demo-manager` / `demo-password`
- `r.sharma` / `sail123`
