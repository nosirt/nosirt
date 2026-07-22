/* ============================================================
   CHAT.JS — v01.08 "carved in stone" icon → 3-tab chat panel
   Load this AFTER core.js.
   Tabs: Global Chat (real-time, site-wide, anonymous), Personal
   Chat (placeholder — under construction), Carved in Stone (the
   original private/local-only notepad, unchanged behavior).

   Data model: one Firestore doc per message in 'nosirt_chat_global'
   (same one-doc-per-item pattern as posts/comments elsewhere).
   Messages older than 24h are hidden from view immediately and
   swept out of Firestore (+ Storage, if they had an image) the
   next time anyone opens the chat panel — see cleanupOldChatMessages().
   ============================================================ */

const CHAT_MAX_LEN = 500;
const CHAT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CHAT_SEND_COOLDOWN_MS = 1200; // light spam guard, not real rate limiting
let chatLastSentAt = 0;
let chatCleanupDone = false;
let chatCurrentTab = 'global';

// v01.09: presence / "who's online"
const PRESENCE_HEARTBEAT_MS = 20 * 1000;
const ONLINE_THRESHOLD_MS = 45 * 1000; // no heartbeat in this window = offline
const PRESENCE_STALE_MS = 5 * 60 * 1000; // prune very old docs from Firestore
let presenceTimer = null;
let onlineListOpen = false;

// ═══ Live sync hooks (called from map-layout.js enterSite) ═══

function onChatSettingsUpdate(data){
  S.chatSettings = Object.assign({mediaMode:'off'}, JSON.parse(data.v||'{}'));
  renderChatMediaControls();
  if(S.adminUnlocked) renderChatAdminSettings();
}

function onChatMessagesUpdate(items){
  S.chatMessages = items.sort((a,b)=>a.ts-b.ts);
  renderChatMessages();
  updateChatUnreadBadge();
}

// v01.09: live presence snapshot — stored as-is, filtered by recency at render time
function onPresenceUpdate(items){
  S.onlinePresence = items;
  renderOnlineCount();
  if(onlineListOpen) renderOnlineList();
}

// Starts sending a heartbeat as soon as the site is entered (site-wide
// presence, not gated behind opening the chat panel). Called once from
// enterSite() in map-layout.js.
function startPresenceHeartbeat(){
  const beat = ()=>{
    fbSavePresence(S.userId, { id:S.userId, num:getChatNum(), displayName:getDisplayLabel(), ts:Date.now() });
    // Occasional lazy prune of very stale presence docs (any client can
    // do this safely — deletes are idempotent).
    (S.onlinePresence||[]).forEach(p=>{
      if(Date.now() - p.ts > PRESENCE_STALE_MS) fbDeletePresence(p.id);
    });
    renderOnlineCount(); // also re-render on a timer so people quietly expire
    if(onlineListOpen) renderOnlineList();
  };
  beat();
  presenceTimer = setInterval(beat, PRESENCE_HEARTBEAT_MS);
  // Best-effort: try to clear our own presence doc when the tab actually closes.
  // Not guaranteed to fire/complete, but harmless if it doesn't — the
  // 45s online threshold covers that case regardless.
  window.addEventListener('pagehide', ()=>{ fbDeletePresence(S.userId); });
}

function getOnlineUsers(){
  const cutoff = Date.now() - ONLINE_THRESHOLD_MS;
  const seen = {};
  (S.onlinePresence||[]).forEach(p=>{
    if(p.ts >= cutoff) seen[p.num] = p; // dedupe by display num just in case
  });
  return Object.values(seen).sort((a,b)=>a.ts-b.ts);
}

function renderOnlineCount(){
  const el = $('chat-online-count');
  if(!el) return;
  el.textContent = getOnlineUsers().length;
}

function toggleOnlineList(){
  onlineListOpen = !onlineListOpen;
  const panel = $('chat-online-list');
  if(!panel) return;
  panel.classList.toggle('open', onlineListOpen);
  if(onlineListOpen) renderOnlineList();
}

function renderOnlineList(){
  const el = $('chat-online-list');
  if(!el) return;
  const users = getOnlineUsers();
  const myNum = getChatNum();
  if(!users.length){
    el.innerHTML = `<div class="chat-empty">no one else is around right now.</div>`;
    return;
  }
  el.innerHTML = users.map(u=>{
    const label = u.displayName || ('user('+u.num+')');
    return `<div class="online-user-row">🟢 ${esc(label)}${u.num===myNum?' <span class="online-you">(you)</span>':''}</div>`;
  }).join('');
}

// ═══ Panel open/close/tabs ═══

function openChatPanel(){
  $('chat-panel').classList.add('open');
  switchChatTab('global');
}
function closeChatPanel(){
  $('chat-panel').classList.remove('open');
}

