// Explicit, development-only demo data. Never run against a production account.
import { randomUUID } from 'node:crypto';
if(process.env.NODE_ENV==='production') throw new Error('Demo seed is disabled in production');
const url=process.env.SEED_API_URL || 'http://localhost:4000';
let token;
async function call(path,body) {
  const r=await fetch(url+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
  const data=await r.json();if(!r.ok)throw new Error(data.error);return data;
}
const email=process.env.DEMO_EMAIL || 'demo@thekabook.test';
const password=process.env.DEMO_PASSWORD;
if(!password || password.length<10) throw new Error('Set DEMO_PASSWORD (at least 10 characters).');
token=(await call('/auth/register',{name:'Vikesh',organization:'Vikesh Painting & Construction',email,password})).token;
const cmd=async(action,data)=>(await call('/commands',{key:randomUUID(),action,data})).record;
const date=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
const sites=[];
for(const s of [
  ['Sharma Residence','Rajesh Sharma','Vaishali Nagar, Jaipur',48000000,9000000,'MATERIAL'],
  ['Sunrise Apartments','Anil Gupta','Mansarovar, Jaipur',32500000,15000000,'LABOUR'],
  ['Green Valley Villa','Neha Mehta','Jagatpura, Jaipur',21000000,6000000,'MATERIAL']
]) sites.push(await cmd('site.create',{name:s[0],owner_name:s[1],address:s[2],contract_amount:s[3],remaining_estimate:s[4],work_type:s[5],pricing:'FIXED',start_date:date,notes:'Demonstration workspace. Fictional project and amounts.'}));
const workers=[];
for(const w of [['Ramesh Kumar','Senior painter',90000],['Suresh Yadav','Painter',75000],['Mohan Lal','Helper',55000],['Imran Khan','Mason',85000]]) workers.push(await cmd('worker.create',{name:w[0],skill:w[1],daily_rate:w[2],overtime_rate:10000}));
for(let i=0;i<workers.length;i++) await cmd('attendance.save',{site_id:sites[i%2].id,worker_id:workers[i].id,date,units:1,overtime_minutes:i===0?60:0});
for(const [i,n] of [[0,30000000],[1,12500000],[2,6000000]]) await cmd('entry.create',{site_id:sites[i].id,kind:'RECEIPT',amount:n,date,description:'Client milestone payment',party:sites[i].owner_name,mode:'BANK',reference:'DEMO-RECEIPT-'+i});
const bill=await cmd('entry.create',{site_id:sites[0].id,kind:'MATERIAL',amount:8200000,date,description:'Interior paint & wall primer',party:'Jaipur Paint House',quantity:180,unit:'litres',mode:'RECORD',reference:'DEMO-BILL-001'});
await cmd('entry.create',{site_id:sites[0].id,kind:'SUPPLIER_PAYMENT',linked_entry_id:bill.id,amount:6000000,date,description:'Paint supplier payment',party:'Jaipur Paint House',mode:'UPI'});
await cmd('entry.create',{site_id:sites[0].id,worker_id:workers[0].id,kind:'WAGE_PAYMENT',amount:50000,date,description:'Ramesh — partial wage payment',mode:'CASH'});
console.log('Fictional sample workspace created for '+email+'. No real transactions were made.');
