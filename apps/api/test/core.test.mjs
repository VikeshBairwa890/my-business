import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { database } from '../src/db.mjs';
import { createApp } from '../src/app.mjs';
import { wages, paise, siteSummary, workerSummary, reportText } from '../../../shared/finance.js';
let db,server,url,token,other,site,worker;
const day = '2026-01-10';
async function call(path,body,t=token) {
  const res=await fetch(url+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(t?{Authorization:'Bearer '+t}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  return {status:res.status,data:await res.json()};
}
const cmd=(action,data,entity_id,key=randomUUID(),t=token)=>call('/commands',{action,data,entity_id,key},t);
const siteData={name:'Sharma Residence',owner_name:'Mr Sharma',work_type:'MATERIAL',pricing:'FIXED',contract_amount:50000000,start_date:'2026-01-01',remaining_estimate:5000000};
before(async()=>{
  db=await database({embedded:true});await db.migrate();
  server=createApp(db,{testing:true}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));url=`http://127.0.0.1:${server.address().port}`;
  token=(await call('/auth/register',{name:'Vikesh',organization:'Vikesh Contractors',email:'owner@example.test',password:'Strong-test-password'})).data.token;
  other=(await call('/auth/register',{name:'Other',organization:'Other',email:'other@example.test',password:'Strong-test-password'})).data.token;
});
after(async()=>{await new Promise(r=>server.close(r));await db.close();});
test('money parsing and overtime round to paise',()=>{
  assert.equal(paise('100.25'),10025);assert.equal(paise('0.01'),1);assert.throws(()=>paise('1.234'));assert.throws(()=>paise('-5'));
  assert.equal(wages(0.5,90,70000,10000),50000);
});
test('login rejects incorrect password and unauthenticated data access',async()=>{
  assert.equal((await call('/auth/login',{email:'owner@example.test',password:'bad'},null)).status,401);
  assert.equal((await call('/snapshot',undefined,null)).status,401);
});
test('create site and worker with PostgreSQL persistence',async()=>{
  const s=await cmd('site.create',siteData);assert.equal(s.status,200);site=s.data.record;
  const w=await cmd('worker.create',{name:'Ramesh',skill:'Painter',daily_rate:70000,overtime_rate:10000});assert.equal(w.status,200);worker=w.data.record;
  const snapshot=await call('/snapshot');assert.equal(snapshot.data.sites.length,1);assert.equal(snapshot.data.workers.length,1);
});
test('tenant isolation for reads and foreign records',async()=>{
  assert.equal((await call('/snapshot',undefined,other)).data.sites.length,0);
  assert.equal((await cmd('site.update',siteData,site.id,randomUUID(),other)).status,404);
  assert.equal((await cmd('attendance.save',{site_id:site.id,worker_id:worker.id,date:day,units:1,overtime_minutes:0},undefined,randomUUID(),other)).status,404);
});
test('attendance retains original wage rate and requires correction reason',async()=>{
  const v={site_id:site.id,worker_id:worker.id,date:day,units:1,overtime_minutes:60};
  const r=await cmd('attendance.save',v);assert.equal(r.status,200);assert.equal(Number(r.data.record.amount),80000);
  await cmd('worker.update',{name:'Ramesh',skill:'Painter',daily_rate:90000,overtime_rate:15000},worker.id);
  assert.equal((await cmd('attendance.save',{...v,units:0.5})).status,400);
  const corrected=await cmd('attendance.save',{...v,units:0.5,notes:'Half day correction'});
  assert.equal(Number(corrected.data.record.amount),45000);assert.equal(Number(corrected.data.record.daily_rate),70000);
});
test('prevent duplicate full-day attendance across sites',async()=>{
  const second=(await cmd('site.create',{...siteData,name:'Second site'})).data.record;
  assert.equal((await cmd('attendance.save',{site_id:second.id,worker_id:worker.id,date:day,units:1,overtime_minutes:0})).status,400);
  assert.equal((await cmd('attendance.save',{site_id:second.id,worker_id:worker.id,date:day,units:0.5,overtime_minutes:0})).status,200);
});
test('validate calendar dates and absent overtime',async()=>{
  const v={site_id:site.id,worker_id:worker.id,date:'2026-02-30',units:1,overtime_minutes:0};
  assert.equal((await cmd('attendance.save',v)).status,400);
  assert.equal((await cmd('attendance.save',{...v,date:'2026-01-11',units:0,overtime_minutes:60})).status,400);
});
test('payment retries are idempotent, changed payload conflicts',async()=>{
  const key=randomUUID(),v={site_id:site.id,kind:'RECEIPT',date:day,amount:10000000,description:'Owner advance'};
  const a=await cmd('entry.create',v,undefined,key);const b=await cmd('entry.create',v,undefined,key);
  assert.equal(a.data.record.id,b.data.record.id);
  assert.equal((await cmd('entry.create',{...v,amount:900},undefined,key)).status,409);
  assert.equal((await call('/snapshot')).data.entries.filter(e=>e.kind==='RECEIPT').length,1);
});
test('costs are not payments; supplier overpayment and bill voiding are blocked',async()=>{
  const bill=(await cmd('entry.create',{site_id:site.id,kind:'MATERIAL',date:day,amount:200000,description:'Paint used on site',party:'Paint shop'})).data.record;
  const pay={site_id:site.id,kind:'SUPPLIER_PAYMENT',linked_entry_id:bill.id,date:day,amount:100000,description:'Part payment'};
  const payment=(await cmd('entry.create',pay)).data.record;
  assert.equal((await cmd('entry.create',{...pay,amount:150000})).status,400);
  assert.equal((await cmd('entry.void',{reason:'Bill correction'},bill.id)).status,400);
  let snap=(await call('/snapshot')).data,f=siteSummary(site,snap.attendance,snap.entries);
  assert.equal(f.material,200000);assert.equal(f.suppliersPaid,100000);assert.equal(f.supplierBalance,100000);
  assert.equal((await cmd('entry.void',{reason:'Duplicate payment'},payment.id)).status,200);
  snap=(await call('/snapshot')).data;f=siteSummary(site,snap.attendance,snap.entries);assert.equal(f.suppliersPaid,0);assert.equal(f.material,200000);
});
test('worker advances do not reduce incurred labour cost or inflate profit',async()=>{
  await cmd('entry.create',{site_id:site.id,worker_id:worker.id,kind:'WAGE_PAYMENT',date:day,amount:150000,description:'Worker advance'});
  const snap=(await call('/snapshot')).data;
  const w=workerSummary(worker,snap.attendance,snap.entries);assert.equal(w.earned,90000);assert.equal(w.balance,-60000);
  const f=siteSummary(site,snap.attendance,snap.entries);assert.equal(f.labour,45000);assert.equal(f.cash,9850000);
  assert.equal(f.profit,50000000-45000-200000-5000000);
});
test('extra work needs approval reference and unit contract derives amount',async()=>{
  assert.equal((await cmd('entry.create',{site_id:site.id,kind:'EXTRA',date:day,amount:1000,description:'Extra work'})).status,400);
  const r=await cmd('site.create',{...siteData,pricing:'UNIT',quantity:100.5,unit_rate:2500,unit:'sq ft'});
  assert.equal(Number(r.data.record.contract_amount),251250);
});
test('logout revokes session and audit is recorded',async()=>{
  assert.ok((await call('/snapshot')).data.audit.length>5);
  await call('/auth/logout',{},other);assert.equal((await call('/snapshot',undefined,other)).status,401);
});
test('site statements exclude other sites and unrelated workers',()=>{
  const data={organization:{name:'Test'},sites:[{id:'a',name:'A',contract_amount:100,status:'COMPLETED'},{id:'b',name:'B',contract_amount:200,status:'COMPLETED'}],
    attendance:[{site_id:'b',worker_id:'w',amount:100}],entries:[],workers:[{id:'w',name:'Private worker on B'}]};
  assert.ok(!reportText(data,'a').includes('Private worker on B'));
});
