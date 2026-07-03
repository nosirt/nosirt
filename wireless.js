/* ============================================================
   WIRELESS.JS — "the wireless" feature (podcast player)
   Load this AFTER core.js.
   Real markup lives in #page-wireless (shown via showPage('wireless')).
   Contains: YouTube-backed player (play/pause, 10s skip with
   hold-to-fast-skip, draggable seek bar, wave/video toggle,
   decorative wave visualizer that collapses to a slim bar in
   wave mode), prev/next episode nav, fullscreen/theater controls
   (video mode only), a center "play" button for first-touch,
   per-episode watch-progress persistence + resume, searchable
   episode list, and a Firebase-validated password gate for
   adding new episodes.
   ============================================================ */

let ytPlayer=null;
let ytApiReady=false;
let pendingVideoId=null;
let currentEpisode=null;
let radioUnlocked=false;
let wpDraggingSeek=false;
let wpHideTimer=null;
let waveRunning=false;

function onYouTubeIframeAPIReady(){
  ytApiReady=true;
  if(pendingVideoId)createPlayer(pendingVideoId);
}

function createPlayer(videoId){
  if(!ytApiReady){pendingVideoId=videoId;return;}
  if(ytPlayer){ytPlayer.loadVideoById(videoId);return;}
  ytPlayer=new YT.Player('yt-player',{
    videoId:videoId,
    playerVars:{controls:0,modestbranding:1,rel:0,playsinline:1,cc_load_policy:1,iv_load_policy:3,fs:0},
    events:{
      onReady:()=>{
        const saved=S.podcastProgress&&currentEpisode&&S.podcastProgress[currentEpisode.id];
        if(saved&&saved.seconds)ytPlayer.seekTo(saved.seconds,true);
        ytPlayer.playVideo();
        const cp=$('wp-center-play');if(cp)cp.style.display='none';
      },
      onStateChange:onPlayerStateChange
    }
  });
}

function onPlayerStateChange(e){
  const playing=e.data===1;
  const btn=$('wp-playpause');
  if(btn){
    const playIcon=btn.querySelector('.wp-icon-play'),pauseIcon=btn.querySelector('.wp-icon-pause');
    if(playIcon)playIcon.style.display=playing?'none':'block';
    if(pauseIcon)pauseIcon.style.display=playing?'block':'none';
  }
  const cp=$('wp-center-play');if(cp)cp.style.display=playing?'none':'flex';
  const stage=$('wp-stage');
  if(stage){stage.classList.toggle('is-playing',playing);stage.classList.toggle('is-paused',!playing);}
  if(playing){startWave();takeOverMusicForPodcast();}else{stopWave();}
  if(e.data===0)nextEpisode();
  checkLiveStatus(e);
}

// Free confirmation signal: if a user is actively watching whatever
// episode is currently loaded in the main player, use its real duration
// to keep that episode's live status accurate without an extra probe.
function checkLiveStatus(e){
  if(!currentEpisode||!ytPlayer||typeof ytPlayer.getDuration!=='function')return;
  let dur=0;
  try{dur=ytPlayer.getDuration();}catch(err){return;}
  const isLiveNow=dur===0;
  if(!!currentEpisode.isLive!==isLiveNow)markEpisodeLive(currentEpisode.id,isLiveNow);
}

function takeOverMusicForPodcast(){
  stopAmbientMusic();
  activeMusic='podcast';
  document.querySelectorAll('.music-opt').forEach(o=>o.classList.remove('playing'));
  const el=document.querySelector('.music-opt[data-key="podcast"]');
  if(el)el.classList.add('playing');
  updateNP(currentEpisode?('🎙 '+currentEpisode.title):'🎙 The Wireless');
}

