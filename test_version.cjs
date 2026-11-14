// Real Chromium settings-version regression: node test_version.cjs [chrome]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const chrome = process.argv[2] || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const viewer = fs.readFileSync(path.join(__dirname, 'lyrics-display.html'), 'utf8');
const versions = [...viewer.matchAll(/\bconst VIEWER_VERSION = '([0-9]+\.[0-9]+\.[0-9]+)';/g)];
const expected = 'v' + (versions[0]?.[1] || '1.0.0');
const setup = `<script>window.fetch=async()=>({ok:true,json:async()=>({results:{slides:[]}})});window.WebSocket=undefined;localStorage.setItem('cbmDisplaySettings',JSON.stringify({firstRun:false}));</script>`;
const checks = `<script>
(async()=>{
 const check=(x,m)=>{if(!x)throw Error(m)};
 const label=document.getElementById('viewer-version'), modal=document.getElementById('modal');
 const expected=${JSON.stringify(expected)};
 check(label && modal.contains(label),'version label belongs to settings');
 check(!label.matches('input,select,textarea,[contenteditable]'),'version is not editable');
 const visible=()=>{const r=label.getBoundingClientRect();return !!r.width && !!r.height && getComputedStyle(label).visibility==='visible'};
 check(!visible(),'version hidden when settings closed');
 showSettings();
 check(visible() && label.textContent === expected,'version visibly displayed in settings');
 const bounds=label.getBoundingClientRect(), viewport=modal.getBoundingClientRect();
 check(bounds.top>=viewport.top && bounds.bottom<=viewport.bottom,'version initially in view without scrolling');
 closeModal(true);
 check(!visible(),'version hidden after save');
 check(!Object.keys(JSON.parse(localStorage.getItem('cbmDisplaySettings'))).some(k=>/version/i.test(k)),'version not saved as preference');
 showSettings(); check(visible() && label.textContent === expected,'version survives save');
 resetSettings(); check(visible() && label.textContent === expected,'version survives reset');
 closeModal(false); check(!visible(),'version hidden on projection after reset');
 for(const id of ['content','title-display','footer','error']) check(!document.getElementById(id).textContent.includes(expected),'version absent from projection '+id);
 parent.postMessage({ok:true},'*');
})().catch(e=>parent.postMessage({ok:false,error:e.stack},'*'));
</script>`;
const src = viewer.replace('<head>', '<head>' + setup).replace('</body>', checks + '</body>');
const wrapper = `<!doctype html><iframe id="frame" style="width:900px;height:800px"></iframe><pre id="result">pending</pre><script>window.addEventListener('message',e=>document.getElementById('result').textContent=JSON.stringify(e.data));document.getElementById('frame').srcdoc=${JSON.stringify(src).replace(/<\//g,'<\\/')};</script>`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lyrics-version-'));
try {
 const file = path.join(dir, 'test.html'); fs.writeFileSync(file, wrapper);
 const result = spawnSync(chrome, ['--headless','--no-sandbox','--disable-gpu','--allow-file-access-from-files','--virtual-time-budget=5000','--dump-dom','file://' + file], {encoding:'utf8', timeout:30000});
 const match = result.stdout.match(/<pre id="result">([^<]+)<\/pre>/);
 if (!match) throw Error('No browser result: ' + result.stderr);
 const data = JSON.parse(match[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&'));
 if (!data.ok) throw Error(data.error || JSON.stringify(data));
 assert.equal(versions.length, 1, 'one standalone viewer version constant');
 console.log('Browser version checks passed:', data);
} finally { fs.rmSync(dir, {recursive:true, force:true}); }
