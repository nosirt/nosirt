/* ============================================================
   CORE.JS — shared foundation for the whole site
   Load this FIRST (before every other JS file).
   Contains: Firebase setup, global config, shared state,
   and small helper functions every other file relies on.
   ============================================================ */

// ═══ VERSION HISTORY ═══
const VERSION_HISTORY = [
  {
    version: '01.20',
    date: new Date().toLocaleDateString(),
    changes: [
      'Pixie dialogue: 400 → 601 lines — conversation habits (interrupting herself, changing her mind mid-sentence), emotional check-ins (bored/tired/hungry/failed/scared/lonely/confused/etc), goodnight/good morning, and a large fallback-recovery set that reacts to HOW a message was said (gibberish, one word, all-caps swearing, spam/repeats, emoji-only, very long messages, "whatever"/"what?"/"why?") instead of a flat "I don\'t understand"',
      'NEW: she can now DO things instead of only talking about them — "play some lofi" actually starts it playing; "play the podcast"/"play midnight archive" actually loads and plays that episode in the background (with a button to jump to the wireless page if you want to watch); asking about a new episode gives a tappable link there',
      'NEW: real weather Q&A — asking "what\'s the weather" or "how windy is it" now pulls your actual current temperature/conditions from the location system already built, instead of a canned "yeah weather\'s real" line. If location isn\'t available yet, she says so and nudges you to allow it',
      'NEW: light response-combining — "hi, what\'s up, nice weather" now gets one combined reply (greeting + real weather) instead of only reacting to the first thing detected',
      'Her messages can now include a small clickable action button (e.g. "🎙 take me there") alongside her text, reusable for future site-linking beyond just Midnight Archive'
    ]
  },
  {
    version: '01.19',
    date: new Date().toLocaleDateString(),
    changes: [
      'Pixie dialogue: 144 → 400 lines, folding in a much richer character guide as her authoritative voice going forward — running gags (a suspicious goose, secretive squirrel meetings, a sighing Tower, an unexplained mushroom incident, an unexplained pond), favorite/hated things, and rare soft/existential moments',
      'NEW mechanics to actually use all this: idle detection ("...you still there?" after 20s of silence, "did you fall asleep?" after 60s while her panel is open), a "haven\'t seen you in days" greeting variant, seasonal/weather-aware asides that read the site\'s real current weather and time of day, and a lightweight affection tier (low/medium/high, based on how much you\'ve talked to her) that unlocks warmer responses over time',
      'Tapping her name in the panel header is now a small poke gag — a running joke on its own',
      'Added regex triggers for how-are-you / what-are-you-doing / who-are-you / how-old-are-you / do-you-like-humans / do-you-like-me / tell-me-a-joke / plain-hello, on top of the existing rude/nice/flirting/curious-about-the-curse detection'
    ]
  },
  {
    version: '01.18',
    date: new Date().toLocaleDateString(),
    changes: [
      'NEW: Pixie\'s shorts source — a show named exactly "pixie" (enforced unique, case-insensitive) is now reserved as her curated shorts feed. Fed the exact same way as any other show — paste a playlist link — no new import mechanism needed',
      'That specific show is automatically hidden from the public wireless grid, visible only when admin is unlocked, so it can still be managed through the normal show-edit UI without regular visitors ever seeing it in the browse list',
      'Admin panel\'s "pixie" tab now shows whether her shorts source exists yet, with a one-tap shortcut to create or manage it — no more digging through Wireless to find it'
    ]
  },
  {
    version: '01.17',
    date: new Date().toLocaleDateString(),
    changes: [
      'NEW: Pixie can now ask for (or notice, if you just volunteer it) your name — give her one and it becomes your real display identity site-wide (global chat, tower posts/comments, who\'s-online) going forward, replacing "user(#####)"',
      'Past messages/posts keep whatever label they were sent under — same "changes apply going forward only" rule as everywhere else on this site, nothing gets rewritten retroactively',
      'Duplicate names are handled the fun way: the first person to claim a name gets it plain, the second gets auto-numbered (e.g. "Alex 2") — and the first person gets bumped to "Alex 1" live, with Pixie proactively mentioning it next time you open her, rather than silently renaming you',
      'This needed Pixie to gain a small bit of real memory (S.pixieAwaiting) — she\'s otherwise fully stateless, but now tracks "waiting on a name reply" across one turn of conversation',
      'Backend: a new live-synced name registry (nosirt_names) using the same transaction pattern from the earlier data-race fixes, so two people claiming the same name at once can\'t corrupt each other\'s state'
    ]
  },
  {
    version: '01.16',
    date: new Date().toLocaleDateString(),
    changes: [
      'Admin panel reorganized into a proper tabbed settings panel (features / chat / world / pixie) instead of one long stacked column — the small profile sidebar now just has an "open admin settings" button once unlocked. A pixie tab is already in place for the settings coming in later batches',
      'Pixie\'s dialogue moved out of the code entirely into pixie-lines.json — a separate data file specifically so the line count can keep growing (toward ~1000, in batches) without ever touching pixie.js again',
      'Added a mood system underneath her responses — annoyed/sarcastic/bored/caught-off-guard/rare-sincere-crack — instead of one flat tone, plus special-intent detection (rude/nice/flirting/asking if she\'s real/asking about the curse/goodbye) on top of the existing topic tips',
      'First batch of dialogue: ~125 lines across greetings, 10 topic categories, 7 special-intent categories, and fallbacks. More batches to follow — this is intentionally not the full set yet'
    ]
  },
  {
    version: '01.15',
    date: new Date().toLocaleDateString(),
    changes: [
      'FIX: the environment-sound (rain/wind/thunder) button was accidentally living inside the map zoom controls, which have been intentionally hidden since v01.05/06 — it\'s now its own standalone button, always visible',
      'Environment sound is no longer just on/off — tap the button for a volume slider (0-160%), raised well above the old fixed levels so it can sit in the background over music if you want it up',
      'NEW: Pixie — a small companion who wanders the screen on her own (and occasionally flies off and comes back), can be dragged like the profile icon, and opens a chat panel when tapped',
      'Pixie\'s responses are hardcoded for now (personality + tips about the site) — built so only one function (getPixieResponse) needs to change when she\'s wired up to a real AI later. Note for that future step: as a static site with no server, that\'ll need a Netlify Function to proxy the request, the same way the admin password check already does — an API key can\'t live safely in the client code the way the YouTube/GIPHY keys do'
    ]
  },
  {
    version: '01.14',
    date: new Date().toLocaleDateString(),
    changes: [
      'Admin panel: version history is now collapsed by default — version numbers shown in lime, tap one to expand just that version\'s changes, instead of dumping the whole log',
      '"Living map" project, part 1 — ocean life: a small pier now has a ship that sails out to sea and back once every 24 hours (driven by the clock, always mid-journey correctly whenever the map loads), plus whales and boats that cross the water occasionally, same rare-spawn pattern as the witches/dragons',
      '"Living map" project, part 2 — location + weather plumbing: the map now quietly gets an approximate location (asks permission via the browser first; falls back to IP-based location with no prompt if declined) and fetches live weather for it. Nothing visual yet — this is just the data now flowing in, ready for the next part',
      'Added an environment-sounds mute button next to the map zoom controls, ready for when rain/wind/thunder sound gets added',
      'Hemisphere-aware: if location is available, latitude decides Northern vs Southern for anything season-related later; falls back to Northern Hemisphere if location isn\'t available at all',
      '"Living map" project, part 3 — weather made visible: cloud cover, rain, snow, and wind now reflect real current weather at your location. Clouds thicken and darken for storms, thin out on clear days, and move faster when it\'s windy. Thunderstorms add occasional lightning flashes with a timed thunder rumble. Wind adds its own drifting streak effect independent of rain/snow',
      'Added synthesized ambient sound for rain/snow/wind/thunder (built from noise + filters, same technique as the Void\'s pop sound and Ancient ambience \u2014 no audio files) \u2014 respects the mute button added in part 2',
      '"Living map" project, part 4 — day/night: the sky now tints toward dawn/dusk orange and night blue based on real sunrise/sunset at your location (falls back to a generic 6am/8pm schedule if location isn\'t available), a sun or moon arcs across the map accordingly, and stars fade in at night',
      'NEW: admin panel has a "preview weather/time" tool — jump the map into any weather (clear/cloudy/rain/snow/thunder/fog), windy or not, and any time of day (dawn/day/dusk/night) to see what it looks like, without waiting for real conditions to match. This is local to your own browser only — it never changes what real visitors see. A "stop previewing" button returns to real weather/time. Festival/seasonal preview will land in this same panel once that part is built',
      '"Living map" project, part 5 — seasons + festivals: the map now tints toward spring green, summer tan, fall orange/grey, or winter white based on the real calendar and your hemisphere (flips automatically for Southern Hemisphere visitors using their real latitude; falls back to Northern if location isn\'t available). Fall adds drifting falling leaves',
      'Festival decorations now show up automatically by real date — Halloween all of October, winter holidays in December, New Year\'s, Valentine\'s Day, and Oktoberfest, each with their own scattered decorations and color wash. Fully config-driven (see FESTIVALS in environment.js) — easy to add, remove, or adjust the date ranges for any of these later',
      'The admin preview tool from part 4 now also covers season and festival — preview any of the four seasons or any festival (or "none") independent of the real date, same "this browser only, never affects real visitors" behavior as the weather/time preview'
    ]
  },
  {
    version: '01.13',
    date: new Date().toLocaleDateString(),
    changes: [
      'BACKEND: posts, recs, and screams each moved from one shared Firestore document per collection to one document per item — fixes a real data race where two people voting/commenting/posting around the same time could silently overwrite each other',
      'Voting and commenting on a post now use a proper read-modify-write transaction against that post\'s own document, so two people acting on the same post at once merge correctly instead of one erasing the other',
      'Existing posts/recs/screams migrate automatically on first load — nothing existing is lost. Old data is left in place afterward as an untouched backup, not deleted',
      'FIX: the town-square "screaming void" used to re-save its entire message list on every render, including renders triggered by its own incoming Firebase updates — a render→write→update→render loop. Rendering only reads now; expired screams are deleted individually instead of rewriting the whole list',
      'FIX: re-entering Wonderland repeatedly no longer stacks up duplicate card-suit icons (spawnCardSoldiers wasn\'t clearing its container first, unlike the fireflies)',
      'FIX: re-entering the Void (space/expressionist world) no longer leaves old animation loops, shooting-star timers, and click listeners running in the background — was causing rising CPU/battery use and a tap on a planet triggering the pop sound multiple times at once',
      'No visible or behavioral change to any of the above from the site — this batch is backend/reliability work only'
    ]
  },
  {
    version: '01.12',
    date: new Date().toLocaleDateString(),
    changes: [
      'FIX: "The Wireless" option in the ♪ sounds menu no longer forces navigation to the wireless page when selected — it now behaves exactly like Ancient/Lofi/Dark: tap to start/resume in place, tap again to stop, no matter what page you\'re on',
      'The "jump to the grid or whatever\'s currently playing" smart shortcut is now exclusively the bottom-nav wireless button\'s (and the map pin\'s) behavior, not the sounds-menu option\'s'
    ]
  },
  {
    version: '01.11',
    date: new Date().toLocaleDateString(),
    changes: [
      'The top-bar "podcast" badge is now a dedicated Midnight Archive shortcut — always that show, regardless of what\'s playing or which show is set as admin\'s "default"',
      'The music modal\'s "The Wireless" option is now the general-purpose shortcut instead: resumes whatever was last loaded, or opens the main wireless page if nothing was',
      'That same smart shortcut now also applies to the bottom-nav wireless button, the map\'s wireless pin, and any direct/bookmarked /wireless link: if you\'re already viewing a show\'s player it steps back to the grid; if something\'s playing elsewhere it deep-links straight to it; if nothing\'s playing it opens the grid',
      'FIX: admin panel was silently showing the literal text "v${CURRENT_VERSION}" instead of the actual version number — that placeholder was sitting in raw HTML and never being evaluated. Now set properly via JS each time the panel opens'
    ]
  },
  {
    version: '01.10',
    date: new Date().toLocaleDateString(),
    changes: [
      'YouTube Data API key added — playlist import in Wireless now works',
      'FIX: the URL now updates no matter how you arrive at a page — bottom-nav buttons, exiting a mood world, and the music-bar podcast shortcut all used to leave the old URL showing; they now go through the same router the map pins already used',
      'Lofi Hip Hop now starts automatically as soon as the site is entered, instead of leaving all music off until you pick something',
      'If a browser blocks that autoplay, it now retries automatically on your first tap/click/keypress anywhere on the page, rather than requiring you to specifically reopen the music menu'
    ]
  },
  {
    version: '01.09',
    date: new Date().toLocaleDateString(),
    changes: [
      'NEW: "who\'s online" in the chat panel — a live count of everyone currently on the site, tap it to see the list of user(#####) names',
      'Presence is site-wide (tracked as soon as you enter the site, not just while chat is open) and updates automatically as people arrive/leave',
      '"Online" means a heartbeat was seen in the last 45 seconds — there\'s no true instant-disconnect signal on a static/Firestore-only site, so someone closing a tab drops off within about a minute rather than immediately'
    ]
  },
  {
    version: '01.08',
    date: new Date().toLocaleDateString(),
    changes: [
      'NEW: the carved-in-stone icon is now a chat panel with 3 tabs — Global Chat, Personal Chat (under construction), and Carved in Stone (your old private notes, unchanged)',
      'Global Chat is a real-time, site-wide chat — everyone shows up as "user(#####): message", auto-updates for everyone as messages come in',
      'Messages older than 24 hours are hidden and cleaned up automatically the next time anyone opens the chat',
      'Admin panel: new "global chat" section — turn GIF search (GIPHY) or image upload on/off (off by default). Only one mode active at a time',
      'Admin can delete any individual chat message',
      'Chat text is HTML-escaped before display — necessary since this is fully public/anonymous, unlike other write-open parts of the site'
    ]
  },
  {
    version: '01.07',
    date: new Date().toLocaleDateString(),
    changes: [
      'NEW: admin panel now has a "features" toggle list — garden, square, tower, wireless, the keep, and the welcome banner can each be switched off',
      'Turning a world off removes its bottom-nav icon and marks its map pin with a 🚧 sign; tapping the pin shows a "temporary review" note instead of entering',
      'Turning off the welcome banner makes the map the site\'s landing view — the intro is skipped entirely on load',
      'Toggle state is synced live via Firebase (features doc), so it applies for every visitor immediately, including on first page load'
    ]
  },
  {
    version: '01.06',
    date: new Date().toLocaleDateString(),
    changes: [
      'SECURITY: passwords no longer readable from the browser at all — moved off Firestore (which had to allow public reads for the old check to work) to a Netlify Function backed by env vars',
      'validatePassword() now calls /.netlify/functions/check-password, which returns only true/false, never the real password',
      'Added netlify/functions/check-password.js — see README-PASSWORDS.md for the Netlify setup steps',
      'Old Firestore "passwords" collection is no longer used by the app — safe to lock down or delete once the new function is live'
    ]
  },
  {
    version: '01.05',
    date: new Date().toLocaleDateString(),
    changes: [
      'Profile icon draggable — houses admin login, bio (editable), version history',
      'Firebase password validation — all passwords now server-side',
      'Podcast player refactored — wave (collapsed) vs video modes',
      'Episode auto-play on click (no manual play button needed)',
      'Styled progress bar with seek indicator (click to jump)',
      'Prev/next episode buttons for easy navigation',
      'Skip forward (+10s) and backward (-10s) controls',
      'Full-screen, theater mode buttons in video mode',
      'Responsive design for mobile and desktop',
      'Map UI removed — zoom/pan still works, no button hints',
      'Admin can edit bio in profile panel (saves to Firebase)',
      'Version history only visible when admin unlocked'
    ]
  },

  {
    version: '01.05',
    date: new Date().toLocaleDateString(),
    changes: [
      'About modal — click profile icon to see bio, instagram, and version history',
      'Version history expandable list in About modal (all versions with bullets)',
      'Draggable admin login panel — separate from About, can be positioned anywhere',
      'Admin panel persists position to localStorage across reloads',
      'Polished modal styling with animations and hover effects',
      'Responsive design for mobile and desktop',
      'All loose ends tied up — everything fully functional'
    ]
  },
  {
    version: '01.03',
    date: new Date().toLocaleDateString(),
    changes: [
      'Episode auto-advance fully implemented — plays next episode when current finishes',
      'Toast notification when auto-advancing to next episode',
      'Resume last-played episode on reload (localStorage) instead of always starting at newest',
      'Handle end-of-series gracefully — stops playback with message when no more episodes',
      'Save current episode ID automatically when loaded',
      'Prevent accidental re-triggering of auto-advance'
    ]
  },
  {
    version: '01.02',
    date: new Date().toLocaleDateString(),
    changes: [
      'Podcast background playback — click wireless from music bar plays in background (no page redirect) after first episode',
      'First time selecting podcast still opens wireless page to pick an episode',
      'Switching to ambient music auto-pauses podcast and remembers timestamp',
      'Podcast resumes from where it was paused when toggled back'
    ]
  },
  {
    version: '01.01',
    date: '6/29/2024',
    changes: [
      'Draggable admin login panel (username/password)',
      'Spotify-style podcast player with progress tracking',
      'Map UI (zoom, recenter) fade in/out on tap (3 sec auto-hide)',
      'Episode progress persistence (localStorage per episode)',
      'Auto-advance framework (incomplete)',
      'Recenter button fully centers map to viewport edges',
      'Removed hint text ("zoom or pinch", "distance from tower")'
    ]
  },
  {
    version: '01.00',
    date: '6/29/2024',
    changes: [
      'Initial Nosirt launch',
      'Map-based location system (Ancient Tower, Garden, Square)',
      'Keep library (docx/PDF upload, auto-chapter detection)',
      'Wireless podcast player with episode list',
      'Lofi/Dark Ambient/Ancient ambience music streaming',
      'Posts, recommendations, notes, screams social features'
    ]
  }
];
const CURRENT_VERSION = VERSION_HISTORY[0].version;

