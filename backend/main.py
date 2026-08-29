from __future__ import annotations
import os, math, random
from datetime import date, timedelta
from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, Column, String, Float, Integer, Boolean, Date, JSON, text
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL=os.getenv('DATABASE_URL','postgresql+psycopg://localhost:5432/freightone')
Base=declarative_base()
engine=create_engine(DATABASE_URL,pool_pre_ping=True,future=True)
SessionLocal=sessionmaker(bind=engine,autocommit=False,autoflush=False)

class Manager(Base):
    __tablename__='managers'; manager_id=Column(String,primary_key=True); password=Column(String,nullable=False); name=Column(String,nullable=False); plant_code=Column(String,nullable=False)
class Consignment(Base):
    __tablename__='consignments'; id=Column(String,primary_key=True); plant_code=Column(String,index=True); material_code=Column(String); origin_code=Column(String); port_code=Column(String); vessel=Column(String); tonnage=Column(Float); status=Column(String); delay_days=Column(Integer,default=0); delay_reason=Column(String,nullable=True); eta_days=Column(Integer); progress=Column(Integer,default=35)
class Inventory(Base):
    __tablename__='inventory'; id=Column(Integer,primary_key=True,autoincrement=True); plant_code=Column(String,index=True); material_code=Column(String,index=True); current_inventory_mt=Column(Float); daily_consumption_mt=Column(Float); safety_days=Column(Integer)

ORIGINS={
'australia':{'label':'Australia','material_bias':['coking_coal','thermal_coal'],'transit':18,'rate':1.0},
'indonesia':{'label':'Indonesia','material_bias':['thermal_coal'],'transit':9,'rate':0.86},
'mozambique':{'label':'Mozambique','material_bias':['coking_coal'],'transit':16,'rate':1.05},
'russia':{'label':'Russia','material_bias':['thermal_coal','coking_coal'],'transit':22,'rate':1.12},
'usa':{'label':'United States','material_bias':['coking_coal'],'transit':30,'rate':1.2},
}
PORTS={
'vizag':{'name':'Visakhapatnam','km':450,'handling':65000,'base_cost':42},'gangavaram':{'name':'Gangavaram','km':470,'handling':70000,'base_cost':39},'paradip':{'name':'Paradip','km':620,'handling':78000,'base_cost':36},'dhamra':{'name':'Dhamra','km':760,'handling':50000,'base_cost':44},'haldia':{'name':'Haldia','km':910,'handling':42000,'base_cost':52},'gopalpur':{'name':'Gopalpur','km':530,'handling':35000,'base_cost':49}}
PLANTS={'RSP':{'name':'Rourkela Steel Plant'},'BSP':{'name':'Bokaro Steel Plant'},'DSP':{'name':'Durgapur Steel Plant'}}
MATERIALS={
'coking_coal':{'name':'Coking Coal','category':'Metallurgical','preferred_origins':['australia','mozambique','usa','russia'],'preferred_ports':['vizag','gangavaram','paradip'],'daily_multiplier':1.0},
'thermal_coal':{'name':'Thermal Coal','category':'Energy','preferred_origins':['indonesia','australia','russia'],'preferred_ports':['paradip','dhamra','haldia'],'daily_multiplier':1.15},
'iron_ore':{'name':'Iron Ore','category':'Bulk Raw Material','preferred_origins':['australia'],'preferred_ports':['vizag','paradip'],'daily_multiplier':0.9},
}

def seed():
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if db.query(Manager).count()==0:
            db.add_all([Manager(manager_id='demo-manager',password='demo-password',name='Demo Manager',plant_code='RSP'),Manager(manager_id='r.sharma',password='sail123',name='R. Sharma',plant_code='RSP')])
        if db.query(Inventory).count()==0:
            for pc in PLANTS:
                for mc,m in MATERIALS.items(): db.add(Inventory(plant_code=pc,material_code=mc,current_inventory_mt=180000 if mc=='coking_coal' else 130000,daily_consumption_mt=11500 if mc=='coking_coal' else 8000,safety_days=12))
        if db.query(Consignment).count()==0:
            db.add_all([
              Consignment(id='FO-2026-001',plant_code='RSP',material_code='coking_coal',origin_code='australia',port_code='vizag',vessel='Panamax',tonnage=75000,status='on_schedule',eta_days=8,progress=62),
              Consignment(id='FO-2026-002',plant_code='RSP',material_code='coking_coal',origin_code='mozambique',port_code='paradip',vessel='Supramax',tonnage=55000,status='delayed',delay_days=3,delay_reason='Berth congestion and weather-related unloading delay.',eta_days=11,progress=48),
              Consignment(id='FO-2026-003',plant_code='BSP',material_code='thermal_coal',origin_code='indonesia',port_code='dhamra',vessel='Supramax',tonnage=60000,status='on_schedule',eta_days=6,progress=71)])
        db.commit()

