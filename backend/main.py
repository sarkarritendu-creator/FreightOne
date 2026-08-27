"""
FreightOne — Backend API v2 (FastAPI)
--------------------------------------------------------------------------
Rebuilt directly against the SIH problem statement:
  - Origins: Australia, US, Mozambique, Russia, Indonesia
  - East Coast India ports: Paradip, Vizag, Gangavaram, Gopalpur, Dhamra,
    Sagar-Sandheads, Haldia — each with draft / LOA / beam / handling-rate
    constraints and live-style congestion (ships in queue, berths).
  - Vessel type (Handysize/Supramax/Panamax/Capesize) is CHOSEN BY THE MODEL,
    not the manager — the manager only chooses a preferred PORT.
  - Manager's final delivery location is a separate step from "nearest port
    to my plant" — supports ordering to a different location entirely.
  - Congestion-aware port comparison (ships queued vs berths vs handling
    rate) drives a "better port available" suggestion, not just distance.
  - 90-day forecast with widening confidence band.
  - Order-timing optimizer: cost/arrival tradeoff across the next 90
    possible order dates.
  - Consignment tracking with full milestone chain (sail -> port arrival ->
    earliest dispatch -> plant delivery) and a reroute/diversion suggestion
    that "notifies" another plant's manager.

Run: uvicorn main:app --reload   ->   http://localhost:8000/docs
"""

import csv
import json
import math
import random
import datetime
from pathlib import Path
from typing import Optional, Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