function loadEpisode(ep){
  currentEpisode=ep;
  $('wp-placeholder').style.display='none';
  $('wp-now-title').textContent=ep.title;
  if(ytPlayer)ytPlayer.loadVideoById(ep.videoId);
  else{pendingVideoId=ep.videoId;createPlayer(ep.videoId);}
  localStorage.setItem('n_last_podcast_ep',ep.id);
  renderEpisodes();
}
function loadEpisodeById(id){
  const ep=S.episodes.find(e=>e.id===id);
  if(ep)loadEpisode(ep);
}
// v01.09: decide which episode plays when the user starts the podcast
// without picking a specific one — a live stream always wins regardless
// of saved position; otherwise resume where they left off; otherwise
// start from the OLDEST episode (a new listener starts at the beginning).
function pickDefaultEpisode(){
  if(!S.episodes||!S.episodes.length)return null;
  const liveEp=S.episodes.find(e=>e.isLive);
  if(liveEp)return liveEp;
  const lastId=localStorage.getItem('n_last_podcast_ep');
  const resumed=lastId&&S.episodes.find(e=>e.id===lastId);
  if(resumed)return resumed;
  return S.episodes[S.episodes.length-1]; // oldest — episodes are unshifted, so oldest is last
}

function loadDefaultEpisode(){
  const ep=pickDefaultEpisode();
  if(ep)loadEpisode(ep);
}

// v01.09: if a stream is live when the site first loads, start it
// playing in the background automatically. Browsers often block audio
// autoplay without a prior user gesture — if that happens, fall back to
// a gentle one-time prompt instead of failing silently.
function autoStartLiveIfAny(){
  const liveEp=(S.episodes||[]).find(e=>e.isLive);
  if(!liveEp)return;
  loadEpisode(liveEp);
  setTimeout(()=>{
    if(ytPlayer&&typeof ytPlayer.getPlayerState==='function'&&ytPlayer.getPlayerState()!==1){
      toast('🔴 live now — tap the podcast badge to tune in');
    }
  },1800);
}

function nextEpisode(){
  if(!currentEpisode)return;
  const list=S.episodes;
  const i=list.findIndex(e=>e.id===currentEpisode.id);
  if(i>0){loadEpisode(list[i-1]);toast('next: '+list[i-1].title);}
  else{if(ytPlayer)ytPlayer.pauseVideo();toast("you've reached the end of the wireless");}
}
function prevEpisode(){
  if(!currentEpisode)return;
  const list=S.episodes;
  const i=list.findIndex(e=>e.id===currentEpisode.id);
  if(i<list.length-1){loadEpisode(list[i+1]);toast('previous: '+list[i+1].title);}
}

function togglePlayPause(){
  if(!ytPlayer){
    if(S.episodes&&S.episodes.length)loadDefaultEpisode();
    return;
  }
  const st=ytPlayer.getPlayerState();
  if(st===1)ytPlayer.pauseVideo();else ytPlayer.playVideo();
}

function updateModeLabel(){
  const stage=$('wp-stage'),btn=$('wp-mode-toggle');
  if(!stage||!btn)return;
  const isVideo=stage.classList.contains('mode-video');
  const waveIcon=btn.querySelector('.wp-mode-icon-wave');
  const videoIcon=btn.querySelector('.wp-mode-icon-video');
  if(waveIcon)waveIcon.style.display=isVideo?'none':'block';
  if(videoIcon)videoIcon.style.display=isVideo?'block':'none';
  const label=btn.querySelector('.wp-mode-text');
  if(label)label.textContent=isVideo?'video':'podcast';
  const vc=$('wp-video-controls');if(vc)vc.style.display=isVideo?'flex':'none';
}

function toggleWaveVideo(){
  const stage=$('wp-stage');
  stage.classList.toggle('mode-video');
  stage.classList.toggle('mode-wave');
  updateModeLabel();
}

function toggleFullscreen(){
  const stage=$('wp-stage');
  if(document.fullscreenElement){document.exitFullscreen();return;}
  if(stage.requestFullscreen)stage.requestFullscreen();
  else if(stage.webkitRequestFullscreen)stage.webkitRequestFullscreen();
}
function toggleTheater(){
  $('page-wireless').classList.toggle('theater-mode');
}

const SKIP_TAP=10;
const HOLD_DELAY=350;

