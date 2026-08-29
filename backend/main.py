from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from datetime import date, timedelta
import math, random

app = FastAPI(title='FreightOne API', version='3.0.0')
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_methods=['*'], allow_headers=['*'])

TODAY = date.today()
MATERIALS = {
 'coking_coal': {'name':'Coking Coal','price_mt':18200,'daily_consumption':4200,'inventory_mt':108000,'safety_stock':45000,'suppliers':['Australia','USA','Mozambique']},
 'iron_ore': {'name':'Iron Ore','price_mt':7800,'daily_consumption':7200,'inventory_mt':205000,'safety_stock':80000,'suppliers':['Australia','Brazil','South Africa']},
 'limestone': {'name':'Limestone','price_mt':3200,'daily_consumption':3800,'inventory_mt':96000,'safety_stock':40000,'suppliers':['UAE','Oman','India']},
}
ORIGINS = {
 'australia': {'label':'Australia','sea_days':18,'mult':1.00},
 'usa': {'label':'USA','sea_days':28,'mult':1.12},
 'mozambique': {'label':'Mozambique','sea_days':14,'mult':0.96},
 'brazil': {'label':'Brazil','sea_days':32,'mult':1.18},
}
PORTS = {
 'paradip': {'name':'Paradip Port','queue':2,'congestion':'Low','inland_days':2,'risk':18,'cost_mt':520},
 'haldia': {'name':'Haldia Port','queue':4,'congestion':'Medium','inland_days':5,'risk':34,'cost_mt':710},
 'vizag': {'name':'Visakhapatnam Port','queue':3,'congestion':'Medium','inland_days':4,'risk':27,'cost_mt':620},
}
PLANTS = {'RSP': {'name':'Rourkela Steel Plant','location':'Odisha','nearest_port':'Paradip','rank':'Senior Manager'}}
USERS = {'r.sharma': {'password':'sail123','name':'R. Sharma','employee_id':'SAIL-20417','rank':'Senior Manager','plant':'RSP','posting_place':'Rourkela Steel Plant'}}

CONSIGNMENTS = [
 {'id':'FO-2419','plant':'RSP','material':'coking_coal','origin':'Australia','port':'Paradip','vessel':'MV Eastern Horizon','tonnage':72000,'status':'On schedule','progress':76,'delay_days':0,'delay_reason':None,'port_eta':8,'final_days':11,'position':'Bay of Bengal'},
 {'id':'FO-2423','plant':'RSP','material':'iron_ore','origin':'Brazil','port':'Haldia','vessel':'MV Atlantic Crown','tonnage':90000,'status':'Delayed','progress':61,'delay_days':6,'delay_reason':'Port congestion and weather-related berth delay','port_eta':13,'final_days':20,'position':'North Bay of Bengal'},
 {'id':'FO-2431','plant':'RSP','material':'coking_coal','origin':'Mozambique','port':'Paradip','vessel':'MV Cape Meridian','tonnage':65000,'status':'Future','progress':18,'delay_days':0,'delay_reason':None,'port_eta':22,'final_days':25,'position':'Port of Beira'},
 {'id':'FO-2388','plant':'RSP','material':'limestone','origin':'Australia','port':'Vizag','vessel':'MV Ocean Crest','tonnage':48000,'status':'Delivered','progress':100,'delay_days':0,'delay_reason':None,'port_eta':-35,'final_days':-31,'position':'Delivered'},
]

class LoginIn(BaseModel): manager_id: str; password: str
class RouteIn(BaseModel): material: str='coking_coal'; origin: str='australia'; preferred_port: str='paradip'; priority: int=50; tonnage: int=80000; plant_code: str='RSP'; final_delivery: Optional[str]=None
class ProcurementIn(BaseModel): material: str='coking_coal'; quantity: int=80000; deadline_days: int=21; preferred_port: str='paradip'; priority: int=50; plant_code: str='RSP'
class RerouteIn(BaseModel): consignment_id: str


def fmt_day(days): return (TODAY + timedelta(days=days)).isoformat()

def forecast(days=90):
    hist=[]; pred=[]
    base=1320
    for i in range(60):
        v=base + math.sin(i/7)*34 + math.cos(i/13)*18 + i*0.7
        hist.append({'day':i-59,'index':round(v,1)})
    last=hist[-1]['index']
    for i in range(1,days+1):
        v=last + i*1.8 + math.sin(i/6)*26
        band=32+i*0.65
        pred.append({'day':i,'predicted':round(v,1),'lower':round(v-band,1),'upper':round(v+band,1)})
    return {'history':hist,'forecast':pred,'current_bdi':round(last,1),'model_horizon_days':days}