DATA_DIR = Path(__file__).parent / "data"
app = FastAPI(title="FreightOne API v2", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def load_json(name):
    with open(DATA_DIR / name) as f:
        return json.load(f)


ORIGINS = load_json("origins.json")
PORTS = load_json("ports.json")
VESSELS = load_json("vessels.json")
PLANTS = load_json("plants.json")
CONSIGNMENTS = load_json("consignments.json")

VESSEL_ORDER = ["Capesize", "Panamax", "Supramax", "Handysize", "Coaster"]  # largest first — economies of scale

NEWS_FEED = [
    {"tag": "RISK", "scope": "origin:australia", "text": "Go-slow action reported at a Queensland coal export terminal.", "weight": 22},
    {"tag": "WEATHER", "scope": "port:paradip", "text": "IMD tracks a low-pressure system forming in the Bay of Bengal near Odisha.", "weight": 26},
    {"tag": "FUEL", "scope": "global", "text": "VLSFO bunker fuel prices up 4% week-on-week across Indian Ocean ports.", "weight": 10},
    {"tag": "MARKET", "scope": "global", "text": "Baltic Dry Index eases 3% on softer Capesize demand out of Asia.", "weight": -8},
    {"tag": "GEO", "scope": "origin:russia", "text": "Extended transit times reported via alternate routings for Far East Russian cargo.", "weight": 14},
    {"tag": "GEO", "scope": "global", "text": "Freight insurers note broadly stable conditions across Indian Ocean shipping lanes.", "weight": -5},
]


# ============================================================== schemas
class LoginRequest(BaseModel):
    manager_id: str
    password: str


class FinalDelivery(BaseModel):
    mode: Literal["plant", "custom"]
    label: Optional[str] = None
    distance_km: Optional[float] = None
    rate_per_mt_km: Optional[float] = 2.0


class RouteRequest(BaseModel):
    tonnage: int
    origin: str
    preferred_port: str
    priority: int  # 0 = price priority, 100 = deadline priority
    plant_code: str
    final_delivery: FinalDelivery


class OrderTimingRequest(BaseModel):
    tonnage: int
    origin: str
    port: str


class RerouteRequest(BaseModel):
    consignment_id: str


# ============================================================== helpers
def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def determine_vessel_plan(tonnage: int, port: dict):
    """The model — not the manager — selects vessel type: largest class that
    physically fits the port's draft/LOA/beam, for best per-MT economics."""
    for vname in VESSEL_ORDER:
        v = VESSELS[vname]
        if port["draft_m"] >= v["draft_req_m"] and port["loa_m"] >= v["loa_req_m"] and port["beam_m"] >= v["beam_req_m"]:
            shipments = math.ceil(tonnage / v["capacity_mt"])
            return {"vessel": vname, "shipments_needed": shipments, **v}
    return None  # no vessel class fits this port at all


def port_turnaround_days(port: dict, vessel_plan: dict):
    """Congestion-aware unloading time: how many ships are queued ahead of
    us, how many berths run in parallel, how fast each berth unloads."""
    unload_days_per_ship = vessel_plan["capacity_mt"] / port["handling_rate_mt_per_day"]
    ships_ahead = port["ships_in_queue"]
    total_ships_through_system = ships_ahead + vessel_plan["shipments_needed"]
    batches = math.ceil(total_ships_through_system / port["berths"])
    return round(batches * unload_days_per_ship, 1), unload_days_per_ship


def route_distance_km(port_id: str, plant_code: str):
    port = PORTS[port_id]
    plant = PLANTS[plant_code]
    if port_id == plant["nearest_port"]:
        return plant["rail_distance_km"]
    nearest = PORTS[plant["nearest_port"]]
    extra = haversine_km(port["lat"], port["lon"], nearest["lat"], nearest["lon"]) * 1.25  # road/rail routing factor
    return round(plant["rail_distance_km"] + extra)


def risk_for(origin_id=None, port_id=None):
    items = []
    for n in NEWS_FEED:
        if n["scope"] == "global":
            items.append(n)
        elif origin_id and n["scope"] == f"origin:{origin_id}":
            items.append(n)
        elif port_id and n["scope"] == f"port:{port_id}":
            items.append(n)
    score = min(100, max(4, 18 + sum(i["weight"] for i in items)))
    level = "red" if score >= 60 else "amber" if score >= 30 else "green"
    return {"score": score, "level": level, "items": items}


def build_route_option(port_id, req: RouteRequest, plant, is_preferred, is_nearest):
    port = PORTS[port_id]
    origin = ORIGINS[req.origin]
    plan = determine_vessel_plan(req.tonnage, port)
    if plan is None:
        return {
            "port_id": port_id, "port": port["name"], "feasible": False,
            "reason": f"No vessel class in our fleet plan can meet {port['name']}'s draft/LOA/beam limits — excluded.",
            "is_preferred": is_preferred, "is_nearest": is_nearest,
        }

    turnaround_days, unload_days_per_ship = port_turnaround_days(port, plan)
    sea_cost = req.tonnage * plan["sea_rate_per_mt"] * origin["base_sea_rate_multiplier"]

    if req.final_delivery.mode == "plant":
        distance_km = route_distance_km(port_id, req.plant_code)
        rate = plant["rail_rate_per_mt_km"]
        dest_label = plant["name"]
    else:
        distance_km = req.final_delivery.distance_km or 0
        rate = req.final_delivery.rate_per_mt_km or 2.0
        dest_label = req.final_delivery.label or "custom delivery location"

    inland_cost = req.tonnage * rate * (distance_km / 100)
    total_cost = sea_cost + inland_cost
    cost_per_mt = round(total_cost / req.tonnage, 2) if req.tonnage else 0

    sailing_days = origin["typical_transit_days"]
    inland_days = math.ceil(distance_km / 300) if distance_km else 0
    eta_days = round(sailing_days + turnaround_days + inland_days)

    risk = risk_for(origin_id=req.origin, port_id=port_id)

    reason = (
        f"Model selects {plan['shipments_needed']}x {plan['vessel']} "
        f"({plan['capacity_mt']:,} MT capacity each) — the largest class {port['name']}'s "
        f"{port['draft_m']}m draft / {port['loa_m']}m LOA can accommodate. "
        f"{port['ships_in_queue']} ships already queued across {port['berths']} berth(s), "
        f"~{unload_days_per_ship:.1f} days/ship to unload -> {turnaround_days} days port turnaround. "
        f"Inland leg to {dest_label}: {distance_km} km."
    )

    return {
        "port_id": port_id, "port": port["name"], "feasible": True,
        "vessel": plan["vessel"], "shipments_needed": plan["shipments_needed"],
        "cost_per_mt": cost_per_mt, "total_cost": round(total_cost),
        "sailing_days": sailing_days, "port_turnaround_days": turnaround_days,
        "inland_days": inland_days, "eta_days": eta_days,
        "distance_km": distance_km, "destination_label": dest_label,
        "risk_score": risk["score"], "risk_level": risk["level"],
        "is_preferred": is_preferred, "is_nearest": is_nearest,
        "reason": reason,
    }


# ============================================================== endpoints
@app.get("/api/health")
def health():
    return {"status": "ok", "service": "FreightOne API v2"}


@app.get("/api/reference-data")
def reference_data():
    """Everything the frontend needs to populate dropdowns — all source
    origins and all East Coast ports named in the problem statement."""
    return {"origins": ORIGINS, "ports": PORTS, "vessels": VESSELS, "plants": PLANTS}


@app.post("/api/login")
def login(req: LoginRequest):
    with open(DATA_DIR / "credentials_PRIVATE.csv") as f:
        for row in csv.DictReader(f):
            if row["manager_id"] == req.manager_id and row["password"] == req.password:
                plant = PLANTS[row["plant_code"]]
                return {"authenticated": True, "manager": {
                    "id": row["manager_id"], "name": row["name"], "plant": row["plant_code"],
                    "initials": "".join(w[0] for w in row["name"].split()[:2]).upper(),
                }, "plant": plant}
    raise HTTPException(status_code=401, detail="Manager ID or password not recognized.")


@app.get("/api/forecast")
def forecast(days: int = 90):
    """90-day-forward forecast (PS requires medium-term visibility, not just
    a short window). Confidence band widens with time AND during the
    monsoon window (day 20-50) to reflect real seasonal uncertainty."""
    history = []
    with open(DATA_DIR / "freight_rates.csv") as f:
        for row in csv.DictReader(f):
            history.append({"day": int(row["day"]), "index": int(row["index"]), "type": "history"})

    last_val = history[-1]["index"]
    slope = (history[-1]["index"] - history[-10]["index"]) / 10

    forecast_points = []
    val = last_val
    for i in range(1, days + 1):
        seasonal_vol = 1.6 if 20 <= i <= 50 else 1.0  # wider band in the monsoon window
        val += slope * 0.6 + random.uniform(-6, 6)
        band = (14 + i * 1.6) * seasonal_vol
        forecast_points.append({
            "day": i, "predicted": round(val),
            "lower": round(val - band), "upper": round(val + band),
            "type": "forecast",
        })
    return {"history": history, "forecast": forecast_points}


@app.get("/api/risk-score")
def risk_score():
    return risk_for()


@app.post("/api/route-options")
def route_options(req: RouteRequest):
    if req.plant_code not in PLANTS:
        raise HTTPException(400, "Unknown plant code.")
    if req.origin not in ORIGINS:
        raise HTTPException(400, "Unknown origin.")
    if req.preferred_port not in PORTS:
        raise HTTPException(400, "Unknown port.")

    plant = PLANTS[req.plant_code]
    nearest_port_id = plant["nearest_port"]

    candidate_ports = set(PORTS.keys())  # evaluate ALL ports named in the PS
    options = [
        build_route_option(pid, req, plant, is_preferred=(pid == req.preferred_port),
                            is_nearest=(pid == nearest_port_id))
        for pid in candidate_ports
    ]
    feasible = [o for o in options if o["feasible"]]

    if req.priority < 35:
        feasible.sort(key=lambda o: o["cost_per_mt"])
    elif req.priority > 65:
        feasible.sort(key=lambda o: o["eta_days"])
    else:
        feasible.sort(key=lambda o: o["cost_per_mt"] / 20 + o["eta_days"] / 5 + o["risk_score"] / 40)

    preferred_opt = next((o for o in feasible if o["is_preferred"]), None)
    nearest_opt = next((o for o in feasible if o["is_nearest"]), None)
    best_opt = feasible[0] if feasible else None

    # Even if the manager's preferred port turns out infeasible for this
    # cargo size, surface WHY rather than silently dropping it — the manager
    # asked for it explicitly and deserves a direct answer.
    preferred_infeasible = None
    if preferred_opt is None:
        raw_preferred = next((o for o in options if o["port_id"] == req.preferred_port), None)
        if raw_preferred and not raw_preferred["feasible"]:
            preferred_infeasible = {
                "port_id": raw_preferred["port_id"], "port": raw_preferred["port"],
                "reason": raw_preferred["reason"],
            }

    better_alternative = None
    if preferred_opt and best_opt and best_opt["port_id"] != preferred_opt["port_id"]:
        cost_saving_pct = round((preferred_opt["cost_per_mt"] - best_opt["cost_per_mt"]) / preferred_opt["cost_per_mt"] * 100, 1)
        time_diff = preferred_opt["eta_days"] - best_opt["eta_days"]
        if cost_saving_pct > 3 or time_diff > 2:
            better_alternative = {
                "port_id": best_opt["port_id"], "port": best_opt["port"],
                "cost_saving_pct": cost_saving_pct, "time_saved_days": time_diff,
                "message": (
                    f"{preferred_opt['port']} is your selection, but {best_opt['port']} works out "
                    f"{cost_saving_pct}% cheaper per MT and {abs(time_diff)} day(s) "
                    f"{'faster' if time_diff > 0 else 'slower'} once port congestion and unloading "
                    f"throughput are factored in — {best_opt['port']} clears "
                    f"{PORTS[best_opt['port_id']]['ships_in_queue']} queued ships across "
                    f"{PORTS[best_opt['port_id']]['berths']} berths faster than "
                    f"{preferred_opt['port']}'s {PORTS[preferred_opt['port_id']]['ships_in_queue']} "
                    f"queued ships across {PORTS[preferred_opt['port_id']]['berths']} berths."
                ),
            }

    # top 5 ranked + always ensure preferred & nearest are represented
    ranked = feasible[:5]
    for extra in [preferred_opt, nearest_opt]:
        if extra and extra["port_id"] not in [r["port_id"] for r in ranked]:
            ranked.append(extra)

    for o in ranked:
        tags = []
        if o is best_opt: tags.append("AI Recommended")
        if o["is_preferred"]: tags.append("Your Preference")
        if o["is_nearest"] and not o["is_preferred"]: tags.append("Nearest to Plant")
        o["tags"] = tags

    return {
        "options": ranked, "preferred": preferred_opt, "nearest": nearest_opt,
        "better_alternative": better_alternative, "preferred_infeasible": preferred_infeasible,
    }


@app.post("/api/order-timing")
def order_timing(req: OrderTimingRequest):
    """USP: exact best day to PLACE the order over the next 90 days, trading
    off projected cost vs projected arrival vs seasonal weather risk."""
    port = PORTS[req.port]
    origin = ORIGINS[req.origin]
    fc = forecast(days=90)
    base_rate = VESSELS["Panamax"]["sea_rate_per_mt"]  # illustrative single-vessel baseline for the curve

    points = []
    for f in fc["forecast"]:
        day = f["day"]
        idx_ratio = f["predicted"] / fc["history"][-1]["index"]
        weather_risk = 65 if 20 <= day <= 50 else 15  # monsoon window
        projected_cost_per_mt = round(base_rate * origin["base_sea_rate_multiplier"] * idx_ratio, 2)
        projected_arrival_day = day + origin["typical_transit_days"]
        points.append({
            "order_day": day, "projected_cost_per_mt": projected_cost_per_mt,
            "projected_arrival_day": projected_arrival_day, "weather_risk": weather_risk,
        })

    best = min(points, key=lambda p: p["projected_cost_per_mt"] + p["weather_risk"] * 0.5)
    return {"points": points, "recommended_order_day": best["order_day"], "recommended": best}


@app.get("/api/consignments")
def consignments(plant_code: Optional[str] = None):
    """Every active consignment plus its full milestone chain: expected port
    arrival, earliest possible dispatch FROM the port (after unloading +
    customs buffer), and expected final arrival at the plant/store."""
    today = datetime.date.today()
    enriched = []
    for c in CONSIGNMENTS:
        if plant_code and c["plant"] != plant_code:
            continue
        d = dict(c)
        port = PORTS[c["port"]]
        plant = PLANTS[c["plant"]]

        eta_days = c["eta_port_days"] + c.get("delay_days", 0)
        eta_port_date = today + datetime.timedelta(days=eta_days)

        unload_days_per_ship = VESSELS[c["vessel"]]["capacity_mt"] / port["handling_rate_mt_per_day"]
        customs_buffer_days = 1
        earliest_dispatch_date = eta_port_date + datetime.timedelta(days=math.ceil(unload_days_per_ship) + customs_buffer_days)

        distance_km = route_distance_km(c["port"], c["plant"])
        inland_days = math.ceil(distance_km / 300)
        final_arrival_date = earliest_dispatch_date + datetime.timedelta(days=inland_days)

        d["origin_label"] = ORIGINS[c["origin"]]["label"]
        d["port_label"] = port["name"]
        d["plant_label"] = plant["name"]
        d["eta_port_date"] = eta_port_date.isoformat()
        d["earliest_dispatch_from_port"] = earliest_dispatch_date.isoformat()
        d["expected_final_arrival"] = final_arrival_date.isoformat()
        d["inland_distance_km"] = distance_km
        enriched.append(d)
    return {"consignments": enriched}


@app.post("/api/reroute-suggestion")
def reroute_suggestion(req: RerouteRequest):
    target = next((c for c in CONSIGNMENTS if c["id"] == req.consignment_id), None)
    if not target:
        raise HTTPException(404, "Consignment not found.")
    if target["status"] != "delayed":
        return {"suggestion": None, "message": "This consignment is on schedule — no reroute needed."}

    # find another in-transit consignment that could spare tonnage toward a
    # nearby port serving the affected plant
    donor = next((c for c in CONSIGNMENTS if c["id"] != target["id"] and c["status"] == "on_schedule"), None)
    affected_plant = PLANTS[target["plant"]]

    if not donor:
        return {"suggestion": None, "message": "No suitable donor vessel currently in transit."}

    donor_plant = PLANTS[donor["plant"]]
    diverted_tonnage = min(15000, donor["tonnage"] // 4)
    days_recovered = min(target["delay_days"], 6)

    suggestion = {
        "donor_vessel": donor["id"],
        "donor_port": PORTS[donor["port"]]["name"],
        "donor_plant": donor_plant["name"],
        "diverted_tonnage": diverted_tonnage,
        "days_recovered": days_recovered,
        "affected_plant": affected_plant["name"],
        "message": (
            f"Divert {diverted_tonnage:,} MT from {donor['id']} (currently bound for "
            f"{donor_plant['name']} via {PORTS[donor['port']]['name']}) to cover "
            f"{affected_plant['name']}'s shortfall from delayed {target['id']}. "
            f"Recovers ~{days_recovered} of {target['delay_days']} delay days."
        ),
        "notification_sent_to": f"Manager, {donor_plant['name']}",
        "notification_message": (
            f"FreightOne is requesting {diverted_tonnage:,} MT be reassigned from your "
            f"incoming shipment {donor['id']} to support {affected_plant['name']}, which is "
            f"facing a {target['delay_days']}-day delay on {target['id']}. Please approve or "
            f"decline this reallocation and confirm compensating tonnage/timeline for your plant."
        ),
        "notification_sent": True,
    }
    return {"suggestion": suggestion}