// ═══ FIREBASE ═══
const firebaseConfig = {
  apiKey: "AIzaSyBDOV1E15XA04WpTCSoFLoc4SxW4ec0bNw",
  authDomain: "nosirt-197ae.firebaseapp.com",
  projectId: "nosirt-197ae",
  storageBucket: "nosirt-197ae.firebasestorage.app",
  messagingSenderId: "454046464323",
  appId: "1:454046464323:web:a5ff6a23dfcf4f9c9517f6"
};

// db is set after Firebase loads — starts null, safe to call fbSave/fbListen before it's ready
let db = null;
// v01.08: Firebase Storage — only actually used if admin turns on "image
// upload" mode for global chat. Safe to init even if never used.
let storage = null;

function fbInit() {
  try {
    if (typeof firebase !== 'undefined' && !firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    db = firebase.firestore();
    if (typeof firebase.storage === 'function') storage = firebase.storage();
  } catch(e) {
    console.warn('Firebase init failed, using localStorage only:', e.message);
  }
}

function fbSave(docName, data) {
  if (!db) return;
  try { db.collection('nosirt').doc(docName).set(data); } catch(e) {}
}

function fbListen(docName, cb) {
  if (!db) return;
  try {
    db.collection('nosirt').doc(docName).onSnapshot(snap => {
      if (snap && snap.exists) cb(snap.data());
    });
  } catch(e) {}
}

// Stories/novels get their own document each (not crammed into one shared
// blob like posts/recs/episodes) because a full novel's text can be large —
// Firestore caps a single document at ~1MB, so one-doc-per-story scales much better.
function fbSaveStory(id, data) {
  if (!db) return;
  try { db.collection('nosirt_stories').doc(id).set(data); } catch(e) {}
}
function fbDeleteStory(id) {
  if (!db) return;
  try { db.collection('nosirt_stories').doc(id).delete(); } catch(e) {}
}
function fbListenStories(cb) {
  if (!db) return;
  try {
    db.collection('nosirt_stories').onSnapshot(snap => {
      const items=[];
      snap.forEach(doc=>items.push(doc.data()));
      cb(items);
    });
  } catch(e) {}
}

// ═══ WIRELESS SHOWS — one doc per show, one doc per episode/video, one
// doc per comment (same one-doc-per-item reasoning as stories above —
// scales fine and each collection just gets listened to as a whole and
// filtered client-side, matching the rest of this app's pattern). ═══
function fbSaveShow(id, data, merge) {
  if (!db) return;
  try { db.collection('nosirt_shows').doc(id).set(data, {merge: !!merge}); } catch(e) {}
}
function fbDeleteShow(id) {
  if (!db) return;
  try { db.collection('nosirt_shows').doc(id).delete(); } catch(e) {}
}
function fbListenShows(cb) {
  if (!db) return;
  try {
    db.collection('nosirt_shows').onSnapshot(snap => {
      const items=[];
      snap.forEach(doc=>items.push(doc.data()));
      cb(items);
    });
  } catch(e) {}
}
function fbSaveShowEpisode(id, data, merge) {
  if (!db) return;
  try { db.collection('nosirt_show_episodes').doc(id).set(data, {merge: !!merge}); } catch(e) {}
}
function fbDeleteShowEpisode(id) {
  if (!db) return;
  try { db.collection('nosirt_show_episodes').doc(id).delete(); } catch(e) {}
}
function fbListenShowEpisodes(cb) {
  if (!db) return;
  try {
    db.collection('nosirt_show_episodes').onSnapshot(snap => {
      const items=[];
      snap.forEach(doc=>items.push(doc.data()));
      cb(items);
    });
  } catch(e) {}
}
function fbSaveComment(id, data) {
  if (!db) return;
  try { db.collection('nosirt_comments').doc(id).set(data); } catch(e) {}
}
function fbDeleteComment(id) {
  if (!db) return;
  try { db.collection('nosirt_comments').doc(id).delete(); } catch(e) {}
}
function fbListenComments(cb) {
  if (!db) return;
  try {
    db.collection('nosirt_comments').onSnapshot(snap => {
      const items=[];
      snap.forEach(doc=>items.push(doc.data()));
      cb(items);
    });
  } catch(e) {}
}

// ═══ v01.08: GLOBAL CHAT — one doc per message (same pattern as posts/
// comments/etc above). "Delete on next visit" cleanup for messages older
// than 24h happens in chat.js (cleanupOldChatMessages), not here. ═══
function fbSaveChatMsg(id, data) {
  if (!db) return;
  try { db.collection('nosirt_chat_global').doc(id).set(data); } catch(e) {}
}
function fbDeleteChatMsg(id) {
  if (!db) return;
  try { db.collection('nosirt_chat_global').doc(id).delete(); } catch(e) {}
}
function fbListenChatMsgs(cb) {
  if (!db) return;
  try {
    db.collection('nosirt_chat_global').onSnapshot(snap => {
      const items=[];
      snap.forEach(doc=>items.push(doc.data()));
      cb(items);
    });
  } catch(e) {}
}
function fbGetChatMsgsOnce() {
  if (!db) return Promise.resolve([]);
  return db.collection('nosirt_chat_global').get().then(snap=>{
    const items=[]; snap.forEach(doc=>items.push(doc.data())); return items;
  }).catch(()=>[]);
}

// ═══ v01.09: PRESENCE — "who's online" ═══
// One doc per browser, keyed by userId, overwritten every heartbeat.
// There's no real "disconnect" event on Firestore (that's a Realtime
// Database feature), so "online" is inferred client-side as "heartbeat
// seen in the last ~45s" — see ONLINE_THRESHOLD_MS in chat.js.
function fbSavePresence(id, data) {
  if (!db) return;
  try { db.collection('nosirt_presence').doc(id).set(data); } catch(e) {}
}
function fbDeletePresence(id) {
  if (!db) return;
  try { db.collection('nosirt_presence').doc(id).delete(); } catch(e) {}
}
function fbListenPresence(cb) {
  if (!db) return;
  try {
    db.collection('nosirt_presence').onSnapshot(snap => {
      const items=[];
      snap.forEach(doc=>items.push(doc.data()));
      cb(items);
    });
  } catch(e) {}
}

// ═══ v01.13: GENERIC PER-ITEM COLLECTION HELPERS ═══
// Same one-doc-per-item pattern already used above for stories/shows/
// episodes/comments/chat/presence, generalized so posts/recs/screams
// (below) can use it too, instead of the old single-blob-per-collection
// storage. That old pattern (one Firestore doc holding an entire array
// as a JSON string) had a real bug: every write re-uploaded the WHOLE
// array, so two people acting around the same time (e.g. two votes on
// the same post) could silently overwrite each other. Existing bespoke
// helpers (fbSaveStory etc.) are left as-is — they already work and
// don't have the race issue this fixes — this is only used for the new
// posts/recs/screams code below.
function fbSaveItem(collection, id, data) {
  if (!db) return;
  try { db.collection(collection).doc(id).set(data); } catch(e) {}
}
function fbDeleteItem(collection, id) {
  if (!db) return;
  try { db.collection(collection).doc(id).delete(); } catch(e) {}
}
function fbListenCollection(collection, cb) {
  if (!db) return;
  try {
    db.collection(collection).onSnapshot(snap => {
      const items=[];
      snap.forEach(doc=>items.push(doc.data()));
      cb(items);
    });
  } catch(e) {}
}
// Proper read-modify-write transaction against a single item's doc.
// mutateFn receives the CURRENT server-side data for that item (not
// whatever stale copy the caller had locally) and returns the updated
// object to save. Used anywhere two people could plausibly act on the
// same item at the same instant (voting/commenting on the same post) —
// each transaction re-reads the latest state before applying its own
// change, so simultaneous actions merge instead of one clobbering the
// other.
async function fbTransactItem(collection, id, mutateFn) {
  if (!db) return null;
  try {
    return await db.runTransaction(async (tx) => {
      const ref = db.collection(collection).doc(id);
      const snap = await tx.get(ref);
      const current = snap.exists ? snap.data() : null;
      const updated = mutateFn(current);
      if (updated) tx.set(ref, updated);
      return updated;
    });
  } catch(e) { console.warn('transaction failed:', e.message); return null; }
}

// One-time migration: posts/recs/screams used to each live as a single
// doc holding the whole collection as a JSON string (see above). This
// moves any existing data into the new per-item collections the first
// time it runs, and does nothing on every run after that (each check is
// "does the new collection already have anything in it?"). Safe to call
// on every page load, from every visitor's browser — whoever gets there
// first does the migration, everyone else's check just finds it already
// done. The old blob docs are left in place afterward as an untouched
// backup, not deleted.
async function ensureLegacyDataMigrated(){
  if(!db)return;
  try{
    const postsSnap=await db.collection('nosirt_posts').limit(1).get();
    if(postsSnap.empty){
      const legacy=await db.collection('nosirt').doc('posts').get();
      const items=legacy.exists?(JSON.parse(legacy.data().v||'[]')||[]):[];
      if(items.length){
        const batch=db.batch();
        items.forEach(p=>{
          // posts already had real ids (e.g. "p1737000000000") from
          // creation — reuse them so this is naturally idempotent even
          // if two browsers race to run the migration at once.
          const id=p.id||('legacy-post-'+items.indexOf(p));
          batch.set(db.collection('nosirt_posts').doc(id),Object.assign({},p,{id}));
        });
        await batch.commit();
      }
    }
  }catch(e){console.warn('posts migration error:',e.message);}

  try{
    const recsSnap=await db.collection('nosirt_recs').limit(1).get();
    if(recsSnap.empty){
      const legacy=await db.collection('nosirt').doc('recs').get();
      const items=legacy.exists?(JSON.parse(legacy.data().v||'null')||[]):[];
      if(items.length){
        const batch=db.batch();
        // recs never had ids — use a deterministic index-based id so
        // concurrent migrations converge on the same docs instead of
        // duplicating. Original array was newest-first; fabricate a
        // descending ts so the new sort-by-ts rendering preserves that
        // same order.
        const baseTs=Date.now();
        items.forEach((r,i)=>{
          const id='legacy-rec-'+i;
          batch.set(db.collection('nosirt_recs').doc(id),Object.assign({},r,{id,ts:r.ts||(baseTs-i)}));
        });
        await batch.commit();
      }
    }
  }catch(e){console.warn('recs migration error:',e.message);}

  try{
    const screamsSnap=await db.collection('nosirt_screams').limit(1).get();
    if(screamsSnap.empty){
      const legacy=await db.collection('nosirt').doc('screams').get();
      const items=legacy.exists?(JSON.parse(legacy.data().v||'[]')||[]):[];
      if(items.length){
        const batch=db.batch();
        items.forEach((s,i)=>{
          const id='legacy-scream-'+i;
          batch.set(db.collection('nosirt_screams').doc(id),Object.assign({},s,{id}));
        });
        await batch.commit();
      }
    }
  }catch(e){console.warn('screams migration error:',e.message);}
}

// Uploads an image for "image upload" chat mode. Enforces type/size
// client-side (server-side Firestore/Storage rules should mirror this —
// see storage.rules). Returns {url, path} or null on failure.
const CHAT_IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5MB
async function fbUploadChatImage(file) {
  if (!storage || !file) return null;
  if (!/^image\//.test(file.type)) { toast('only image files are allowed'); return null; }
  if (file.size > CHAT_IMAGE_MAX_BYTES) { toast('image too big — 5MB max'); return null; }
  try {
    const path = `chat_images/${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const ref = storage.ref().child(path);
    await ref.put(file);
    const url = await ref.getDownloadURL();
    return { url, path };
  } catch(e) {
    console.warn('chat image upload failed:', e.message);
    toast('image upload failed');
    return null;
  }
}
function fbDeleteChatImage(path) {
  if (!storage || !path) return;
  try { storage.ref().child(path).delete().catch(()=>{}); } catch(e) {}
}

// Paste a free YouTube Data API v3 key here to enable "import playlist" on
// the wireless page. Get one at https://console.cloud.google.com →
// create/select a project → APIs & Services → Library → enable
// "YouTube Data API v3" → Credentials → Create API Key. Free quota
// (10,000 units/day) covers this site's usage many times over.
const YOUTUBE_API_KEY = 'AIzaSyBrv5ZR9ylYgxg2BIr8crg24lge0OWzwpI';

// v01.08: Paste a free GIPHY API key here to enable "GIF search" mode in
// global chat. Get one at https://developers.giphy.com — create a free
// developer account → Create an App → choose "API" → copy the key. New
// keys start as rate-limited "beta" (100 requests/hour), which is
// plenty for a small chat; upgrade later only if you outgrow it.
// (Note: Tenor's API — the other common GIF option — stopped accepting
// new signups in Jan 2026 and shut down entirely on June 30, 2026, so
// GIPHY is the only viable option here now.)
const GIPHY_API_KEY = 'PASTE_YOUR_GIPHY_API_KEY_HERE';


// ═══ CONFIG ═══
let activeMusic=null;
const MUSIC={
  ancient:{src:null,builtIn:true,name:'🏰 Ancient ambience · built in'},
  lofi:{src:'https://stream.zeno.fm/0r0xa792kwzuv',name:'📻 Lofi Hip Hop · live'},
  dark:{src:'https://stream.zeno.fm/f3wvbbqmdg8uv',name:'🌑 Dark Ambient · live'},
  podcast:{podcast:true,name:'🎙 The Wireless · podcast'},
};
let synthMusic=null;

const FORUMS=['movies','shows','anime','books','music','venting','shopping','random'];
const BAD=['fuck','shit','cunt','nigger','faggot','retard'];
// Passwords (admin/podcast/keep) are no longer hardcoded here, and as of
// v01.06 they're no longer readable from the browser at all — they live
// only as Netlify environment variables and are checked by a serverless
// function (netlify/functions/check-password.js) via validatePassword()
// below. See README-PASSWORDS.md.

// People can type any genre they like when uploading a story, but it always
// also gets mapped to one of these fixed canonical genres too, so search and
// the genre filter chips stay consistent even when wording varies.
const CANONICAL_GENRES=['Fantasy','Sci-Fi','Romance','Horror','Mystery','Drama','Comedy','Adventure','Historical Fiction','Poetry','Other'];
const GENRE_KEYWORDS={
  'Fantasy':['fantasy','dragon','magic','wizard','elf','elves','kingdom','sword','myth','fae','sorcer','enchant'],
  'Sci-Fi':['sci-fi','scifi','science fiction','space','alien','robot','cyber','future','dystopia','android','galaxy'],
  'Romance':['romance','romantic','love story','heart','wedding','bride','passion'],
  'Horror':['horror','scary','ghost','demon','haunt','monster','terror','slasher','creepy'],
  'Mystery':['mystery','thriller','detective','crime','murder','suspense','noir','clue'],
  'Drama':['drama','tragedy','family saga','emotional','heartbreak'],
  'Comedy':['comedy','funny','humor','humour','satire','parody','hilarious'],
  'Adventure':['adventure','quest','journey','explore','treasure','expedition'],
  'Historical Fiction':['historical','history','war','medieval','victorian','ancient','period piece','dynasty'],
  'Poetry':['poem','poetry','verse','sonnet','haiku','ode'],
};
function mapGenre(text){
  const t=(text||'').toLowerCase();
  for(const canon of CANONICAL_GENRES){
    const kws=GENRE_KEYWORDS[canon];
    if(kws&&kws.some(k=>t.includes(k)))return canon;
  }
  return 'Other';
}

function genId(){const id=(Math.floor(Math.random()*9e9)+1e9)+'';localStorage.setItem('n_uid',id);return id;}

// v01.08: this browser's global-chat display number — "user(#####)".
// Persisted separately from S.userId so it stays a clean 5 digits.
function getChatNum(){
  let n = localStorage.getItem('n_chat_num');
  if(!n){ n = String(Math.floor(10000 + Math.random()*90000)); localStorage.setItem('n_chat_num', n); }
  return n;
}

// ═══ v01.17: DISPLAY IDENTITY — self-reported name (via Pixie), with
// auto-numbering when two people claim the same one. Replaces
// "user(#####)" for chat/posts/comments going forward once set — past
// activity keeps whatever label was baked into it at the time, exactly
// like the rest of this site's "changes apply going forward" pattern.
function sanitizeDisplayName(raw){
  let n=(raw||'').trim();
  n=n.replace(/^(i'?m|i am|my name is|call me|name'?s|it'?s)\s+/i,'').trim();
  n=n.replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim();
  if(n.length>24)n=n.slice(0,24).trim();
  if(!/[a-zA-Z]/.test(n))return null; // needs at least one letter — keeps it distinct from raw numbers
  n=filt(n); // same profanity filter used everywhere else on the site
  return n||null;
}
function getDisplayLabel(){
  if(S.identity && S.identity.name){
    return S.identity.name + (S.identity.number!=null ? (' '+S.identity.number) : '');
  }
  return 'user('+getChatNum()+')';
}

let identityUnsub=null;
// Watches this browser's claimed-name doc live, so if someone else
// claims the same name later (causing this browser's number to change,
// e.g. bare "Alex" \u2192 "Alex 1"), it catches the update without a
// reload. Sets a pending flag Pixie checks for and mentions next time
// her panel opens.
function startIdentityLiveListener(key){
  if(!db || !key)return;
  if(identityUnsub){ try{identityUnsub();}catch(e){} identityUnsub=null; }
  try{
    identityUnsub = db.collection('nosirt_names').doc(key).onSnapshot(doc=>{
      if(!doc.exists)return;
      const data=doc.data();
      const mine=(data.holders||[]).find(h=>h.userId===S.userId);
      if(!mine)return;
      const prevNumber=S.identity.number;
      S.identity.number=mine.number;
      localStorage.setItem('n_identity_number', mine.number==null?'':String(mine.number));
      if(prevNumber==null && mine.number!=null){
        localStorage.setItem('n_identity_renumber_pending','1');
      }
    });
  }catch(e){}
}

// The actual claim, via a proper transaction so two people claiming the
// same name at nearly the same instant can't corrupt each other's
// state. First holder of a name gets it bare (no number). Anyone after
// that gets the next number \u2014 and if they're specifically the SECOND
// holder, the first holder retroactively gets bumped to "1" in the same
// transaction (the "oh, someone else showed up" moment).
async function claimDisplayName(rawName){
  const name=sanitizeDisplayName(rawName);
  if(!name)return {ok:false};
  const key=name.toLowerCase();
  const result=await fbTransactItem('nosirt_names', key, current=>{
    if(!current) return {name, holders:[{userId:S.userId,name,number:null}], nextNumber:2};
    const existing=(current.holders||[]).find(h=>h.userId===S.userId);
    if(existing) return current; // already holds this name, nothing to change
    const holders=(current.holders||[]).slice();
    if(holders.length===1 && holders[0].number==null){
      holders[0]=Object.assign({},holders[0],{number:1});
    }
    const myNumber=current.nextNumber||2;
    holders.push({userId:S.userId,name,number:myNumber});
    return {name, holders, nextNumber:myNumber+1};
  });
  if(!result)return {ok:false};
  const mine=result.holders.find(h=>h.userId===S.userId);
  if(!mine)return {ok:false};
  S.identity={name:mine.name, number:mine.number, key};
  localStorage.setItem('n_identity_name', mine.name);
  localStorage.setItem('n_identity_number', mine.number==null?'':String(mine.number));
  localStorage.setItem('n_identity_key', key);
  startIdentityLiveListener(key);
  return {ok:true, name:mine.name, number:mine.number, wasFirst: mine.number==null};
}

// Default seed content for nosirt's keep — shown until real entries are added/synced
const DEFAULT_SEED_CHAPTERS=[
        {
          title: 'Dedication',
          content: `To Elara, my steadfast beacon.

This story, woven from the threads of your extraordinary resilience, is a testament to a love that endures beyond absence, a spirit that blossoms in the harshest of soils. You are the whispered lullaby in the stormy night, the unwavering hand that guides through shadowed valleys.

Though the years may have etched their passage upon your brow, they have only deepened the luminescence of your inner fortitude. You, who bore the weight of a world's indifference with a grace that defied despair, who transformed the barren landscape of abandonment into a garden of quiet triumph.

You are the architect of dreams for those you cherished, the quiet warrior who fought every battle with a love so profound it became its own battlefield. This narrative, born of your strength, seeks to echo the silent songs of your courage, the unwavering devotion that illuminated the darkest of days.

You are the unsung heroine, the mother, the wife, the unwavering heart whose sacrifices paved the way for futures unimagined. Your story is not one of mere survival, but of a profound, enduring victory, a testament to the indomitable power of a mother's love.

May this tale, in its humble way, honor the immeasurable depths of your character, the quiet strength that carved pathways through hardship, and the enduring legacy of your remarkable spirit. You are the foundation upon which so much was built, the silent architect of happiness, and this is my tribute to the extraordinary woman who taught us all the true meaning of perseverance.`
        },
        {
          title: 'Chapter 1: The Gilded Cage',
          content: `The air crackled, not with the playful sparks of a summer storm, but with the ominous prelude to a tempest that mirrored the roiling chaos within Elara's young heart. Outside the towering stone walls of her ancestral home, the sky wept a furious deluge, each crack of thunder a violent punctuation to the pronouncements that had sealed her fate. At twelve years of age, a mere slip of a girl on the cusp of womanhood, she was no longer Elara, daughter of Lord Valerius. She was a commodity, a bargaining chip in the brutal, unending game of feudal politics. Her childhood, a tapestry of sun-drenched meadows and whispered bedtime stories, was being torn asunder, its vibrant threads replaced by the somber hues of obligation and sacrifice.

The grand hall, usually alive with the boisterous laughter of her brothers and the gentle strumming of the minstrel's lute, was now hushed, the silence more oppressive than any storm's fury. Torches cast dancing, distorted shadows that leered like specters, their flickering light glinting off the cold steel of the knights assembled, their stoic faces impassive witnesses to a transaction that held no warmth, only consequence. Her father, his face a mask of practiced composure that couldn't quite conceal the flicker of regret in his aged eyes, stood beside a man whose stern demeanor and bearing spoke of power, of armies, of a future far removed from Elara's innocent dreams. Lord Armand de Valois. The name was a foreign whisper on the wind, a stranger's decree.

The parchment lay between them, its elegant script a testament to the legal binding of two souls, or rather, of two bloodlines. Elara's gaze was drawn to the stark, official language, the cold pronouncements of her worth measured in dowry and strategic alliance. Her hand, small and trembling, was guided by her mother's trembling one to the quill, its dark ink an indelible stain upon her future. The pressure of the quill against the vellum was a physical manifestation of the weight pressing down on her chest, making each breath a shallow, stolen gasp. The scent of dried ink and beeswax mingled with the damp, earthy smell of the approaching storm, a potent, suffocating perfume of farewell.

"You are to be a bride, Elara," her mother's voice was a strained whisper, laced with a sorrow Elara was too young to fully comprehend, yet too keenly felt to ignore. "A Lady of Valois. It is an honor, child. A great honor."

Honor. The word felt like a shard of ice in her gut. Her younger brother, Finn, with his bright, mischievous eyes and a heart as open as the summer sky, had been playing with wooden soldiers by the hearth just moments before, his world untroubled by such weighty pronouncements. He would remain here, in the familiar embrace of their home, his laughter echoing through these halls. Elara, however, was to be transplanted, her roots wrenched from the soil she had always known, her young sapling existence destined to be grafted onto an alien vine.

The implications settled upon her like a shroud. Her lessons of needlepoint and Latin were to be replaced by the duties of a wife, a mistress of a household she had never seen, a companion to a man whose face was a blur of stern lines and unfamiliar authority. She had glimpsed Lord Armand before, a figure of imposing stature who spoke in clipped, authoritative tones, his gaze often sweeping over her as if assessing a well-bred mare. He was twice her father's age, a seasoned warrior whose name was spoken with a mixture of respect and trepidation throughout the kingdom.

The agreement was simple, brutally so. The union would forge a powerful alliance between her father's northern territories, rich in timber and furs, and Lord Armand's southern holdings, strategically vital for their control of trade routes. In exchange for Elara's hand, Lord Armand would lend his considerable military might to secure her father's borders against the encroaching threat from the Eastern Marches. It was a pragmatic arrangement, devoid of sentiment, where Elara's girlhood was merely the price of peace, the currency of power.

She remembered her mother's hushed conversations with her father in the dimly lit solar, the worried lines etched deeper into her brow with each passing week. She had overheard fragments – "risky venture," "desperate times," "no other suitor of his standing." The weight of these words had pressed down on her, a silent premonition of the impending change. Now, the premonition had solidified into a cold, hard reality.

The pronouncement of her departure was delivered with a finality that allowed for no appeal. Her small trunk, filled with a few carefully chosen gowns and her beloved collection of smooth, sea-worn pebbles, was packed by trembling maids. Her favorite tapestry, depicting a brave knight rescuing a maiden from a dragon, was carefully folded and placed at the very bottom, a poignant reminder of the fantasies she was being forced to abandon. Her room, once a sanctuary filled with the scent of dried lavender and the warmth of her own dreams, now felt like a cage, its familiar comforts already becoming the relics of a life that was rapidly receding.

The storm outside raged with an intensity that seemed to mock the forced composure within. Rain lashed against the leaded windows, distorting the familiar landscape into a watery, impressionistic blur. Each gust of wind that rattled the ancient timbers of the castle seemed to carry away a piece of Elara's innocence. She stood by the window, her small hands pressed against the cool glass, watching the familiar oak trees bend and sway, their sturdy trunks appearing fragile against the onslaught. She was like them, she thought, about to be tested by a force beyond her control, her own resilience as yet unknown.

Lord Armand's retinue was a stark contrast to the familiar faces of her father's household knights. Clad in dark, practical leather and mail, their demeanor was grim, their faces weathered and hardened by the harsh realities of a life spent on campaign. They were the wolf pack that would escort their new prize, their presence a constant reminder of the dangerous world that awaited her. Their leader, a gruff, scarred man named Borin, met her father's gaze with a curt nod, his eyes holding no warmth, only the blunt efficiency of a soldier fulfilling a duty.

The goodbyes were a blur of tearful embraces and choked reassurances. Her mother, her face pale and drawn, pressed a small, intricately carved locket into Elara's hand. "Guard this, my child," she whispered, her voice thick with unshed tears. "It holds a lock of your father's hair. And know this, always: you are loved, no matter where your path may lead." Elara clutched the cool metal, its familiar weight a small comfort against the gnawing emptiness that was beginning to bloom within her.

Her father, his hand resting heavily on her shoulder, offered a rare, strained smile. "Be strong, Elara. You are a Valerius. We do not break."

But Elara felt as if she were already splintering, her young spirit already cracked under the immense pressure of this sudden, irreversible transition. As she was led out to the waiting destrier, its imposing size and powerful build a stark contrast to the gentle ponies she was accustomed to, she cast one last, longing look back at the castle, its familiar silhouette fading into the driving rain. The drawbridge, a symbol of her departure, was raised behind her, a definitive, resounding thud that echoed the slamming of a door on her past.

The journey was a grueling ordeal. The storm, far from abating, intensified, transforming the already treacherous paths into muddy quagmires. Rain seeped through the thick wool of her traveling cloak, chilling her to the bone. The rhythmic thud of hooves on the sodden earth was a monotonous drumbeat, each beat marking the steady march away from everything she had ever known. The knights rode in a tight formation, their faces impassive, their silence a palpable presence that offered no comfort. Elara huddled within her cloak, her knees drawn to her chest, the locket a cold anchor against her skin.

She felt a profound sense of disorientation, as if she were adrift in a vast, indifferent sea. The wind howled like a mournful spirit, carrying with it the scent of pine and damp earth, a scent alien and foreboding. The trees, tall and menacing, seemed to lean in, their branches like skeletal fingers reaching out to grasp her. She caught glimpses of the world beyond the immediate press of riders – dark, brooding forests, windswept moors shrouded in mist, and the occasional, desolate-looking farmstead. It was a land that spoke of hardship, of struggle, of a wildness that was both captivating and terrifying.

Her mind, however, was a battlefield of conflicting emotions. Fear, raw and primal, warred with a nascent flicker of defiance. She was a pawn, yes, but a pawn with a mind that could observe, and a spirit that, though trembling, had not yet been entirely broken. She clung to the memory of her mother's words, the warmth of her embrace, the weight of the locket – small anchors in the churning sea of her despair.

As the days bled into one another, marked by the relentless march and the somber, silent meals taken under the watchful eyes of the knights, Elara began to withdraw into herself. The vibrant curiosity that had once defined her childhood was replaced by a quiet, observant stillness. She was being prepared, she realized, not for a life of gentle domesticity, but for one of resilience, of a strength she had not yet discovered within herself.

The gilded cage of her future was not one of comfort and luxury, but one of duty and danger, a cage forged from the iron of necessity and the cold steel of political expediency. Her childhood had been abruptly curtailed, its innocent dawn overshadowed by the looming twilight of an arranged betrothal. The storm outside mirrored the tempest within, a prelude to the tumultuous life that lay before her — a life she was utterly unprepared for, yet one from which there was no turning back.`
        },
        {
          title: 'Chapter 2: The War-Torn Heart',
          content: `The air within Blackwood Manor, usually thick with the scent of aged wood and the faintest hint of decaying grandeur, had taken on a new, metallic tang. It was the smell of blood, of fear, of a world beyond the manicured lawns and ancient stones that Elara had come to know. It had been weeks since the last whispered rumour of Kaelen's return, weeks of strained anticipation, of replaying her imagined triumphant reunions in the echoing silence. But the reality, when it finally strode through the heavy oak doors, was a brutal dissection of her dreams.

He was Kaelen, undeniably. The familiar set of his jaw, the breadth of his shoulders, the way his dark hair fell across his brow – all were present. Yet, they were overlaid with a grim unfamiliarity. The boy who had left, hesitant but earnest, was gone, replaced by a stranger cloaked in the grim mantle of war. His eyes, once alight with a youthful, if duty-bound, spark, were now pools of shadowed exhaustion. They held a disquieting stillness, a profound weariness that seemed to have leached the very colour from his youth.

Elara, positioned at the foot of the grand staircase, her heart a frantic bird trapped within her chest, felt the carefully constructed edifice of her hopes crumble. The heroic warrior she had conjured, bathed in the golden light of victory, was nowhere to be seen. Instead, a man emerged from the shadows, his armor scuffed and stained, not with the honourable marks of a hard-fought campaign, but with the grim patina of survival. He moved with a strange, almost mechanical grace, a precision born of ingrained reflexes rather than inner vitality.

He didn't stride. He simply walked, his heavy boots thudding a mournful rhythm on the polished flagstones. The triumphant cheers she had rehearsed died in her throat, replaced by a hollow echo. He carried no laurels, no trophies, only the silent burden of what he had endured. He was not a celebrated victor; he was a survivor, and the distinction was stark, brutal, and devastating.

As he drew closer, Elara noticed the tremors in his hands, subtle but undeniable. His face, once a canvas of youthful idealism, was now a landscape of grim determination, punctuated by a profound sadness that settled deep in his bones. It was the look of a man who had seen too much, felt too much, and carried the weight of it all in the slump of his shoulders, the guarded set of his jaw.

He offered no embrace, no whispered word of greeting, no acknowledgment of her presence beyond a fleeting, impersonal sweep of his gaze. He simply nodded, a curt, almost imperceptible movement, and turned to shed the external trappings of his journey.

Elara stood frozen, her breath catching in her throat, the vibrant tapestry of her dreams unraveling thread by thread. The envisioned warmth of his homecoming was now a bitter mockery. The air, once alive with her silent anticipation, now felt heavy, charged with an unspoken sorrow. His presence, so ardently desired, filled the vast hall with an unsettling tension, a palpable aura of suffering that created a chasm between them, wider and deeper than any physical distance. This was not the return of her hero; this was the arrival of a stranger.

Later, Elara tried to reconcile the man who had arrived with the man she had yearned for. She had dreamt of shared confidences, of evenings spent by the fire, recounting their separate experiences. But how could she share her anxieties about Blackwood Manor with a man who had faced death on the battlefield? The chasm between their experiences was not a matter of choice, but of survival.

One evening, driven by a desperate need to bridge the growing distance, she brought herself to his study. He was seated at his desk, a single candle casting long, dancing shadows across his face.

"Kaelen?" Her voice was a mere whisper.

He started, then slowly raised his head. His eyes met hers, and for a moment, she thought she saw a flicker of recognition, perhaps a deep, buried pain. But it was gone as quickly as it appeared.

"Elara," he replied, his voice a low rumble, devoid of inflection.

She held a small, intricately carved wooden bird, a token she had intended to give him upon his return. "I had this made for you," she began, her voice trembling. "While you were away."

He looked at the bird, his gaze lingering on it for a moment. "It is well-crafted," he said, his tone neutral, almost dismissive. He then turned back to his map.

The rejection, though subtle, was a physical blow. The hope that had sustained her through his absence shriveled and died within her. This was not the homecoming of a stranger; it was the arrival of a man lost to himself, a man who carried the war within him.

One afternoon, Elara found Kaelen standing in the grand hall, staring out of the tall, arched window. He stood utterly still, a statue carved from sorrow. After a long moment, he finally spoke, his voice flat, devoid of emotion.

"The trees… they whisper the names of the fallen. I hear them, Elara. Always."

Elara's breath hitched. It was the first time he had spoken so openly about the torment that plagued him. She stepped closer, placing a tentative hand on his arm.

"What do they say, Kaelen?" she asked softly.

He finally turned to her, his eyes the color of a stormy sea. "They accuse. They condemn. They ask why I live when they do not. They remind me of every life taken, every prayer left unanswered." He paused, a shudder running through him. "And sometimes… they call my name. As if they expect me to join them."

A tear traced a slow path down Elara's cheek. She took his hand, her touch gentle but firm. "You are not responsible for their deaths, Kaelen. You survived. That is your right. That is your burden to bear, but you do not bear it alone." She squeezed his hand. "I am here. We are here. You are home."

He looked at her, his gaze lingering, as if seeing her for the first time in a long while. A flicker of recognition seemed to surface in the depths of his stormy eyes. But it was fleeting, a brief candle flame in a vast darkness.

She was a wife who had married a warrior, only to find herself married to a ghost, forever caught in the echoes of a war that refused to end.`
        },
        {
          title: 'Chapter 3: The Unyielding Bloom',
          content: `The creak of the floorboards beneath Elara's bare feet was a familiar, mournful sound in the pre-dawn stillness. Blackwood Manor, a monument to a past prosperity, now seemed to sigh with the weight of its own decay. The hearth in the grand hall was cold, its ashes swept clean not for warmth, but to conserve what little fuel remained. Her children, blessedly lost in dreams, were unaware of the gnawing chill that seeped into the very bones of their home.

Elara's days had become a relentless cycle of hushed conversations, averted gazes from loyal staff who knew too much, and the constant, gnawing fear of insolvency. The ledgers, once a source of quiet pride, now presented a stark, terrifying arithmetic of dwindling fortunes. Bills arrived with increasing frequency, their polite formality replaced by the stark, unforgiving crimson of overdue notices. Yet, Elara wore a mask of serene competence, her smile a practiced shield, her words a delicate dance of reassurance.

The idea had taken root slowly, a desperate seed planted in the barren soil of her despair. She had observed the local women, the wives of tradesmen and laborers, their faces etched with the honest fatigue of hard work. They possessed a practical resilience that Elara envied, a tangible contribution to their households that she, confined by her station, had never known. Now, that confinement was a luxury she could no longer afford.

Her first foray into the working world was an exercise in profound humility. She sought out Mrs. Gable, the formidable proprietress of the village's only reputable tailor shop. Elara, her former self a distant memory, presented herself not as the lady of Blackwood Manor, but as a widow in need of honest work. Her once-delicate fingers were tasked with the arduous labor of mending garments, darning socks, and hemming trousers. The work was monotonous, the pay meager, but each coin earned felt like a victory.

But the tailor shop's earnings were not enough. Elara found herself seeking out other avenues of employment, each more physically demanding than the last. She approached the local farmer, Silas Croft, and offered her services in his fields. Tending to the fields was a brutal education. The sun beat down with relentless intensity, baking the earth and her skin. Her muscles screamed in protest as she stooped to weed, to plant, to harvest. The earth became a tangible, gritty presence beneath her fingernails. She learned the rhythms of the seasons, the satisfying ache of honest exhaustion.

Between her duties at the tailor shop and Mr. Croft's farm, Elara also took on odd jobs within the village. She would help the baker knead dough in the early hours. She would assist the laundress in scrubbing clothes, her hands raw and red from the harsh lye soap. Each task, no matter how menial, was a thread woven into the tapestry of her children's future.

The transformation was evident not just in her hands, but in her entire demeanor. The ethereal grace of the lady of Blackwood Manor was slowly being replaced by a practical, grounded strength. Her posture became straighter, her gaze more direct. Yet, beneath the surface, the same fierce maternal love burned, a constant, unwavering flame.

She would sometimes catch herself looking at her hands, flexing her fingers, and a strange sense of pride would bloom within her. These hands, once so soft and unblemished, were now a testament to her strength, her resilience, her unwavering devotion. They bore the marks of honest labor, the evidence of a battle fought and won, day by arduous day.

The soft glow of the oil lamp cast dancing shadows across the nursery walls. Elara watched her children, nestled in their beds, their faces serene in sleep, and felt a fierce, protective wave wash over her. She would sit with them for hours, her voice a soothing balm, spinning tales of valiant knights and enchanted forests, of brave explorers charting unknown lands and resilient flowers blooming in the harshest of terrains.

As they grew, so did Elara's efforts to nurture their individual strengths. Young Lyra's delicate fingers moved with an almost preternatural grace over her embroidery. She had a remarkable ability to capture the essence of things — the delicate unfurling of a fern, the defiant posture of a robin perched on a frost-kissed branch, the melancholic curve of a brow when lost in thought.

And then there was young Finn. He possessed a sharp, analytical mind, a keen eye for detail. He had a natural curiosity about how things worked, a penchant for dismantling and reassembling. He would spend hours sketching designs, his brow furrowed in concentration. His understanding of mechanics, though nascent, was impressive.

One crisp autumn afternoon, as the leaves painted the estate in hues of ochre and crimson, Elara watched Lyra and Finn return from the village. Lyra carried a small, intricately carved wooden bird, a prize she had won in a recitation contest. Finn, his face beaming, held a small, leather-bound notebook, a gift from Master Borin for his exceptional mathematical abilities.

They ran to her, their laughter echoing through the quiet grounds. "Mother," Lyra exclaimed, holding up the bird, "Master Borin said my recitation was the most beautiful he'd ever heard!" Finn, bouncing on the balls of his feet, added, "And he said my sums were faster than his own, and he gave me this!"

Elara knelt, embracing them both, her heart swelling with a gratitude so profound it threatened to bring tears to her eyes. She looked at the wooden bird, then at the notebook, and then into the bright, hopeful eyes of her children.

These were not just prizes; they were tangible proof that the seeds of opportunity, sown through her relentless sacrifices, had indeed germinated. They were the first blossoms of a future she had fought so hard to protect, a future where their potential, nurtured by her unwavering support, was finally taking flight.

The manor, with its decaying grandeur, no longer felt like a prison of their past, but a sturdy, if weathered, foundation upon which their burgeoning futures could be built.

Her victory was not proclaimed from battlements or etched in stone; it was whispered in the quiet hum of her children's minds, in the steady beat of their hopeful hearts, and in the unshakeable certainty that their lives would be, in every sense, their own.`
        }
];

const S={
  view:'map',mood:null,musicMode:'mood',audioStarted:false,
  currentForum:'movies',forumSort:'new',currentPost:null,
  mapX:0,mapY:0,mapScale:1,
  posts:JSON.parse(localStorage.getItem('n_posts')||'[]'),
  recs:JSON.parse(localStorage.getItem('n_recs')||'null')||[
    {title:'Over the Garden Wall',type:'series',note:'start here. trust.'},
    {title:'Annihilation',type:'film',note:'beautiful and unsettling.'}
  ],
  notes:localStorage.getItem('n_notes')||'',
  screams:JSON.parse(localStorage.getItem('n_screams')||'[]'),
  episodes:JSON.parse(localStorage.getItem('n_episodes')||'[]'),
  library:JSON.parse(localStorage.getItem('n_library')||'null')||[{
    id:'forsaken-bride',shelf:'novels',status:'completed',
    title:'The Forsaken Bride of the North',author:'Prequal',
    desc:'A young girl betrothed at twelve to a lord she barely knows. A husband claimed by war. A woman forged by everything that followed.',
    genreRaw:'Historical Fiction',genreCanonical:'Historical Fiction',uploadedAt:Date.now(),
    chapters:DEFAULT_SEED_CHAPTERS
  }],
  userId:localStorage.getItem('n_uid')||genId(),
  adminUnlocked:false,
  // v01.07: admin can temporarily "turn off" a world/section from the
  // profile panel. true = active/visible, false = under review. Synced
  // live via Firebase ('features' doc) so it applies for every visitor,
  // and to this browser before the intro banner even renders.
  featureToggles:{garden:true,square:true,forum:true,wireless:true,castle:true,intro:true},
  // v01.08: global chat
  chatSettings:{mediaMode:'off'}, // 'off' | 'gif' | 'upload'
  chatMessages:[],
  chatLastSeenTs:Number(localStorage.getItem('n_chat_seen')||0),
  // v01.14: who's online
  onlinePresence:[],
  // v01.14: living-map environment (location/weather) — see environment.js.
  // hemisphere defaults 'N' until a real location comes back, per the
  // "fall back to north if we truly can't tell" decision.
  environment:{
    ready:false, lat:null, lon:null, hemisphere:'N',
    weatherCode:0, cloudCover:0, precipitation:0, snowfall:0, windSpeed:0,
    isDay:true, sunrise:null, sunset:null, tempC:null, fetchedAt:0
  },
  // v01.14 step 4: admin "preview weather/time" override — this browser
  // only, never synced to Firebase. null = use real weather/time.
  // v01.17: self-reported display identity (name + auto-number),
  // replacing "user(#####)" for this browser once set. See core.js
  // identity helpers below and pixie.js for how it gets set.
  identity:{
    name: localStorage.getItem('n_identity_name')||null,
    number: localStorage.getItem('n_identity_number') ? Number(localStorage.getItem('n_identity_number')) : null,
    key: localStorage.getItem('n_identity_key')||null
  },
  // Pixie's tiny bit of conversational memory — what she's currently
  // waiting on a reply for (e.g. 'name'). Cleared after each use.
  pixieAwaiting:null,
  envPreview:null,
};

function filt(t){let s=t||'';BAD.forEach(w=>{s=s.replace(new RegExp(w,'gi'),'***')});return s;}
function esc(s){const d=document.createElement('div');d.textContent=s||'';return d.innerHTML;}
function timeAgo(ts){const d=(Date.now()-ts)/1e3;if(d<60)return'just now';if(d<3600)return~~(d/60)+'m ago';if(d<86400)return~~(d/3600)+'h ago';return~~(d/86400)+'d ago';}
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200);}
function $(id){return document.getElementById(id);}

