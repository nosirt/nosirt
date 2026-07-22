/* ============================================================
   MAP-LAYOUT.JS — overall site shell
   Load this AFTER core.js.
   Contains: intro animation, the world map (drag/zoom/canvas
   drawing), page navigation, the music player, the popup/
   chat-panel widget, the Konami easter egg, and page init.
   ============================================================ */

// ═══ INTRO ═══
(function(){
  const c=$('intro-leaves'),cols=['#5a3a10','#8b4a2f','#6b5020','#3a5020','#8b2a10'];
  for(let i=0;i<14;i++){const l=document.createElement('div');l.className='leaf';
    l.style.cssText=`left:${Math.random()*100}%;background:${cols[~~(Math.random()*5)]};
    animation-duration:${6+Math.random()*10}s;animation-delay:${Math.random()*8}s;
    width:${6+Math.random()*6}px;height:${8+Math.random()*8}px;`;c.appendChild(l);}
})();

// v01.07: guards against entering twice — the early intro-toggle check
// (below) can race with the visitor's own tap on the intro screen.
let siteEntered=false;

// Pass skipAnim=true when the welcome banner is toggled off, so the site
// opens straight to the map with no fade/delay.
function enterSite(skipAnim){
  if(siteEntered)return;
  siteEntered=true;
  const intro=$('intro');
  const proceed=()=>{
    if(intro)intro.style.display='none';
    $('app').classList.add('visible');
    S.audioStarted=true;
    fbInit();
    initMap();initMapCanvas();buildWL();buildSur();buildExp();
    renderForumNav();startClock();startCreatures();animateClouds();spawnFigures();
    playForView('map');
    // v01.10: auto-start Lofi Hip Hop as soon as the site is entered,
    // instead of leaving all music off until the visitor picks one.
    // Safe to call unconditionally — toggleMusic() no-ops nothing here
    // since activeMusic starts null. If the browser blocks autoplay
    // (e.g. the welcome banner was skipped, so there was no tap to
    // "unlock" audio), tryPlay()'s fallback below retries on the
    // visitor's first interaction anywhere on the page.
    toggleMusic('lofi');
    // Load shared data from Firebase (live-synced across all visitors)
    // v01.13: posts/recs/screams moved off the old single-blob-per-
    // collection storage (see core.js for why — real data-race bug) to
    // one Firestore doc per item. Migrate any existing data first, then
    // set up the new live listeners. notes stays on the old system —
    // it's one shared text field with no multi-writer race to fix.
    if(typeof ensureLegacyDataMigrated==='function')ensureLegacyDataMigrated();
    if(typeof fbListenCollection==='function'){
      fbListenCollection('nosirt_posts', items=>{ S.posts=(items||[]).sort((a,b)=>b.ts-a.ts); renderPosts(); });
      fbListenCollection('nosirt_recs',  items=>{ S.recs=(items||[]).sort((a,b)=>b.ts-a.ts); renderRecs(); });
      fbListenCollection('nosirt_screams',items=>{
        S.screams=(items||[]).sort((a,b)=>a.ts-b.ts);
        renderScreams();
        if(typeof cleanupExpiredScreamsOnce==='function')cleanupExpiredScreamsOnce();
      });
    }
    fbListen('notes', d=>{ S.notes=d.v||''; renderNotes(); });
    // v01.08: global chat — settings (media mode) + messages, both live
    fbListen('chat_settings', d=>{ if(typeof onChatSettingsUpdate==='function')onChatSettingsUpdate(d); });
    if(typeof fbListenChatMsgs==='function'){
      fbListenChatMsgs(items=>{ if(typeof onChatMessagesUpdate==='function')onChatMessagesUpdate(items); });
    }
    // v01.09: presence — "who's online"
    if(typeof fbListenPresence==='function'){
      fbListenPresence(items=>{ if(typeof onPresenceUpdate==='function')onPresenceUpdate(items); });
    }
    if(typeof startPresenceHeartbeat==='function')startPresenceHeartbeat();
    // v01.14: living-map environment — location + weather plumbing
    // (see environment.js). Fire-and-forget, same pattern as the other
    // init calls here — nothing else depends on it being ready yet.
    if(typeof startEnvironmentRefreshLoop==='function')startEnvironmentRefreshLoop();
    // v01.15: Pixie
    if(typeof initPixie==='function')initPixie();
    // v01.17: resume watching for renumbering if a name was already claimed before
    if(S.identity && S.identity.key && typeof startIdentityLiveListener==='function'){
      startIdentityLiveListener(S.identity.key);
    }
    // v01.07: which worlds/banner are switched on — live-synced so an
    // admin toggle takes effect for everyone immediately.
    fbListen('features', d=>{
      S.featureToggles=Object.assign({garden:true,square:true,forum:true,wireless:true,castle:true,intro:true},JSON.parse(d.v||'{}'));
      applyFeatureToggles();
      if(S.adminUnlocked&&typeof renderFeatureToggleList==='function')renderFeatureToggleList();
    });
    // Wireless "shows" (multi-playlist podcast/video browser) — migrates
    // any legacy single-podcast episode data into the new model once,
    // then keeps everything live-synced.
    if(typeof initWirelessShows==='function')initWirelessShows();
    fbListenStories(items=>{ if(items.length){ S.library=items; localStorage.setItem('n_library',JSON.stringify(S.library)); if(typeof renderBookList==='function')renderBookList(); } });
    // Podcast booking calendar — public slot list (never contains names)
    if(typeof fbListen==='function'){
      fbListen('podcast_calendar', d=>{ S.calendar=d; if(typeof renderCalendarGrid==='function')renderCalendarGrid(); });
    }

    // v01.10: land directly on the page a shared/bookmarked URL points to
    const initialPath=currentRoutePath();
    if(initialPath)navigateTo(initialPath,false);
  };
  if(intro&&!skipAnim){
    intro.classList.add('fade-out');
    setTimeout(proceed,1200);
  }else{
    proceed();
  }
}

// v01.07: best-effort check, before the intro even renders, for whether
// the welcome banner has been switched off in the admin panel. If so,
// skip straight to the map. If this fails for any reason (offline, no
// Firebase, etc.) the intro just shows normally — nothing breaks.
(async function checkIntroToggle(){
  try{
    fbInit();
    if(!db)return;
    const doc=await db.collection('nosirt').doc('features').get();
    if(doc.exists){
      const toggles=JSON.parse(doc.data().v||'{}');
      if(toggles&&toggles.intro===false){
        S.featureToggles=Object.assign(S.featureToggles,toggles);
        enterSite(true);
      }
    }
  }catch(e){ /* fall back to showing the intro as normal */ }
})();

// ═══ MAP ═══
const MAP_W=3200,MAP_H=3200;
const PIN_LOCS={
  garden:[980,1220],square:[1560,1820],forum:[2280,1060],castle:[1960,620],wireless:[840,1620]
};

function fitMap(){
  const vw=window.innerWidth,vh=window.innerHeight;
  const portrait=vh>vw&&vw<640;
  if(portrait){
    S.mapScale=Math.max(vw/MAP_W*1.9,vh/MAP_H*.9);
    S.mapX=vw/2-1560*S.mapScale;
    S.mapY=vh*.54-1280*S.mapScale;
  }else{
    S.mapScale=Math.min(vw/MAP_W,vh/MAP_H)*0.98;
    S.mapX=(vw-MAP_W*S.mapScale)/2;
    S.mapY=(vh-MAP_H*S.mapScale)/2;
  }
  const mc=$('map-canvas');
  if(mc){
    mc.style.transition='none';
    mc.style.transform='translate('+S.mapX+'px,'+S.mapY+'px) scale('+S.mapScale+')';
  }
  updatePinOverlay();
}

function clampMap(){
  const vw=window.innerWidth,vh=window.innerHeight;
  const mw=MAP_W*S.mapScale, mh=MAP_H*S.mapScale;
  // Allow generous panning - just prevent map from going completely offscreen
  const minX = Math.min(0, vw - mw);
  const minY = Math.min(0, vh - mh);
  const maxX = Math.max(0, vw - mw) + (mw > vw ? 0 : 0);
  const maxY = Math.max(0, vh - mh) + (mh > vh ? 0 : 0);
  // Simple: don't let the map go more than 80% offscreen in any direction
  const buffer = 80;
  S.mapX = Math.min(vw - buffer, Math.max(buffer - mw, S.mapX));
  S.mapY = Math.min(vh - buffer, Math.max(buffer - mh, S.mapY));
}

function applyMap(){
  const mc=$('map-canvas');
  if(mc){
    mc.style.transition='none';
    mc.style.transform='translate('+S.mapX+'px,'+S.mapY+'px) scale('+S.mapScale+')';
  }
  updatePinOverlay();
}

function zoomAt(factor,cx,cy){
  const newScale=Math.min(4.0,Math.max(0.25,S.mapScale*factor));
  S.mapX=cx-(cx-S.mapX)*(newScale/S.mapScale);
  S.mapY=cy-(cy-S.mapY)*(newScale/S.mapScale);
  S.mapScale=newScale;
  clampMap();applyMap();
}

function resetMap(){
  const mc=$('map-canvas');
  if(mc) mc.style.transition='transform 0.45s cubic-bezier(0.25,0.46,0.45,0.94)';
  fitMap();
  setTimeout(()=>{const mc2=$('map-canvas');if(mc2)mc2.style.transition='none';},500);
  toast('map centered ⊕');
}

function updatePinOverlay(){
  const vw=window.innerWidth,vh=window.innerHeight;
  let nearest='the living map',best=Infinity;
  Object.entries(PIN_LOCS).forEach(([name,[sx,sy]])=>{
    const el=$('fpin-'+name);if(!el)return;
    const screenX=S.mapX+sx*S.mapScale;
    const screenY=S.mapY+sy*S.mapScale;
    const dist=Math.hypot(screenX-vw/2,screenY-vh/2);
    if(dist<best){best=dist;nearest={garden:'near the garden',square:'near town square',forum:'near the tower',castle:"near nosirt's keep",wireless:'near the wireless'}[name]||name;}
    el.style.left=screenX+'px';
    el.style.top=screenY+'px';
    const labelScale=Math.max(0.5,Math.min(1.6,1/S.mapScale));
    el.style.transform=`translate(-50%,-50%) scale(${labelScale})`;
    const lab=el.querySelector('.pin-label');
    if(lab){
      const lw=lab.offsetWidth||92;
      let nudge=0;
      if(screenX+lw/2>vw-12)nudge=(vw-12)-(screenX+lw/2);
      if(screenX-lw/2<12)nudge=12-(screenX-lw/2);
      lab.style.transform=`translateX(${nudge}px)`;
    }
    const margin=60;
    const vis=screenX>-margin&&screenX<vw+margin&&screenY>-margin&&screenY<vh+margin;
    el.style.opacity=vis?'1':'0';
    el.style.pointerEvents=vis?'all':'none';
  });
  const ro=$('map-readout');
  if(ro)ro.textContent=`${nearest} · ${Math.round(S.mapScale*100)}%`;
}

// ═══ v01.07: FEATURE TOGGLES ═══
// Lets admin temporarily switch off a world (or the welcome banner)
// from the profile panel. Bottom-nav icons for a switched-off world
// disappear, its map pin gets a 🚧 mark, and tapping the pin shows a
// note instead of entering. See VERSION_HISTORY / README for details.
const FEATURE_LABELS={
  garden:'🌿 garden',square:'🏚 square',forum:'🗼 tower (n/)',
  wireless:'🎙 wireless',castle:"🏰 nosirt's keep",intro:'🚪 welcome banner'
};
const REVIEW_LABELS={
  garden:'the garden',square:'town square',forum:'the tower',
  castle:"nosirt's keep",wireless:'the wireless'
};
const NAV_TOGGLE_KEYS=['garden','square','forum','wireless'];
const PIN_TOGGLE_KEYS=['garden','square','forum','castle','wireless'];

// Applies the current S.featureToggles state to the bottom nav + map pins.
// Safe to call any time (e.g. right after a Firebase sync, or on load).
function applyFeatureToggles(){
  NAV_TOGGLE_KEYS.forEach(key=>{
    const btn=$('nav-'+key);
    if(btn)btn.style.display=(S.featureToggles[key]===false)?'none':'';
  });
  PIN_TOGGLE_KEYS.forEach(key=>{
    const pin=$('fpin-'+key);
    if(pin)pin.classList.toggle('pin-disabled',S.featureToggles[key]===false);
  });
}