function seekBy(delta){
  if(!ytPlayer)return;
  const dur=ytPlayer.getDuration()||0;
  const t=Math.max(0,Math.min(dur,ytPlayer.getCurrentTime()+delta));
  ytPlayer.seekTo(t,true);
}
function bindHoldButton(el,dir){
  if(!el)return;
  let holdTimer=null,holdInterval=null,holdStart=0,holdActive=false;
  function start(e){
    e.preventDefault();
    holdActive=true;
    holdStart=Date.now();
    clearTimeout(holdTimer);clearInterval(holdInterval);
    holdTimer=setTimeout(()=>{
      holdInterval=setInterval(()=>{
        const held=(Date.now()-holdStart)/1000;
        const amt=2*Math.pow(1.9,held)*0.2;
        seekBy(dir*amt);
        showWpControls();
      },200);
    },HOLD_DELAY);
  }
  function end(){
    if(!holdActive)return; // pointerup/leave fired without a real click first (e.g. desktop hover) — ignore
    holdActive=false;
    clearTimeout(holdTimer);
    if(holdInterval){clearInterval(holdInterval);holdInterval=null;}
    else{seekBy(dir*SKIP_TAP);}
  }
  el.addEventListener('pointerdown',start);
  ['pointerup','pointerleave','pointercancel'].forEach(ev=>el.addEventListener(ev,end));
}

function fmtTime(s){
  s=Math.max(0,~~s);
  const m=~~(s/60),sec=s%60;
  return m+':'+(sec<10?'0':'')+sec;
}
function seekBarUpdateLoop(){
  if(ytPlayer&&!wpDraggingSeek&&typeof ytPlayer.getDuration==='function'){
    const dur=ytPlayer.getDuration()||0,cur=ytPlayer.getCurrentTime()||0;
    const pct=dur?(cur/dur*100):0;
    $('wp-seek-fill').style.width=pct+'%';
    $('wp-seek-handle').style.left=pct+'%';
    $('wp-time-cur').textContent=fmtTime(cur);
    $('wp-time-dur').textContent=fmtTime(dur);
    if(currentEpisode&&dur){
      if(!S.podcastProgress)S.podcastProgress={};
      S.podcastProgress[currentEpisode.id]={seconds:cur,pct:pct};
      if(Math.floor(cur)%3===0)localStorage.setItem('n_podcast_progress',JSON.stringify(S.podcastProgress));
    }
  }
  requestAnimationFrame(seekBarUpdateLoop);
}
function seekBarRatioFromEvent(e){
  const bar=$('wp-seekbar'),rect=bar.getBoundingClientRect();
  const x=(e.touches?e.touches[0].clientX:e.clientX)-rect.left;
  return Math.max(0,Math.min(1,x/rect.width));
}
function bindSeekBar(){
  const bar=$('wp-seekbar');
  if(!bar)return;
  bar.addEventListener('pointerdown',e=>{
    if(!ytPlayer)return;
    wpDraggingSeek=true;showWpControls();
    const ratio=seekBarRatioFromEvent(e);
    $('wp-seek-fill').style.width=(ratio*100)+'%';
    $('wp-seek-handle').style.left=(ratio*100)+'%';
  });
  window.addEventListener('pointermove',e=>{
    if(!wpDraggingSeek||!ytPlayer)return;
    const ratio=seekBarRatioFromEvent(e);
    $('wp-seek-fill').style.width=(ratio*100)+'%';
    $('wp-seek-handle').style.left=(ratio*100)+'%';
  });
  window.addEventListener('pointerup',e=>{
    if(!wpDraggingSeek)return;
    wpDraggingSeek=false;
    if(!ytPlayer)return;
    const ratio=seekBarRatioFromEvent(e);
    const dur=ytPlayer.getDuration()||0;
    ytPlayer.seekTo(ratio*dur,true);
  });
}

function showWpControls(){
  const c=$('wp-controls');if(!c)return;
  c.classList.add('show');
  clearTimeout(wpHideTimer);
  wpHideTimer=setTimeout(()=>{
    if(!wpDraggingSeek&&!holdInterval)c.classList.remove('show');
  },2600);
}

