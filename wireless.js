/* ============================================================
   WIRELESS.JS — "the wireless" feature (podcast player)
   Load this AFTER core.js (order relative to other feature
   files doesn't matter).
   Contains: the YouTube-backed podcast player (play/pause,
   10s skip with exponential hold-to-fast-skip, draggable seek
   bar, wave/video toggle, decorative wave visualizer), the
   searchable episode list, and the password-gated "add episode"
   form. Episodes are stored in S.episodes and synced through
   Firebase via fbSave/fbListen, same as every other feature.
   ============================================================ */

// ═══ STATE ═══
let ytPlayer=null;          // the YT.Player instance, created lazily
let ytApiReady=false;       // set true once YouTube's IFrame API has loaded
let pendingVideoId=null;    // a videoId waiting for the player to become ready
let currentEpisode=null;    // the episode object currently loaded
let radioUnlocked=false;    // whether the add-episode password has been entered this visit
let wpDraggingSeek=false;
let wpHideTimer=null;
let waveRunning=false;

// ═══ YOUTUBE IFRAME API ═══
// Called automatically by the YouTube API script once it has loaded.
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
      onReady:()=>{ytPlayer.playVideo();},
      onStateChange:onPlayerStateChange
    }
  });
}

function onPlayerStateChange(e){
  const playing=e.data===1; // YT.PlayerState.PLAYING
  const btn=$('wp-playpause');
  if(btn)btn.textContent=playing?'❚❚':'▶';
  if(playing){
    startWave();
    takeOverMusicForPodcast();
  }else{
    stopWave();
  }
  if(e.data===0)nextEpisode(); // ENDED — auto-advance
}

// Keeps the persistent top music bar in sync whenever the podcast starts
// playing, however it was started (episode list, music bar, or auto-advance).
function takeOverMusicForPodcast(){
  stopAmbientMusic();
  activeMusic='podcast';
  document.querySelectorAll('.music-opt').forEach(o=>o.classList.remove('playing'));
  const el=document.querySelector('.music-opt[data-key="podcast"]');
  if(el)el.classList.add('playing');
  updateNP(currentEpisode?('🎙 '+currentEpisode.title):'🎙 The Wireless');
}

// ═══ LOADING AN EPISODE ═══
function loadEpisode(ep){
  currentEpisode=ep;
  $('wp-placeholder').style.display='none';
  $('wp-now-title').textContent=ep.title;
  if(ytPlayer)ytPlayer.loadVideoById(ep.videoId);
  else{pendingVideoId=ep.videoId;createPlayer(ep.videoId);}
  renderEpisodes();
}
function loadEpisodeById(id){
  const ep=S.episodes.find(e=>e.id===id);
  if(ep)loadEpisode(ep);
}

function nextEpisode(){
  if(!currentEpisode)return;
  const list=S.episodes;
  const i=list.findIndex(e=>e.id===currentEpisode.id);
  if(i>-1&&i<list.length-1)loadEpisode(list[i+1]);
}

function togglePlayPause(){
  if(!ytPlayer)return;
  const st=ytPlayer.getPlayerState();
  if(st===1)ytPlayer.pauseVideo();else ytPlayer.playVideo();
}

// ═══ WAVE / VIDEO TOGGLE ═══
function toggleWaveVideo(){
  const stage=$('wp-stage');
  stage.classList.toggle('mode-video');
  stage.classList.toggle('mode-wave');
  const btn=$('wp-mode-toggle');
  btn.textContent=stage.classList.contains('mode-video')?'🌊':'🎥';
}

// ═══ SKIP CONTROLS — tap = 10s, hold = accelerating skip ═══
const SKIP_TAP=10;        // seconds skipped on a quick tap
const HOLD_DELAY=350;     // ms before continuous-hold mode kicks in
let holdTimer=null,holdInterval=null,holdStart=0;

function seekBy(delta){
  if(!ytPlayer)return;
  const dur=ytPlayer.getDuration()||0;
  const t=Math.max(0,Math.min(dur,ytPlayer.getCurrentTime()+delta));
  ytPlayer.seekTo(t,true);
}

function startHold(dir){
  holdStart=Date.now();
  clearTimeout(holdTimer);clearInterval(holdInterval);
  holdTimer=setTimeout(()=>{
    holdInterval=setInterval(()=>{
      const held=(Date.now()-holdStart)/1000; // seconds held so far
      // grows from a few seconds/tick up toward ~1 minute per ~2s held — tune the 1.9 to taste
      const amt=2*Math.pow(1.9,held)*0.2;
      seekBy(dir*amt);
      showWpControls();
    },200);
  },HOLD_DELAY);
}
function endHold(dir){
  clearTimeout(holdTimer);
  if(holdInterval){clearInterval(holdInterval);holdInterval=null;}
  else{seekBy(dir*SKIP_TAP);} // released before hold kicked in = simple tap skip
}

function bindHoldButton(el,dir){
  if(!el)return;
  el.addEventListener('pointerdown',e=>{e.preventDefault();startHold(dir);});
  ['pointerup','pointerleave','pointercancel'].forEach(ev=>
    el.addEventListener(ev,()=>endHold(dir)));
}

// ═══ SEEK BAR ═══
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

// ═══ CONTROLS SHOW/HIDE ON HOVER OR TOUCH ═══
function showWpControls(){
  const c=$('wp-controls');if(!c)return;
  c.classList.add('show');
  clearTimeout(wpHideTimer);
  wpHideTimer=setTimeout(()=>{
    if(!wpDraggingSeek&&!holdInterval)c.classList.remove('show');
  },2600);
}