def route_options(x: RouteIn):
    material=MATERIALS.get(x.material,MATERIALS['coking_coal'])
    origin=ORIGINS.get(x.origin,ORIGINS['australia'])
    options=[]
    for pid,p in PORTS.items():
        sea_cost=material['price_mt']*origin['mult']*0.045
        priority_factor=(x.priority/100)*0.35
        eta=origin['sea_days']+p['queue']+p['inland_days']
        cost_per_mt=material['price_mt']+sea_cost+p['cost_mt']+eta*12*priority_factor
        risk=min(100,p['risk']+max(0,x.priority-70)*0.18)
        vessel='Capesize' if x.tonnage>=80000 and pid!='haldia' else ('Panamax' if x.tonnage>=45000 else 'Handysize')
        score=cost_per_mt+eta*(18+priority_factor*18)+risk*22
        options.append({'port_id':pid,'port':p['name'],'cost_per_mt':round(cost_per_mt),'total_cost':round(cost_per_mt*x.tonnage),'eta_days':eta,'risk_score':round(risk),'congestion':p['congestion'],'vessel':vessel,'optimization_score':round(score),'manager_preference':pid==x.preferred_port,'tags':[p['congestion']+' congestion', vessel]})
    options.sort(key=lambda o:o['optimization_score'])
    for i,o in enumerate(options,1): o['optimization_rank']=i
    selected=next(o for o in options if o['port_id']==x.preferred_port)
    best=options[0]
    better=None
    if best['port_id']!=selected['port_id']:
        better={'port':best['port'],'message':f"{best['port']} reduces estimated landed cost and recovery exposure versus the selected preference."}
    return {'selected_port':selected,'best_overall':best,'options':options,'better_alternative':better,'material':material['name']}

def procurement(x: ProcurementIn):
    m=MATERIALS.get(x.material,MATERIALS['coking_coal'])
    days_cover=m['inventory_mt']/m['daily_consumption']
    reorder=max(0,m['safety_stock']+m['daily_consumption']*x.deadline_days-m['inventory_mt'])
    urgency=min(10,max(1,round((x.deadline_days/max(days_cover,1))*5 + (1 if m['inventory_mt']<m['safety_stock']*1.5 else 0))))
    route=route_options(RouteIn(material=x.material,origin='australia',preferred_port=x.preferred_port,priority=x.priority,tonnage=x.quantity,plant_code=x.plant_code))
    rec=max(x.quantity,reorder,40000)
    return {'material':m['name'],'manager_preference':{'quantity_mt':x.quantity,'deadline_days':x.deadline_days,'preferred_port':PORTS[x.preferred_port]['name'],'priority':x.priority},'model_output':{'recommended_quantity_mt':round(rec/1000)*1000,'reorder_now':urgency>=7,'days_of_cover':round(days_cover,1),'urgency_index':urgency,'recommended_port':route['best_overall']['port'],'estimated_landed_cost':route['best_overall']['total_cost'],'reason':f"Current stock covers about {round(days_cover)} days. The decision combines inventory exposure, lead time and freight risk."}}

@app.get('/api/health')
def health(): return {'status':'ok','service':'FreightOne API'}

@app.post('/api/login')
def login(x: LoginIn):
    u=USERS.get(x.manager_id.lower())
    if not u or u['password']!=x.password: raise HTTPException(401,'Invalid Manager ID or password')
    manager={k:v for k,v in u.items() if k!='password'}
    plant=PLANTS[u['plant']]
    return {'manager':manager,'plant':plant}

@app.get('/api/reference-data')
def refs(): return {'materials':MATERIALS,'origins':ORIGINS,'ports':PORTS,'plants':PLANTS}
@app.get('/api/forecast')
def api_forecast(days:int=90): return forecast(min(max(days,30),180))
@app.get('/api/risk-score')
def risk_score():
    return {'risk_score':68,'risk_level':'amber','items':[
      {'title':'Low-pressure conditions are affecting the Bay of Bengal shipping corridor.','tags':['WEATHER'],'published':'LIVE'},
      {'title':'Queensland coal export loading has slowed after terminal disruption.','tags':['MARKET'],'published':'LIVE'},
      {'title':'VLSFO bunker prices remain elevated across Indian Ocean routes.','tags':['FUEL'],'published':'LIVE'}]}
@app.get('/api/news')
def news(material:str='coking_coal',origin:str='australia',port:str='paradip'): return risk_score()
@app.get('/api/market-intelligence')
def market_intelligence(material:str='coking_coal',origin:str='australia',port:str='paradip',plant_code:str='RSP'):
    m=MATERIALS.get(material,MATERIALS['coking_coal']); cover=m['inventory_mt']/m['daily_consumption']
    return {'buy_more_now':cover<30,'reason':f"{m['name']} has approximately {round(cover)} days of inventory cover. Freight risk is currently elevated, so booking timing should be monitored closely."}
@app.post('/api/route-options')
def api_routes(x: RouteIn): return route_options(x)
@app.post('/api/procurement-plan')
def api_procurement(x: ProcurementIn): return procurement(x)
@app.get('/api/consignments')
def consignments(plant_code:str='RSP', view:str='active'):
    items=[]
    for c in CONSIGNMENTS:
        if c['plant']!=plant_code: continue
        if view=='active' and c['status'] not in ['On schedule','Delayed']: continue
        if view=='future' and c['status']!='Future': continue
        if view=='past' and c['status']!='Delivered': continue
        items.append({**c,'material_label':MATERIALS[c['material']]['name'],'origin_label':c['origin'],'port_label':PORTS[c['port']]['name'],'plant_label':PLANTS[c['plant']]['name'],'eta_port_date':fmt_day(c['port_eta']),'earliest_dispatch_from_port':fmt_day(c['port_eta']+2),'expected_final_arrival':fmt_day(c['final_days']),'risk_percentage':min(95,20+c['delay_days']*8) if c['status']=='Delayed' else 22})
    return {'consignments':items}
