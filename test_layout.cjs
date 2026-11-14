// Real Chromium layout checks: node test_layout.cjs [path-to-chrome]
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const chrome = process.argv[2] || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const viewer = fs.readFileSync(path.join(__dirname, 'lyrics-display.html'), 'utf8');
const setup = `<script>
let testSlide = '';
window.fetch = async () => ({ok:true, json:async () => ({results:{slides:[{selected:true, text:testSlide, title:'c123'}]}})});
window.WebSocket = undefined;
const nativeInterval = window.setInterval;
window.setInterval = (fn, ms) => { window.testPoll = fn; return nativeInterval(fn, ms); };
localStorage.setItem('cbmDisplaySettings', JSON.stringify({firstRun:false, showTitle:true}));
</script>`;
const checks = `<script>
(async () => {
 const check = (ok, message) => { if (!ok) throw Error(message); };
 const content = document.getElementById('content');
 async function flush() { for (let i=0; i<20; i++) await Promise.resolve(); }
 async function refresh() { await flush(); testPoll(); await flush(); }
 async function show(text) { testSlide=text; await refresh(); }
 function verify(label) {
   const c=content.getBoundingClientRect(), title=document.getElementById('title-display').getBoundingClientRect(), footer=document.getElementById('footer').getBoundingClientRect();
   const lines=[...content.querySelectorAll('p')];
   check(lines.length>0, label+': lines');
   for (const p of lines) {
     const r=p.getBoundingClientRect();
     check(r.left>=19 && r.right<=innerWidth-19, label+': width '+JSON.stringify(r.toJSON()));
     check(r.top>=title.bottom && r.bottom<=footer.top, label+': height');
     check(p.scrollWidth<=p.clientWidth+1, label+': wrapping/overflow '+p.scrollWidth+'/'+p.clientWidth+' font '+getComputedStyle(p).fontSize+' window '+innerWidth);
   }
   check(document.documentElement.scrollHeight<=innerHeight, label+': scrollbar');
   const en=content.querySelector('.english'), zh=content.querySelector('.chinese');
   if (en && zh) {
     const expected=Math.max(24,Math.min(innerWidth*.05,64))/Math.max(20,Math.min(innerWidth*.04,56));
     check(Math.abs(parseFloat(getComputedStyle(zh).fontSize)/parseFloat(getComputedStyle(en).fontSize)-expected)<0.001, label+': ratio');
   }
   return parseFloat(getComputedStyle(lines[0]).fontSize);
 }
 await show('Short<br>短句'); const short=verify('short bilingual');
 const originalEn=content.style.getPropertyValue('--fit-english'), originalZh=content.style.getPropertyValue('--fit-chinese');
 content.style.setProperty('--fit-english', (parseFloat(originalEn)+0.2)+'px');
 content.style.setProperty('--fit-chinese', (parseFloat(originalZh)*(parseFloat(originalEn)+0.2)/parseFloat(originalEn))+'px');
 const ps=[...content.querySelectorAll('p')];
 check(ps.some(p=>p.scrollWidth>p.clientWidth) || ps.reduce((sum,p)=>sum+p.getBoundingClientRect().height,0)>content.clientHeight, 'fit is within 0.2px of maximum');
 content.style.setProperty('--fit-english', originalEn); content.style.setProperty('--fit-chinese', originalZh);
 await show('A very long line of lyrics that must fit without wrapping across the display<br>奇異恩典何等甘甜'); const long=verify('long bilingual');
 check(long<short, 'long line shrinks');
 await show(Array.from({length:12},(_,i)=>'Line '+i).join('<br>')); const many=verify('many English');
 check(many<short, 'many lines shrink');
 await show("<span style='color:white'>Short</span><br>短句");
 const before=content.innerHTML, size=verify('repeat');
 let mutations=0; const observer=new MutationObserver(records=>{ mutations+=records.length; });
 observer.observe(content,{childList:true,attributes:true,subtree:true});
 await refresh(); await Promise.resolve(); observer.disconnect();
 check(content.innerHTML===before && verify('unchanged')===size && mutations===0, 'stable refresh without mutations');
 frameElement.style.width='500px'; frameElement.style.height='400px';
 await new Promise(resolve=>setTimeout(resolve,100));
 const smaller=verify('resized smaller'); check(smaller<size, 'resize refits');
 frameElement.style.width='900px'; frameElement.style.height='650px';
 await new Promise(resolve=>setTimeout(resolve,100)); verify('resized larger');
 document.dispatchEvent(new KeyboardEvent('keydown', {key:'.', bubbles:true}));
 window.dispatchEvent(new Event('resize'));
 document.dispatchEvent(new KeyboardEvent('keydown', {key:'.', bubbles:true}));
 verify('blackout restored');
 settings.displayLanguage='english'; await refresh();
 check(!content.querySelector('.chinese'), 'English only'); verify('English only');
 settings.autoFit=false; applySettings();
 check(Math.abs(parseFloat(getComputedStyle(content.querySelector('p')).fontSize)-Math.max(20,Math.min(innerWidth*.04,56)))<0.1, 'disabled clamp');
 settings.autoFit=true; applySettings();
 const face=new FontFace('DelayedTestFont', 'local("Arial")');
 document.fonts.add(face);
 document.body.style.setProperty('--english-font', 'DelayedTestFont, sans-serif');
 content.style.setProperty('--fit-english', '1px');
 await new Promise(resolve=>setTimeout(resolve,100));
 await face.load(); await document.fonts.ready;
 check(parseFloat(getComputedStyle(content.querySelector('p')).fontSize)>1, 'delayed font load refits');
 verify('delayed font');
 parent.postMessage({ok:true, short,long,many}, '*');
})().catch(e => parent.postMessage({ok:false,error:e.stack}, '*'));
</script>`;
const src = viewer.replace('<head>', '<head>'+setup).replace('</body>', checks+'</body>');
const wrapper = `<!doctype html><body><iframe id="frame" style="width:900px;height:650px;border:0"></iframe><pre id="result">pending</pre><script>
window.addEventListener('message', e => { document.getElementById('result').textContent=JSON.stringify(e.data); });
document.getElementById('frame').srcdoc=${JSON.stringify(src).replace(/<\//g, '<\\/')};
</script></body>`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lyrics-layout-'));
try {
 const file=path.join(dir,'test.html'); fs.writeFileSync(file,wrapper);
 const result=spawnSync(chrome,['--headless','--no-sandbox','--disable-gpu','--allow-file-access-from-files','--virtual-time-budget=5000','--dump-dom','file://'+file],{encoding:'utf8',timeout:30000});
 const match=result.stdout.match(/<pre id="result">([^<]+)<\/pre>/);
 if (!match) throw Error('No browser result: '+result.stderr);
 const data=JSON.parse(match[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&'));
 if (!data.ok) throw Error(data.error || JSON.stringify(data));
 console.log('Browser layout checks passed:', data);
} finally { fs.rmSync(dir,{recursive:true,force:true}); }