// ═══ DECORATIVE WAVE VISUALIZER ═══
// Note: a YouTube embed's audio can't be read by JS (cross-origin), so this
// is a stylized animation that pulses while playing — not a real audio
// analysis. It pauses/settles whenever playback is paused.
let waveCtx=null,waveBars=[];
function setupWaveCanvas(){
  const canvas=$('wp-wave');if(!canvas)return;
  const stage=$('wp-stage');
  const w=stage.clientWidth,h=stage.clientHeight;
  canvas.width=w;canvas.height=h;
  waveCtx=canvas.getContext('2d');
  if(!waveBars.length){
    const n=42;
    for(let i=0;i<n;i++)waveBars.push({seed:Math.random()*10,speed:.6+Math.random()*.8});
  }
}
function drawWave(t){
  if(!waveCtx)return;
  const canvas=$('wp-wave'),w=canvas.width,h=canvas.height;
  waveCtx.clearRect(0,0,w,h);
  const n=waveBars.length,bw=w/n*0.62,gap=w/n;
  waveCtx.save();
  for(let i=0;i<n;i++){
    const b=waveBars[i];
    const amp=waveRunning?(0.18+0.32*Math.abs(Math.sin(t*b.speed+b.seed))+0.12*Math.abs(Math.sin(t*b.speed*2.3+b.seed))):0.05;
    const barH=h*amp;
    const x=i*gap+(gap-bw)/2,y=(h-barH)/2;
    const grad=waveCtx.createLinearGradient(0,y,0,y+barH);
    grad.addColorStop(0,'rgba(255,210,110,.85)');
    grad.addColorStop(1,'rgba(200,137,42,.55)');
    waveCtx.fillStyle=grad;
    roundRect(waveCtx,x,y,bw,Math.max(3,barH),bw/2);
    waveCtx.fill();
  }
  waveCtx.restore();
}
function waveLoop(){
  drawWave(Date.now()/600);
  if(waveRunning)requestAnimationFrame(waveLoop);
}
function startWave(){ if(waveRunning)return; waveRunning=true; waveLoop(); }
function stopWave(){ waveRunning=false; drawWave(Date.now()/600); }

// ═══ EPISODE LIST + SEARCH ═══
function renderEpisodes(){
  const q=($('wp-search')?$('wp-search').value:'').trim().toLowerCase();
  const list=S.episodes.filter(e=>!q||e.title.toLowerCase().includes(q)||(e.desc||'').toLowerCase().includes(q));
  const el=$('wp-episode-list');if(!el)return;
  if(!list.length){
    el.innerHTML='<div class="wp-ep-empty">no episodes yet'+(q?' match that search.':'. check back soon.')+'</div>';
    return;
  }
  el.innerHTML=list.map(ep=>`
    <div class="wp-ep-item ${currentEpisode&&currentEpisode.id===ep.id?'playing':''}" onclick="loadEpisodeById('${ep.id}')">
      <div class="wp-ep-play-icon">${currentEpisode&&currentEpisode.id===ep.id?'🔊':'▶'}</div>
      <div>
        <div class="wp-ep-title">${esc(ep.title)}</div>
        ${ep.desc?`<div class="wp-ep-desc">${esc(ep.desc)}</div>`:''}
      </div>
    </div>`).join('');
}

// ═══ ADD EPISODE (password-gated) ═══
function toggleAddEpisode(){
  const panel=$('wp-add-panel');
  const open=panel.style.display==='none';
  panel.style.display=open?'flex':'none';
  if(open&&radioUnlocked){$('wp-gate').style.display='none';$('wp-add-form').style.display='flex';}
  else if(open){$('wp-gate').style.display='flex';$('wp-add-form').style.display='none';}
}

function tryRadioUnlock(){
  const val=$('wp-gate-pw').value.trim().toLowerCase();
  if(val===RADIO_PW){
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

function addEpisode(){
  const title=filt($('wp-ep-title').value.trim());
  const url=$('wp-ep-url').value.trim();
  const desc=filt($('wp-ep-desc').value.trim());
  const videoId=parseYouTubeId(url);
  if(!title){toast('give it a title first');return;}
  if(!videoId){toast("that doesn't look like a youtube link");return;}
  const ep={id:'ep'+Date.now(),title,desc,videoId,addedAt:Date.now()};
  S.episodes.unshift(ep);
  localStorage.setItem('n_episodes',JSON.stringify(S.episodes));
  fbSave('episodes',{v:JSON.stringify(S.episodes)});
  $('wp-ep-title').value='';$('wp-ep-url').value='';$('wp-ep-desc').value='';
  toast('episode added ✓');
  renderEpisodes();
}

// ═══ INIT ═══
// Runs once at script-load time; safe because it only wires up listeners
// and doesn't touch the player until an episode is actually picked.
(function initWireless(){
  document.addEventListener('DOMContentLoaded',()=>{
    setupWaveCanvas();
    bindSeekBar();
    bindHoldButton($('wp-back'),-1);
    bindHoldButton($('wp-fwd'),1);
    const pp=$('wp-playpause');if(pp)pp.addEventListener('click',togglePlayPause);
    const stage=$('wp-stage');
    if(stage){
      ['pointerdown','pointermove'].forEach(ev=>stage.addEventListener(ev,showWpControls));
    }
    window.addEventListener('resize',setupWaveCanvas);
    requestAnimationFrame(seekBarUpdateLoop);
    drawWave(0);
  });
})();