@app.get('/api/consignment/{cid}')
def consignment(cid:str):
    c=next((x for x in CONSIGNMENTS if x['id']==cid),None)
    if not c: raise HTTPException(404,'Consignment not found')
    return {'consignment':c,'tracking':{'position':c['position'],'status':'Delayed' if c['status']=='Delayed' else 'On schedule','coordinates':[20.3,88.7]}}
@app.post('/api/reroute-suggestion')
def reroute(x:RerouteIn):
    c=next((z for z in CONSIGNMENTS if z['id']==x.consignment_id),None)
    if not c: raise HTTPException(404,'Consignment not found')
    if c['status']!='Delayed': return {'suggestion':None,'message':'No reroute required for an on-schedule consignment.'}
    return {'suggestion':{'recommended_port':'Paradip Port','recovery_mode':'Divert discharge + priority rail slot','estimated_recovery_days':4,'risk_reduction':31,'additional_cost':1850000,'message':'Reroute via Paradip and reserve a priority inland slot to recover approximately four of the six delayed days.','notification_status':'Draft notification ready for plant logistics control.'}}
@app.get('/api/freight-intelligence')
def freight_intelligence():
    f=forecast(90)
    return {'forecast':f,'booking_window':{'best_day':18,'expected_savings_percent':4.2,'reason':'Projected freight pressure eases before the next upward market cycle.'},'indices':{'BDI':f['current_bdi'],'Capesize':1880,'Panamax':1540,'Fuel':742}}
@app.get('/api/weather')
def weather():
    return {'region':'Bay of Bengal','status':'Moderate operational risk','risk':{'green':52,'yellow':26,'orange':15,'red':7},'series':[{'day':i,'risk':round(18+8*math.sin(i/5)+max(0,i-18)*0.7,1)} for i in range(1,31)]}
@app.get('/api/material-market')
def material_market(material:str='coking_coal'):
    m=MATERIALS.get(material,MATERIALS['coking_coal'])
    countries=[]
    for name,mult in [('Australia',1.0),('USA',1.12),('Mozambique',0.96)]: countries.append({'country':name,'price_mt':round(m['price_mt']*mult)})
    countries.sort(key=lambda x:x['price_mt'])
    return {'material':m['name'],'countries':countries,'lowest':countries[0]['country']}
@app.get('/api/inventory')
def inventory(plant_code:str='RSP'):
    out=[]
    for k,m in MATERIALS.items():
        cover=m['inventory_mt']/m['daily_consumption']; urgency=min(10,max(1,round(60/max(cover,1))))
        incoming=sum(c['tonnage'] for c in CONSIGNMENTS if c['plant']==plant_code and c['material']==k and c['status']!='Delayed')
        out.append({'id':k,'material':m['name'],'stock_mt':m['inventory_mt'],'daily_consumption':m['daily_consumption'],'days_cover':round(cover,1),'incoming_mt':incoming,'urgency_index':urgency,'rating':'Critical' if urgency>=8 else 'Watch' if urgency>=5 else 'Healthy'})
    return {'plant':PLANTS[plant_code]['name'],'items':out}
@app.get('/api/alerts')
def alerts():
    return {'alerts':[
      {'severity':'high','type':'CONSIGNMENT','title':'FO-2423 is delayed by 6 days','impact':'Iron ore supply exposure for Rourkela','action':'Open reroute recommendation'},
      {'severity':'medium','type':'WEATHER','title':'Bay of Bengal weather risk elevated','impact':'Possible berth and sailing delay','action':'Monitor vessel ETA'},
      {'severity':'medium','type':'MARKET','title':'BDI trend remains upward','impact':'Future charter cost sensitivity','action':'Review booking window'},
    ]}
@app.post('/api/what-if')
def what_if(x: RouteIn):
    r=route_options(x); sel=r['selected_port']; best=r['best_overall']
    return {'base':sel,'what_if':best,'difference':{'cost_delta':best['total_cost']-sel['total_cost'],'eta_delta_days':best['eta_days']-sel['eta_days'],'risk_delta':best['risk_score']-sel['risk_score']},'summary':'The model compares the manager-selected scenario against the highest-ranked alternative using the same cost, time and risk logic.'}
@app.get('/api/executive-report')
def report():
    inv=inventory()['items']; delayed=[c for c in CONSIGNMENTS if c['status']=='Delayed']
    return {'summary':{'network_risk':68,'active_consignments':2,'delayed_consignments':len(delayed),'inventory_watch':sum(1 for i in inv if i['urgency_index']>=5)},'decisions':['Review reroute for FO-2423','Monitor coking coal booking window','Keep Paradip as preferred route for current high-priority loads'],'generated_on':TODAY.isoformat()}