// Renders the checkbox list in the admin panel. Called when admin
// unlocks, and again whenever a features update comes in from Firebase.
function renderFeatureToggleList(){
  const el=$('feature-toggle-list');
  if(!el)return;
  el.innerHTML=Object.keys(FEATURE_LABELS).map(key=>{
    const on=S.featureToggles[key]!==false;
    return `<label style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:.75rem;color:var(--cream);font-family:'IM Fell English',serif;font-style:italic;cursor:pointer">
      <span>${FEATURE_LABELS[key]}</span>
      <input type="checkbox" ${on?'checked':''} onchange="toggleFeature('${key}',this.checked)" style="accent-color:#c8892a;width:16px;height:16px;cursor:pointer">
    </label>`;
  }).join('');
}

// Flips one toggle, saves it (live-synced to every visitor via
// Firebase), and applies it immediately in this browser too.
function toggleFeature(key,isOn){
  if(!S.adminUnlocked){toast('admin access required');return;}
  S.featureToggles[key]=isOn;
  fbSave('features',{v:JSON.stringify(S.featureToggles)});
  applyFeatureToggles();
  toast(`${(FEATURE_LABELS[key]||key).replace(/^[^\s]+\s/,'')} ${isOn?'switched on':'switched off'}`);
}

// The "🚧 under temporary review" note shown when tapping a disabled pin
// or landing on a disabled page's URL directly.
function showUnderReviewNote(key){
  const t=$('review-text');
  if(t)t.textContent=`${REVIEW_LABELS[key]||'this feature'} is under temporary review. check back soon.`;
  const m=$('review-modal');
  if(m)m.classList.add('open');
}
function closeReviewNote(){
  const m=$('review-modal');
  if(m)m.classList.remove('open');
}

function initMap(){
  const vp = $('map-viewport');
  if(!vp) return;
  fitMap();

  // ── Mobile pinch/pan; Hammer if it loads, native pointer fallback otherwise ──
  if(window.Hammer){
    const mc2 = new Hammer.Manager(vp, {
      recognizers:[
        [Hammer.Pan,  {direction: Hammer.DIRECTION_ALL, threshold:0}],
        [Hammer.Pinch,{enable:true}, ['pan']],
      ]
    });

    let startX=0, startY=0, startScale=1;
    mc2.on('panstart', ()=>{startX=S.mapX; startY=S.mapY;});
    mc2.on('panmove', e=>{
      S.mapX = startX + e.deltaX;
      S.mapY = startY + e.deltaY;
      clampMap(); applyMap();
    });

    mc2.on('pinchstart', ()=>{
      startScale = S.mapScale;
      startX = S.mapX; startY = S.mapY;
    });
    mc2.on('pinchmove', e=>{
      const newScale = Math.min(4.0, Math.max(0.25, startScale * e.scale));
      const cx = e.center.x, cy = e.center.y;
      S.mapX = cx - (cx - startX) * (newScale / startScale);
      S.mapY = cy - (cy - startY) * (newScale / startScale);
      S.mapScale = newScale;
      clampMap(); applyMap();
    });
  }else{
    bindPointerMap(vp);
  }

  // ── Desktop mouse drag ──
  let mdrag=false, msx=0, msy=0, mstartX=0, mstartY=0;
  vp.addEventListener('mousedown', e=>{
    if(e.target.closest('.map-pin')) return;
    mdrag=true; msx=e.clientX; msy=e.clientY;
    mstartX=S.mapX; mstartY=S.mapY;
    e.preventDefault();
  });
  window.addEventListener('mousemove', e=>{
    if(!mdrag) return;
    S.mapX = mstartX + (e.clientX - msx);
    S.mapY = mstartY + (e.clientY - msy);
    clampMap(); applyMap();
  });
  window.addEventListener('mouseup', ()=>{ mdrag=false; });

  // ── Desktop scroll wheel ──
  vp.addEventListener('wheel', e=>{
    e.preventDefault();
    zoomAt(e.deltaY<0 ? 1.12 : 0.9, e.clientX, e.clientY);
  },{passive:false});

  // ── Reset button ──
  const rb=$('map-reset');
  if(rb) rb.onclick = resetMap;
}

function bindPointerMap(vp){
  const points=new Map();
  let base=null;
  function mid(){
    const arr=[...points.values()];
    return {x:(arr[0].x+arr[1].x)/2,y:(arr[0].y+arr[1].y)/2,d:Math.hypot(arr[0].x-arr[1].x,arr[0].y-arr[1].y)};
  }
  vp.addEventListener('pointerdown',e=>{
    if(e.target.closest('.map-pin'))return;
    vp.setPointerCapture(e.pointerId);
    points.set(e.pointerId,{x:e.clientX,y:e.clientY});
    base=points.size===2?{...mid(),x0:S.mapX,y0:S.mapY,s0:S.mapScale}:{x:e.clientX,y:e.clientY,x0:S.mapX,y0:S.mapY,s0:S.mapScale};
  });
  vp.addEventListener('pointermove',e=>{
    if(!points.has(e.pointerId)||!base)return;
    points.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(points.size>=2){
      const m=mid(),newScale=Math.min(4,Math.max(0.25,base.s0*(m.d/base.d)));
      S.mapX=m.x-(base.x-base.x0)*(newScale/base.s0);
      S.mapY=m.y-(base.y-base.y0)*(newScale/base.s0);
      S.mapScale=newScale;
    }else{
      S.mapX=base.x0+(e.clientX-base.x);
      S.mapY=base.y0+(e.clientY-base.y);
    }
    clampMap();applyMap();
  });
  ['pointerup','pointercancel','pointerleave'].forEach(type=>vp.addEventListener(type,e=>{
    points.delete(e.pointerId);
    base=points.size?{x:[...points.values()][0].x,y:[...points.values()][0].y,x0:S.mapX,y0:S.mapY,s0:S.mapScale}:null;
  }));
}

// ═══ v01.10: URL ROUTING ═══
// Gives each section its own real, shareable URL:
//   /            → the map
//   /garden      → the garden
//   /square      → town square
//   /tower       → the tower (internal page id is 'forum' — kept for
//                  backwards compatibility with existing code)
//   /wireless    → the wireless
//   /keep        → nosirt's keep (password gate)
const ROUTE_TO_PAGE={garden:'garden',square:'square',tower:'forum',wireless:'wireless'};

function currentRoutePath(){
  return location.pathname.replace(/^\/|\/$/g,'').toLowerCase();
}

// v01.11: plain, non-smart way to land on the wireless page + sync the
// URL — used when a caller (like the dedicated Midnight Archive badge)
// has already decided exactly what should be shown and just needs the
// page + URL to catch up. Bypasses openWirelessSmart() entirely.
function gotoWirelessPageDirect(){
  const url='/wireless';
  if(location.pathname!==url)history.pushState({path:'wireless'},'',url);
  showPage('wireless');
}

// v01.11: the general-purpose "go to wireless" behavior — used by the
// bottom-nav wireless button, the map's wireless pin, direct/bookmarked
// URLs, browser back/forward, and the music modal's "The Wireless"
// option. Three cases:
//  1. Already viewing a specific show's player → step back out to the
//     main wireless page (the show grid).
//  2. Something is actively playing from wireless and we're not
//     already looking at it → jump straight to that show/episode.
//  3. Nothing playing → the main wireless page.
function openWirelessSmart(){
  if(S.view==='wireless' && S.currentShowId){
    S.currentShowId=null;
    showPage('wireless');
    return;
  }
  if(activeMusic==='podcast' && typeof currentEpisode!=='undefined' && currentEpisode && currentEpisode.showId){
    if(S.currentShowId!==currentEpisode.showId){
      S.currentShowId=currentEpisode.showId;
      if(typeof refreshCurrentShowEpisodes==='function')refreshCurrentShowEpisodes();
    }
    showPage('wireless');
    if(typeof setActiveShow==='function')setActiveShow(currentEpisode.showId,{autoplay:false});
    return;
  }
  S.currentShowId=null;
  showPage('wireless');
}

// Central router — shows the right view for a path. Pass push:false when
// responding to the browser's own back/forward (don't add a new entry).
function navigateTo(path,push){
  path=(path||'').replace(/^\/|\/$/g,'').toLowerCase();
  if(push!==false){
    const url=path?('/'+path):'/';
    if(location.pathname!==url)history.pushState({path},'',url);
  }
  if(path==='keep'){
    if(S.featureToggles.castle===false){showUnderReviewNote('castle');showMap();return;}
    showMap();openCastle();return;
  }
  const internal=ROUTE_TO_PAGE[path];
  if(internal){
    if(S.featureToggles[internal]===false){showUnderReviewNote(internal);showMap();return;}
    if(internal==='wireless'){openWirelessSmart();return;}
    showPage(internal);
  }else showMap();
}

window.addEventListener('popstate',()=>{navigateTo(currentRoutePath(),false);});

function goToLocation(loc){
  if(loc==='castle'){navigateTo('keep');return;}
  navigateTo(loc==='forum'?'tower':loc);
}

// Called from nav buttons — also resets any zoom/pan to sensible defaults
function navTo(page){
  navigateTo(page==='forum'?'tower':page);
}

// ═══ NAV ═══
function showPage(page){
  // Hide map and all mood worlds
  $('map-world').style.display='none';
  $('map-reset').style.display='none';
  if($('pin-overlay'))$('pin-overlay').style.display='none';
  document.querySelectorAll('.mood-world').forEach(w=>{
    w.classList.remove('active');
    w.style.opacity='0';
    w.style.pointerEvents='none';
  });
  // Reset ALL pages display then show the right one
  document.querySelectorAll('.page').forEach(p=>{
    p.classList.remove('active');
    p.style.display='none';
  });
  $('mood-back').classList.remove('visible');
  $('bottom-nav').style.display='block';
  $('profile-icon').style.display='block';
  $('float-chat').style.display='flex';
  const pg=$('page-'+page);
  if(pg){pg.style.display='flex';pg.classList.add('active');}
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  const nb=$('nav-'+page);if(nb)nb.classList.add('active');
  S.view=page;playForView(page);
  if(page==='forum')renderPosts();
  if(page==='wireless'){
    if(S.currentShowId&&typeof renderEpisodes==='function')renderEpisodes();
    else if(typeof renderShowGrid==='function')renderShowGrid();
  }
}

function showMap(){
  document.querySelectorAll('.page').forEach(p=>{p.classList.remove('active');p.style.display='none';});
  document.querySelectorAll('.mood-world').forEach(w=>{w.classList.remove('active');w.style.opacity='0';w.style.pointerEvents='none';});
  $('map-world').style.display='block';
  $('map-reset').style.display='flex';
  $('mood-back').classList.remove('visible');
  $('bottom-nav').style.display='none';
  $('profile-icon').style.display='block';
  $('float-chat').style.display='flex';
  if($('pin-overlay'))$('pin-overlay').style.display='block';
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  S.view='map';S.mood=null;playForView('map');
  updatePinOverlay();
}

function enterMoodWorld(mood){
  // Hide all pages and map
  document.querySelectorAll('.page').forEach(p=>{p.classList.remove('active');p.style.display='none';});
  $('map-world').style.display='none';
  $('map-reset').style.display='none';
  if($('pin-overlay'))$('pin-overlay').style.display='none';
  // Hide all mood worlds first
  document.querySelectorAll('.mood-world').forEach(w=>{
    w.classList.remove('active');
    w.style.opacity='0';
    w.style.pointerEvents='none';
  });
  // Show selected mood world
  const world=$('world-'+mood);
  if(world){
    world.style.opacity='';
    world.style.pointerEvents='';
    world.classList.add('active');
  }
  $('mood-back').classList.add('visible');
  $('bottom-nav').style.display='none';
  $('profile-icon').style.display='none';
  $('float-chat').style.display='flex';
  S.mood=mood;S.view='mood';playForView('mood');
  if(mood==='expressionist'){
    bindExpTap();
    setTimeout(()=>{const cv=$('space-canvas');if(cv){cv.width=window.innerWidth;cv.height=window.innerHeight;initSpace();}},50);
  }
  if(mood==='wonderland'){
    bindWLDrag();
    setTimeout(()=>{
      spawnFireflies();
      spawnCardSoldiers();
      const cv=$('sparkle-canvas');
      if(cv){cv.width=window.innerWidth;cv.height=window.innerHeight;}
    },50);
  }
}
function exitMoodWorld(){
  document.querySelectorAll('.mood-world').forEach(w=>w.classList.remove('active'));
  navTo('garden');
}

// ═══ MUSIC ═══
function playForView(view){} // no-op — music is manual now