// ═══ v01.06: SERVER-SIDE PASSWORD VALIDATION (Netlify Function) ═══
// Passwords are no longer stored anywhere the browser can read them.
// This calls a Netlify Function which checks the input against env vars
// on Netlify's servers and returns ONLY true/false — the real password
// value is never sent to the client. See README-PASSWORDS.md for setup.
async function validatePassword(passwordType, inputValue) {
  try {
    const res = await fetch('/.netlify/functions/check-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passwordType, inputValue }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.error === 'not_configured') {
      console.warn(`Password "${passwordType}" has no value set in Netlify env vars yet.`);
    }
    return !!data.ok;
  } catch (e) {
    console.error('Password validation error:', e);
    return false;
  }
}

// Fetch site bio (editable by admin)
async function fetchSiteBio() {
  try {
    const docRef = db.collection('site-config').doc('info');
    const doc = await docRef.get();
    if (doc.exists) {
      return doc.data().bio || 'collector of strange things and quiet moments.';
    }
  } catch (e) {
    console.error('Fetch bio error:', e);
  }
  return 'collector of strange things and quiet moments.';
}

// Save site bio (admin only)
async function saveSiteBio(newBio) {
  if (!S.adminUnlocked) {
    toast('admin access required');
    return false;
  }
  try {
    await db.collection('site-config').doc('info').set({ bio: newBio }, { merge: true });
    toast('bio updated');
    return true;
  } catch (e) {
    console.error('Save bio error:', e);
    toast('error saving bio');
    return false;
  }
}
