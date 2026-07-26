/* ============================================================
   PIXIE.JS — v01.17
   Load this AFTER core.js.

   Pixie is a small companion who wanders the screen on her own,
   occasionally flying off and coming back, can be dragged like the
   profile icon, and opens a chat panel when tapped (not dragged).

   RIGHT NOW: responses are hardcoded — pulled from pixie-lines.json
   (a separate data file, not code, specifically so the line count can
   keep growing toward ~1000 in batches without ever touching this file
   again), picked via a light mood system + keyword/intent matching.
   getPixieResponse() is the ONLY function that needs to change later to
   wire her up to a real AI. (When that happens: this is a static site
   with no server, so an API key can't live in this file the way
   YOUTUBE_API_KEY etc. do — a real AI call needs a Netlify Function
   (like netlify/functions/check-password.js) to proxy the request
   server-side, keeping the real key off the client entirely.)

   v01.17: she can now ask for (or notice, unprompted) your name, which
   becomes your real display identity site-wide (chat/posts/comments)
   going forward — see claimDisplayName()/getDisplayLabel() in core.js.
   This is her one bit of real memory: S.pixieAwaiting tracks that she's
   waiting on a specific reply, cleared right after it's used.

   Lore (for future reference, not yet surfaced in-app beyond hints):
   Pixie is bound to this place by a curse from a wizard, and is
   reluctantly obligated to help anyone who shows up — hence the
   attitude. She's not actually mean, just extremely put-upon about the
   whole thing.
   ============================================================ */