let waveCtx=null;
function setupWaveCanvas(){
  const canvas=$('wp-wave');if(!canvas)return;
  const tile=$('wp-art-tile')||$('wp-stage');
  const w=tile.clientWidth||64,h=tile.clientHeight||64;
  const dpr=window.devicePixelRatio||1;
  canvas.width=w*dpr;canvas.height=h*dpr;
  canvas.style.width=w+'px';canvas.style.height=h+'px';
  waveCtx=canvas.getContext('2d');
  waveCtx.setTransform(dpr,0,0,dpr,0,0);
}
function drawWave(t){
  if(!waveCtx)return;
  const canvas=$('wp-wave'),w=canvas.clientWidth||64,h=canvas.clientHeight||64;
  const cx=w/2,cy=h/2;
  waveCtx.clearRect(0,0,w,h);
  waveCtx.save();
  const pulse=0.4+0.3*Math.sin(t*2);
  const orbSize=Math.min(w,h)*0.22;
  const grad0=waveCtx.createRadialGradient(cx,cy,0,cx,cy,orbSize*pulse);
  grad0.addColorStop(0,'rgba(255,210,110,'+Math.min(1,0.8+0.3*Math.sin(t*2.5))+')');
  grad0.addColorStop(1,'rgba(200,137,42,'+Math.min(0.8,0.3+0.2*Math.sin(t*2))+')');
  waveCtx.fillStyle=grad0;
  waveCtx.beginPath();waveCtx.arc(cx,cy,orbSize*pulse,0,Math.PI*2);waveCtx.fill();
  for(let ring=0;ring<2;ring++){
    const radius=Math.min(w,h)*(0.3+ring*0.14);
    const rotSpeed=0.5-ring*0.08;
    const angle=t*rotSpeed;
    const opacity=waveRunning?(0.6-ring*0.15):0.15;
    waveCtx.strokeStyle='rgba(255,210,110,'+opacity*0.4+')';
    waveCtx.lineWidth=1;
    waveCtx.beginPath();waveCtx.arc(cx,cy,radius,0,Math.PI*2);waveCtx.stroke();
    const partCount=6+ring*2;
    for(let p=0;p<partCount;p++){
      const a=angle+(Math.PI*2/partCount)*p;
      const px=cx+Math.cos(a)*radius;
      const py=cy+Math.sin(a)*radius;
      const partOpacity=opacity*(0.5+0.5*Math.sin(t*1.8+p));
      waveCtx.fillStyle='rgba(255,210,110,'+partOpacity+')';
      waveCtx.beginPath();waveCtx.arc(px,py,2+ring*0.8,0,Math.PI*2);waveCtx.fill();
    }
  }
  waveCtx.restore();
}
function waveLoop(){
  drawWave(Date.now()/800);
  if(waveRunning)requestAnimationFrame(waveLoop);
}
function startWave(){ if(waveRunning)return; waveRunning=true; waveLoop(); }
function stopWave(){ waveRunning=false; drawWave(Date.now()/800); }

function renderEpisodes(){
  const q=($('wp-search')?$('wp-search').value:'').trim().toLowerCase();
  const list=(S.episodes||[]).filter(e=>!q||e.title.toLowerCase().includes(q)||(e.desc||'').toLowerCase().includes(q));
  const el=$('wp-episode-list');if(!el)return;
  if(!list.length){
    el.innerHTML='<div class="wp-ep-empty">no episodes yet'+(q?' match that search.':'. check back soon.')+'</div>';
    return;
  }
  el.innerHTML=list.map(ep=>{
    const progress=S.podcastProgress&&S.podcastProgress[ep.id];
    const pct=progress?Math.round(progress.pct):0;
    return `
    <div class="wp-ep-item ${currentEpisode&&currentEpisode.id===ep.id?'playing':''}" onclick="loadEpisodeById('${ep.id}')">
      <div class="wp-ep-play-icon">${currentEpisode&&currentEpisode.id===ep.id?'🔊':'▶'}</div>
      <div class="wp-ep-content">
        <div class="wp-ep-title">${esc(ep.title)}</div>
        ${ep.desc?`<div class="wp-ep-desc">${esc(ep.desc)}</div>`:''}
        ${pct>0?`<div class="wp-ep-progress"><div class="wp-ep-progress-fill" style="width:${pct}%"></div></div>`:''}
      </div>
      <div class="wp-ep-admin ${S.adminUnlocked?'show':''}">
        <button class="wp-ep-btn edit" onclick="editEpisode(event,'${ep.id}')" title="edit">✎</button>
        <button class="wp-ep-btn delete" onclick="deleteEpisode(event,'${ep.id}')" title="delete">✕</button>
      </div>
    </div>`;
  }).join('');
}

