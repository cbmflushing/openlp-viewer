// Offline real-Chromium display regression: node test_safe_display.cjs [path-to-chrome]
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const chrome = process.argv[2] || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const viewer = fs.readFileSync(path.join(__dirname, 'lyrics-display.html'), 'utf8');
const setup = `<script>
window.fetch = async () => ({ok:true,json:async()=>({results:{slides:[]}})});
window.WebSocket = undefined;
localStorage.setItem('cbmDisplaySettings', JSON.stringify({firstRun:false,ccliNumber:'<b>Marker</b>',showTitle:true}));
</script>`;
const checks = `<script>
(() => {
 const failures=[];
 function check(ok, message) { if (!ok) failures.push(message); }
 const footer=document.getElementById('footer');
 check(footer.textContent==='CBM Flushing © CCLI# <b>Marker</b>' && !footer.querySelector('b'), 'saved CCLI is literal on startup');
 showSettings();
 const ccli='<i>New marker</i> & text';
 document.getElementById('ccli-number').value=ccli;
 closeModal(true);
 check(footer.textContent==='CBM Flushing © CCLI# '+ccli && !footer.querySelector('i'), 'CCLI is literal after saving');
 const slide={selected:true,title:'c123',html:'<span class="benign">Hello <b title="note" style="color: blue">bold</b> <i>italic</i> <u>under</u> <sup>up</sup> <sub>down</sub> &lt;literal&gt;</span><br>Second<br>中文'};
 displayLiveData({results:{slides:[slide]}});
 const content=document.getElementById('content');
 check(footer.textContent.includes(ccli) && !footer.querySelector('i') && footer.textContent.includes('Chorus #123') && footer.querySelector('br'), 'CCLI slide footer and songbook line');
 check(!content.querySelector('span,[title],[style]:not(p),[class]:not(p)') && ['b','i','u','sup','sub'].every(tag=>content.querySelector(tag)) && content.textContent.includes('<literal>') && content.querySelectorAll('p').length===3, 'lyrics formatting allowlist, literal text and line breaks');
 const parsed=parseSlideLines('<b>One<br>Two</b><style>hidden</style><template>hidden</template><svg><text>hidden</text></svg>');
 check(JSON.stringify(parsed.englishLines)===JSON.stringify(['<b>One</b>','<b>Two</b>']), 'inert subtrees omitted and formatting survives line breaks');
 let mutations=0; const observer=new MutationObserver(records=>mutations+=records.length);
 observer.observe(content,{childList:true,attributes:true,subtree:true});
 displayLiveData({results:{slides:[slide]}});
 Promise.resolve().then(()=>{observer.disconnect(); check(mutations===0,'identical poll stable');
 displayLiveData({results:{slides:[{selected:false,text:'Ignored'},{selected:true,text:'<em>Fallback</em> &amp; text'}]}});
 check(content.querySelector('em') && content.textContent==='Fallback & text', 'selected text fallback retains formatting and entities');
 parent.postMessage({failures},'*');});
})().catch(e=>parent.postMessage({failures:[e.stack]},'*'));
</script>`;
const src=viewer.replace('<head>','<head>'+setup).replace('</body>',checks+'</body>');
const wrapper=`<!doctype html><iframe id="frame"></iframe><pre id="result">pending</pre><script>
window.addEventListener('message',e=>document.getElementById('result').textContent=JSON.stringify(e.data));
document.getElementById('frame').srcdoc=${JSON.stringify(src).replace(/<\//g,'<\\/')};
</script>`;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'safe-display-'));
try {
 const file=path.join(dir,'test.html'); fs.writeFileSync(file,wrapper);
 const result=spawnSync(chrome,['--headless','--no-sandbox','--disable-gpu','--allow-file-access-from-files','--virtual-time-budget=5000','--dump-dom','file://'+file],{encoding:'utf8',timeout:30000});
 const match=result.stdout.match(/<pre id="result">([^<]+)<\/pre>/);
 if (!match) throw Error('No browser result: '+result.stderr);
 const data=JSON.parse(match[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&'));
 if (data.failures.length) { console.error(data.failures.join('\n')); process.exitCode=1; } else console.log('Safe display browser checks passed');
} finally { fs.rmSync(dir,{recursive:true,force:true}); }