function switchChatTab(tab){
  chatCurrentTab = tab;
  ['global','personal','stone'].forEach(t=>{
    const body=$('chat-tab-'+t), btn=$('chat-tabbtn-'+t);
    if(body)body.style.display = (t===tab)?'flex':'none';
    if(btn)btn.classList.toggle('active', t===tab);
  });
  if(tab==='global'){
    cleanupOldChatMessages();
    S.chatLastSeenTs = Date.now();
    localStorage.setItem('n_chat_seen', String(S.chatLastSeenTs));
    updateChatUnreadBadge();
    renderChatMessages();
    scrollChatToBottom();
  }
  if(tab==='stone'){
    $('stone-textarea').value = localStorage.getItem('n_stone') || '';
  }
}

// ═══ Carved in Stone — now a tab inside the chat panel. Same private,
// local-only notepad as before (v01.07 and earlier), just autosaved
// instead of requiring an explicit "close the stone" button. ═══
let stoneSaveTimer=null;
function saveStoneDebounced(){
  clearTimeout(stoneSaveTimer);
  stoneSaveTimer = setTimeout(()=>{
    localStorage.setItem('n_stone', $('stone-textarea').value);
  }, 500);
}

// ═══ Rendering ═══

function renderChatMessages(){
  const el = $('chat-global-messages');
  if(!el) return;
  const cutoff = Date.now() - CHAT_TTL_MS;
  const visible = S.chatMessages.filter(m=>m.ts >= cutoff);
  const myNum = getChatNum();
  const nearBottom = (el.scrollHeight - el.scrollTop - el.clientHeight) < 80;

  if(!visible.length){
    el.innerHTML = `<div class="chat-empty">it's quiet in here. say something.</div>`;
    return;
  }

  el.innerHTML = visible.map(m=>{
    const mine = m.num === myNum;
    const delBtn = S.adminUnlocked
      ? `<button class="chat-del" onclick="deleteChatMessage('${m.id}')" title="delete">🗑</button>` : '';
    let media = '';
    if(m.gifUrl) media = `<img class="chat-media" src="${esc(m.gifUrl)}" loading="lazy" alt="gif">`;
    else if(m.imageUrl) media = `<img class="chat-media" src="${esc(m.imageUrl)}" loading="lazy" alt="image">`;
    const textPart = m.text ? `<span class="chat-text">${esc(m.text)}</span>` : '';
    const label = m.displayName || ('user('+m.num+')');
    return `<div class="chat-msg${mine?' mine':''}">
      <div class="chat-msg-head">
        <span class="chat-user">${esc(label)}</span>${delBtn}
      </div>
      ${textPart}
      ${media}
    </div>`;
  }).join('');

  if(nearBottom) scrollChatToBottom();
}

function scrollChatToBottom(){
  const el = $('chat-global-messages');
  if(el) el.scrollTop = el.scrollHeight;
}

