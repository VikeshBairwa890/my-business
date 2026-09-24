import assert from 'node:assert/strict';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { createBrotliDecompress } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import express from 'express';
import { database } from '../apps/api/src/db.mjs';
import { createApp } from '../apps/api/src/app.mjs';
// All servers and the browser run together; no external accounts or real data.
const db=await database({embedded:true}); await db.migrate();
const api=createApp(db,{testing:true}).listen(4000,'127.0.0.1');
const web=express().use(express.static(resolve('apps/mobile/dist'))).listen(8081,'127.0.0.1');
await Promise.all([new Promise(r=>api.once('listening',r)),new Promise(r=>web.once('listening',r))]);
let browser, page;
const errors=[];
try {
  process.env.DEMO_PASSWORD='Preview-only-12345';
  process.env.SEED_API_URL='http://127.0.0.1:4000';
  await import('../apps/api/src/seed.mjs');
  let launch={headless:true};
  if(process.env.USE_PACKAGED_CHROMIUM==='1') {
    // Extract only the executable, using system fonts/libraries. Avoid preserving
    // Lambda-specific archive ownership metadata on ordinary Linux test hosts.
    const dir=await mkdtemp(resolve(tmpdir(),'thekabook-browser-'));
    const binary=resolve(dir,'chromium');
    await pipeline(createReadStream(resolve('node_modules/@sparticuz/chromium/bin/chromium.br')),createBrotliDecompress(),createWriteStream(binary,{mode:0o700}));
    launch={...launch,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage'],executablePath:binary};
  }
  browser=await chromium.launch(launch);
  page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:8081');
  await page.getByLabel('Email address',{exact:true}).fill('demo@thekabook.test');
  await page.getByLabel('Password',{exact:true}).fill('Preview-only-12345');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByText('Kaam ka poora hisab.',{exact:true}).waitFor();
  await mkdir('qa',{recursive:true});
  await page.screenshot({path:'qa/overview-mobile.png'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'No horizontal overflow');
  await page.getByRole('tab',{name:'Sites',exact:true}).click();
  await page.getByRole('button',{name:'Open Sharma Residence',exact:true}).click();
  await page.getByText('Cost & cash breakdown',{exact:true}).waitFor();
  await page.screenshot({path:'qa/site-mobile.png'});
  await page.getByRole('tab',{name:'Labour',exact:true}).click();
  await page.getByRole('button',{name:'Add worker',exact:true}).click();
  await page.getByLabel('Full name',{exact:true}).fill('QA Test Worker');
  await page.getByLabel('Daily wage (₹)',{exact:true}).fill('800');
  await page.getByLabel('Overtime per hour (₹)',{exact:true}).fill('100');
  await page.getByRole('button',{name:'Save record',exact:true}).click();
  await page.getByText('QA Test Worker',{exact:true}).waitFor();
  await page.screenshot({path:'qa/labour-mobile.png'});
  await page.getByRole('tab',{name:'Attendance',exact:true}).click();
  await page.getByRole('button',{name:'Mark',exact:true}).click();
  await page.getByRole('button',{name:'QA Test Worker',exact:true}).click();
  await page.getByLabel('Overtime in minutes (60 = 1 hour)',{exact:true}).fill('60');
  await page.getByRole('button',{name:'Save record',exact:true}).click();
  await page.getByText('QA Test Worker',{exact:true}).waitFor();
  await page.getByRole('tab',{name:'Hisab',exact:true}).click();
  await page.getByRole('button',{name:'Client payment received',exact:true}).click();
  await page.getByLabel('Amount (₹)',{exact:true}).fill('1234');
  await page.getByLabel('Description',{exact:true}).fill('QA receipt through mobile UI');
  await page.getByRole('button',{name:'Save record',exact:true}).click();
  await page.getByText('QA receipt through mobile UI',{exact:true}).waitFor();
  await page.reload();
  await page.getByText('Kaam ka poora hisab.',{exact:true}).waitFor();
  await page.getByRole('tab',{name:'Hisab',exact:true}).click();
  await page.getByText('QA receipt through mobile UI',{exact:true}).waitFor();
  await page.getByRole('tab',{name:'Reports',exact:true}).click();
  await page.getByText('Site profitability',{exact:true}).waitFor();
  await page.screenshot({path:'qa/reports-mobile.png'});
  await page.setViewportSize({width:1280,height:900});
  await page.getByRole('tab',{name:'Overview',exact:true}).click();
  await page.screenshot({path:'qa/overview-desktop.png'});
  assert.deepEqual(errors,[],'No browser runtime errors');
  console.log('UI smoke PASS: login, worker creation, attendance, receipt, reload persistence, six-tab navigation and responsive layouts.');
} catch(e) {
  console.error('Browser errors:',errors);
  if(page) { console.error('Page text:',(await page.locator('body').innerText()).slice(0,2500)); }
  throw e;
} finally {
  await browser?.close(); await Promise.all([new Promise(r=>api.close(r)),new Promise(r=>web.close(r))]); await db.close();
}