def vessel_for(tonnage,port):
    if tonnage>=120000 and port in ['vizag','paradip','gangavaram']: return 'Capesize'
    if tonnage>=65000:return 'Panamax'
    return 'Supramax' if tonnage>=35000 else 'Handysize'

def risk(origin,port,material):
    score=18
    if origin=='russia':score+=18
    if port=='paradip':score+=9
    if material=='thermal_coal':score+=4
    return min(95,score)

def level(score): return 'red' if score>=65 else 'amber' if score>=35 else 'green'

def route_options(payload):
    mat=MATERIALS[payload.material]; origin=ORIGINS[payload.origin]; opts=[]
    for pid,p in PORTS.items():
        affinity=1.0 if pid in mat['preferred_ports'] else .72
        preferred_bonus=.0
        if pid==payload.preferred_port: preferred_bonus=0
        sea=payload.tonnage*(42*origin['rate']+p['base_cost'])
        inland=payload.tonnage*(p['km']/100)*1.8
        total=sea+inland
        eta=origin['transit']+math.ceil(payload.tonnage/p['handling']*4)+math.ceil(p['km']/350)
        rs=risk(payload.origin,pid,payload.material)
        price_score=100-(total/100000000)*100
        time_score=100-min(90,eta*3.3)
        suitability=round(45+35*affinity+12*(pid in mat['preferred_ports'])-rs*.12,1)
        score=(100-payload.priority)/100*price_score+payload.priority/100*time_score+suitability*.18-rs*.08
        tags=['Material-preferred'] if pid in mat['preferred_ports'] else []
        if pid==payload.preferred_port: tags.insert(0,'Manager selected')
        opts.append({'port_id':pid,'port':p['name'],'material':mat['name'],'cost_per_mt':round(total/payload.tonnage,2),'total_cost':round(total),'eta_days':int(eta),'risk_score':rs,'risk_level':level(rs),'vessel':vessel_for(payload.tonnage,pid),'ml_suitability_score':suitability,'score':score,'tags':tags,'reason':f"{mat['name']} lane analysis combines landed cost, ETA, material-port suitability and current risk for {p['name']}."})
    ranked=sorted(opts,key=lambda x:x['score'],reverse=True)
    for i,o in enumerate(ranked,1):o['optimization_rank']=i
    selected=next(o for o in opts if o['port_id']==payload.preferred_port)
    display=[selected]+[o for o in ranked if o['port_id']!=selected['port_id']]
    alt=ranked[0] if ranked[0]['port_id']!=selected['port_id'] else None
    return {'selected_port':selected,'options':display,'ranking_note':'Your selected port is always displayed first; true optimization rank remains visible separately.','better_alternative':None if not alt else {'port':alt['port'],'message':f"Model ranks {alt['port']} higher at #{alt['optimization_rank']} based on current landed cost, ETA, risk and material suitability."}}

class LoginRequest(BaseModel): manager_id:str; password:str
class RouteRequest(BaseModel): tonnage:float=Field(gt=0); material:str; origin:str; preferred_port:str; priority:float=Field(ge=0,le=100); plant_code:str; final_delivery:dict={}
class ProcurementRequest(BaseModel): plant_code:str; material:str; horizon_days:int=60
class RerouteRequest(BaseModel): consignment_id:str

@asynccontextmanager
async def lifespan(app):
    seed(); yield
app=FastAPI(title='FreightOne API',version='6.0',lifespan=lifespan,docs_url='/docs',redoc_url=None)
app.add_middleware(CORSMiddleware,allow_origins=['http://localhost:5173','http://127.0.0.1:5173'],allow_methods=['*'],allow_headers=['*'])

@app.get('/api/health')
def health():
    with engine.connect() as c:c.execute(text('SELECT 1'))
    return {'status':'ok','service':'FreightOne API','database':'connected'}
@app.post('/api/login')
def login(r:LoginRequest):
    with SessionLocal() as db:
        m=db.get(Manager,r.manager_id)
        if not m or m.password!=r.password: raise HTTPException(401,'Invalid Manager ID or password')
        return {'manager':{'id':m.manager_id,'name':m.name,'plant':m.plant_code},'plant':PLANTS[m.plant_code]}
@app.get('/api/reference-data')
def refs():return {'materials':MATERIALS,'origins':ORIGINS,'ports':PORTS,'plants':PLANTS}
@app.get('/api/forecast')
def forecast(days:int=90):
    hist=[]; fc=[]; base=1320
    for i in range(1,31): hist.append({'day':i,'index':round(base+2.8*i+28*math.sin(i/4),1),'upper':None,'lower':None,'predicted':None})
    for i in range(31,days+1):
        pred=base+2.8*i+28*math.sin(i/4); band=25+(i-30)*.7; fc.append({'day':i,'predicted':round(pred,1),'upper':round(pred+band,1),'lower':round(pred-band,1),'index':None})
    return {'history':hist,'forecast':fc}
