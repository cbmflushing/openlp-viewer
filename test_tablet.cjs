// Real Chromium touch/coarse-pointer checks: node test_tablet.cjs [path-to-chrome]
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {pathToFileURL} = require('node:url');
const chromePath = process.argv[2] || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const source = fs.readFileSync(path.join(__dirname, 'lyrics-display.html'), 'utf8');
const setup = `<script>window.fetch=async()=>({ok:true,json:async()=>({results:{slides:[]}})});window.WebSocket=undefined;localStorage.setItem('cbmDisplaySettings',JSON.stringify({firstRun:false}));</script>`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lyrics-tablet-'));
const file = path.join(dir, 'viewer.html');
fs.writeFileSync(file, source.replace('<head>', '<head>'+setup));
const profile = path.join(dir, 'profile');
const chrome = spawn(chromePath, ['--headless','--no-sandbox','--disable-gpu','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'], {stdio:'ignore'});
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
 const failures = [];
 try {
  const portFile = path.join(profile,'DevToolsActivePort');
  for (let i=0;i<100&&!fs.existsSync(portFile);i++) await sleep(100);
  if (!fs.existsSync(portFile)) throw Error('Chrome did not start: '+chromePath);
  const port = fs.readFileSync(portFile,'utf8').split('\n')[0];
  const tabs = await (await fetch('http://127.0.0.1:'+port+'/json')).json();
  const ws = new WebSocket(tabs[0].webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
  let id=0; const pending=new Map();
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const [resolve,reject]=pending.get(m.id);pending.delete(m.id);m.error?reject(Error(JSON.stringify(m.error))):resolve(m.result)}};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,[resolve,reject]);ws.send(JSON.stringify({id:n,method,params}))});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value};
  const check=(value,message)=>{if(!value)failures.push(message)};
  const tap=async selector=>{
   const point=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center',inline:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
   await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
   await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   await sleep(100);
  };
  await send('Page.enable');
  await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  for(const [name,width,height] of [['portrait',768,1024],['landscape',1024,768],['narrow',375,812]]) {
   await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
   await send('Page.navigate',{url:pathToFileURL(file).href}); await sleep(500);
   const query=await evaluate(`({coarse:matchMedia('(pointer: coarse)').matches,noHover:matchMedia('(hover: none)').matches,touch:navigator.maxTouchPoints})`);
   if(!query.coarse || !query.noHover || !query.touch) throw Error(name+': touch media emulation not active: '+JSON.stringify(query));
   const launch=await evaluate(`(()=>{let e=document.querySelector('#settings-btn'),r=e.getBoundingClientRect();return {opacity:+getComputedStyle(e).opacity,w:r.width,h:r.height}})()`);
   check(launch.opacity>=0.7, name+': launcher visible without hover: '+JSON.stringify(launch));
   check(launch.w>=44&&launch.h>=44,name+': launcher touch size: '+JSON.stringify(launch));
   const layering=await evaluate(`(()=>{const launcher=document.querySelector('#settings-btn'),fade=document.querySelector('#fade-overlay');return {fadeOpacity:+getComputedStyle(fade).opacity,fadeZ:+getComputedStyle(fade).zIndex,launcherZ:getComputedStyle(launcher).zIndex}})()`);
   check(layering.fadeOpacity>0.9 && Number(layering.launcherZ)>layering.fadeZ,name+': launcher remains visible above active blackout fade: '+JSON.stringify(layering));
   await tap('#settings-btn');
   check(await evaluate(`!document.querySelector('#modal-overlay').classList.contains('hidden')`),name+': touch launcher opens settings');
   const layout=await evaluate(`(()=>{
    const modal=document.querySelector('#modal'), bounds=modal.getBoundingClientRect(), issues=[];
    const rect=e=>e.getBoundingClientRect();
    if(bounds.left<0||bounds.right>innerWidth||bounds.top<0||bounds.bottom>innerHeight||modal.scrollWidth>modal.clientWidth) issues.push('modal overflows viewport');
    if(modal.scrollHeight<=modal.clientHeight) issues.push('modal should scroll');
    for(const row of document.querySelectorAll('.color-setting')) {
     const r=rect(row), swatches=[...row.querySelectorAll('.color-swatch')], summary=rect(row.querySelector('summary'));
     for(const s of swatches) {const b=rect(s); if(b.width<44||b.height<44) issues.push('swatch too small '+b.width+'x'+b.height); if(b.left<r.left-1||b.right>r.right+1) issues.push('swatch outside row'); if(b.left<summary.right&&b.right>summary.left&&b.top<summary.bottom&&b.bottom>summary.top) issues.push('swatch overlaps disclosure');}
     if(summary.width<44||summary.height<44) issues.push('disclosure too small '+summary.width+'x'+summary.height);
     if(summary.left<r.left-1||summary.right>r.right+1) issues.push('disclosure outside row');
     row.querySelector('details').open=true;
     if(rect(row.querySelector('input[type=color]')).top < Math.max(...swatches.map(s=>rect(s).bottom))) issues.push('editor overlaps swatches');
    }
    for(const e of document.querySelectorAll('#modal label:has(input[type=checkbox])')) if(rect(e).height<44) issues.push('checkbox label too small');
    for(const e of document.querySelectorAll('#modal input[type=text], #modal input[type=color], #modal select, #modal-buttons button')) {const r=rect(e);if(r.width<44||r.height<44) issues.push((e.id||e.getAttribute('aria-label'))+' too small '+r.width+'x'+r.height);}
    const buttons=[...document.querySelectorAll('#modal-buttons button')].map(rect);
    if(buttons.some((b,i)=>b.left<bounds.left||b.right>bounds.right||(i&&buttons[i-1].right>b.left))) issues.push('buttons overflow or overlap');
    return issues;
   })()`);
   for(const issue of [...new Set(layout)]) failures.push(name+': '+issue);
   await evaluate(`document.querySelectorAll('#modal details').forEach(e=>e.open=false)`);
   await tap('[data-color-id="bg-color"] summary');
   check(await evaluate(`document.querySelector('[data-color-id="bg-color"] details').open`),name+': touch disclosure opens');
   await tap('[data-color-id="bg-color"] .color-swatch[data-color="#ffffff"]');
   check(await evaluate(`document.querySelector('[data-color-id="bg-color"] .color-swatch[data-color="#ffffff"]').getAttribute('aria-pressed')==='true'`),name+': touch selects swatch');
   check(await evaluate(`(()=>{document.querySelector('#save-btn').scrollIntoView({block:'center'});return document.querySelector('#modal').scrollTop>0})()`),name+': settings scroll to bottom controls');
   await tap('#save-btn');
   check(await evaluate(`document.querySelector('#modal-overlay').classList.contains('hidden') && JSON.parse(localStorage.getItem('cbmDisplaySettings')).bgColor==='#ffffff'`),name+': touch save persists selection');
   await tap('#settings-btn');
   await tap('[data-color-id="bg-color"] .color-swatch[data-color="#1e1e1e"]');
   await tap('#skip-btn');
   check(await evaluate(`document.querySelector('#modal-overlay').classList.contains('hidden') && JSON.parse(localStorage.getItem('cbmDisplaySettings')).bgColor==='#ffffff'`),name+': touch skip discards change');
   console.log(name+': media verified; touch actions exercised');
  }
  await send('Emulation.setTouchEmulationEnabled',{enabled:false});
  await send('Emulation.setDeviceMetricsOverride',{width:1000,height:900,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:pathToFileURL(file).href}); await sleep(500);
  check(await evaluate(`!matchMedia('(pointer: coarse)').matches && +getComputedStyle(document.querySelector('#settings-btn')).opacity===0`),'desktop launcher remains unobtrusive');
  ws.close();
  if(failures.length) throw Error(failures.join('\n'));
  console.log('Tablet touch checks passed');
 } finally {chrome.kill();await sleep(300);fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e.stack);process.exitCode=1});
