/* ============================================================
   SQUARE.JS — "town square" feature
   Load this AFTER core.js.
   Contains: recs list, the community board (notes), and the
   screaming door. All synced through Firebase via fbSave/fbListen.
   ============================================================ */

// ═══ SQUARE ═══
function openTab(tab){
  document.querySelectorAll('.sq-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.sq-panel').forEach(p=>p.classList.remove('active'));
  document.querySelector(`.sq-tab[onclick="openTab('${tab}')"]`).classList.add('active');
  $('panel-'+tab).classList.add('active');
}
function renderRecs(){
  $('rec-list').innerHTML=S.recs.map(r=>`<div class="rec-item">
    <div class="rec-item-title">${esc(r.title)}</div>
    <div class="rec-item-type">${esc(r.type)}</div>
    ${r.note?`<div class="rec-item-note">${esc(r.note)}</div>`:''}
  </div>`).join('');
}
function addRec(){
  const t=$('rec-title').value.trim();if(!t)return;
  S.recs.unshift({title:filt(t),type:$('rec-type').value,note:filt($('rec-note').value.trim())});
  if(S.recs.length>60)S.recs.pop();
  localStorage.setItem('n_recs',JSON.stringify(S.recs)); fbSave('recs',{v:JSON.stringify(S.recs)});
  renderRecs();$('rec-title').value='';$('rec-note').value='';toast('rec added ✓');
}
function renderNotes(){$('notes-text').value=S.notes;}
function saveNotes(){S.notes=filt($('notes-text').value);localStorage.setItem('n_notes',S.notes);fbSave('notes',{v:S.notes});toast('posted ✓');}
const SCOLS=['#d4a5a5','#b4a5d4','#a5c4d4','#d4c4a5','#c4d4a5'];
function renderScreams(){
  const now=Date.now(),wk=7*24*60*60*1e3;
  S.screams=S.screams.filter(s=>now-s.ts<wk);localStorage.setItem('n_screams',JSON.stringify(S.screams)); fbSave('screams',{v:JSON.stringify(S.screams)});
  const v=$('scream-void');v.innerHTML='';
  S.screams.forEach((s,i)=>{
    const m=document.createElement('div');m.className='void-message';
    const age=(now-s.ts)/wk;
    m.style.cssText=`left:${8+Math.random()*68}%;top:${8+Math.random()*68}%;
      color:${SCOLS[i%5]};font-size:${.58+Math.random()*.3}rem;opacity:${.8-age*.5};
      --tx:${(Math.random()-.5)*170}px;--ty:${(Math.random()-.5)*170}px;
      animation-duration:${48+Math.random()*50}s;animation-delay:${Math.random()*-28}s;`;
    m.textContent=s.text;v.appendChild(m);
  });
}
function sendScream(){
  const t=$('scream-text').value.trim();if(!t)return;
  S.screams.push({text:filt(t),ts:Date.now()});
  localStorage.setItem('n_screams',JSON.stringify(S.screams)); fbSave('screams',{v:JSON.stringify(S.screams)});
  renderScreams();$('scream-text').value='';
  const v=$('scream-void');
  v.style.background='radial-gradient(ellipse at center,#2a0520 0%,#050508 70%)';
  setTimeout(()=>{v.style.background='';},450);toast('hurled into the void');
}