function toggleAddEpisode(){
  const panel=$('wp-add-panel');
  const open=panel.style.display==='none';
  panel.style.display=open?'flex':'none';
  if(open&&radioUnlocked){$('wp-gate').style.display='none';$('wp-add-form').style.display='flex';}
  else if(open){$('wp-gate').style.display='flex';$('wp-add-form').style.display='none';}
}

async function tryRadioUnlock(){
  const val=$('wp-gate-pw').value.trim();
  const ok=await validatePassword('podcast_password',val);
  if(ok){
    radioUnlocked=true;
    $('wp-gate').style.display='none';
    $('wp-add-form').style.display='flex';
    $('wp-gate-pw').value='';$('wp-gate-wrong').textContent='';
  }else{
    $('wp-gate-pw').classList.add('wrong');
    $('wp-gate-wrong').textContent='wrong frequency. try again.';
    setTimeout(()=>$('wp-gate-pw').classList.remove('wrong'),420);
    $('wp-gate-pw').value='';
  }
}

function parseYouTubeId(url){
  const m=(url||'').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|v=)([a-zA-Z0-9_-]{11})/);
  return m?m[1]:null;
}

function deleteEpisode(e,id){
  if(!S.adminUnlocked)return;
  e.stopPropagation();
  if(confirm('delete this episode?')){
    S.episodes=S.episodes.filter(ep=>ep.id!==id);
    persistEpisodes();
    if(currentEpisode&&currentEpisode.id===id){
      currentEpisode=null;
      $('wp-placeholder').style.display='flex';
      $('wp-now-title').textContent='';
    }
    renderEpisodes();
    updateLiveBadge();
    toast('episode deleted');
  }
}
function editEpisode(e,id){
  if(!S.adminUnlocked)return;
  e.stopPropagation();
  const ep=S.episodes.find(x=>x.id===id);
  if(!ep)return;
  const newTitle=prompt('episode title:',ep.title);
  if(newTitle===null)return;
  ep.title=filt(newTitle.trim());
  const newDesc=prompt('description:',ep.desc||'');
  if(newDesc!==null)ep.desc=filt(newDesc.trim());
  persistEpisodes();
  if(currentEpisode&&currentEpisode.id===id)$('wp-now-title').textContent=ep.title;
  renderEpisodes();
  toast('episode updated');
}

function addEpisode(){
  const title=filt($('wp-ep-title').value.trim());
  const url=$('wp-ep-url').value.trim();
  const desc=filt($('wp-ep-desc').value.trim());
  const videoId=parseYouTubeId(url);
  if(!title){toast('give it a title first');return;}
  if(!videoId){toast("that doesn't look like a youtube link");return;}
  const ep={id:'ep'+Date.now(),title,desc,videoId,addedAt:Date.now()};
  S.episodes.unshift(ep);
  persistEpisodes();
  $('wp-ep-title').value='';$('wp-ep-url').value='';$('wp-ep-desc').value='';
  toast('episode added ✓');
  renderEpisodes();
  // v01.08: check if this is a live stream — if so, light up the map badge
  probeLiveStatus(ep,(isLive)=>{ if(isLive)markEpisodeLive(ep.id,true); });
}

function persistEpisodes(){
  localStorage.setItem('n_episodes',JSON.stringify(S.episodes));
  fbSave('episodes',{v:JSON.stringify(S.episodes)});
}

// ═══ v01.08: LIVE STREAM DETECTION ═══
// A YouTube live broadcast reliably reports getDuration()===0 while it's
// airing (a finished/normal video always has a real duration). We use a
// small hidden, muted, throwaway player to check this without disturbing
// whatever the user is actually listening to.
function probeLiveStatus(ep,cb){
  if(!ytApiReady){setTimeout(()=>probeLiveStatus(ep,cb),600);return;}
  let holder=document.getElementById('live-check-holder');
  if(!holder){
    holder=document.createElement('div');
    holder.id='live-check-holder';
    holder.style.cssText='position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;top:-9999px;';
    document.body.appendChild(holder);
  }
  holder.innerHTML='<div id="live-check-inner"></div>';
  try{
    new YT.Player('live-check-inner',{
      videoId:ep.videoId,
      playerVars:{controls:0,autoplay:0,mute:1},
      events:{
        onReady:(ev)=>{
          ev.target.mute();
          setTimeout(()=>{
            let isLive=false;
            try{isLive=ev.target.getDuration()===0;}catch(err){}
            cb(isLive);
            try{ev.target.destroy();}catch(err){}
          },1200);
        },
        onError:()=>cb(false)
      }
    });
  }catch(err){cb(false);}
}