function tryPlay(src,name){
  stopSynthMusic();
  const a=$('audio-player');
  if(a.src!==src){a.src=src;a.load();}
  a.onerror=()=>{
    if(activeMusic==='podcast'||a.src!==src||!a.getAttribute('src'))return; // stale/irrelevant error, ignore
    updateNP('stream failed · try built-in ancient');toast('that stream would not open here');
  };
  a.play().then(()=>toast('sound started')).catch(()=>{
    updateNP('tap anywhere to start sound');
    // v01.10: browser blocked autoplay (no user-gesture in this call's
    // history — most commonly because the welcome banner was toggled
    // off, so there was no tap to "unlock" audio). Retry automatically
    // the moment the visitor interacts with the page at all, rather
    // than requiring them to specifically reopen the music menu.
    const retryPlay=()=>{
      a.play().then(()=>{ toast('sound started'); updateNP(name); }).catch(()=>{});
      document.removeEventListener('click',retryPlay);
      document.removeEventListener('touchstart',retryPlay);
      document.removeEventListener('keydown',retryPlay);
    };
    document.addEventListener('click',retryPlay,{once:true});
    document.addEventListener('touchstart',retryPlay,{once:true});
    document.addEventListener('keydown',retryPlay,{once:true});
  });
  updateNP(name);
}
function updateNP(name){$('now-playing-text').textContent=name;}

function startAncientSynth(){
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC){toast('audio not supported here');return;}
  stopSynthMusic();
  const ac=new AC();
  const master=ac.createGain();master.gain.value=.0001;master.connect(ac.destination);
  master.gain.exponentialRampToValueAtTime(.18,ac.currentTime+1.8);
  const delay=ac.createDelay(2.5);delay.delayTime.value=.42;
  const fb=ac.createGain();fb.gain.value=.26;
  delay.connect(fb);fb.connect(delay);delay.connect(master);
  const filter=ac.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1900;filter.Q.value=.6;filter.connect(delay);filter.connect(master);
  const scale=[220,261.63,293.66,329.63,392,440,523.25];
  const nodes=[];
  function pluck(freq,when,dur,vol){
    const o=ac.createOscillator(),g=ac.createGain(),tone=ac.createBiquadFilter();
    o.type='triangle';o.frequency.setValueAtTime(freq,when);
    tone.type='bandpass';tone.frequency.value=freq*2.1;tone.Q.value=3.2;
    g.gain.setValueAtTime(.0001,when);
    g.gain.exponentialRampToValueAtTime(vol,when+.025);
    g.gain.exponentialRampToValueAtTime(.0001,when+dur);
    o.connect(tone);tone.connect(g);g.connect(filter);o.start(when);o.stop(when+dur+.08);
    nodes.push(o,g,tone);
  }
  function drone(freq){
    const o=ac.createOscillator(),g=ac.createGain();
    o.type='sine';o.frequency.value=freq;g.gain.value=.026;
    o.connect(g);g.connect(master);o.start();nodes.push(o,g);
  }
  drone(110);drone(165);
  let step=0;
  const timer=setInterval(()=>{
    const now=ac.currentTime+.04;
    const root=scale[(step%14<7?0:3)];
    pluck(root,now,.9,.055);
    pluck(scale[(step*2+1)%scale.length]*.5,now+.18,1.2,.035);
    if(step%2===0)pluck(scale[(step+4)%scale.length],now+.42,.7,.038);
    step++;
  },720);
  synthMusic={ac,master,nodes,timer};
  updateNP('🏰 Ancient ambience · built in');
  toast('ancient ambience started');
}

function stopSynthMusic(){
  if(!synthMusic)return;
  clearInterval(synthMusic.timer);
  const {ac,master,nodes}=synthMusic;
  try{master.gain.cancelScheduledValues(ac.currentTime);master.gain.setTargetAtTime(.0001,ac.currentTime,.12);}catch(e){}
  setTimeout(()=>{nodes.forEach(n=>{try{n.stop&&n.stop();}catch(e){}});try{ac.close();}catch(e){}},420);
  synthMusic=null;
}

function stopAmbientMusic(){
  const a=$('audio-player');
  a.onerror=null; // clear first — a pending error from the old track must never fire after this point
  a.pause();a.removeAttribute('src');a.load();
  stopSynthMusic();
}

function toggleMusic(key){
  if(key==='podcast'){
    if(activeMusic==='podcast'){
      // tapping "The Wireless" again while it's already the active sound → stop it
      if(ytPlayer)ytPlayer.pauseVideo();
      activeMusic=null;
      updateNP('nothing playing · tap to start');
      document.querySelectorAll('.music-opt').forEach(o=>o.classList.remove('playing'));
      closeMusicModal();
      return;
    }
    // v01.11/01.12: "The Wireless" modal option is the general sound
    // picker (distinct from the dedicated "podcast" badge, which is
    // always Midnight Archive — see handleLiveBadgeClick in wireless.js).
    // Same start/stop toggle as Ancient/Lofi/Dark: resumes whatever was
    // last loaded if anything was, plays nothing (silently) if not yet
    // — no page navigation, same as the other sound options.
    stopAmbientMusic(); // wireless takes over from whatever ambient sound was playing
    activeMusic='podcast';
    document.querySelectorAll('.music-opt').forEach(o=>o.classList.remove('playing'));
    const el=document.querySelector(`.music-opt[data-key="podcast"]`);
    if(el)el.classList.add('playing');
    if(typeof currentEpisode!=='undefined' && currentEpisode && ytPlayer){
      ytPlayer.playVideo();
      updateNP('🎙 '+currentEpisode.title);
    }else{
      updateNP('🎙 The Wireless');
    }
    // v01.12: no navigation here on purpose — selecting "The Wireless"
    // from the sounds menu should behave exactly like Ancient/Lofi/Dark:
    // it just starts/resumes playback wherever you already are. Jumping
    // to the grid or the currently-playing show is the bottom-nav
    // wireless button's job specifically (and the map pin) — see
    // openWirelessSmart() — not this modal option's.
    closeMusicModal();
    return;
  }
  // switching to an ambient track — make sure the podcast isn't also playing
  if(ytPlayer)ytPlayer.pauseVideo();
  const a=$('audio-player');
  if(activeMusic===key){
    // clicking same track → stop
    a.pause();a.removeAttribute('src');a.load();
    stopSynthMusic();
    activeMusic=null;
    updateNP('nothing playing · tap to start');
    document.querySelectorAll('.music-opt').forEach(o=>o.classList.remove('playing'));
  } else {
    activeMusic=key;
    const t=MUSIC[key];
    if(t&&t.builtIn){a.pause();a.removeAttribute('src');a.load();startAncientSynth();}
    else if(t)tryPlay(t.src,t.name);
    document.querySelectorAll('.music-opt').forEach(o=>o.classList.remove('playing'));
    const el=document.querySelector(`.music-opt[data-key="${key}"]`);
    if(el)el.classList.add('playing');
  }
  closeMusicModal();
}
function selectMusic(mode,el){toggleMusic(mode);}
function openMusicModal(){$('music-modal').classList.add('open');}
function closeMusicModal(){$('music-modal').classList.remove('open');}

// ═══ ADMIN MODE ═══
// (unlock/lock now handled by handleAdminLoginProfile/handleAdminLogoutProfile
// in the profile panel — see below. This just toggles admin-only UI site-wide.)
function updateAdminUI(){
  // Show/hide admin controls on episodes, posts, notes, etc.
  document.querySelectorAll('.wp-ep-admin, .admin-controls, .rec-admin, .post-admin, .note-admin, .scream-admin, .lib-admin, .wcal-admin-toggle, .show-admin').forEach(el=>{
    if(S.adminUnlocked)el.classList.add('show');
    else el.classList.remove('show');
  });
}
// (now handled by canvas map engine — see initMapCanvas/drawMap)
function animateClouds(){} // no-op: canvas handles clouds
function spawnFigures(){} // no-op: canvas handles figures

// ═══ CREATURES ═══
// (handled by canvas map engine)
function startCreatures(){} // no-op: canvas handles witches/dragons


// ═══════════════════════════════════════
// CANVAS MAP DRAWING ENGINE
// ═══════════════════════════════════════
let mapCtx=null;
const mapState={clouds:[],birds:[],witches:[],dragons:[],figures:[],whales:[],boats:[],
  rain:[],snow:[],windStreaks:[],lightning:{flash:0,nextStrikeAt:0},stars:[],
  leaves:[],festivalDecor:[],festivalDecorId:null,
  waveOff:0,time:0};
// v01.14: coastal point the pier juts out from, and the point out at
// open sea the daily ship sails to and from.
const PIER_BASE={x:2340,y:600,angle:0.35};
const PIER_SEA_POINT={x:2600,y:520};

function initMapCanvas(){
  const cv=$('map-canvas');if(!cv)return;
  cv.width=MAP_W;cv.height=MAP_H;
  cv.style.width=MAP_W+'px';cv.style.height=MAP_H+'px';
  cv.style.transformOrigin='0 0';
  mapCtx=cv.getContext('2d');
  // Clouds
  for(let i=0;i<14;i++) mapState.clouds.push({
    x:Math.random()*MAP_W,y:80+Math.random()*380,
    w:120+Math.random()*200,h:50+Math.random()*55,
    speed:0.18+Math.random()*0.22,opacity:0.28+Math.random()*0.2
  });
  // Bird flocks
  for(let f=0;f<5;f++){
    const bx=Math.random()*MAP_W,by=180+Math.random()*500;
    for(let b=0;b<4+Math.floor(Math.random()*5);b++) mapState.birds.push({
      x:bx+(Math.random()-.5)*100,y:by+(Math.random()-.5)*50,
      speed:0.5+Math.random()*0.6,wing:Math.random()*Math.PI*2,
      wingSpd:0.07+Math.random()*0.05
    });
  }
  // Walking figures
  const roads=[
    {x1:980,y1:1220,x2:1560,y2:1820},{x1:1560,y1:820,x2:1560,y2:1820},
    {x1:1560,y1:1820,x2:2280,y2:1060},{x1:1960,y1:620,x2:1560,y2:820}
  ];
  for(let i=0;i<10;i++) mapState.figures.push({
    road:roads[i%roads.length],t:Math.random(),
    speed:0.00007+Math.random()*0.00006,dir:Math.random()>.5?1:-1,
    step:Math.random()*Math.PI*2
  });
  requestAnimationFrame(mapLoop);
}

function mapLoop(){
  mapState.time+=0.016;mapState.waveOff+=0.3;
  drawMapCanvas();requestAnimationFrame(mapLoop);
}

