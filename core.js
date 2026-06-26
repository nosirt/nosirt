/* ============================================================
   CORE.JS — shared foundation for the whole site
   Load this FIRST (before every other JS file).
   Contains: Firebase setup, global config, shared state,
   and small helper functions every other file relies on.
   ============================================================ */

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

function fbInit() {
  try {
    if (typeof firebase !== 'undefined' && !firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    db = firebase.firestore();
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
const CASTLE_PW='love';
const RADIO_PW='signal'; // password to add a new podcast episode — change this to whatever you like

function genId(){const id=(Math.floor(Math.random()*9e9)+1e9)+'';localStorage.setItem('n_uid',id);return id;}
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
  userId:localStorage.getItem('n_uid')||genId(),
};

function filt(t){let s=t||'';BAD.forEach(w=>{s=s.replace(new RegExp(w,'gi'),'***')});return s;}
function esc(s){const d=document.createElement('div');d.textContent=s||'';return d.innerHTML;}
function timeAgo(ts){const d=(Date.now()-ts)/1e3;if(d<60)return'just now';if(d<3600)return~~(d/60)+'m ago';if(d<86400)return~~(d/3600)+'h ago';return~~(d/86400)+'d ago';}
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200);}
function $(id){return document.getElementById(id);}