function markEpisodeLive(id,isLive){
  const ep=S.episodes.find(x=>x.id===id);
  if(!ep)return;
  const changed=!!ep.isLive!==isLive;
  ep.isLive=isLive;
  ep.liveCheckedAt=Date.now();
  if(changed){persistEpisodes();renderEpisodes();}
  updateLiveBadge();
}

function updateLiveBadge(){
  const badge=$('wireless-live-badge');
  if(!badge)return;
  const liveEp=(S.episodes||[]).find(e=>e.isLive);
  const label=badge.querySelector('.live-badge-text');
  if(liveEp){
    badge.classList.add('is-live');
    if(label)label.textContent='LIVE';
    badge.title='live now — tap to listen: '+liveEp.title;
  }else{
    badge.classList.remove('is-live');
    if(label)label.textContent='podcast';
    badge.title='the wireless — tap to browse episodes';
  }
}

function handleLiveBadgeClick(){
  const ep=pickDefaultEpisode();
  if(!ep){goToLocation('wireless');return;} // no episodes exist yet at all
  loadEpisode(ep);
  toast(ep.isLive?('🔴 tuning in live: '+ep.title):('▶ '+ep.title));
}

// Safety-net + periodic re-check for whichever episode is currently
// flagged live — confirms it's still airing, or clears the flag once the
// stream has ended. A max-age safety net guarantees it can never get
// stuck showing LIVE forever even if a check silently fails.
const LIVE_MAX_AGE_MS=6*60*60*1000; // 6 hours
function sweepLiveStatus(){
  const liveEp=(S.episodes||[]).find(e=>e.isLive);
  if(!liveEp)return;
  if(Date.now()-(liveEp.liveCheckedAt||0)>LIVE_MAX_AGE_MS){
    markEpisodeLive(liveEp.id,false);
    return;
  }
  probeLiveStatus(liveEp,(isLive)=>{ markEpisodeLive(liveEp.id,isLive); });
}

function startPodcastFromMusicBar(){
  const liveEp=(S.episodes||[]).find(e=>e.isLive);
  if(liveEp&&(!currentEpisode||currentEpisode.id!==liveEp.id)){
    loadEpisode(liveEp);
    return true; // handled — no page navigation needed
  }
  if(currentEpisode&&ytPlayer){
    ytPlayer.playVideo();
    return true;
  }
  if(S.episodes&&S.episodes.length){
    loadDefaultEpisode();
    return false;
  }
  return null;
}

(function initWireless(){
  document.addEventListener('DOMContentLoaded',()=>{
    const saved=localStorage.getItem('n_podcast_progress');
    S.podcastProgress=saved?JSON.parse(saved):{};

    setupWaveCanvas();
    bindSeekBar();
    bindHoldButton($('wp-back'),-1);
    bindHoldButton($('wp-fwd'),1);
    const pp=$('wp-playpause');if(pp)pp.addEventListener('click',togglePlayPause);
    const cp=$('wp-center-play');if(cp)cp.addEventListener('click',togglePlayPause);
    const stage=$('wp-stage');
    if(stage){
      ['pointerdown','pointermove'].forEach(ev=>stage.addEventListener(ev,showWpControls));
    }
    const vol=$('wp-volume');
    if(vol)vol.addEventListener('input',()=>{
      if(ytPlayer&&typeof ytPlayer.setVolume==='function')ytPlayer.setVolume(+vol.value);
    });
    window.addEventListener('resize',setupWaveCanvas);
    requestAnimationFrame(seekBarUpdateLoop);
    drawWave(0);
    updateModeLabel();

    // v01.08: live-stream badge — initial paint + periodic re-check
    updateLiveBadge();
    setInterval(sweepLiveStatus,3*60*1000);
  });
})();