function drawMapCanvas(){
  if(!mapCtx)return;
  const ctx=mapCtx,W=MAP_W,H=MAP_H,t=mapState.time;
  ctx.clearRect(0,0,W,H);

  // OCEAN
  const og=ctx.createRadialGradient(W*.4,H*.35,0,W*.5,H*.5,W*.8);
  og.addColorStop(0,'#1e4d6b');og.addColorStop(.5,'#163850');og.addColorStop(1,'#0c2030');
  ctx.fillStyle=og;ctx.fillRect(0,0,W,H);
  // Wave lines
  ctx.save();ctx.globalAlpha=.1;ctx.strokeStyle='#4a9ac8';ctx.lineWidth=1.5;
  for(let wy=100;wy<H;wy+=80){
    ctx.beginPath();
    for(let wx=0;wx<W;wx+=5){
      const y=wy+Math.sin((wx*.008)+mapState.waveOff*.035+wy*.002)*9;
      wx===0?ctx.moveTo(wx,y):ctx.lineTo(wx,y);
    }
    ctx.stroke();
  }
  ctx.restore();

  // MAIN LANDMASS
  ctx.save();
  const lg=ctx.createRadialGradient(1600,1400,100,1600,1400,1400);
  lg.addColorStop(0,'#3d6228');lg.addColorStop(.5,'#324f20');lg.addColorStop(1,'#253c18');
  ctx.fillStyle=lg;
  ctx.beginPath();
  ctx.moveTo(520,320);
  ctx.bezierCurveTo(620,200,880,160,1100,180);
  ctx.bezierCurveTo(1380,165,1620,195,1840,240);
  ctx.bezierCurveTo(2100,290,2280,380,2340,520);
  ctx.bezierCurveTo(2400,660,2380,840,2320,1000);
  ctx.bezierCurveTo(2260,1160,2180,1300,2060,1420);
  ctx.bezierCurveTo(1940,1540,1800,1640,1640,1720);
  ctx.bezierCurveTo(1480,1800,1300,1860,1120,1880);
  ctx.bezierCurveTo(940,1900,760,1880,600,1820);
  ctx.bezierCurveTo(440,1760,310,1660,240,1520);
  ctx.bezierCurveTo(170,1380,170,1200,220,1060);
  ctx.bezierCurveTo(270,920,360,780,420,640);
  ctx.bezierCurveTo(480,500,450,400,520,320);
  ctx.fill();
  ctx.save();
  ctx.lineWidth=18;ctx.strokeStyle='rgba(220,196,126,.28)';ctx.stroke();
  ctx.lineWidth=5;ctx.strokeStyle='rgba(70,44,24,.42)';ctx.stroke();
  ctx.setLineDash([22,16]);ctx.lineWidth=2;ctx.strokeStyle='rgba(245,220,150,.24)';ctx.stroke();
  ctx.restore();
  // Highland tint
  const hg=ctx.createRadialGradient(1300,1100,0,1300,1100,700);
  hg.addColorStop(0,'rgba(72,100,48,.65)');hg.addColorStop(1,'transparent');
  ctx.fillStyle=hg;ctx.beginPath();ctx.ellipse(1300,1100,700,500,-.2,0,Math.PI*2);ctx.fill();
  ctx.save();
  ctx.globalAlpha=.18;
  for(let i=0;i<900;i++){
    const x=260+rand2(i,3)*2100,y=250+rand2(i,8)*1620;
    const dx=(x-1420)/1080,dy=(y-1160)/820;
    if(dx*dx+dy*dy<1.08){
      ctx.fillStyle=rand2(i,12)>.55?'#5f7834':'#213816';
      ctx.fillRect(x,y,1.6+rand2(i,20)*2.4,1.2+rand2(i,21)*2.1);
    }
  }
  ctx.restore();
  ctx.restore();

  // DESERT
  ctx.save();
  const dg=ctx.createRadialGradient(2050,1480,0,2050,1480,420);
  dg.addColorStop(0,'rgba(190,148,58,.8)');dg.addColorStop(.6,'rgba(150,108,42,.5)');dg.addColorStop(1,'transparent');
  ctx.fillStyle=dg;ctx.beginPath();ctx.ellipse(2050,1480,420,320,.3,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=.22;ctx.strokeStyle='#c8a848';ctx.lineWidth=2;
  for(let di=0;di<5;di++){
    ctx.beginPath();ctx.moveTo(1750+di*40,1380+di*28);
    ctx.bezierCurveTo(1900,1365+di*22,2060,1375+di*18,2200+di*18,1400+di*28);ctx.stroke();
  }
  ctx.restore();

  // FORESTS
  mForest(ctx,680,680,260,190,t);
  mForest(ctx,700,1400,190,150,t);
  mForest(ctx,1060,1700,170,125,t);

  // MOUNTAINS
  mMountainRange(ctx,[
    {x:1180,y:620,h:200,w:90},{x:1280,y:590,h:230,w:100},
    {x:1380,y:570,h:260,w:112},{x:1480,y:590,h:240,w:100},
    {x:1580,y:620,h:210,w:90},{x:1680,y:650,h:180,w:80},
    {x:1780,y:640,h:165,w:74},
  ]);
  mMountainRange(ctx,[
    {x:2100,y:900,h:115,w:65},{x:2185,y:878,h:138,w:72},
    {x:2268,y:898,h:118,w:63},{x:2340,y:918,h:98,w:58},
  ]);

  // LAKES
  mLake(ctx,1200,1300,155,108,t);
  mLake(ctx,2100,1300,96,65,t);
  mLake(ctx,1620,1700,52,36,t);

  // RIVERS
  mRiver(ctx,[[1380,690],[1340,810],[1280,930],[1240,1050],[1222,1185],[1242,1268]],10,t);
  mRiver(ctx,[[1360,1310],[1490,1318],[1630,1328],[1790,1348],[1940,1368],[2058,1296]],7,t);
  mRiver(ctx,[[1232,1388],[1244,1490],[1286,1592],[1368,1672],[1492,1732],[1592,1770]],6,t);
  mRiver(ctx,[[1196,1328],[1062,1348],[924,1368],[804,1408],[684,1468],[588,1528]],5,t);

  // WATERFALL
  mWaterfall(ctx,1272,1158,t);

  // ROADS
  mRoad(ctx,[[980,1220],[1100,1400],[1300,1580],[1560,1820]]);
  mRoad(ctx,[[1560,820],[1560,1220],[1560,1500],[1560,1820]]);
  mRoad(ctx,[[1560,1820],[1760,1700],[1980,1560],[2140,1380],[2280,1160],[2280,1060]]);
  mRoad(ctx,[[1560,820],[1680,720],[1820,660],[1960,620]]);
  mRoad(ctx,[[840,1620],[1080,1660],[1320,1740],[1560,1820]]);

  // SETTLEMENTS
  mVillage(ctx,1560,1820,78,t);
  mSettlement(ctx,2280,1060,42,t);
  mCastle(ctx,1960,620,t);
  mTower(ctx,2280,1060,t);
  mGarden(ctx,980,1220,t);
  mRuins(ctx,740,980,t);
  mWireless(ctx,840,1620,t);
  mMapLabel(ctx,980,1320,'the garden');
  mMapLabel(ctx,1560,1934,'town square');
  mMapLabel(ctx,2280,1160,'the tower');
  mMapLabel(ctx,1960,742,"nosirt's keep");
  mMapLabel(ctx,840,1712,'the wireless');

  // ISLANDS
  mIsland(ctx,290,490,85,52);mIsland(ctx,2850,330,68,42);
  mIsland(ctx,2770,2690,76,48);mIsland(ctx,390,2750,58,36);mIsland(ctx,188,1820,42,26);

  // ANIMATED BIRDS
  mapState.birds.forEach(b=>{
    b.x+=b.speed;b.wing+=b.wingSpd;
    if(b.x>MAP_W+100)b.x=-100;
    b.y+=Math.sin(b.wing*.5)*.3;
    mBird(ctx,b.x,b.y,b.wing);
  });

  // WALKING FIGURES
  mapState.figures.forEach(fg=>{
    fg.t+=fg.speed*fg.dir;
    if(fg.t>1){fg.t=1;fg.dir=-1;}if(fg.t<0){fg.t=0;fg.dir=1;}
    fg.step+=.08;
    const fx=fg.road.x1+(fg.road.x2-fg.road.x1)*fg.t;
    const fy=fg.road.y1+(fg.road.y2-fg.road.y1)*fg.t;
    mFigure(ctx,fx,fy,fg.step,fg.dir);
  });

  // WITCHES
  if(mapState.witches.length<1&&Math.random()<.0004)
    mapState.witches.push({x:-60,y:200+Math.random()*320,spd:1.8+Math.random()});
  for(let i=mapState.witches.length-1;i>=0;i--){
    const w=mapState.witches[i];w.x+=w.spd;
    mWitch(ctx,w.x,w.y,t);
    if(w.x>MAP_W+80)mapState.witches.splice(i,1);
  }

  // DRAGONS
  if(mapState.dragons.length<1&&Math.random()<.00012)
    mapState.dragons.push({x:-100,y:380+Math.random()*420,spd:1.1+Math.random()*.9});
  for(let i=mapState.dragons.length-1;i>=0;i--){
    const d=mapState.dragons[i];d.x+=d.spd;
    mDragon(ctx,d.x,d.y,t);
    if(d.x>MAP_W+120)mapState.dragons.splice(i,1);
  }

  // v01.14: PIER + DAILY SHIP
  // Ship position cycles smoothly once every 24h of the visitor's own
  // clock: docked at the pier around midnight, farthest out at sea
  // around midday, back by the next midnight. No stored state needed —
  // it's a pure function of the current time, so it's already "mid-
  // journey" correctly no matter when someone loads the page.
  mPier(ctx,PIER_BASE.x,PIER_BASE.y,PIER_BASE.angle);
  {
    const now=new Date();
    const hourFrac=(now.getHours()+now.getMinutes()/60)/24;
    const shipT=(1-Math.cos(hourFrac*Math.PI*2))/2; // 0 at pier, 1 = farthest out
    const dockX=PIER_BASE.x+Math.cos(PIER_BASE.angle)*70,dockY=PIER_BASE.y+Math.sin(PIER_BASE.angle)*70;
    const sx=dockX+(PIER_SEA_POINT.x-dockX)*shipT;
    const sy=dockY+(PIER_SEA_POINT.y-dockY)*shipT+Math.sin(shipT*Math.PI)*-18;
    mShip(ctx,sx,sy,1,t*1.4,true);
  }

  // WHALES (rare, like witches/dragons above)
  if(mapState.whales.length<1&&Math.random()<.00008)
    mapState.whales.push({x:2500+Math.random()*500,y:1900+Math.random()*900,spd:0.25+Math.random()*.2,dir:Math.random()>.5?1:-1});
  for(let i=mapState.whales.length-1;i>=0;i--){
    const w=mapState.whales[i];w.x+=w.spd*w.dir;
    mWhale(ctx,w.x,w.y,t);
    if(w.x>MAP_W+80||w.x<-80)mapState.whales.splice(i,1);
  }

  // BOATS (rare, a plain sailboat crossing open water)
  if(mapState.boats.length<1&&Math.random()<.00015)
    mapState.boats.push({x:-60,y:2000+Math.random()*700,spd:0.7+Math.random()*.5});
  for(let i=mapState.boats.length-1;i>=0;i--){
    const b=mapState.boats[i];b.x+=b.spd;
    mBoat(ctx,b.x,b.y,t,true);
    if(b.x>MAP_W+80)mapState.boats.splice(i,1);
  }

  // v01.14 step 3: WEATHER — computed once per frame from S.environment.
  // Everything below (cloud density/color, rain, snow, wind streaks,
  // lightning) reacts to this single object.
  const wv=(typeof computeWeatherVisualState==='function')?computeWeatherVisualState():{kind:'clear',windy:false,cloudCover:0,isDay:true,intensity:0};

  // CLOUDS — count/opacity/darkness now follow real cloud cover instead
  // of always being the same fixed decorative amount, and move faster
  // when it's windy.
  const cloudBoost = wv.kind==='thunder'?.4 : wv.kind==='rain'||wv.kind==='snow'?.22 : wv.kind==='cloudy'?.1 : wv.kind==='clear'?-.35 : 0;
  const cloudDark = wv.kind==='thunder'?.55 : wv.kind==='rain'?.22 : 0;
  mapState.clouds.forEach(cl=>{
    cl.x+=cl.speed*(wv.windy?2.4:1);if(cl.x-cl.w>MAP_W)cl.x=-cl.w;
    const op=Math.max(.04,Math.min(1,cl.opacity+cloudBoost));
    mCloud(ctx,cl.x,cl.y,cl.w,cl.h,op,cloudDark);
  });

  // RAIN — sparse, stylized streaks that respawn once they fall off the
  // bottom, spread across the whole map so it reads as raining wherever
  // you happen to be looking, without needing hundreds of particles.
  if(wv.kind==='rain'||wv.kind==='thunder'){
    const targetCount=wv.kind==='thunder'?110:80;
    while(mapState.rain.length<targetCount)
      mapState.rain.push({x:Math.random()*MAP_W,y:Math.random()*MAP_H,len:14+Math.random()*16,spd:16+Math.random()*10});
    if(mapState.rain.length>targetCount)mapState.rain.length=targetCount;
    ctx.save();ctx.strokeStyle='rgba(200,215,230,.38)';ctx.lineWidth=1.6;ctx.lineCap='round';
    mapState.rain.forEach(d=>{
      d.y+=d.spd;d.x-=wv.windy?2.2:0.6;
      if(d.y>MAP_H){d.y=-20;d.x=Math.random()*MAP_W;}
      if(d.x<-20)d.x=MAP_W+20;
      ctx.beginPath();ctx.moveTo(d.x,d.y);ctx.lineTo(d.x-(wv.windy?7:2),d.y+d.len);ctx.stroke();
    });
    ctx.restore();
  }else if(mapState.rain.length){mapState.rain.length=0;}

  // SNOW — soft drifting dots, gentler than rain
  if(wv.kind==='snow'){
    const targetCount=70;
    while(mapState.snow.length<targetCount)
      mapState.snow.push({x:Math.random()*MAP_W,y:Math.random()*MAP_H,r:2+Math.random()*3,spd:2+Math.random()*2,drift:Math.random()*Math.PI*2});
    if(mapState.snow.length>targetCount)mapState.snow.length=targetCount;
    ctx.save();ctx.fillStyle='rgba(255,255,255,.75)';
    mapState.snow.forEach(f=>{
      f.y+=f.spd;f.drift+=0.02;f.x+=Math.sin(f.drift)*1.1+(wv.windy?1.6:0);
      if(f.y>MAP_H){f.y=-10;f.x=Math.random()*MAP_W;}
      if(f.x>MAP_W+10)f.x=-10;if(f.x<-10)f.x=MAP_W+10;
      ctx.beginPath();ctx.arc(f.x,f.y,f.r,0,Math.PI*2);ctx.fill();
    });
    ctx.restore();
  }else if(mapState.snow.length){mapState.snow.length=0;}

  // WIND — drifting leaf/dust streaks on genuinely windy days,
  // independent of whatever precipitation (or lack of it) is happening
  if(wv.windy){
    const targetCount=36;
    while(mapState.windStreaks.length<targetCount)
      mapState.windStreaks.push({x:Math.random()*MAP_W,y:Math.random()*MAP_H,spd:9+Math.random()*7,len:10+Math.random()*8,drift:Math.random()*Math.PI*2});
    if(mapState.windStreaks.length>targetCount)mapState.windStreaks.length=targetCount;
    ctx.save();ctx.strokeStyle='rgba(200,180,120,.28)';ctx.lineWidth=1.4;ctx.lineCap='round';
    mapState.windStreaks.forEach(w=>{
      w.x+=w.spd;w.drift+=0.05;const dy=Math.sin(w.drift)*3;
      if(w.x>MAP_W+20){w.x=-20;w.y=Math.random()*MAP_H;}
      ctx.beginPath();ctx.moveTo(w.x,w.y+dy);ctx.lineTo(w.x-w.len,w.y+dy-2);ctx.stroke();
    });
    ctx.restore();
  }else if(mapState.windStreaks.length){mapState.windStreaks.length=0;}

  // LIGHTNING — an occasional screen flash + thunder rumble
  if(wv.kind==='thunder'){
    if(!mapState.lightning.nextStrikeAt)mapState.lightning.nextStrikeAt=performance.now()+3000+Math.random()*6000;
    if(performance.now()>=mapState.lightning.nextStrikeAt){
      mapState.lightning.flash=1;
      mapState.lightning.nextStrikeAt=performance.now()+4000+Math.random()*9000;
      if(typeof playThunderRumble==='function')setTimeout(()=>playThunderRumble(),150+Math.random()*350);
    }
    if(mapState.lightning.flash>0.01){
      ctx.save();ctx.fillStyle=`rgba(230,238,255,${mapState.lightning.flash*.55})`;ctx.fillRect(0,0,W,H);ctx.restore();
      mapState.lightning.flash*=0.82;
    }else mapState.lightning.flash=0;
  }else{
    mapState.lightning.flash=0;mapState.lightning.nextStrikeAt=0;
  }

  // v01.14 step 5: SEASON — a translucent full-canvas wash (same
  // technique as the day/night tint below, layered underneath it) plus
  // falling leaves in the fall. Hemisphere-aware — see computeSeason()
  // in environment.js.
  {
    const season=(typeof computeSeason==='function')?computeSeason():'spring';
    const SEASON_WASH={
      spring:{color:'rgba(150,225,120,1)',alpha:.08},
      summer:{color:'rgba(215,185,95,1)', alpha:.10},
      fall:  {color:'rgba(180,110,55,1)', alpha:.13},
      winter:{color:'rgba(232,240,250,1)',alpha:.20}
    };
    const sw=SEASON_WASH[season]||SEASON_WASH.spring;
    ctx.save();ctx.globalAlpha=sw.alpha;ctx.fillStyle=sw.color;ctx.fillRect(0,0,W,H);ctx.restore();

    if(season==='fall'){
      const targetCount=26;
      while(mapState.leaves.length<targetCount)
        mapState.leaves.push({x:Math.random()*MAP_W,y:Math.random()*MAP_H,
          emoji:Math.random()>.5?'🍂':'🍁',size:14+Math.random()*8,
          spd:1+Math.random()*1.3,drift:Math.random()*Math.PI*2});
      if(mapState.leaves.length>targetCount)mapState.leaves.length=targetCount;
      ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.globalAlpha=.75;
      mapState.leaves.forEach(lf=>{
        lf.y+=lf.spd;lf.drift+=0.035;lf.x+=Math.sin(lf.drift)*1.8+0.6; // gentle breeze, always a little windy in fall
        if(lf.y>MAP_H){lf.y=-14;lf.x=Math.random()*MAP_W;}
        if(lf.x>MAP_W+14)lf.x=-14;
        ctx.font=lf.size+'px serif';
        ctx.fillText(lf.emoji,lf.x,lf.y);
      });
      ctx.restore();
    }else if(mapState.leaves.length){ mapState.leaves.length=0; }
  }

  // v01.14 step 4: DAY/NIGHT — sky tint, sun/moon arc, stars
  {
    const dn=(typeof computeDayNightPhase==='function')?computeDayNightPhase():{isDaytime:true,sunPos:.5,twilight:0,nightAmount:0};

    // Sky tint wash — dawn/dusk orange, night deep blue. Drawn as a
    // translucent full-canvas overlay so it colors everything already
    // drawn (ocean, land, weather) without needing to touch every
    // individual gradient.
    if(dn.twilight>0.02){
      ctx.save();ctx.globalAlpha=dn.twilight*.28;
      ctx.fillStyle='rgba(255,140,60,1)';ctx.fillRect(0,0,W,H);
      ctx.restore();
    }
    if(dn.nightAmount>0.02){
      ctx.save();ctx.globalAlpha=dn.nightAmount*.42*(1-dn.twilight*.5);
      ctx.fillStyle='rgba(10,16,42,1)';ctx.fillRect(0,0,W,H);
      ctx.restore();
    }

    // Stars — fixed field, fade in with nightAmount, gentle twinkle
    if(dn.nightAmount>0.05){
      if(!mapState.stars.length){
        for(let i=0;i<130;i++)
          mapState.stars.push({x:Math.random()*W,y:Math.random()*H*.55,r:0.6+Math.random()*1.4,ph:Math.random()*Math.PI*2});
      }
      ctx.save();
      const baseA=dn.nightAmount*(1-dn.twilight*.6);
      mapState.stars.forEach(s=>{
        const tw=0.55+0.45*Math.sin(t*1.3+s.ph);
        ctx.globalAlpha=baseA*tw;
        ctx.fillStyle='rgba(255,255,245,1)';
        ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();
      });
      ctx.restore();
    }

    // Sun/moon — arcs across the upper portion of the map, peaking in
    // the middle, low at the rise/set edges (a stylized "storybook map"
    // sky band, same spirit as the compass rose in the corner — not a
    // literal side-view horizon).
    const arcX0=380,arcX1=2820,peakY=140,edgeY=560;
    const sp=dn.sunPos;
    const bodyX=arcX0+(arcX1-arcX0)*sp;
    const bodyY=edgeY-(edgeY-peakY)*Math.sin(sp*Math.PI);
    ctx.save();
    if(dn.isDaytime){
      const glow=ctx.createRadialGradient(bodyX,bodyY,0,bodyX,bodyY,70);
      glow.addColorStop(0,'rgba(255,224,140,.55)');glow.addColorStop(1,'rgba(255,224,140,0)');
      ctx.fillStyle=glow;ctx.beginPath();ctx.arc(bodyX,bodyY,70,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=dn.twilight>0.3?'rgba(255,176,110,.85)':'rgba(255,232,170,.85)';
      ctx.beginPath();ctx.arc(bodyX,bodyY,26,0,Math.PI*2);ctx.fill();
    }else{
      const glow=ctx.createRadialGradient(bodyX,bodyY,0,bodyX,bodyY,50);
      glow.addColorStop(0,'rgba(210,220,255,.32)');glow.addColorStop(1,'rgba(210,220,255,0)');
      ctx.fillStyle=glow;ctx.beginPath();ctx.arc(bodyX,bodyY,50,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba(224,228,240,.82)';
      ctx.beginPath();ctx.arc(bodyX,bodyY,19,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba(10,16,42,.5)';
      ctx.beginPath();ctx.arc(bodyX+7,bodyY-4,16,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }

  // v01.14 step 5: FESTIVAL DECORATIONS — a light color wash plus
  // scattered themed emoji, drawn above the day/night tint so they stay
  // clearly readable at any time of day. Config-driven — see the
  // FESTIVALS list in environment.js to add/change occasions.
  {
    const fest=(typeof getActiveFestival==='function')?getActiveFestival():null;
    if(fest){
      if(mapState.festivalDecorId!==fest.id){
        mapState.festivalDecor=[];
        for(let i=0;i<22;i++){
          mapState.festivalDecor.push({
            x:420+Math.random()*2000,y:280+Math.random()*1550,
            emoji:fest.emoji[Math.floor(Math.random()*fest.emoji.length)],
            size:22+Math.random()*14,bob:Math.random()*Math.PI*2
          });
        }
        mapState.festivalDecorId=fest.id;
      }
      ctx.save();ctx.globalAlpha=.09;ctx.fillStyle=fest.tint;ctx.fillRect(0,0,W,H);ctx.restore();
      ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.globalAlpha=.9;
      mapState.festivalDecor.forEach(d=>{
        const bobY=Math.sin(t*0.6+d.bob)*4;
        ctx.font=d.size+'px serif';
        ctx.fillText(d.emoji,d.x,d.y+bobY);
      });
      ctx.restore();
    }else if(mapState.festivalDecor.length){
      mapState.festivalDecor=[];mapState.festivalDecorId=null;
    }
  }

  // VIGNETTE
  const vig=ctx.createRadialGradient(W/2,H/2,W*.25,W/2,H/2,W*.72);
  vig.addColorStop(0,'transparent');vig.addColorStop(1,'rgba(8,5,14,.58)');
  ctx.fillStyle=vig;ctx.fillRect(0,0,W,H);

  // BORDER
  ctx.save();ctx.strokeStyle='rgba(200,160,80,.2)';ctx.lineWidth=4;
  ctx.strokeRect(14,14,W-28,H-28);
  ctx.strokeStyle='rgba(200,160,80,.1)';ctx.lineWidth=1.5;
  ctx.strokeRect(22,22,W-44,H-44);ctx.restore();

  // COMPASS
  mCompass(ctx,W-110,H-110);

  // TITLE
  ctx.save();ctx.globalAlpha=.22;ctx.fillStyle='rgba(200,160,80,1)';
  ctx.font='italic 20px serif';ctx.textAlign='center';
  ctx.fillText('the lands of nosirt',W/2,H-26);ctx.restore();
}

// MAP HELPER FUNCTIONS
function rand2(a,b){
  const x=Math.sin(a*127.1+b*311.7)*43758.5453123;
  return x-Math.floor(x);
}

function mForest(ctx,cx,cy,rw,rh,t){
  ctx.save();
  ctx.globalAlpha=.4;ctx.fillStyle='#1a3010';
  ctx.beginPath();ctx.ellipse(cx,cy,rw,rh,0,0,Math.PI*2);ctx.fill();
  const count=Math.floor(rw*rh/1100);
  ctx.globalAlpha=.88;
  for(let i=0;i<count;i++){
    const a=(i/count)*Math.PI*2,r=rand2(i,Math.round(cx+cy))*Math.min(rw,rh)*.82;
    const tx=cx+Math.cos(a)*r*(rw/Math.max(rw,rh)),ty=cy+Math.sin(a)*r*(rh/Math.max(rw,rh));
    const tr=13+rand2(i,Math.round(rw))*17;
    ctx.fillStyle='#1a3810';ctx.beginPath();ctx.arc(tx+4,ty+5,tr,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#264818';ctx.beginPath();ctx.arc(tx,ty,tr,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(70,118,44,.55)';ctx.beginPath();ctx.arc(tx-2,ty-3,tr*.52,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#2a5020';ctx.beginPath();ctx.moveTo(tx,ty-tr-7);ctx.lineTo(tx-5,ty-tr+3);ctx.lineTo(tx+5,ty-tr+3);ctx.fill();
  }
  ctx.restore();
}

function mMountainRange(ctx,peaks){
  ctx.save();
  // hazy back
  ctx.globalAlpha=.32;ctx.fillStyle='#9a9080';
  peaks.forEach(p=>{ctx.beginPath();ctx.moveTo(p.x-p.w,p.y+p.h);ctx.lineTo(p.x,p.y-p.h*.28);ctx.lineTo(p.x+p.w,p.y+p.h);ctx.fill();});
  // mid
  ctx.globalAlpha=.62;
  peaks.forEach((p,i)=>{
    ctx.fillStyle=i%2===0?'#8a8268':'#907c6a';
    ctx.beginPath();ctx.moveTo(p.x-p.w*.88,p.y+p.h);ctx.lineTo(p.x-p.w*.08,p.y-p.h*.58);ctx.lineTo(p.x+p.w*.08,p.y-p.h*.58);ctx.lineTo(p.x+p.w*.88,p.y+p.h);ctx.fill();
  });
  // front with light/shadow
  peaks.forEach(p=>{
    ctx.globalAlpha=.82;
    ctx.fillStyle='#504030';
    ctx.beginPath();ctx.moveTo(p.x,p.y-p.h);ctx.lineTo(p.x+p.w*.05,p.y-p.h*.9);ctx.lineTo(p.x+p.w,p.y+p.h);ctx.lineTo(p.x,p.y+p.h);ctx.fill();
    ctx.fillStyle='#c8bc9a';
    ctx.beginPath();ctx.moveTo(p.x,p.y-p.h);ctx.lineTo(p.x-p.w*.05,p.y-p.h*.9);ctx.lineTo(p.x-p.w,p.y+p.h);ctx.lineTo(p.x,p.y+p.h);ctx.fill();
    // snow
    ctx.fillStyle='rgba(242,240,235,.92)';
    ctx.beginPath();ctx.moveTo(p.x,p.y-p.h);ctx.lineTo(p.x-p.w*.2,p.y-p.h*.63);ctx.lineTo(p.x+p.w*.17,p.y-p.h*.60);ctx.fill();
    // ridge lines
    ctx.globalAlpha=.18;ctx.strokeStyle='#808060';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(p.x,p.y-p.h);ctx.lineTo(p.x-p.w*.38,p.y-p.h*.18);ctx.stroke();
    ctx.beginPath();ctx.moveTo(p.x,p.y-p.h);ctx.lineTo(p.x+p.w*.34,p.y-p.h*.14);ctx.stroke();
  });
  ctx.restore();
}

function mLake(ctx,cx,cy,rx,ry,t){
  ctx.save();
  const lg=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(rx,ry));
  lg.addColorStop(0,'#5ab0d8');lg.addColorStop(.5,'#3a88b0');lg.addColorStop(1,'#2a6888');
  ctx.fillStyle=lg;ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=.28+Math.sin(t*2)*.1;ctx.fillStyle='rgba(180,230,255,.4)';
  ctx.beginPath();ctx.ellipse(cx-rx*.2,cy-ry*.22,rx*.42,ry*.24,-.3,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=.55;ctx.strokeStyle='#7ac0d8';ctx.lineWidth=3;
  ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);ctx.stroke();
  ctx.restore();
}

function mRiver(ctx,pts,w,t){
  if(pts.length<2)return;ctx.save();
  ctx.globalAlpha=.72;ctx.strokeStyle='#1a5878';ctx.lineWidth=w+2;ctx.lineCap='round';ctx.lineJoin='round';
  ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1]);ctx.stroke();
  ctx.strokeStyle='#4a9ac0';ctx.lineWidth=w;ctx.stroke();
  ctx.globalAlpha=.18+Math.sin(t*1.5)*.07;ctx.strokeStyle='#a0d8f0';ctx.lineWidth=w*.38;ctx.stroke();
  ctx.restore();
}

function mWaterfall(ctx,x,y,t){
  ctx.save();
  ctx.fillStyle='#5a5040';ctx.fillRect(x-14,y-32,28,32);
  for(let i=0;i<4;i++){
    const ph=t*3+i*.5,oy=((y+(ph*20))%62);
    ctx.globalAlpha=.55+Math.sin(ph)*.18;ctx.fillStyle='#90d0f0';
    ctx.fillRect(x-7+i*4,y,3.5,Math.min(oy,52));
  }
  const mist=ctx.createRadialGradient(x,y+58,0,x,y+58,30);
  mist.addColorStop(0,'rgba(180,220,240,.4)');mist.addColorStop(1,'transparent');
  ctx.fillStyle=mist;ctx.globalAlpha=.45+Math.sin(t*2)*.12;
  ctx.beginPath();ctx.ellipse(x,y+58,30,18,0,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

function mRoad(ctx,pts){
  if(pts.length<2)return;ctx.save();
  ctx.setLineDash([14,8]);ctx.strokeStyle='rgba(200,168,80,.48)';ctx.lineWidth=4;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1]);ctx.stroke();
  ctx.setLineDash([]);ctx.restore();
}

function mSmoke(ctx,x,y,t,off){
  ctx.save();
  for(let i=0;i<3;i++){
    const ph=t*.8+off+i*.8,oy=((ph*18)%52),ox=Math.sin(ph*.7)*6;
    ctx.globalAlpha=Math.max(0,.4-oy/62);ctx.fillStyle='#c0c0b0';
    ctx.beginPath();ctx.arc(x+ox,y-oy,4+oy*.08,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}

function mVillage(ctx,cx,cy,sz,t){
  ctx.save();
  ctx.fillStyle='rgba(120,100,60,.4)';
  ctx.beginPath();ctx.ellipse(cx,cy,sz,sz*.6,0,0,Math.PI*2);ctx.fill();
  const bs=[{x:-30,y:-10,w:22,h:26},{x:0,y:-15,w:26,h:30},{x:34,y:-8,w:20,h:24},{x:-18,y:8,w:18,h:20},{x:18,y:6,w:18,h:22},{x:50,y:4,w:16,h:18},{x:-50,y:4,w:18,h:20}];
  bs.forEach(b=>{
    ctx.fillStyle='#a09068';ctx.fillRect(cx+b.x,cy+b.y-b.h,b.w,b.h);
    ctx.fillStyle='#8a6040';ctx.beginPath();ctx.moveTo(cx+b.x-2,cy+b.y-b.h);ctx.lineTo(cx+b.x+b.w/2,cy+b.y-b.h-13);ctx.lineTo(cx+b.x+b.w+2,cy+b.y-b.h);ctx.fill();
    ctx.fillStyle='rgba(255,215,110,.62)';ctx.fillRect(cx+b.x+4,cy+b.y-b.h+6,5,6);
  });
  mSmoke(ctx,cx+3,cy-43,t,0);mSmoke(ctx,cx-30,cy-33,t,1.5);
  ctx.restore();
}

function mSettlement(ctx,cx,cy,sz,t){
  ctx.save();
  ctx.fillStyle='rgba(100,85,50,.35)';ctx.beginPath();ctx.ellipse(cx,cy,sz,sz*.6,0,0,Math.PI*2);ctx.fill();
  [[0,-8,18,22],[20,-5,16,18],[-22,-4,16,18]].forEach(b=>{
    ctx.fillStyle='#907858';ctx.fillRect(cx+b[0],cy+b[1]-b[3],b[2],b[3]);
    ctx.fillStyle='#7a5838';ctx.beginPath();ctx.moveTo(cx+b[0]-2,cy+b[1]-b[3]);ctx.lineTo(cx+b[0]+b[2]/2,cy+b[1]-b[3]-10);ctx.lineTo(cx+b[0]+b[2]+2,cy+b[1]-b[3]);ctx.fill();
  });
  mSmoke(ctx,cx,cy-33,t,.8);ctx.restore();
}

function mCastle(ctx,cx,cy,t){
  ctx.save();
  ctx.fillStyle='rgba(80,70,50,.6)';ctx.beginPath();ctx.moveTo(cx-70,cy+62);ctx.bezierCurveTo(cx-50,cy+22,cx+50,cy+22,cx+70,cy+62);ctx.closePath();ctx.fill();
  ctx.fillStyle='#8a7a60';ctx.fillRect(cx-56,cy-20,112,72);
  ctx.fillStyle='#9a8a70';ctx.fillRect(cx-36,cy-56,72,66);
  ctx.fillStyle='#a8987a';ctx.fillRect(cx-20,cy-92,40,60);
  ctx.fillStyle='#b0a080';ctx.fillRect(cx-22,cy-98,44,8);
  for(let bx=cx-20;bx<cx+20;bx+=10){ctx.fillRect(bx,cy-100,7,10);}
  ctx.fillStyle='#9a8a70';ctx.fillRect(cx-56,cy-42,22,56);ctx.fillRect(cx+34,cy-42,22,56);
  ctx.fillStyle='rgba(255,220,100,.88)';ctx.fillRect(cx-6,cy-80,8,11);ctx.fillRect(cx-6,cy-60,8,8);
  ctx.fillStyle='rgba(255,175,75,.5)';ctx.fillRect(cx-46,cy-26,6,8);ctx.fillRect(cx+40,cy-26,6,8);
  ctx.strokeStyle='#8a7050';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cx,cy-92);ctx.lineTo(cx,cy-114);ctx.stroke();
  ctx.fillStyle='#c03030';ctx.beginPath();ctx.moveTo(cx,cy-114);ctx.lineTo(cx+19,cy-108);ctx.lineTo(cx,cy-101);ctx.fill();
  const gl=ctx.createRadialGradient(cx,cy-72,0,cx,cy-72,42);
  gl.addColorStop(0,'rgba(255,200,80,1)');gl.addColorStop(1,'transparent');
  ctx.globalAlpha=.14+Math.sin(t*3)*.05;ctx.fillStyle=gl;
  ctx.beginPath();ctx.arc(cx,cy-72,42,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

function mTower(ctx,cx,cy,t){
  ctx.save();
  ctx.fillStyle='rgba(60,45,25,.5)';ctx.beginPath();ctx.ellipse(cx,cy+42,32,16,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#6a5a40';ctx.fillRect(cx-14,cy-62,28,98);
  ctx.fillStyle='#8a7258';ctx.fillRect(cx-16,cy-67,32,8);
  for(let bx=cx-14;bx<cx+14;bx+=9){ctx.fillRect(bx,cy-74,6,9);}
  const ga=.68+Math.sin(t*2)*.24;
  ctx.fillStyle=`rgba(160,80,220,${ga})`;ctx.fillRect(cx-4,cy-50,8,10);ctx.fillRect(cx-4,cy-30,8,10);
  const mg=ctx.createRadialGradient(cx,cy-42,0,cx,cy-42,36);
  mg.addColorStop(0,'rgba(160,80,220,1)');mg.addColorStop(1,'transparent');
  ctx.globalAlpha=.28+Math.sin(t*2)*.14;ctx.fillStyle=mg;
  ctx.beginPath();ctx.arc(cx,cy-42,36,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

function mGarden(ctx,cx,cy,t){
  ctx.save();
  const cg=ctx.createRadialGradient(cx,cy,0,cx,cy,82);
  cg.addColorStop(0,'#4a8840');cg.addColorStop(.6,'#3a6830');cg.addColorStop(1,'transparent');
  ctx.fillStyle=cg;ctx.beginPath();ctx.ellipse(cx,cy,82,62,0,0,Math.PI*2);ctx.fill();
  [[-30,-15,'#e8c840'],[10,-22,'#f0a0a0'],[36,-8,'#e8c840'],[-15,12,'#f0a0a0'],[22,18,'#a0d880'],[-42,8,'#e8c840']].forEach(f=>{
    ctx.fillStyle=f[2];ctx.beginPath();ctx.arc(cx+f[0],cy+f[1]+Math.sin(t*1.5+f[0])*.8,5,0,Math.PI*2);ctx.fill();
  });
  ctx.fillStyle='#8a8070';[[-28,-18],[28,-14],[2,-26]].forEach(([sx,sy])=>{ctx.fillRect(cx+sx,cy+sy-14,5,14);});
  ctx.restore();
}

function mWireless(ctx,cx,cy,t){
  ctx.save();
  // ground shadow
  ctx.fillStyle='rgba(60,50,30,.4)';ctx.beginPath();ctx.ellipse(cx,cy+30,32,14,0,0,Math.PI*2);ctx.fill();
  // little station hut at the base
  ctx.fillStyle='#8a7858';ctx.fillRect(cx-20,cy-8,40,38);
  ctx.fillStyle='#6a5840';ctx.beginPath();ctx.moveTo(cx-24,cy-8);ctx.lineTo(cx,cy-26);ctx.lineTo(cx+24,cy-8);ctx.fill();
  ctx.fillStyle=`rgba(255,200,90,${.5+Math.sin(t*2)*.15})`;ctx.fillRect(cx-6,cy+10,10,10);
  // mast rising from the hut
  ctx.strokeStyle='#7a6848';ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(cx,cy-8);ctx.lineTo(cx,cy-118);ctx.stroke();
  // guy wires
  ctx.lineWidth=1;ctx.strokeStyle='rgba(120,105,75,.5)';
  ctx.beginPath();ctx.moveTo(cx,cy-70);ctx.lineTo(cx-26,cy-4);ctx.stroke();
  ctx.beginPath();ctx.moveTo(cx,cy-70);ctx.lineTo(cx+26,cy-4);ctx.stroke();
  // antenna crossbar
  ctx.lineWidth=2.5;ctx.strokeStyle='#8a7858';
  ctx.beginPath();ctx.moveTo(cx-14,cy-110);ctx.lineTo(cx+14,cy-110);ctx.stroke();
  // pulsing tip light
  const tipY=cy-118;
  ctx.fillStyle=`rgba(255,210,110,${.6+Math.sin(t*3)*.3})`;
  ctx.beginPath();ctx.arc(cx,tipY,4,0,Math.PI*2);ctx.fill();
  // broadcast waves rippling outward
  for(let i=0;i<3;i++){
    const r=18+((t*46+i*26)%70);
    const a=Math.max(0,.5-r/70);
    ctx.strokeStyle=`rgba(200,225,255,${a})`;ctx.lineWidth=1.4;
    ctx.beginPath();ctx.arc(cx,tipY,r,Math.PI*1.1,Math.PI*1.9);ctx.stroke();
  }
  // warm glow
  const gl=ctx.createRadialGradient(cx,tipY,0,cx,tipY,46);
  gl.addColorStop(0,'rgba(255,210,110,.5)');gl.addColorStop(1,'transparent');
  ctx.globalAlpha=.5+Math.sin(t*3)*.2;ctx.fillStyle=gl;
  ctx.beginPath();ctx.arc(cx,tipY,46,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

// v01.14: ocean life — a small pier with a ship that sails out and back
// once per day (driven purely by the local clock, no dependencies), plus
// whales and boats that cross the water occasionally, same spawn pattern
// as the witches/dragons above.
function mPier(ctx,x,y,angle){
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);
  ctx.strokeStyle='rgba(90,66,42,.7)';ctx.lineWidth=10;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(70,0);ctx.stroke();
  ctx.strokeStyle='rgba(60,42,26,.65)';ctx.lineWidth=4;
  for(let i=0;i<=70;i+=14){
    ctx.beginPath();ctx.moveTo(i,-7);ctx.lineTo(i,7);ctx.stroke();
  }
  ctx.fillStyle='rgba(60,42,26,.6)';
  ctx.beginPath();ctx.arc(70,-6,4,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(70,6,4,0,Math.PI*2);ctx.fill();
  ctx.restore();
}
function mShip(ctx,x,y,scale,bob,facingRight){
  ctx.save();ctx.translate(x,y+Math.sin(bob)*2*scale);
  if(!facingRight)ctx.scale(-1,1);
  ctx.scale(scale,scale);
  ctx.globalAlpha=.72;
  // hull
  ctx.fillStyle='rgba(58,40,26,.88)';
  ctx.beginPath();ctx.moveTo(-16,4);ctx.lineTo(16,4);ctx.lineTo(11,12);ctx.lineTo(-11,12);ctx.closePath();ctx.fill();
  // mast + sail
  ctx.strokeStyle='rgba(50,36,24,.85)';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(0,4);ctx.lineTo(0,-22);ctx.stroke();
  ctx.fillStyle='rgba(224,210,182,.82)';
  ctx.beginPath();ctx.moveTo(1,-21);ctx.lineTo(1,-2);ctx.lineTo(15,-4);ctx.closePath();ctx.fill();
  ctx.restore();
}
function mWhale(ctx,x,y,t){
  ctx.save();ctx.translate(x,y);ctx.globalAlpha=.55;
  ctx.fillStyle='rgba(40,58,72,.85)';
  ctx.beginPath();ctx.ellipse(0,0,26,9,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.moveTo(-24,0);ctx.quadraticCurveTo(-34,-10,-40,-2);ctx.quadraticCurveTo(-34,2,-24,4);ctx.closePath();ctx.fill();
  // spout, on a slow cycle
  const spout=Math.max(0,Math.sin(t*1.4));
  if(spout>.55){
    ctx.strokeStyle=`rgba(210,224,232,${(spout-.55)*1.6})`;ctx.lineWidth=3;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(8,-8);ctx.lineTo(8,-8-spout*16);ctx.stroke();
  }
  ctx.restore();
}
function mBoat(ctx,x,y,t,facingRight){
  mShip(ctx,x,y,0.7,t*2,facingRight);
}

function mIsland(ctx,cx,cy,rx,ry){
  ctx.save();
  ctx.fillStyle='#c8b878';ctx.beginPath();ctx.ellipse(cx,cy,rx+6,ry+6,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#2a4a1a';ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);ctx.fill();
  const tr=Math.min(rx,ry)*.45;
  ctx.fillStyle='#1e3812';ctx.beginPath();ctx.arc(cx,cy,tr,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#2e5020';ctx.beginPath();ctx.arc(cx-2,cy-3,tr*.85,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

function mBird(ctx,x,y,wing){
  ctx.save();ctx.strokeStyle='rgba(55,45,28,.5)';ctx.lineWidth=1.5;ctx.lineCap='round';
  const wa=Math.sin(wing)*5;
  ctx.beginPath();ctx.moveTo(x-7,y+wa);ctx.quadraticCurveTo(x-3,y,x,y-2);ctx.quadraticCurveTo(x+3,y,x+7,y+wa);ctx.stroke();
  ctx.restore();
}

function mFigure(ctx,x,y,step,dir){
  ctx.save();ctx.globalAlpha=.52;ctx.strokeStyle='#8a7050';ctx.lineWidth=2.5;ctx.lineCap='round';
  ctx.translate(x,y);if(dir<0)ctx.scale(-1,1);
  ctx.beginPath();ctx.moveTo(0,-6);ctx.lineTo(0,4);ctx.stroke();
  ctx.fillStyle='#c8a878';ctx.beginPath();ctx.arc(0,-9,4,0,Math.PI*2);ctx.fill();
  const ls=Math.sin(step)*4;
  ctx.beginPath();ctx.moveTo(0,4);ctx.lineTo(-3+ls,14);ctx.stroke();
  ctx.beginPath();ctx.moveTo(0,4);ctx.lineTo(3-ls,14);ctx.stroke();
  ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-5+ls*.5,6);ctx.stroke();
  ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(5-ls*.5,6);ctx.stroke();
  ctx.restore();
}

function mCloud(ctx,x,y,w,h,op,dark){
  dark=dark||0;
  ctx.save();ctx.globalAlpha=op;
  const g=Math.round(255-dark*175),b=Math.round(255-dark*145);
  ctx.fillStyle=`rgba(${g},${g},${b},.88)`;
  const cx=x+w/2,cy=y+h/2;
  ctx.beginPath();ctx.ellipse(cx,cy,w/2,h/2,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(cx-w*.22,cy,w*.3,h*.52,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(cx+w*.22,cy,w*.3,h*.52,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(cx-w*.08,cy-h*.18,w*.33,h*.42,0,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

function mRuins(ctx,cx,cy,t){
  ctx.save();
  ctx.globalAlpha=.72;
  ctx.fillStyle='rgba(76,66,48,.78)';
  for(let i=0;i<5;i++){
    const h=28+rand2(i,cx)*38;
    ctx.fillRect(cx-42+i*18,cy-h,10,h);
    ctx.fillStyle=i%2?'rgba(116,104,78,.76)':'rgba(76,66,48,.78)';
  }
  ctx.strokeStyle='rgba(210,178,104,.28)';ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(cx,cy-12,62,Math.PI*1.05,Math.PI*1.9);ctx.stroke();
  const gl=ctx.createRadialGradient(cx,cy-26,0,cx,cy-26,82);
  gl.addColorStop(0,`rgba(152,105,215,${.12+Math.sin(t*1.2)*.04})`);
  gl.addColorStop(1,'transparent');
  ctx.fillStyle=gl;ctx.beginPath();ctx.arc(cx,cy-26,82,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

function mMapLabel(ctx,x,y,text){
  ctx.save();
  ctx.font='italic 22px "IM Fell English", Georgia, serif';
  ctx.textAlign='center';
  const w=ctx.measureText(text).width+28;
  ctx.fillStyle='rgba(16,12,9,.54)';
  ctx.strokeStyle='rgba(222,178,92,.18)';
  ctx.lineWidth=1.5;
  roundRect(ctx,x-w/2,y-23,w,32,10);
  ctx.fill();ctx.stroke();
  ctx.fillStyle='rgba(242,228,196,.86)';
  ctx.shadowColor='rgba(0,0,0,.9)';ctx.shadowBlur=6;
  ctx.fillText(text,x,y);
  ctx.restore();
}

function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);
}

function mWitch(ctx,x,y,t){
  ctx.save();ctx.translate(x,y);ctx.globalAlpha=.68;
  ctx.strokeStyle='rgba(28,20,20,.85)';ctx.lineWidth=4;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(-20,8);ctx.lineTo(24,-2);ctx.stroke();
  ctx.fillStyle='rgba(32,22,38,.9)';
  ctx.beginPath();ctx.moveTo(-2,-18);ctx.lineTo(10,4);ctx.lineTo(-14,2);ctx.closePath();ctx.fill();
  ctx.fillStyle='rgba(210,166,70,.5)';
  ctx.beginPath();ctx.arc(-4,-6,4+Math.sin(t*6)*.8,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

function mDragon(ctx,x,y,t){
  ctx.save();ctx.translate(x,y);ctx.globalAlpha=.58;
  ctx.fillStyle='rgba(82,48,36,.86)';
  ctx.beginPath();ctx.ellipse(0,0,30,11,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(30,-4,9,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='rgba(82,48,36,.86)';ctx.lineWidth=7;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(-25,2);ctx.quadraticCurveTo(-52,-8,-66,10);ctx.stroke();
  const flap=Math.sin(t*8)*12;
  ctx.fillStyle='rgba(115,58,42,.58)';
  ctx.beginPath();ctx.moveTo(-8,-4);ctx.lineTo(-38,-38+flap);ctx.lineTo(8,-14);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(8,-4);ctx.lineTo(42,-34-flap);ctx.lineTo(18,-10);ctx.closePath();ctx.fill();
  ctx.restore();
}

function mCompass(ctx,x,y){
  ctx.save();ctx.globalAlpha=.42;
  ctx.fillStyle='rgba(10,8,14,.5)';ctx.beginPath();ctx.arc(x,y,30,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='rgba(200,160,80,.45)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,30,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle='rgba(200,80,60,.9)';
  ctx.beginPath();ctx.moveTo(x,y-24);ctx.lineTo(x+4,y-7);ctx.lineTo(x,y-12);ctx.lineTo(x-4,y-7);ctx.fill();
  ctx.fillStyle='rgba(200,160,80,.58)';
  ctx.beginPath();ctx.moveTo(x,y+24);ctx.lineTo(x+4,y+7);ctx.lineTo(x,y+12);ctx.lineTo(x-4,y+7);ctx.fill();
  ctx.fillStyle='rgba(200,160,80,.9)';ctx.font='bold 11px serif';ctx.textAlign='center';ctx.fillText('N',x,y-34);
  ctx.globalAlpha=.45;ctx.font='9px serif';
  ctx.fillText('S',x,y+42);ctx.fillText('E',x+40,y+3);ctx.fillText('W',x-40,y+3);
  ctx.restore();
}

// ═══ PROFILE PANEL — closes on outside tap ═══
document.addEventListener('click',e=>{
  const panel=$('profile-panel');
  if(panel&&panel.style.display!=='none'&&!e.target.closest('#profile-icon')&&!e.target.closest('#profile-panel'))
    closeProfilePanel();
});

// ═══ STONE NOTE ═══
// v01.08: the old standalone "carved in stone" overlay (openStoneNote/
// closeStoneNote) has been folded into the chat panel as a tab — see
// chat.js (openChatPanel, switchChatTab, saveStoneDebounced).

// ═══ EASTER EGGS ═══
const KONAMI=[38,38,40,40,37,39,37,39,66,65];let ki=0;
document.addEventListener('keydown',e=>{
  if(e.keyCode===KONAMI[ki]){ki++;if(ki===KONAMI.length){ki=0;toast('the beast watches');spawnBeast();}}else ki=0;
});
function spawnBeast(){
  const b=document.createElement('div');
  b.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);font-size:3rem;z-index:999;pointer-events:none;';
  b.textContent='🐻';document.body.appendChild(b);setTimeout(()=>b.remove(),3000);
}
let nTaps=0,nTimer=null;

// ── WATERFALL AMBIENT SOUND ────────────────────────────────────────────────
function playWaterfallSound(){
  try{
    const ac=new(window.AudioContext||window.webkitAudioContext)();
    const buf=ac.createBuffer(1,ac.sampleRate*.8,ac.sampleRate);
    const data=buf.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.4;
    const src=ac.createBufferSource();src.buffer=buf;
    const flt=ac.createBiquadFilter();flt.type='bandpass';flt.frequency.value=800;flt.Q.value=.5;
    const g=ac.createGain();g.gain.setValueAtTime(0,ac.currentTime);
    g.gain.linearRampToValueAtTime(.15,ac.currentTime+.2);
    g.gain.linearRampToValueAtTime(0,ac.currentTime+.8);
    src.connect(flt);flt.connect(g);g.connect(ac.destination);
    src.start();src.stop(ac.currentTime+.8);
  }catch(e){}
}

// Waterfall click on map
document.addEventListener('click',function(e){
  if(S.view!=='map')return;
  // Check if near waterfall (approx screen position)
  const wfX=S.mapX+865*S.mapScale, wfY=S.mapY+755*S.mapScale;
  if(Math.hypot(e.clientX-wfX,e.clientY-wfY)<30*S.mapScale){
    playWaterfallSound();
    toast('the falls rush on');
  }
});

// ═══ INIT ═══
window.addEventListener('load',()=>{
  $('map-world').style.display='block';
  $('map-reset').style.display='flex';
  $('bottom-nav').style.display='none';
  document.querySelectorAll('.page').forEach(p=>{p.classList.remove('active');p.style.display='none';});
  // Use fitMap so the whole map is visible and centered
  setTimeout(()=>{fitMap();},50);
  // Bind element-specific listeners safely after DOM confirmed ready
  const _nfEl2=$('profile-icon');
  if(_nfEl2)_nfEl2.addEventListener('click',()=>{
    nTaps++;clearTimeout(nTimer);nTimer=setTimeout(()=>nTaps=0,2000);
    if(nTaps>=5){nTaps=0;toast('the wanderer returns...');setTimeout(showMap,800);}
  });
});
window.addEventListener('resize',()=>{
  const cv=$('sparkle-canvas');if(cv){cv.width=window.innerWidth;cv.height=window.innerHeight;}
  if(S.view==='map'){fitMap();updatePinOverlay();}
});

// ═══════════════════════════════════════════════════════════
// v01.05 — Profile Icon Draggable, Admin/Bio/Versions Integrated
// ═══════════════════════════════════════════════════════════

function openProfilePanel() {
  const panel = $('profile-panel');
  if (panel) {
    panel.style.display = 'flex';
    // v01.11: was a dead "v${CURRENT_VERSION}" literal sitting in raw
    // HTML (never actually evaluated as JS) — now set here for real.
    const vEl = $('profile-version-display');
    if (vEl) vEl.textContent = CURRENT_VERSION;
    loadProfileData();
  }
}

function closeProfilePanel() {
  const panel = $('profile-panel');
  if (panel) panel.style.display = 'none';
}

// v01.16: full tabbed admin settings panel — launched from the small
// profile sidebar once unlocked. Re-renders every section's content on
// open, same as before, just now inside tabs instead of one long stack.
function openAdminSettingsPanel(){
  if(!S.adminUnlocked)return;
  const panel=$('admin-settings-panel');
  if(!panel)return;
  panel.classList.add('open');
  if(typeof renderFeatureToggleList==='function')renderFeatureToggleList();
  if(typeof renderChatAdminSettings==='function')renderChatAdminSettings();
  if(typeof renderEnvPreviewControls==='function')renderEnvPreviewControls();
  if(typeof renderPixieAdminSettings==='function')renderPixieAdminSettings();
}
function closeAdminSettingsPanel(){
  const panel=$('admin-settings-panel');
  if(panel)panel.classList.remove('open');
}
function switchAdminTab(tab){
  ['features','chat','environment','pixie'].forEach(t=>{
    const body=$('admin-tab-'+t),btn=$('admin-tabbtn-'+t);
    if(body)body.style.display=(t===tab)?'flex':'none';
    if(btn)btn.classList.toggle('active',t===tab);
  });
}

async function loadProfileData() {
  // Load bio from Firebase
  const bio = await fetchSiteBio();
  $('profile-bio-display').textContent = bio;

  // Show admin buttons if unlocked
  if (S.adminUnlocked) {
    $('profile-bio-edit-btn').style.display = 'block';
    loadChangelogIfAdmin();
    renderFeatureToggleList();
    if(typeof renderChatAdminSettings==='function')renderChatAdminSettings();
    if(typeof renderEnvPreviewControls==='function')renderEnvPreviewControls();
  }
}

function loadChangelogIfAdmin() {
  if (!S.adminUnlocked) return;
  const changelogDiv = $('profile-changelog');
  changelogDiv.innerHTML = '';

  VERSION_HISTORY.forEach((v, idx) => {
    const item = document.createElement('div');
    item.style.cssText = 'margin-bottom:6px;border-radius:4px;overflow:hidden';
    const changesHtml = v.changes.map(ch => `• ${esc(ch)}`).join('<br>');
    item.innerHTML = `
      <div class="changelog-version-row" onclick="const b=this.nextElementSibling;b.style.display=b.style.display==='block'?'none':'block';"
        style="cursor:pointer;padding:6px;color:#a8e05f;font-weight:bold;font-family:'Cinzel Decorative',serif;
        display:flex;align-items:center;justify-content:space-between;background:rgba(200,137,42,.08)">
        <span>v${esc(v.version)}</span><span style="opacity:.5;font-size:.65rem">tap to expand</span>
      </div>
      <div class="changelog-version-body" style="display:none;padding:8px 6px;background:rgba(200,137,42,.04)">${changesHtml}</div>
    `;
    changelogDiv.appendChild(item);
  });
  changelogDiv.style.display = 'block';
}

function startBioEdit() {
  $('profile-bio-display').style.display = 'none';
  $('profile-bio-edit-btn').style.display = 'none';
  $('profile-bio-edit').style.display = 'block';
  $('profile-bio-buttons').style.display = 'flex';
  $('profile-bio-edit').value = $('profile-bio-display').textContent;
}

function cancelBioEdit() {
  $('profile-bio-edit').style.display = 'none';
  $('profile-bio-buttons').style.display = 'none';
  $('profile-bio-display').style.display = 'block';
  $('profile-bio-edit-btn').style.display = 'block';
}

async function saveBioEdit() {
  const newBio = $('profile-bio-edit').value.trim();
  if (newBio.length < 5) {
    toast('bio must be at least 5 characters');
    return;
  }
  
  const success = await saveSiteBio(newBio);
  if (success) {
    $('profile-bio-display').textContent = newBio;
    cancelBioEdit();
  }
}

async function handleAdminLoginProfile() {
  const username = $('admin-username-profile').value.trim();
  const password = $('admin-password-profile').value.trim();
  const errorDiv = $('admin-login-error-profile');

  const isValid = await validatePassword('admin_password', password);
  
  if (username === 'admin' && isValid) {
    S.adminUnlocked = true;
    errorDiv.textContent = '';
    $('admin-username-profile').value = '';
    $('admin-password-profile').value = '';
    $('admin-login-form-profile').style.display = 'none';
    $('admin-unlocked-view-profile').style.display = 'block';
    $('profile-bio-edit-btn').style.display = 'block';
    loadChangelogIfAdmin();
    renderFeatureToggleList();
    if(typeof renderChatAdminSettings==='function')renderChatAdminSettings();
    if(typeof renderEnvPreviewControls==='function')renderEnvPreviewControls();
    toast('admin mode unlocked');
    updateAdminUI();
    renderEpisodes(); // refresh so wp-ep-admin edit/delete buttons show immediately
    if(typeof renderShowGrid==='function')renderShowGrid();
    if(typeof renderComments==='function')renderComments();
    if(typeof loadClaimNamesForAdmin==='function')loadClaimNamesForAdmin(); // reveal booking names now that admin is unlocked
  } else {
    errorDiv.textContent = 'wrong username or password';
  }
}

function handleAdminLogoutProfile() {
  S.adminUnlocked = false;
  $('admin-username-profile').value = '';
  $('admin-password-profile').value = '';
  $('admin-unlocked-view-profile').style.display = 'none';
  $('admin-login-form-profile').style.display = 'flex';
  $('profile-bio-edit-btn').style.display = 'none';
  $('profile-changelog').style.display = 'none';
  cancelBioEdit();
  toast('admin locked');
  updateAdminUI();
  if(typeof renderEpisodes==='function')renderEpisodes();
  wcalClaimsCache={}; // wipe cached booking names from memory on logout
  if(typeof renderCalendarGrid==='function')renderCalendarGrid();
  if(typeof closeAdminEdit==='function')closeAdminEdit();
  if($('wcal-admin-panel'))$('wcal-admin-panel').classList.remove('show');
  if(typeof closeAdminSettingsPanel==='function')closeAdminSettingsPanel();
  if(typeof renderShowGrid==='function')renderShowGrid();
  if(typeof renderComments==='function')renderComments();
  if(typeof cancelShowDescriptionEdit==='function')cancelShowDescriptionEdit();
  if(typeof closeShowForm==='function')closeShowForm();
  if(S.selectMode&&typeof toggleSelectMode==='function')toggleSelectMode();
}

function initProfileIconDraggable() {
  const icon = $('profile-icon');
  const panel = $('profile-panel');
  let isDragging = false;
  let moved = false;
  let startX = 0, startY = 0;

  // v01.06: keep the icon fully inside the app frame — never let it
  // drag off past the edges of the map square itself.
  function clamp(x, y) {
    const w = icon.offsetWidth || 40;
    const h = icon.offsetHeight || 56;
    const pad = 6; // small breathing room from the very edge
    const maxX = window.innerWidth - w - pad;
    const maxY = window.innerHeight - h - pad;
    return {
      x: Math.max(pad, Math.min(x, maxX)),
      y: Math.max(pad, Math.min(y, maxY))
    };
  }

  // Click to open panel (only if it wasn't a drag)
  icon.addEventListener('click', () => {
    if (!moved) openProfilePanel();
  });

  icon.addEventListener('pointerdown', (e) => {
    isDragging = true;
    moved = false;
    const rect = icon.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    icon.setPointerCapture && icon.setPointerCapture(e.pointerId);
  });

  document.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    moved = true;
    const rawX = e.clientX - startX;
    const rawY = e.clientY - startY;
    const { x, y } = clamp(rawX, rawY);
    icon.style.position = 'fixed';
    icon.style.left = x + 'px';
    icon.style.top = y + 'px';
    icon.style.right = 'auto';
    icon.style.bottom = 'auto';
  });

  document.addEventListener('pointerup', () => {
    if (isDragging) {
      isDragging = false;
      if (moved) {
        const pos = { left: icon.style.left, top: icon.style.top };
        localStorage.setItem('n_profile_icon_pos', JSON.stringify(pos));
      }
      // small delay so the click handler above can see the final `moved` state
      setTimeout(() => { moved = false; }, 50);
    }
  });

  // Re-clamp on resize/orientation change so it can never end up stuck
  // off-screen after the viewport changes size.
  window.addEventListener('resize', () => {
    const rect = icon.getBoundingClientRect();
    const { x, y } = clamp(rect.left, rect.top);
    if (icon.style.left) {
      icon.style.left = x + 'px';
      icon.style.top = y + 'px';
    }
  });

  // Restore position (clamped, in case the viewport is smaller now than
  // when the position was saved — e.g. switched from desktop to mobile)
  const saved = localStorage.getItem('n_profile_icon_pos');
  if (saved) {
    const pos = JSON.parse(saved);
    const savedX = parseFloat(pos.left) || 0;
    const savedY = parseFloat(pos.top) || 0;
    const { x, y } = clamp(savedX, savedY);
    icon.style.left = x + 'px';
    icon.style.top = y + 'px';
    icon.style.right = 'auto';
    icon.style.bottom = 'auto';
  }
}

// Init on load
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    initProfileIconDraggable();
  }, 100);
});
// v01.05: Remove map UI (buttons/hints) — keep zoom/pan
function hideMapUI() {
  const tools = $('map-tools');
  if (tools) tools.style.display = 'none';
}

function showMapUI() {
  // Intentionally disabled — map UI removed in v01.05
}

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    hideMapUI();
  }, 100);
});