function updateChatUnreadBadge(){
  const badge = $('chat-unread-badge');
  if(!badge) return;
  const cutoff = Date.now() - CHAT_TTL_MS;
  const unread = S.chatMessages.filter(m=>m.ts >= cutoff && m.ts > S.chatLastSeenTs && m.num !== getChatNum()).length;
  if(unread > 0 && !($('chat-panel').classList.contains('open') && chatCurrentTab==='global')){
    badge.textContent = unread > 9 ? '9+' : String(unread);
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

// ═══ Sending ═══

function handleChatInputKeydown(evt){
  if(evt.key==='Enter' && !evt.shiftKey){ evt.preventDefault(); sendChatMessage(); }
}

function sendChatMessage(){
  const input = $('chat-global-input');
  if(!input) return;
  const now = Date.now();
  if(now - chatLastSentAt < CHAT_SEND_COOLDOWN_MS){ toast('slow down a little'); return; }
  let text = input.value.trim();
  if(!text) return;
  if(text.length > CHAT_MAX_LEN) text = text.slice(0, CHAT_MAX_LEN);
  chatLastSentAt = now;
  const id = 'c'+now+Math.random().toString(36).slice(2,8);
  fbSaveChatMsg(id, { id, num:getChatNum(), displayName:getDisplayLabel(), text:filt(text), gifUrl:null, imageUrl:null, imagePath:null, ts:now });
  input.value = '';
}

async function sendChatImage(file){
  if(!file) return;
  toast('uploading image…');
  const res = await fbUploadChatImage(file);
  if(!res) return;
  const now = Date.now();
  const id = 'c'+now+Math.random().toString(36).slice(2,8);
  fbSaveChatMsg(id, { id, num:getChatNum(), displayName:getDisplayLabel(), text:'', gifUrl:null, imageUrl:res.url, imagePath:res.path, ts:now });
}

function sendChatGif(gifUrl){
  const now = Date.now();
  const id = 'c'+now+Math.random().toString(36).slice(2,8);
  fbSaveChatMsg(id, { id, num:getChatNum(), displayName:getDisplayLabel(), text:'', gifUrl, imageUrl:null, imagePath:null, ts:now });
  closeGifSearch();
}
function sendChatGifByIndex(i){
  const url = (window._gifSearchResults||[])[i];
  if(url) sendChatGif(url);
}

// ═══ Admin: delete a message ═══

function deleteChatMessage(id){
  if(!S.adminUnlocked) return;
  const msg = S.chatMessages.find(m=>m.id===id);
  if(msg && msg.imagePath) fbDeleteChatImage(msg.imagePath);
  fbDeleteChatMsg(id);
}

// ═══ Lazy 24h cleanup — runs once per panel-open, not on every snapshot ═══

async function cleanupOldChatMessages(){
  if(chatCleanupDone) return;
  chatCleanupDone = true;
  try{
    const items = await fbGetChatMsgsOnce();
    const cutoff = Date.now() - CHAT_TTL_MS;
    items.filter(m=>m.ts < cutoff).forEach(m=>{
      if(m.imagePath) fbDeleteChatImage(m.imagePath);
      fbDeleteChatMsg(m.id);
    });
  }catch(e){}
}

// ═══ Media controls (GIF search / image upload) — shown per admin setting ═══

function renderChatMediaControls(){
  const btn = $('chat-media-btn');
  if(!btn) return;
  const mode = S.chatSettings.mediaMode;
  btn.style.display = (mode==='off') ? 'none' : 'flex';
  btn.textContent = (mode==='upload') ? '🖼' : '🎬';
  btn.title = (mode==='upload') ? 'send an image' : 'search GIFs';
}

function handleChatMediaBtn(){
  const mode = S.chatSettings.mediaMode;
  if(mode==='upload'){ $('chat-image-input').click(); }
  else if(mode==='gif'){ openGifSearch(); }
}

function handleChatImageFileSelected(input){
  const file = input.files && input.files[0];
  input.value = '';
  if(file) sendChatImage(file);
}

// GIF search (GIPHY) — see core.js for GIPHY_API_KEY setup instructions
let gifSearchTimer=null;
function openGifSearch(){
  $('gif-search-panel').classList.add('open');
  $('gif-search-input').value='';
  $('gif-search-results').innerHTML = `<div class="chat-empty">type to search GIFs</div>`;
  $('gif-search-input').focus();
}
function closeGifSearch(){
  $('gif-search-panel').classList.remove('open');
}
function onGifSearchInput(val){
  clearTimeout(gifSearchTimer);
  gifSearchTimer = setTimeout(()=>searchGifs(val.trim()), 400);
}
async function searchGifs(query){
  const resultsEl = $('gif-search-results');
  if(!query){ resultsEl.innerHTML = `<div class="chat-empty">type to search GIFs</div>`; return; }
  if(GIPHY_API_KEY === 'PASTE_YOUR_GIPHY_API_KEY_HERE'){
    resultsEl.innerHTML = `<div class="chat-empty">GIF search needs a GIPHY API key pasted into core.js first.</div>`;
    return;
  }
  resultsEl.innerHTML = `<div class="chat-empty">searching…</div>`;
  try{
    const url = `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=16&rating=pg-13`;
    const res = await fetch(url);
    const data = await res.json();
    const gifs = data.data || [];
    if(!gifs.length){ resultsEl.innerHTML = `<div class="chat-empty">no results</div>`; return; }
    window._gifSearchResults = gifs.map(g=>g.images.original.url);
    resultsEl.innerHTML = gifs.map((g,i)=>{
      const preview = g.images.fixed_width_small ? g.images.fixed_width_small.url : g.images.original.url;
      return `<img class="gif-result" src="${esc(preview)}" loading="lazy" onclick="sendChatGifByIndex(${i})">`;
    }).join('');
  }catch(e){
    resultsEl.innerHTML = `<div class="chat-empty">GIF search failed — try again</div>`;
  }
}

// ═══ Admin: global chat settings (media mode) ═══

function renderChatAdminSettings(){
  const el = $('chat-admin-settings');
  if(!el) return;
  const mode = S.chatSettings.mediaMode;
  el.innerHTML = `
    <div style="font-size:.7rem;color:var(--fog);opacity:.6;margin-bottom:6px;font-family:'Cinzel Decorative',serif">global chat media</div>
    <label style="display:flex;align-items:center;gap:6px;font-size:.72rem;color:var(--cream);font-family:'IM Fell English',serif;font-style:italic;cursor:pointer;margin-bottom:4px">
      <input type="radio" name="chat-media-mode" ${mode==='off'?'checked':''} onchange="setChatMediaMode('off')"> off (safest)
    </label>
    <label style="display:flex;align-items:center;gap:6px;font-size:.72rem;color:var(--cream);font-family:'IM Fell English',serif;font-style:italic;cursor:pointer;margin-bottom:4px">
      <input type="radio" name="chat-media-mode" ${mode==='gif'?'checked':''} onchange="setChatMediaMode('gif')"> GIF search (GIPHY)
    </label>
    <label style="display:flex;align-items:center;gap:6px;font-size:.72rem;color:var(--cream);font-family:'IM Fell English',serif;font-style:italic;cursor:pointer">
      <input type="radio" name="chat-media-mode" ${mode==='upload'?'checked':''} onchange="setChatMediaMode('upload')"> image upload <span style="opacity:.55">(unmoderated)</span>
    </label>`;
}

function setChatMediaMode(mode){
  if(!S.adminUnlocked) return;
  S.chatSettings.mediaMode = mode;
  fbSave('chat_settings', {v: JSON.stringify(S.chatSettings)});
  renderChatMediaControls();
  renderChatAdminSettings();
  toast('chat media mode: '+mode);
}