@app.get('/api/news')
def news(material:str='coking_coal',origin:str='australia',port:str='vizag'):
    rs=risk(origin,port,material); items=[
      {'title':f'{ORIGINS[origin]["label"]} bulk export conditions remain under watch','published':'LIVE','tags':['ORIGIN','RISK'],'url':'https://www.reuters.com/'},
      {'title':f'{PORTS[port]["name"]} congestion and handling conditions monitored','published':'LIVE','tags':['PORT','LOGISTICS'],'url':'https://www.reuters.com/'},
      {'title':'Dry bulk freight market volatility remains elevated','published':'LIVE','tags':['MARKET'],'url':'https://www.reuters.com/'}]
    return {'risk_score':rs,'risk_level':level(rs),'items':items}
@app.get('/api/market-intelligence')
def market(material:str='coking_coal',origin:str='australia',port:str='vizag',plant_code:str='RSP'):
    with SessionLocal() as db: inv=db.query(Inventory).filter_by(plant_code=plant_code,material_code=material).first()
    days=round(inv.current_inventory_mt/inv.daily_consumption_mt,1) if inv else 0; rs=risk(origin,port,material); buy=days<18 or rs>=50
    return {'buy_more_now':buy,'reason':f"{days} days of cover against a {inv.safety_days if inv else 12}-day safety threshold; lane risk is {rs}/100. {'Advance procurement is recommended.' if buy else 'Current inventory is adequate; continue monitoring.'}"}
@app.post('/api/route-options')
def route(r:RouteRequest):
    if r.material not in MATERIALS or r.origin not in ORIGINS or r.preferred_port not in PORTS: raise HTTPException(400,'Invalid material, origin or port')
    return route_options(r)
@app.post('/api/procurement-plan')
def procurement(r:ProcurementRequest):
    if r.material not in MATERIALS or r.plant_code not in PLANTS: raise HTTPException(400,'Invalid material or plant')
    with SessionLocal() as db: inv=db.query(Inventory).filter_by(plant_code=r.plant_code,material_code=r.material).first()
    days=round(inv.current_inventory_mt/inv.daily_consumption_mt,1); target=max(inv.safety_days+14,30); additional=max(0,round((target-days)*inv.daily_consumption_mt))
    action='BUY MORE NOW' if days<20 else 'MONITOR MARKET'
    trend=round(2.4+random.random()*2.8,1); rs=38 if action=='BUY MORE NOW' else 22
    return {'inventory':{'current_inventory_mt':round(inv.current_inventory_mt),'days_of_cover':days},'recommendation':{'action':action,'additional_mt':additional,'timing':'Place order within 72 hours' if action=='BUY MORE NOW' else 'Re-evaluate daily'},'market':{'market_trend_30d_pct':trend,'risk_level':level(rs)},'explanation':f"The system combines inventory cover, consumption, safety stock, material preference and current market risk. {days} days of cover are currently available."}
@app.get('/api/consignments')
def consignments(plant_code:str):
    today=date.today(); out=[]
    with SessionLocal() as db: rows=db.query(Consignment).filter_by(plant_code=plant_code).all()
    for c in rows:
        eta=today+timedelta(days=c.eta_days); dispatch=eta+timedelta(days=2+c.delay_days); final=dispatch+timedelta(days=3)
        out.append({'id':c.id,'material_label':MATERIALS[c.material_code]['name'],'origin_label':ORIGINS[c.origin_code]['label'],'port_label':PORTS[c.port_code]['name'],'plant_label':PLANTS[c.plant_code]['name'],'vessel':c.vessel,'tonnage':c.tonnage,'status':c.status,'delay_days':c.delay_days,'delay_reason':c.delay_reason,'eta_port_date':eta.isoformat(),'earliest_dispatch_from_port':dispatch.isoformat(),'expected_final_arrival':final.isoformat(),'progress':c.progress})
    return {'consignments':out}
@app.post('/api/reroute-suggestion')
def reroute(r:RerouteRequest):
    with SessionLocal() as db:c=db.get(Consignment,r.consignment_id)
    if not c: raise HTTPException(404,'Consignment not found')
    if c.status!='delayed':return {'suggestion':None}
    return {'suggestion':{'donor_consignment':'FO-2026-003','diverted_tonnage_mt':25000,'estimated_recovery_days':max(1,c.delay_days-1),'message':'Temporary cross-plant diversion can bridge the delayed material requirement while the original cargo clears the port.','notification_status':'BSP manager notification prepared'}}
@app.post('/api/what-if')
def whatif(r:RouteRequest):
    result=route_options(r); ranked=sorted(result['options'],key=lambda x:x['optimization_rank']); return {'selected_port':result['selected_port'],'best_overall':ranked[0]}