function pickRandom(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

// ═══ v01.16: DIALOGUE DATA — loaded from pixie-lines.json ═══
// Batch 1 of many — external file specifically so it can keep growing
// (toward ~1000 lines) without ever touching this code again. See the
// "_meta" note at the top of that file for the structure.
let PIXIE_LINES=null;
let pixieLastUserMsg=null; // for spam/repeat detection
let pixieLinesLoading=null;
function loadPixieLines(){
  if(PIXIE_LINES)return Promise.resolve(PIXIE_LINES);
  if(pixieLinesLoading)return pixieLinesLoading;
  pixieLinesLoading=fetch('pixie-lines.json').then(r=>r.json()).then(data=>{
    PIXIE_LINES=data;
    return data;
  }).catch(e=>{
    console.warn('pixie lines failed to load, using fallback:',e.message);
    // Minimal safety net so she's never completely silent if the fetch fails
    PIXIE_LINES={
      greetings:{annoyed:["...Give me a second, I'm not all here yet."]},
      topics:{},
      special:{},
      fallback:{annoyed:["Ask me again in a moment — I'm still waking up."]}
    };
    return PIXIE_LINES;
  });
  return pixieLinesLoading;
}

// Mood weighting — baseline annoyed/sarcastic most of the time, with
// rarer bored/caughtOffGuard/sincereCrack moments so she doesn't read as
// one-note. See VERSION_HISTORY for the reasoning.
const PIXIE_MOOD_WEIGHTS=[
  {mood:'annoyed',w:40},{mood:'sarcastic',w:30},{mood:'bored',w:15},
  {mood:'caughtOffGuard',w:10},{mood:'sincereCrack',w:5}
];
function pickPixieMood(){
  const total=PIXIE_MOOD_WEIGHTS.reduce((s,m)=>s+m.w,0);
  let r=Math.random()*total;
  for(const m of PIXIE_MOOD_WEIGHTS){ if(r<m.w)return m.mood; r-=m.w; }
  return 'annoyed';
}
// Pulls one line from a mood-tagged category object, e.g.
// {annoyed:[...], sarcastic:[...]}. Falls back to 'annoyed' if the
// chosen mood has no lines here, then to whatever's available at all.
function pickLineFromCategory(catObj){
  if(!catObj)return null;
  const mood=pickPixieMood();
  let pool=catObj[mood];
  if(!pool||!pool.length)pool=catObj.annoyed;
  if(!pool||!pool.length)pool=Object.values(catObj).flat();
  if(!pool||!pool.length)return null;
  return pickRandom(pool);
}

// Special-intent detection — checked before topic keywords since these
// are more specific. Simple substring/regex matching, not real NLP —
// good enough for a hardcoded placeholder engine.
const PIXIE_SPECIAL_PATTERNS=[
  {key:'rude',re:/\b(fuck you|screw you|shut up|stupid|idiot|hate you|useless)\b/},
  {key:'nice',re:/\b(thank you|thanks|ty|you're the best|good job|appreciate you)\b/},
  {key:'askIfReal',re:/\b(are you real|are you ai|are you human|are you a bot)\b/},
  {key:'flirting',re:/\b(cute|pretty|beautiful|marry me|date me|kiss|i love you)\b/},
  {key:'curseLore',re:/\b(curse|wizard|why are you here|who cursed you|your story)\b/},
  {key:'goodbye',re:/\b(bye|goodbye|see ya|see you|later|gtg|got to go)\b/},
  {key:'futureAiRequest',re:/\b(send me a (video|short)|show me a video|can you actually|are you smart)\b/},
  {key:'sayHi',re:/^\s*(hi|hello|hey|sup|yo)[\s!.]*$/},
  {key:'howAreYou',re:/\b(how are you|how're you|how you doing|how are u)\b/},
  {key:'whatDoing',re:/\b(what are you doing|whatcha doing|what're you up to|what you up to)\b/},
  {key:'apology',re:/\b(sorry|my bad|apologies)\b/},
  {key:'whoAreYou',re:/\b(who are you|what's your name|whats your name)\b/},
  {key:'howOld',re:/\b(how old are you|what's your age)\b/},
  {key:'doYouLikeHumans',re:/\b(do you like humans|do you like people)\b/},
  {key:'tellJoke',re:/\b(tell me a joke|say something funny|make me laugh)\b/},
  {key:'doYouLikeMe',re:/\b(do you like me)\b/},
  {key:'idk',re:/^\s*(i don'?t know|idk|dunno)\s*$/},
  {key:'bored',re:/\bi'?m (so )?bored\b/},
  {key:'tired',re:/\bi'?m (so )?(tired|exhausted|sleepy)\b/},
  {key:'hungry',re:/\bi'?m (so )?hungry\b/},
  {key:'failed',re:/\bi (failed|messed up|screwed up)\b/},
  {key:'scared',re:/\bi'?m (scared|afraid|nervous|anxious)\b/},
  {key:'lonely',re:/\bi'?m (so )?lonely\b/},
  {key:'happyMood',re:/\bi'?m (so )?happy\b/},
  {key:'hateMyself',re:/\bi hate myself\b/},
  {key:'confused',re:/\bi'?m (so )?confused\b/},
  {key:'goodnight',re:/\b(good ?night|gn)\b/},
  {key:'goodmorning',re:/\b(good ?morning|gm)\b/}
];

// Placeholder response engine — this is the ONLY function that needs to
// change when real AI is wired up later (see file header comment).
// v01.19: lightweight "affection" tracking — just a message count, not
// real sentiment analysis. Buckets into low/medium/high, used only for
// the doYouLikeMe response and (lightly) to bias toward warmer flavor
// lines the more someone's talked to her.
function getPixieAffectionTier(){
  const n=Number(localStorage.getItem('n_pixie_msg_count')||'0');
  if(n>=20)return 'high';
  if(n>=5)return 'medium';
  return 'low';
}
function bumpPixieAffection(){
  const n=Number(localStorage.getItem('n_pixie_msg_count')||'0')+1;
  localStorage.setItem('n_pixie_msg_count',String(n));
}

// v01.20: SITE AWARENESS — real weather Q&A + playing/linking content
// directly, instead of only canned tips about these features.
function getRealWeatherLine(){
  const e=S.environment;
  if(!e || !e.ready){
    return "I don't actually know where you are yet. Allow location (or don't — I'm not the boss of you) and I'll give you the real report instead of vibes.";
  }
  const wv=(typeof computeWeatherVisualState==='function')?computeWeatherVisualState():null;
  const temp=(e.tempC!=null)?Math.round(e.tempC):null;
  const wind=(e.windSpeed!=null)?Math.round(e.windSpeed):null;
  let desc='clear';
  if(wv){
    if(wv.kind==='rain')desc='raining';
    else if(wv.kind==='snow')desc='snowing';
    else if(wv.kind==='thunder')desc='thundering, dramatically';
    else if(wv.kind==='fog')desc='foggy';
    else if(wv.kind==='cloudy')desc='cloudy';
  }
  let line=`It's ${desc} where you are`+(temp!=null?`, about ${temp}°C`:'');
  if(wind!=null && wind>=15)line+=`, and windy — ${wind}km/h`;
  line+='. That\'s the real report, not a guess.';
  return line;
}

function pixiePlayMidnightArchive(){
  if(S.featureToggles && S.featureToggles.wireless===false)return null;
  const show=(typeof getMidnightArchiveShow==='function')?getMidnightArchiveShow():((typeof getDefaultShow==='function')?getDefaultShow():null);
  if(!show)return null;
  if(S.currentShowId!==show.id){ S.currentShowId=show.id; if(typeof refreshCurrentShowEpisodes==='function')refreshCurrentShowEpisodes(); }
  const ep=(typeof pickDefaultEpisode==='function')?pickDefaultEpisode():null;
  if(!ep)return null;
  if(typeof loadEpisode==='function')loadEpisode(ep);
  if(typeof activeMusic!=='undefined')activeMusic='podcast';
  if(typeof updateNP==='function')updateNP('🎙 '+ep.title);
  return ep;
}

// Looks up a category by key across the different places it might live
// (special/, emotions/, or a flat top-level array like goodnight).
function resolvePixieCategory(data,key){
  if(data.special && data.special[key]) return data.special[key];
  if(data.emotions && data.emotions[key]) return data.emotions[key];
  if(Array.isArray(data[key])) return data[key]; // flat pool — wrap so pickLineFromCategory still works
  return null;
}
function pickFromResolved(pool){
  if(!pool)return null;
  if(Array.isArray(pool))return pickRandom(pool);
  return pickLineFromCategory(pool);
}

// v01.20: message-shape detection (Pack #3) — reacts to HOW something
// was said when nothing else matched, instead of a flat "I don't
// understand." Order matters: most specific/cheap checks first.
function detectPixieMessageShape(raw){
  const t=(raw||'').trim();
  if(!t)return null;
  if(/^\.{2,}$/.test(t))return 'ellipsisOnly';
  if(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+$/u.test(t))return 'emojiOnly';
  const lower=t.toLowerCase();
  if(/^whatever[.!]?$/.test(lower))return 'whatever';
  if(/^what\??!?$/.test(lower))return 'whatQuestion';
  if(/^why\??!?$/.test(lower))return 'whyQuestion';
  if(t.length>280)return 'veryLong';
  const words=t.split(/\s+/);
  if(words.length===1 && t.length<=14 && /^[a-zA-Z']+$/.test(t))return 'oneWord';
  const lettersOnly=t.replace(/[^a-zA-Z]/g,'');
  if(lettersOnly.length>=6 && words.length===1){
    const vowels=(lettersOnly.match(/[aeiouAEIOU]/g)||[]).length;
    if(vowels/lettersOnly.length<0.2)return 'gibberish';
  }
  if(typeof BAD!=='undefined'){
    let badCount=0;
    BAD.forEach(w=>{ if(new RegExp('\\b'+w+'\\b','i').test(lower))badCount++; });
    if(badCount>=2)return 'swearingExcessive';
    if(badCount===1)return 'swearingPlayful';
  }
  return null;
}

function getPixieResponse(userText){
  const data=PIXIE_LINES;
  if(!data)return "...still waking up. Try that again in a second.";
  const t=(userText||'').toLowerCase();

  if(userText && userText.trim()===pixieLastUserMsg){
    const line=pickFromResolved(data.recovery&&data.recovery.spamRepeat);
    if(line){ pixieLastUserMsg=userText.trim(); return line; }
  }
  pixieLastUserMsg=(userText||'').trim();

  for(const p of PIXIE_SPECIAL_PATTERNS){
    if(p.re.test(t)){
      if(p.key==='doYouLikeMe'){
        const pool=data.special.doYouLikeMe&&data.special.doYouLikeMe[getPixieAffectionTier()];
        if(pool&&pool.length)return pickRandom(pool);
        continue;
      }
      const line=pickFromResolved(resolvePixieCategory(data,p.key));
      if(line)return line;
    }
  }
  for(const key in (data.topics||{})){
    const topic=data.topics[key];
    if(topic.keywords&&topic.keywords.some(k=>t.includes(k))){
      const line=pickLineFromCategory(topic.lines);
      if(line)return line;
    }
  }

  // Pack #3: react to the SHAPE of the message when intent is unclear —
  // gibberish, one word, "whatever", excessive swearing, etc — instead
  // of a flat "I don't understand."
  const shape=detectPixieMessageShape(userText);
  if(shape){
    const line=pickFromResolved(data.recovery&&data.recovery[shape]);
    if(line)return line;
  }

  // Occasional texture instead of always falling back to the generic
  // pool — seasonal awareness (real weather/time from environment.js),
  // running gags, a random observation, or (rarely, and more often
  // once she "knows" someone) a soft/secret-affection moment.
  const roll=Math.random();
  if(roll<0.08 && data.seasonal && typeof computeWeatherVisualState==='function'){
    const wv=computeWeatherVisualState();
    const dn=(typeof computeDayNightPhase==='function')?computeDayNightPhase():null;
    const season=(typeof computeSeason==='function')?computeSeason():null;
    let pool=null;
    if(wv.kind==='rain')pool=data.seasonal.rain;
    else if(wv.kind==='snow')pool=data.seasonal.snow;
    else if(wv.kind==='thunder')pool=data.seasonal.thunder;
    else if(wv.windy)pool=data.seasonal.windy;
    else if(dn && !dn.isDaytime)pool=data.seasonal.night;
    else if(season && data.seasonal[season])pool=data.seasonal[season];
    if(pool&&pool.length)return pickRandom(pool);
  }
  if(roll<0.10 && data.runningGags){
    const gagKeys=Object.keys(data.runningGags);
    const pool=data.runningGags[pickRandom(gagKeys)];
    if(pool&&pool.length)return pickRandom(pool);
  }
  if(roll<0.18 && data.flavor && data.flavor.randomObservations){
    return pickRandom(data.flavor.randomObservations);
  }
  const tier=getPixieAffectionTier();
  if(tier!=='low' && roll<0.24 && data.flavor && data.flavor.rareSoft){
    return pickRandom(data.flavor.rareSoft);
  }
  if(tier==='high' && roll<0.28 && data.flavor && data.flavor.secretAffection){
    return pickRandom(data.flavor.secretAffection);
  }
  // v01.20/21: the fragment combiner (Pack #4) is the main driver of
  // generic replies now — far more combinatorial variety than any
  // fixed pool, since it's built from independent fragment pieces.
  if(roll<0.75){
    const reaction=buildUniversalReaction(data);
    if(reaction)return reaction;
  }

  const finalPool=[].concat(
    data.fallback&&pickLineFromCategory(data.fallback)?[pickLineFromCategory(data.fallback)]:[],
    data.universalRecovery||[],
    (data.flavor&&data.flavor.oneLiners)||[]
  );
  return finalPool.length?pickRandom(finalPool):"Ask me something else.";
}

// ═══ CHAT PANEL ═══
function openPixiePanel(){
  const panel=$('pixie-panel');
  if(!panel)return;
  panel.classList.add('open');
  const log=$('pixie-messages');
  log.innerHTML='';
  // v01.21: resume the conversation instead of wiping it every time —
  // as long as this browser's localStorage hasn't been cleared.
  const history=loadPixieHistory();
  const hasHistory=history.length>0;
  if(hasHistory){
    history.forEach(h=>renderPixieHistoryLine(h.who,h.text));
    log.scrollTop=log.scrollHeight;
  }
  loadPixieLines().then(data=>{
    if(!hasHistory){
      // v01.19: if it's been a while since her panel was last opened,
      // that greeting takes priority over the normal random pool.
      const isReturning=checkReturnAfterDays();
      if(isReturning && data.returnAfterDays && data.returnAfterDays.length){
        addPixieMessage('pixie',pickRandom(data.returnAfterDays));
      }else{
        addPixieMessage('pixie',pickLineFromCategory(data.greetings)||"...Hi. What do you want?");
      }
    }else{
      checkReturnAfterDays(); // still updates the last-visit clock; the resumed history already gives continuity
    }
    // A beat later, either mention a renumbering that happened since
    // last time, or (if she still doesn't know a name) ask for one.
    setTimeout(()=>{
      if(localStorage.getItem('n_identity_renumber_pending')==='1'){
        localStorage.removeItem('n_identity_renumber_pending');
        const line=pickLineFromCategory(data.special&&data.special.renumberNotice);
        addPixieMessage('pixie',fillNameTokens(line||"Oh — someone else calling themselves {name} showed up. You're {name} {number} now."));
      }else if(maybeAskForName()){
        addPixieMessage('pixie',pickLineFromCategory(data.special&&data.special.askName)||"What should I even call you?");
      }
    },900);
    resetPixieIdleTimers();
  });
}
function closePixiePanel(){
  const p=$('pixie-panel');
  if(p)p.classList.remove('open');
  clearPixieIdleTimers();
}
// Tracks time since her panel was last opened, in this browser. Returns
// true (and resets the clock) if it's been 3+ days.
function checkReturnAfterDays(){
  const last=Number(localStorage.getItem('n_pixie_last_visit')||'0');
  const now=Date.now();
  localStorage.setItem('n_pixie_last_visit',String(now));
  return !!(last && (now-last) > 3*24*60*60*1000);
}
// v01.20: `action`, if given, is {label, fn} — renders a small button
// under her message that runs fn() when tapped (used for "take me
// there" style links into the site). textContent used for the message
// itself (can't inject markup); the button label is also plain text.
function addPixieMessage(who,text,action){
  const log=$('pixie-messages');
  if(!log)return;
  const div=document.createElement('div');
  div.className='pixie-msg '+(who==='user'?'user':'pixie');
  const textEl=document.createElement('div');
  textEl.textContent=text;
  div.appendChild(textEl);
  if(action && action.label && typeof action.fn==='function' && who!=='user'){
    const btn=document.createElement('button');
    btn.className='pixie-action-btn';
    btn.textContent=action.label;
    btn.onclick=()=>{ action.fn(); };
    div.appendChild(btn);
  }
  log.appendChild(div);
  log.scrollTop=log.scrollHeight;
  savePixieHistoryEntry(who,text);
}
function handlePixieInputKeydown(e){ if(e.key==='Enter')sendPixieMessage(); }

// v01.19: idle detection while her panel is open — "...you still
// there?" after 20s of silence, "did you fall asleep?" after 60s.
// Reset on every message sent; cleared entirely when the panel closes
// so nothing pops up after someone's already left.
let pixieIdleShortTimer=null;
let pixieIdleLongTimer=null;
function resetPixieIdleTimers(){
  clearTimeout(pixieIdleShortTimer);
  clearTimeout(pixieIdleLongTimer);
  const panel=$('pixie-panel');
  if(!panel||!panel.classList.contains('open'))return;
  pixieIdleShortTimer=setTimeout(()=>{
    loadPixieLines().then(data=>{ if(data.idleShort&&data.idleShort.length)addPixieMessage('pixie',pickRandom(data.idleShort)); });
  },20000);
  pixieIdleLongTimer=setTimeout(()=>{
    loadPixieLines().then(data=>{ if(data.idleLong&&data.idleLong.length)addPixieMessage('pixie',pickRandom(data.idleLong)); });
  },60000);
}
function clearPixieIdleTimers(){
  clearTimeout(pixieIdleShortTimer);
  clearTimeout(pixieIdleLongTimer);
}

// Tapping her name/icon in the panel header while already talking to
// her — a little "poke" gag, separate from opening/closing the panel.
function pokePixie(){
  loadPixieLines().then(data=>{
    const pool=data.flavor&&data.flavor.clickRepeat;
    if(pool&&pool.length)addPixieMessage('pixie',pickRandom(pool));
  });
}

// v01.17: NAME CAPTURE
// Substitutes {name}/{number} tokens in dialogue lines that reference
// the dynamic identity.
function fillNameTokens(line){
  if(!line)return line;
  const name=S.identity&&S.identity.name?S.identity.name:'';
  const number=S.identity&&S.identity.number!=null?String(S.identity.number):'';
  return line.replace(/\{name\}/g,name).replace(/\{number\}/g,number);
}
// Decides whether Pixie should ask for a name right now: always the
// first time ever, then just occasionally after that if she still
// doesn't know it (so she's not nagging every single time you open her).
function maybeAskForName(){
  if(S.identity && S.identity.name)return false;
  const askedBefore=localStorage.getItem('n_pixie_asked_name')==='1';
  if(!askedBefore || Math.random()<0.15){
    localStorage.setItem('n_pixie_asked_name','1');
    S.pixieAwaiting='name';
    return true;
  }
  return false;
}
// Catches someone volunteering a name without being asked — "i'm Alex",
// "my name is Alex", "call me Alex", etc. Requires an explicit marker
// phrase on purpose (per the "be careful, not clever" note) — this is
// NOT used for the "she just asked, this is the reply" case below,
// which has its own, looser check.
function detectUnpromptedName(text){
  const m=/\b(i'?m|i am|my name is|call me|name'?s)\s+([a-zA-Z][a-zA-Z0-9 _-]{0,23})\b/i.exec(text);
  return m?m[2]:null;
}
// v01.21 FIX: previously, once she asked for a name, the ENTIRE next
// message got treated as the answer no matter what it was — so asking
// her "what's your name?" back got swallowed as an attempted name
// claim. Now a reply only counts as a name if it either uses an
// explicit marker phrase, OR is short and plain (no question mark, no
// sentence structure) — a bare "Dash" or "Sarah" passes; "what's your
// name" (a question) does not.
function looksLikeNameReply(text){
  const t=(text||'').trim();
  if(!t || t.includes('?'))return false;
  if(/^(i'?m|i am|my name is|call me|name'?s)\s+/i.test(t))return true;
  const words=t.split(/\s+/);
  return words.length<=2 && /^[a-zA-Z' -]+$/.test(t) && t.length<=24;
}

// ═══ v01.21: CHAT HISTORY (persisted in this browser) ═══
const PIXIE_HISTORY_KEY='n_pixie_chat_history';
const PIXIE_HISTORY_MAX=200;
function loadPixieHistory(){
  try{ return JSON.parse(localStorage.getItem(PIXIE_HISTORY_KEY)||'[]'); }catch(e){ return []; }
}
function savePixieHistoryEntry(who,text){
  try{
    const hist=loadPixieHistory();
    hist.push({who,text});
    while(hist.length>PIXIE_HISTORY_MAX)hist.shift();
    localStorage.setItem(PIXIE_HISTORY_KEY,JSON.stringify(hist));
  }catch(e){}
}
// Renders a past message without re-saving it (used only to replay
// history on open — saving here would just grow the log every visit).
function renderPixieHistoryLine(who,text){
  const log=$('pixie-messages');
  if(!log)return;
  const div=document.createElement('div');
  div.className='pixie-msg '+(who==='user'?'user':'pixie');
  const textEl=document.createElement('div');
  textEl.textContent=text;
  div.appendChild(textEl);
  log.appendChild(div);
}

// ═══ v01.21: CONVERSATION TREE ENGINE ═══
// Generic walker for the multi-turn trees in pixie-lines.json (trees).
// A tree has: trigger (regex string), open (lines shown immediately),
// branches (array of {match, reply, branches?}) matched against the
// NEXT user message, and an optional fallback if nothing matches.
// State lives in S.pixieAwaiting as {type:'tree', branches, fallback}
// while a tree is mid-conversation; cleared once a leaf is reached.
function findPixieTree(text){
  const data=PIXIE_LINES;
  if(!data || !data.trees)return null;
  const t=text.toLowerCase();
  for(const id in data.trees){
    const tree=data.trees[id];
    if(tree.trigger && new RegExp(tree.trigger,'i').test(t))return tree;
  }
  return null;
}
function pickFriendshipWhatAreWeLine(){
  const tier=getPixieAffectionTier();
  if(tier==='low')return "...Potentially.";
  if(tier==='medium')return "...I think we're getting there.";
  return "...Yeah. I think so. Don't make me say it twice.";
}
function resolvePixieTreeTokens(lines){
  return (lines||[]).map(l=> l==='__FRIENDSHIP_TIER__' ? pickFriendshipWhatAreWeLine() : l);
}
// Returns an array of lines to show, or null if nothing in the current
// tree state matched (caller falls through to the generic engine).
function advancePixieTree(text){
  const awaiting=S.pixieAwaiting;
  if(!awaiting || awaiting.type!=='tree')return null;
  const t=text.toLowerCase();
  const branches=awaiting.branches||[];
  for(const b of branches){
    if(b.match && new RegExp(b.match,'i').test(t)){
      const lines=resolvePixieTreeTokens(b.reply);
      if(b.branches && b.branches.length){
        S.pixieAwaiting={type:'tree', branches:b.branches, fallback:b.fallback||awaiting.fallback};
      }else{
        S.pixieAwaiting=null;
      }
      return lines;
    }
  }
  S.pixieAwaiting=null;
  return awaiting.fallback?resolvePixieTreeTokens(awaiting.fallback):null;
}

// ═══ v01.20/21: fragment combiner (Pack #4) — assembles a reply from
// 1-2 independent fragment pools instead of one fixed line, so the
// same "categories" produce a much larger number of effectively-
// unique replies without needing more raw lines. ═══
function buildUniversalReaction(data){
  const u=data.universal;
  if(!u)return null;
  const baseCats=['general','agreement','disagreement','mildSarcasm','surprise','thoughtful','mildConfusion'];
  const validBase=baseCats.filter(c=>u[c]&&u[c].length);
  if(!validBase.length)return null;
  const base=pickRandom(validBase);
  let line=pickRandom(u[base]);
  if(Math.random()<0.4){
    const tailCats=['curiosityPrompt','filler','endingThought','tinyCompliment','playfulTeasing','encouraging'];
    const validTail=tailCats.filter(c=>u[c]&&u[c].length && c!==base);
    if(validTail.length){
      line+=' '+pickRandom(u[pickRandom(validTail)]);
    }
  }
  return line;
}

async function sendPixieMessage(){
  const input=$('pixie-input');
  if(!input)return;
  const text=input.value.trim();
  if(!text)return;
  addPixieMessage('user',text);
  input.value='';
  bumpPixieAffection();
  resetPixieIdleTimers();
  const data=await loadPixieLines();

  // ── Name capture ──
  const wasAwaitingName=S.pixieAwaiting==='name';
  const unprompted=detectUnpromptedName(text);
  const nameReplyLooksValid = wasAwaitingName ? looksLikeNameReply(text) : true;
  if((wasAwaitingName && nameReplyLooksValid) || unprompted){
    S.pixieAwaiting=null;
    const raw=(wasAwaitingName&&nameReplyLooksValid)?text:unprompted;
    setTimeout(async ()=>{
      const res=await claimDisplayName(raw);
      if(res.locked){
        addPixieMessage('pixie',pickLineFromCategory(data.special&&data.special.nameLocked)||"You already used your one change. Clear your browser data if you really want a new name.");
        return;
      }
      if(!res.ok){
        addPixieMessage('pixie',"That's not really a name I can work with. Try again?");
        return;
      }
      const cat=res.wasFirst?'nameGivenFresh':'nameGivenNumbered';
      const line=pickLineFromCategory(data.special&&data.special[cat]);
      addPixieMessage('pixie',fillNameTokens(line||(res.wasFirst?`Fine. ${res.name} it is.`:`Someone beat you to that one. You're ${res.name} ${res.number} now.`)));
    },350+Math.random()*400);
    return;
  }
  if(wasAwaitingName && !nameReplyLooksValid){
    // v01.21: didn't look like a real name reply — drop it and respond
    // to what they actually said instead of forcing a bad claim.
    S.pixieAwaiting=null;
  }

  // ── Continue an in-progress conversation tree, if any ──
  if(S.pixieAwaiting && S.pixieAwaiting.type==='tree'){
    const lines=advancePixieTree(text);
    if(lines && lines.length){
      setTimeout(()=>{ lines.forEach(l=>addPixieMessage('pixie',l)); },350+Math.random()*400);
      return;
    }
  }

  // v01.20: direct actions — playing/linking site content, and real
  // weather Q&A (with actual numbers), checked before the generic
  // dialogue engine since these should DO something, not just talk.
  const t=text.toLowerCase();
  const wantsLofi=/\bplay\s+(some\s+)?(lofi|lo-fi|ambient|music|something (soothing|chill|calm))\b/.test(t);
  const wantsPodcast=/\bplay\s+(the\s+)?(podcast|midnight archive|newest episode|latest episode|an episode)\b/.test(t);
  const asksNewEpisode=!wantsPodcast && /\b(new episode|newest episode|latest episode|is there a new)\b/.test(t);
  // v01.21 FIX: broadened significantly — "how's the weather", "what's
  // it like outside", "temp", etc previously fell through to the old
  // canned (non-real-data) topic reply because this regex was too narrow.
  const wantsWeather=/\b(what'?s|how'?s|hows) (the )?weather\b|weather (like|report|today|right now)|what'?s it like (outside|out there)|\bhow (windy|hot|cold|warm)\b|\btemp(erature)?\b.*\?|is it (raining|snowing|storming)\b/.test(t);
  const isGreetingish=/\b(hi|hello|hey|sup|yo)\b/.test(t)||/what'?s up|whats up/.test(t);

  if(wantsLofi){
    setTimeout(()=>{
      if(typeof toggleMusic==='function')toggleMusic('lofi');
      addPixieMessage('pixie',pickRandom(["Fine. Lofi it is. Don't get used to me doing what you ask.","There. Playing. Happy now?","Done. That was almost enjoyable to do."]));
    },350);
    return;
  }
  if(wantsPodcast){
    setTimeout(()=>{
      const ep=pixiePlayMidnightArchive();
      if(ep){
        addPixieMessage('pixie',`Fine, playing "${ep.title}" from Midnight Archive. Don't make this weird.`,
          {label:'🎙 take me there',fn:()=>{ closePixiePanel(); if(typeof gotoWirelessPageDirect==='function')gotoWirelessPageDirect(); }});
      }else{
        addPixieMessage('pixie',"There's nothing to play yet. Someone hasn't uploaded anything, and it isn't me.");
      }
    },350);
    return;
  }
  if(asksNewEpisode){
    setTimeout(()=>{
      addPixieMessage('pixie',"There might be. Go look, I'm not your notification system.",
        {label:'🎙 check the wireless',fn:()=>{ closePixiePanel(); if(typeof gotoWirelessPageDirect==='function')gotoWirelessPageDirect(); }});
    },350);
    return;
  }
  if(wantsWeather && isGreetingish){
    // v01.20: combined response — the specific example given was
    // "hi, what's up, nice weather" landing as one reply, not three.
    setTimeout(()=>{
      const greetLine=pickLineFromCategory(data.special&&data.special.sayHi)||pickLineFromCategory(data.greetings)||"Hi.";
      addPixieMessage('pixie',greetLine+' '+getRealWeatherLine());
    },350+Math.random()*400);
    return;
  }
  if(wantsWeather){
    setTimeout(()=>{ addPixieMessage('pixie',getRealWeatherLine()); },350);
    return;
  }

  // ── Start a new conversation tree, if this message triggers one ──
  const tree=findPixieTree(text);
  if(tree){
    setTimeout(()=>{
      (tree.open||[]).forEach(l=>addPixieMessage('pixie',l));
      if(tree.branches && tree.branches.length){
        S.pixieAwaiting={type:'tree', branches:tree.branches, fallback:tree.fallback};
      }
    },350+Math.random()*400);
    return;
  }

  // ── AI response via Gemini (server-side Netlify function) ──
  // Falls back silently to the local hardcoded engine if the call fails,
  // so Pixie is never completely silent even if the function is down.
  sendPixieAiMessage(text);
}

// ═══ LIVE SITE CONTEXT — assembled fresh on every message ═══
// Gathers everything knowable about the current state of the site and
// packages it into a plain object that gets sent to the Netlify function
// and injected into Pixie's system prompt. She can then reference real
// state rather than guessing — what's playing, the weather, who's online,
// what the latest episode is, what world the visitor is in, etc.
function buildPixieSiteContext() {
  const ctx = {};

  // ── Current view / world ──
  ctx.currentView = S.view || 'map';

  // ── Music ──
  ctx.musicPlaying = activeMusic || null; // 'lofi' | 'ancient' | 'dark' | 'podcast' | null
  // Try to get the actual track name if it's ambient
  if (activeMusic && typeof MUSIC !== 'undefined' && MUSIC[activeMusic]) {
    ctx.musicTrackName = MUSIC[activeMusic].name || activeMusic;
  }

  // ── Podcast / episode ──
  if (typeof currentEpisode !== 'undefined' && currentEpisode) {
    ctx.currentEpisode = {
      title: currentEpisode.title || null,
      isLive: !!currentEpisode.isLive
    };
  }
  // Latest episode across all shows (most recently added)
  const allEps = (S.episodes || []).slice();
  if (allEps.length) {
    const latest = allEps.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))[0];
    ctx.latestEpisode = {
      title: latest.title || null,
      showId: latest.showId || null,
      addedAt: latest.addedAt ? timeAgo(latest.addedAt) : null
    };
  }
  // Show list (public shows, titles only — no IDs needed by Pixie)
  const publicShows = (S.shows || []).filter(s => {
    const t = (s.title || '').trim().toLowerCase();
    return t !== 'pixie'; // hide the pixie shorts show
  });
  if (publicShows.length) {
    ctx.shows = publicShows.map(s => ({
      title: s.title,
      isDefault: !!s.isDefault,
      episodeCount: (S.episodes || []).filter(e => e.showId === s.id).length
    }));
  }

  // ── Weather / environment ──
  if (S.environment && S.environment.ready) {
    const wv = typeof computeWeatherVisualState === 'function'
      ? computeWeatherVisualState() : null;
    const dn = typeof computeDayNightPhase === 'function'
      ? computeDayNightPhase() : null;
    const season = typeof computeSeason === 'function'
      ? computeSeason() : null;
    ctx.weather = {
      condition: wv ? wv.kind : null,   // 'clear'|'rain'|'snow'|'thunder'|'fog'|'cloudy'
      windy: wv ? wv.windy : false,
      tempC: S.environment.tempC != null ? Math.round(S.environment.tempC) : null,
      isDaytime: dn ? dn.isDaytime : null,
      timeOfDay: dn
        ? (dn.twilight > 0.5 ? (dn.isDaytime ? 'dawn/dusk' : 'night') : (dn.isDaytime ? 'day' : 'night'))
        : null,
      season
    };
  }

  // ── Who's online ──
  const onlineCount = (S.onlinePresence || []).length;
  ctx.visitorsOnline = onlineCount; // includes the current visitor

  // ── Visitor identity ──
  if (S.identity && S.identity.name) {
    ctx.visitorName = S.identity.name;
    if (S.identity.number != null) ctx.visitorNumber = S.identity.number;
  }

  // ── Feature toggles (what sections are live) ──
  ctx.activeFeatures = Object.entries(S.featureToggles || {})
    .filter(([, v]) => v)
    .map(([k]) => k);

  // ── Community board / screams (counts, not content) ──
  ctx.screamCount = (S.screams || []).length;

  // ── Library ──
  const lib = S.library || [];
  ctx.libraryCount = lib.length;
  if (lib.length) {
    ctx.libraryTitles = lib.map(b => b.title).slice(0, 5); // first 5
  }

  return ctx;
}

// Sends the message to the Gemini-backed Netlify function and renders
// the reply. Keeps the last N turns in memory (session only — not
// persisted beyond the existing localStorage chat history) so Pixie
// has short-term conversational context.
const PIXIE_AI_HISTORY_MAX = 20; // turns kept in session memory
let pixieAiHistory = []; // [{role:'user'|'model', text:string}]

// Parses and executes an [ACTION:xxx] tag from the end of Gemini's reply.
// Returns the clean reply text (tag stripped) and optionally an action
// object for addPixieMessage to render as a button.
function parsePixieAiAction(rawReply) {
  const actionMatch = rawReply.match(/\[ACTION:([\w_]+)\]\s*$/);
  if (!actionMatch) return { text: rawReply, action: null };

  const cleanText = rawReply.replace(/\[ACTION:[\w_]+\]\s*$/, '').trim();
  const tag = actionMatch[1];

  let action = null;
  switch (tag) {
    case 'play_lofi':
      action = {
        label: '🎵 play lofi',
        fn: () => { if (typeof toggleMusic === 'function') toggleMusic('lofi'); }
      };
      break;
    case 'stop_music':
      action = {
        label: '⏹ stop music',
        fn: () => {
          if (typeof toggleMusic === 'function' && typeof activeMusic !== 'undefined' && activeMusic) {
            toggleMusic(activeMusic); // toggling active track stops it
          }
        }
      };
      break;
    case 'open_wireless':
      action = {
        label: '🎙 take me there',
        fn: () => { closePixiePanel(); if (typeof gotoWirelessPageDirect === 'function') gotoWirelessPageDirect(); }
      };
      break;
    case 'play_podcast':
      action = {
        label: '🎙 play episode',
        fn: () => { pixiePlayMidnightArchive(); }
      };
      break;
  }

  return { text: cleanText, action };
}

async function sendPixieAiMessage(userText) {
  // Add this message to session history for context
  pixieAiHistory.push({ role: 'user', text: userText });
  if (pixieAiHistory.length > PIXIE_AI_HISTORY_MAX) {
    pixieAiHistory = pixieAiHistory.slice(-PIXIE_AI_HISTORY_MAX);
  }

  const thinkDelay = 400 + Math.random() * 500;

  try {
    const res = await fetch('/.netlify/functions/pixie-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userText,
        history: pixieAiHistory.slice(0, -1),
        isAdmin: !!(typeof S !== 'undefined' && S.adminUnlocked),
        siteContext: buildPixieSiteContext() // live site state
      })
    });

    const data = await res.json();

    if (data.reply) {
      // Strip action tag before storing in history
      const { text, action } = parsePixieAiAction(data.reply);

      pixieAiHistory.push({ role: 'model', text });
      if (pixieAiHistory.length > PIXIE_AI_HISTORY_MAX) {
        pixieAiHistory = pixieAiHistory.slice(-PIXIE_AI_HISTORY_MAX);
      }

      setTimeout(() => addPixieMessage('pixie', text, action || undefined), thinkDelay);
    } else {
      setTimeout(() => addPixieMessage('pixie', getPixieResponse(userText)), thinkDelay);
    }

  } catch (err) {
    console.warn('Pixie AI call failed, using local fallback:', err.message);
    setTimeout(() => addPixieMessage('pixie', getPixieResponse(userText)), thinkDelay);
  }
}


// ═══ v01.18: ADMIN — shorts source status/shortcut ═══
function renderPixieAdminSettings(){
  const el=document.getElementById('pixie-admin-settings');
  if(!el)return;
  const show=(typeof getPixieShow==='function')?getPixieShow():null;
  const eps=(typeof getPixieShowEpisodes==='function')?getPixieShowEpisodes():[];
  el.innerHTML=`
    <div style="font-size:.7rem;color:var(--fog);opacity:.6;margin-bottom:10px;font-family:'Cinzel Decorative',serif">shorts source</div>
    ${show
      ? `<div style="font-family:'Crimson Text',serif;font-size:.85rem;color:var(--cream);margin-bottom:8px">✓ "pixie" show exists — ${eps.length} video${eps.length===1?'':'s'} in it. Hidden from the public grid automatically.</div>
         <button class="sq-submit" style="width:100%;font-size:.72rem" onclick="goEditPixieShow('${show.id}')">manage her shorts (add/remove videos)</button>`
      : `<div class="admin-placeholder" style="padding:4px 0 12px">No "pixie" show yet. It's fed the exact same way as any other show — paste a playlist link, just under a show named exactly "pixie". It'll be hidden from the public grid automatically once created.</div>
         <button class="sq-submit" style="width:100%;font-size:.72rem" onclick="goCreatePixieShow()">create it now</button>`
    }
    <div class="admin-placeholder" style="padding:14px 0 0">More Pixie settings (curated vs. live search, dialogue tuning) will land here in later batches.</div>
  `;
}
function goEditPixieShow(showId){
  if(typeof closeAdminSettingsPanel==='function')closeAdminSettingsPanel();
  if(typeof closeProfilePanel==='function')closeProfilePanel();
  navTo('wireless');
  setTimeout(()=>{ if(typeof openShow==='function')openShow(showId); },200);
}
function goCreatePixieShow(){
  if(typeof closeAdminSettingsPanel==='function')closeAdminSettingsPanel();
  if(typeof closeProfilePanel==='function')closeProfilePanel();
  navTo('wireless');
  setTimeout(()=>{
    if(typeof openShowForm==='function')openShowForm(null);
    setTimeout(()=>{ const inp=document.getElementById('wp-show-title-input'); if(inp)inp.value='pixie'; },100);
  },200);
}
// ═══ WANDERING / DRAGGABLE ICON ═══
let pixieDragging=false;
let pixieMoved=false;
let pixieWanderTimer=null;
let pixieAway=false;

function initPixie(){
  const icon=$('pixie-icon');
  if(!icon)return;
  loadPixieLines(); // prefetch, don't block on it

  icon.style.left=(window.innerWidth*0.6)+'px';
  icon.style.top=(window.innerHeight*0.22)+'px';

  icon.addEventListener('click',()=>{ if(!pixieMoved)openPixiePanel(); });

  let startX=0,startY=0;
  icon.addEventListener('pointerdown',(e)=>{
    pixieDragging=true;pixieMoved=false;
    clearTimeout(pixieWanderTimer);
    const rect=icon.getBoundingClientRect();
    startX=e.clientX-rect.left;startY=e.clientY-rect.top;
    icon.style.transition='none';
    icon.setPointerCapture && icon.setPointerCapture(e.pointerId);
  });
  document.addEventListener('pointermove',(e)=>{
    if(!pixieDragging)return;
    pixieMoved=true;
    const x=Math.max(4,Math.min(e.clientX-startX,window.innerWidth-46));
    const y=Math.max(4,Math.min(e.clientY-startY,window.innerHeight-46));
    icon.style.left=x+'px';icon.style.top=y+'px';
  });
  document.addEventListener('pointerup',()=>{
    if(!pixieDragging)return;
    pixieDragging=false;
    icon.style.transition='left 3s ease-in-out, top 3s ease-in-out, opacity 1.2s ease';
    setTimeout(()=>{ pixieMoved=false; },50);
    scheduleNextPixieWander(2000+Math.random()*3000);
  });

  scheduleNextPixieWander(1800);
}

function scheduleNextPixieWander(delay){
  clearTimeout(pixieWanderTimer);
  pixieWanderTimer=setTimeout(pixieWanderStep,delay);
}

// One step of Pixie's autonomous movement: usually just wanders to a
// new spot on screen; occasionally flies off-screen entirely and stays
// gone for a while before re-entering from a random edge.
function pixieWanderStep(){
  const icon=$('pixie-icon');
  if(!icon||pixieDragging)return;
  const W=window.innerWidth,H=window.innerHeight;

  if(pixieAway){
    // Re-enter from a random edge, fade in, then resume normal wandering
    const edge=Math.floor(Math.random()*4);
    let ex,ey;
    if(edge===0){ex=-50;ey=Math.random()*H*0.5+40;}
    else if(edge===1){ex=W+50;ey=Math.random()*H*0.5+40;}
    else if(edge===2){ex=Math.random()*W;ey=-50;}
    else{ex=Math.random()*W;ey=H*0.55;}
    icon.style.transition='none';
    icon.style.left=ex+'px';icon.style.top=ey+'px';
    icon.style.opacity='0';
    pixieAway=false;
    setTimeout(()=>{
      icon.style.transition='left 3s ease-in-out, top 3s ease-in-out, opacity 1.2s ease';
      icon.style.opacity='1';
      icon.style.left=(W*0.15+Math.random()*W*0.7)+'px';
      icon.style.top=(H*0.1+Math.random()*H*0.45)+'px';
      scheduleNextPixieWander(6000+Math.random()*9000);
    },300);
    return;
  }

  // Small chance each step to fly off and disappear for a while
  if(Math.random()<0.18){
    const edge=Math.floor(Math.random()*4);
    let ex,ey;
    if(edge===0){ex=-70;ey=Math.random()*H*0.5+40;}
    else if(edge===1){ex=W+70;ey=Math.random()*H*0.5+40;}
    else if(edge===2){ex=Math.random()*W;ey=-70;}
    else{ex=Math.random()*W;ey=H+70;}
    icon.style.left=ex+'px';icon.style.top=ey+'px';
    setTimeout(()=>{ icon.style.opacity='0'; },1600);
    pixieAway=true;
    scheduleNextPixieWander(20000+Math.random()*70000);
    return;
  }

  // Normal wander to a new spot within the screen
  icon.style.left=(W*0.1+Math.random()*W*0.75)+'px';
  icon.style.top=(H*0.08+Math.random()*H*0.5)+'px';
  scheduleNextPixieWander(5000+Math.random()*8000);
}
