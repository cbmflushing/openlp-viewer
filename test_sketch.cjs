// Real Chromium sketchbook controls checks: node test_sketch.cjs [path-to-chrome]
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const chrome = process.argv[2] || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const viewer = fs.readFileSync(path.join(__dirname, 'lyrics-display.html'), 'utf8');
const setup = `<script>window.fetch=async()=>({ok:true,json:async()=>({results:{slides:[]}})});window.WebSocket=undefined;localStorage.setItem('cbmDisplaySettings',JSON.stringify({firstRun:false}));</script>`;
const checks = `<script>
(async()=>{
 const check=(v,m)=>{if(!v)throw Error(m)}, $=s=>document.querySelector(s), style=e=>getComputedStyle(e);
 const launcher=$('#settings-btn'); launcher.focus(); await new Promise(r=>setTimeout(r,350));
 check(document.activeElement===launcher && Number(style(launcher).opacity)>0,'launcher keyboard focus is visible: active='+document.activeElement.id+' opacity='+style(launcher).opacity+' focus-visible='+launcher.matches(':focus-visible'));
 showSettings();
 const modal=$('#modal'), heading=$('#modal h2'), field=$('#server-ip'), save=$('#save-btn');
 check(style(modal).backgroundColor==='rgb(250, 247, 239)','warm paper modal');
 check(style(modal).borderTopWidth==='2px' && style(modal).boxShadow!=='none','outlined modal with offset shadow');
 check(style(heading).fontFamily.includes('Comic Sans MS'),'local handwritten heading');
 check(style(field).borderTopWidth==='2px' && style(field).backgroundColor==='rgb(255, 253, 247)','outlined paper input');
 check(style(save).borderTopWidth==='2px' && style(save).boxShadow!=='none','outlined button with offset shadow');
 field.focus(); check(style(field).outlineStyle!=='none' && style(field).outlineWidth!=='0px','keyboard focus ring');
 const root=$('[data-color-id="bg-color"]'), details=root.querySelector('details'), hex=root.querySelector('.color-hex');
 const swatch=root.querySelector('.color-swatch'); swatch.click();
 check(swatch.getAttribute('aria-pressed')==='true' && getComputedStyle(swatch,'::after').content.includes('✓'),'selected swatch remains clear');
 details.open=true; hex.value='#12'; hex.dispatchEvent(new Event('input',{bubbles:true}));
 check(hex.getAttribute('aria-invalid')==='true' && style(hex).borderTopColor==='rgb(166, 54, 54)','invalid field outlined');
 const error=root.querySelector('.color-error'); check(!error.hidden && style(error).color==='rgb(134, 37, 37)','readable error');
 closeModal(true); check(!$('#modal-overlay').classList.contains('hidden'),'invalid input blocks save');
 swatch.click(); closeModal(true); check($('#modal-overlay').classList.contains('hidden'),'corrected input saves');
 frameElement.style.width='375px'; frameElement.style.height='667px'; await new Promise(r=>setTimeout(r,100)); showSettings();
 const bounds=modal.getBoundingClientRect(); check(bounds.left>=0 && bounds.right<=innerWidth && modal.scrollWidth<=modal.clientWidth,'375px modal fits without horizontal overflow');
 for(const row of document.querySelectorAll('.color-setting')){
   const r=row.getBoundingClientRect(), swatches=[...row.querySelectorAll('.color-swatch')].map(e=>e.getBoundingClientRect()), summary=row.querySelector('summary').getBoundingClientRect();
   for(const s of swatches) check(s.left>=r.left-1 && s.right<=r.right+1,'mobile swatches fit');
   check(summary.left>=r.left-1 && summary.right<=r.right+1,'mobile disclosure fits');
   row.querySelector('details').open=true;
   check(row.querySelector('input[type=color]').getBoundingClientRect().top>=Math.max(...swatches.map(s=>s.bottom)),'mobile editor does not overlap');
 }
 const buttons=[...document.querySelectorAll('#modal-buttons button')].map(b=>b.getBoundingClientRect());
 check(buttons.every(b=>b.left>=bounds.left && b.right<=bounds.right) && buttons.every((b,i)=>!i||buttons[i-1].right<=b.left),'mobile buttons fit and do not overlap');
 parent.postMessage({ok:true},'*');
})().catch(e=>parent.postMessage({ok:false,error:e.stack},'*'));
</script>`;
const src=viewer.replace('<head>','<head>'+setup).replace('</body>',checks+'</body>');
const wrapper=`<!doctype html><iframe id="frame" style="width:900px;height:700px;border:0"></iframe><pre id="result">pending</pre><script>window.addEventListener('message',e=>document.getElementById('result').textContent=JSON.stringify(e.data));document.getElementById('frame').srcdoc=${JSON.stringify(src).replace(/<\//g,'<\\/')};</script>`;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lyrics-sketch-'));
try {
 const file=path.join(dir,'test.html'); fs.writeFileSync(file,wrapper);
 const result=spawnSync(chrome,['--headless','--no-sandbox','--disable-gpu','--allow-file-access-from-files','--virtual-time-budget=5000','--dump-dom','file://'+file],{encoding:'utf8',timeout:30000});
 const match=result.stdout.match(/<pre id="result">([^<]+)<\/pre>/);
 if(!match) throw Error('No browser result: '+result.stderr);
 const data=JSON.parse(match[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&')); if(!data.ok) throw Error(data.error);
 console.log('Browser sketchbook checks passed:',data);
} finally {fs.rmSync(dir,{recursive:true,force:true});}
