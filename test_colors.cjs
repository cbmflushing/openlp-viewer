// Real Chromium color-control regression checks: node test_colors.cjs [chrome]
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const chrome = process.argv[2] || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const viewer = fs.readFileSync(path.join(__dirname, 'lyrics-display.html'), 'utf8');
const setup = `<script>window.fetch=async()=>({ok:true,json:async()=>({results:{slides:[]}})}); window.WebSocket=undefined; localStorage.setItem('cbmDisplaySettings',JSON.stringify({firstRun:false,bgColor:'#123456'}));</script>`;
const checks = `<script>
(async()=>{
 const check=(x,m)=>{if(!x)throw Error(m)};
 const $=s=>document.querySelector(s), all=s=>[...document.querySelectorAll(s)];
 const edit=(el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));};
 showSettings();
 const ids=['bg-color','english-color','chinese-color','footer-color'];
 const rows=ids.map(id=>$('[data-color-id="'+id+'"]'));
 for(let i=0;i<rows.length;i++){
   const r=rows[i].getBoundingClientRect(), label=rows[i].querySelector(':scope > label').getBoundingClientRect(), swatches=[...rows[i].querySelectorAll('.color-swatch')].map(x=>x.getBoundingClientRect()), summary=rows[i].querySelector('summary').getBoundingClientRect();
   check(r.width >= $('#modal').clientWidth - 62,ids[i]+' full-width row');
   check(i===0 || r.top>=rows[i-1].getBoundingClientRect().bottom,ids[i]+' separate row');
   check(swatches.every(s=>Math.abs(s.top-swatches[0].top)<2) && Math.abs(label.top-swatches[0].top)<12 && Math.abs(summary.top-swatches[0].top)<12,ids[i]+' label, swatches and disclosure on one line');
   check(label.right<=swatches[0].left && swatches[swatches.length-1].right<=summary.left,ids[i]+' header controls do not overlap');
   check(!rows[i].querySelector('.color-current') || getComputedStyle(rows[i].querySelector('.color-current')).position==='absolute',ids[i]+' no visible selected line');
   const details=rows[i].querySelector('details'); details.open=true;
   check(rows[i].querySelector('input[type=color]').getBoundingClientRect().top>=swatches[0].bottom,ids[i]+' advanced below row');
   check(!rows[i+1] || rows[i+1].getBoundingClientRect().top>=rows[i].getBoundingClientRect().bottom,ids[i]+' expansion does not overlap next row');
   details.open=false;
 }
 frameElement.style.width='900px'; await new Promise(r=>setTimeout(r,100));
 for(const row of rows){
   const swatches=[...row.querySelectorAll('.color-swatch')].map(x=>x.getBoundingClientRect()), summary=row.querySelector('summary').getBoundingClientRect();
   check(swatches.every(s=>Math.abs(s.top-swatches[0].top)<2) && Math.abs(summary.top-swatches[0].top)<12 && swatches[swatches.length-1].right<=summary.left,'900px compact header');
 }
 frameElement.style.width='500px'; await new Promise(r=>setTimeout(r,100));
 for(const id of ids){
   const root=$('[data-color-id="'+id+'"]');
   check(root, id+' control exists');
   check(root.querySelectorAll('.color-swatch').length>=8,id+' presets');
   check(!root.querySelector('details').open,id+' initially collapsed');
   check(root.querySelector('.color-hex') && root.querySelectorAll('.color-rgb').length===3,id+' editable fields');
   const button=root.querySelector('.color-swatch'); button.click();
   check(root.querySelector('input[type=color]').value===button.dataset.color && button.getAttribute('aria-pressed')==='true',id+' swatch sync');
 }
 // Restore the saved custom value after exercising each editor.
 showSettings();
 const root=$('[data-color-id="bg-color"]'), picker=$('#bg-color'), hex=root.querySelector('.color-hex'), rgb=[...root.querySelectorAll('.color-rgb')], details=root.querySelector('details');
 check(picker.value==='#123456' && hex.value==='#123456','legacy custom preserved');
 check(root.querySelector('.color-current').textContent.includes('#123456'),'custom selection identified accessibly');
 details.querySelector('summary').click(); check(details.open && picker.value==='#123456','expand unchanged');
 const swatch=root.querySelector('.color-swatch'); swatch.focus(); check(document.activeElement===swatch,'keyboard focus'); swatch.click();
 check(swatch.getAttribute('aria-pressed')==='true' && picker.value===swatch.dataset.color && getComputedStyle(swatch,'::after').content.includes('✓'),'swatch selection and checkmark');
 details.querySelector('summary').focus(); check(document.activeElement===details.querySelector('summary'),'disclosure keyboard focus');
 details.querySelector('summary').click(); check(!details.open && picker.isConnected,'collapse retains controls');
 details.querySelector('summary').click(); check(details.open && picker.value===swatch.dataset.color,'reopen retains selection');
 edit(hex,'#a1b2c3'); check(picker.value==='#a1b2c3' && rgb.map(x=>x.value).join(',')==='161,178,195','hex sync');
 edit(rgb[0],'255'); check(picker.value==='#ffb2c3' && hex.value==='#ffb2c3','rgb sync');
 edit(picker,'#123abc'); check(hex.value==='#123abc' && rgb.map(x=>x.value).join(',')==='18,58,188','picker sync');
 edit(hex,'#12'); check(hex.getAttribute('aria-invalid')==='true','invalid hex indicated');
 closeModal(true); check(!$('#modal-overlay').classList.contains('hidden'),'invalid blocks save');
 check(JSON.parse(localStorage.getItem('cbmDisplaySettings')).bgColor==='#123456','invalid not saved');
 edit(hex,'#abcdef'); edit(rgb[1],''); check(rgb[1].getAttribute('aria-invalid')==='true','incomplete RGB indicated');
 edit(rgb[1],'-1'); check(rgb[1].getAttribute('aria-invalid')==='true','negative RGB indicated');
 edit(rgb[1],'256'); check(rgb[1].getAttribute('aria-invalid')==='true','invalid RGB indicated');
 closeModal(true); check(!$('#modal-overlay').classList.contains('hidden'),'invalid RGB blocks save');
 edit(rgb[1],'0'); closeModal(true); check(JSON.parse(localStorage.getItem('cbmDisplaySettings')).bgColor==='#ab00ef','save');
 for(const dismiss of [()=>closeModal(false),()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})),()=>$('#modal-overlay').click()]){
   showSettings(); edit(picker,'#112233'); dismiss(); showSettings(); check(picker.value==='#ab00ef','dismiss discards'); closeModal(false);
 }
 showSettings(); resetSettings(); check(picker.value==='#006400' && $('#english-color').value==='#ffffff' && $('#chinese-color').value==='#ffff00' && $('#footer-color').value==='#ffffff','reset defaults');
 frameElement.style.width='320px'; frameElement.style.height='480px'; await new Promise(r=>setTimeout(r,100));
 const modal=$('#modal'), bounds=modal.getBoundingClientRect();
 check(bounds.left>=0 && bounds.right<=innerWidth && modal.scrollHeight>modal.clientHeight,'small dialog fits and scrolls');
 check(root.getBoundingClientRect().width<=modal.clientWidth,'small palette fits');
 for(const row of rows){
   const r=row.getBoundingClientRect();
   for(const el of row.querySelectorAll('.color-swatch, summary')){const b=el.getBoundingClientRect(); check(b.left>=r.left-1 && b.right<=r.right+1,'small controls fit row');}
   row.querySelector('details').open=true;
   check(row.querySelector('input[type=color]').getBoundingClientRect().top>=row.querySelector('.color-swatches').getBoundingClientRect().bottom,'small advanced below swatches');
   row.querySelector('details').open=false;
 }
 parent.postMessage({ok:true},'*');
})().catch(e=>parent.postMessage({ok:false,error:e.stack},'*'));
</script>`;
const src=viewer.replace('<head>','<head>'+setup).replace('</body>',checks+'</body>');
const wrapper=`<!doctype html><iframe id="frame" style="width:500px;height:650px"></iframe><pre id="result">pending</pre><script>window.addEventListener('message',e=>document.getElementById('result').textContent=JSON.stringify(e.data));document.getElementById('frame').srcdoc=${JSON.stringify(src).replace(/<\//g,'<\\/')};</script>`;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lyrics-colors-'));
try { const file=path.join(dir,'test.html'); fs.writeFileSync(file,wrapper); const result=spawnSync(chrome,['--headless','--no-sandbox','--disable-gpu','--allow-file-access-from-files','--virtual-time-budget=5000','--dump-dom','file://'+file],{encoding:'utf8',timeout:30000}); const match=result.stdout.match(/<pre id="result">([^<]+)<\/pre>/); if(!match)throw Error('No browser result: '+result.stderr); const data=JSON.parse(match[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&')); if(!data.ok)throw Error(data.error || JSON.stringify(data)); console.log('Browser color checks passed:',data); } finally { fs.rmSync(dir,{recursive:true,force:true}); }
