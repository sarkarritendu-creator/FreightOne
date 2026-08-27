
# FreightOne — Final Full-Stack Prototype

This package preserves the approved UI and connects it to the FastAPI backend.

## Requirements
- Node.js 20+ recommended
- Python 3.11+

## Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 -m uvicorn main:app --reload
```
Open: http://127.0.0.1:8000/docs

## Frontend
Open a second terminal:
```bash
cd frontend
npm install
npm run dev
```
Open the URL printed by Vite (normally http://localhost:5173).

## Important design requirements implemented
- Login page does not display dummy credentials.
- Manager chooses a preferred port; vessel class is selected automatically by the backend.
- Results compare preferred port, nearest port, and other feasible ports.
- Rankings account for landed cost, ETA, congestion, and risk.
- Forecast uses 90 days with a widening confidence band.
- Consignments expose port ETA, earliest dispatch, final arrival, and reroute suggestions for delayed shipments.
Test modification for login branch
Test modification for login-auth branch
Test modification for login-auth branch
Test modification for optimizer branch
Test modification for tracker-contingency branch

