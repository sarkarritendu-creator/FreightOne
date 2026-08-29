# FreightOne — Proper Full-Stack Rebuild

This rebuild is based on the earlier FreightOne workflow and visual structure rather than the previous generic full-stack prototype.

## Included left-sidebar modules
1. Command Center
2. Procurement Planner
3. Freight Intelligence
4. Port Optimizer
5. Consignment Tracker
6. What-if Simulation
7. Alert Center
8. Stock & Inventory
9. Executive Report

## Demo login
- Manager ID: `r.sharma`
- Password: `sail123`

## Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Frontend
Open another terminal:
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

The backend is intentionally prototype-oriented and uses coherent static operational data and deterministic rules. The architecture keeps the existing API-driven model: frontend = presentation and interaction; FastAPI = decision logic.
