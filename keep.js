/* ============================================================
   KEEP.JS — "nosirt's keep" feature
   Load this AFTER core.js.
   Contains: the castle gate/password, and the library/reader —
   now backed by S.library (synced via Firestore, one document
   per story) instead of a hardcoded LIBRARY object. Stories are
   added by anyone who's past the castle gate; admin mode (see
   the floaty profile) can edit/delete any of them afterward.
   ============================================================ */

// ═══ CASTLE ═══
function openCastle(){$('castle-door').classList.add('open');}
function closeCastle(){$('castle-door').classList.remove('open');$('castle-input').value='';$('castle-wrong').textContent='';}
function tryCastle(){
  if($('castle-input').value.trim().toLowerCase()===CASTLE_PW){
    $('castle-door').classList.remove('open');$('castle-input').value='';$('castle-wrong').textContent='';
    $('castle-interior').classList.add('open');
    setTimeout(renderBookList,50);
  }else{
    $('castle-input').classList.add('wrong');$('castle-wrong').textContent='the gate remains sealed.';
    setTimeout(()=>$('castle-input').classList.remove('wrong'),420);$('castle-input').value='';
  }
}
function closeInterior(){
  $('castle-interior').classList.remove('open');
  // Reset to library view when closing
  setTimeout(()=>{
    $('reader-view').style.display='none';
    $('library-view').style.display='flex';
  },300);
}

// ═══════════════════════════════════════
// CASTLE LIBRARY — now backed by S.library (synced via Firestore,
// one document per story since full novels are too big for a shared blob).
// Stories are added by anyone who's past the castle gate; admin mode
// (see the floaty profile) can edit/delete/reorder any of them after.
// ═══════════════════════════════════════

if(typeof pdfjsLib!=='undefined'){
  pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

let currentShelf = 'novels';
let currentBook = null;
let currentChapterIdx = 0;

function switchShelf(shelf) {
  currentShelf = shelf;
  $('lib-search').value='';
  document.querySelectorAll('.shelf-tab').forEach(t => {
    const isActive = t.getAttribute('onclick') === `switchShelf('${shelf}')`;
    t.style.background = isActive ? 'rgba(200,137,42,.15)' : 'transparent';
    t.style.borderColor = isActive ? 'rgba(200,137,42,.35)' : 'rgba(200,137,42,.2)';
    t.style.color = isActive ? 'var(--cream)' : 'var(--fog)';
  });
  renderBookList();
}

// Clicking an author name or genre chip anywhere jumps into a cross-shelf
// search for that value — the closest thing to an "author/genre profile" page
// without a real accounts system.
function filterLibrary(value){
  $('lib-search').value=value;
  renderBookList();
}

const SHELF_ICON={novels:'📖',stories:'📜',poetry:'🪶',other:'✦'};

function renderBookList() {
  const list = $('book-list');
  if (!list) return;
  const q=($('lib-search')?$('lib-search').value:'').trim().toLowerCase();
  let books;
  if(q){
    // search crosses every shelf
    books=S.library.filter(b=>
      b.title.toLowerCase().includes(q)||
      (b.author||'').toLowerCase().includes(q)||
      (b.genreRaw||'').toLowerCase().includes(q)||
      (b.genreCanonical||'').toLowerCase().includes(q)
    );
  }else{
    books=S.library.filter(b=>b.shelf===currentShelf);
  }
  if (!books.length) {
    list.innerHTML = `<div style="font-family:'IM Fell English',serif;font-style:italic;font-size:.88rem;color:var(--fog);text-align:center;padding:40px 20px;opacity:.5;line-height:1.7">
      ${q?'nothing matches that search.':'the shelves here are empty for now.<br>more stories will find their way in.'}
    </div>`;
    return;
  }
  list.innerHTML = books.map(b => `
    <div onclick="openBook('${b.id}')" style="background:rgba(20,14,8,.7);border:1px solid rgba(200,137,42,.18);border-radius:12px;padding:14px 16px;cursor:pointer;transition:border-color .2s"
      onmouseover="this.style.borderColor='rgba(200,137,42,.4)'" onmouseout="this.style.borderColor='rgba(200,137,42,.18)'">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div style="font-family:'Cinzel Decorative',serif;font-size:.88rem;color:var(--cream);margin-bottom:4px;line-height:1.4">${esc(b.title)}</div>
        ${q?`<div style="flex-shrink:0;font-size:.65rem;color:var(--fog);opacity:.6">${SHELF_ICON[b.shelf]||''} ${esc(b.shelf)}</div>`:''}
      </div>
      <div style="font-family:'IM Fell English',serif;font-style:italic;font-size:.72rem;color:var(--amber);opacity:.8;margin-bottom:8px">
        by <span onclick="event.stopPropagation();filterLibrary('${esc(b.author).replace(/'/g,"\\'")}')" style="text-decoration:underline;cursor:pointer">${esc(b.author)}</span>
        · <span onclick="event.stopPropagation();filterLibrary('${esc(b.genreCanonical).replace(/'/g,"\\'")}')" style="text-decoration:underline;cursor:pointer">${esc(b.genreRaw||b.genreCanonical)}</span>
        ${b.status==='ongoing'?' · <span style="color:#8fc97a">ongoing</span>':''}
      </div>
      ${b.desc?`<div style="font-family:'IM Fell English',serif;font-style:italic;font-size:.78rem;color:var(--fog);line-height:1.6">${esc(b.desc)}</div>`:''}
      <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:.68rem;color:var(--fog);opacity:.5">${b.chapters.length} chapter${b.chapters.length!==1?'s':''}</div>
        <div class="lib-admin ${S.adminUnlocked?'show':''}">
          <button class="admin-btn edit" onclick="event.stopPropagation();editStory('${b.id}')">✎ edit</button>
          <button class="admin-btn delete" onclick="event.stopPropagation();deleteStory('${b.id}')">✕ delete</button>
        </div>
      </div>
    </div>
  `).join('');
}

function openBook(id) {
  const book = S.library.find(b => b.id === id);
  if (!book) return;
  currentBook = book;
  currentChapterIdx = 0;
  $('reader-title').textContent = book.title;
  $('reader-meta').innerHTML = `by ${esc(book.author)} · ${esc(book.genreRaw||book.genreCanonical)}${book.status==='ongoing'?' · <span style="color:#8fc97a">ongoing</span>':''}`;
  $('reader-add-ch-btn').style.display = book.status==='ongoing' ? 'block' : 'none';
  $('lib-add-chapter-panel').style.display='none';
  buildChapterNav(book);
  renderChapter(0);
  $('library-view').style.display = 'none';
  $('reader-view').style.display = 'flex';
}

function buildChapterNav(book) {
  $('chapter-list').innerHTML = book.chapters.map((ch, i) => `
    <div onclick="goToChapter(${i});toggleChapterNav()" style="padding:6px 8px;border-radius:6px;cursor:pointer;font-family:'IM Fell English',serif;font-style:italic;font-size:.78rem;color:var(--fog);transition:all .15s;border:1px solid transparent"
      onmouseover="this.style.color='var(--cream)';this.style.borderColor='rgba(200,137,42,.2)'"
      onmouseout="this.style.color='var(--fog)';this.style.borderColor='transparent'"
      id="ch-nav-${i}">${i === 0 ? '❧' : '·'} ${esc(ch.title)}
    </div>
  `).join('');
}

function renderChapter(idx) {
  if (!currentBook) return;
  const ch = currentBook.chapters[idx];
  if (!ch) return;
  currentChapterIdx = idx;

  // Format paragraphs
  // Split on any run of newlines, not just blank-line-separated double
  // newlines — PDF-extracted text and plainly-typed pasted text use single
  // line breaks between paragraphs, and would otherwise render as one
  // unbroken block of text.
  const paragraphs = ch.content.split(/\n+/).filter(p => p.trim());
  const html = paragraphs.map(p => {
    const trimmed = p.trim();
    if (trimmed.startsWith('"') || trimmed.startsWith('\u201c')) {
      return `<p style="margin-bottom:1.4em;color:rgba(240,230,210,.9);font-style:italic">${esc(trimmed)}</p>`;
    }
    return `<p style="margin-bottom:1.4em">${esc(trimmed)}</p>`;
  }).join('');

  $('reader-content').innerHTML = `
    <div style="font-family:'Cinzel Decorative',serif;font-size:1rem;color:var(--amber);margin-bottom:6px;line-height:1.4">${esc(ch.title)}</div>
    <div style="width:40px;height:1px;background:rgba(200,137,42,.3);margin-bottom:20px"></div>
    <div style="font-family:'Crimson Text',serif;font-size:1.05rem;color:rgba(230,220,200,.88);line-height:1.85">${html}</div>
    ${idx < currentBook.chapters.length - 1 ? `
    <div style="margin-top:32px;text-align:center">
      <button onclick="goToChapter(${idx+1})" style="background:rgba(200,137,42,.1);border:1px solid rgba(200,137,42,.3);border-radius:20px;padding:8px 24px;color:var(--cream);font-family:'IM Fell English',serif;font-style:italic;font-size:.85rem;cursor:pointer">
        next: ${esc(currentBook.chapters[idx+1].title)} →
      </button>
    </div>` : `
    <div style="margin-top:32px;text-align:center;font-family:'IM Fell English',serif;font-style:italic;font-size:.85rem;color:var(--fog);opacity:.6">— end ${currentBook.status==='ongoing'?"of what's posted so far":''} —</div>
    <div style="margin-top:12px;text-align:center">
      <button onclick="closeReader()" style="background:transparent;border:1px solid rgba(200,137,42,.2);border-radius:20px;padding:6px 18px;color:var(--fog);font-family:'IM Fell English',serif;font-style:italic;font-size:.8rem;cursor:pointer">return to library</button>
    </div>`}
  `;
  $('reader-content').scrollTop = 0;
  updateReadProgress();
}

function goToChapter(idx) {
  renderChapter(idx);
}

function toggleChapterNav() {
  const nav = $('chapter-nav');
  nav.style.display = nav.style.display === 'none' ? 'block' : 'none';
}

function closeReader() {
  $('reader-view').style.display = 'none';
  $('library-view').style.display = 'flex';
  $('chapter-nav').style.display = 'none';
  $('lib-add-chapter-panel').style.display='none';
  currentBook = null;
}

function updateReadProgress() {
  const rc = $('reader-content');
  if (!rc) return;
  rc.addEventListener('scroll', () => {
    const pct = rc.scrollTop / (rc.scrollHeight - rc.clientHeight) * 100;
    const bar = $('read-progress');
    if (bar) bar.style.width = Math.min(100, pct) + '%';
  }, { passive: true });
}

// ═══ CHAPTER DETECTION ═══
// Heuristic only — looks for lines like "Chapter 1", "Chapter One: Title",
// "Part II", etc. Anything before the first detected heading becomes an
// implicit first chapter, so short single-piece stories still work fine.
function detectChapters(text){
  const lines=text.split(/\r?\n/);
  const headingRegex=/^(chapter|part|book|ch\.?)\s*[\divxlcIVXLC]*\b.{0,60}$/i;
  const chapters=[];
  let current=null;
  for(const raw of lines){
    const line=raw.trim();
    if(line && line.length<70 && headingRegex.test(line)){
      if(current)chapters.push(current);
      current={title:line,content:''};
    }else if(current){
      current.content+=(current.content?'\n':'')+raw;
    }else if(line){
      current={title:'Chapter 1',content:raw};
    }
  }
  if(current)chapters.push(current);
  chapters.forEach(c=>{c.content=c.content.replace(/\n{3,}/g,'\n\n').trim();});
  return chapters.filter(c=>c.content.length>0);
}

// Splits mammoth's converted HTML on heading tags (H1/H2/H3), which is a
// much more reliable signal than regex since it reflects the doc's real
// formatting (Word "Heading" styles map straight to these tags).
function chaptersFromDocxHtml(html){
  const div=document.createElement('div');
  div.innerHTML=html;
  const chapters=[];
  let current=null;
  Array.from(div.childNodes).forEach(node=>{
    if(node.nodeType===1 && /^H[1-3]$/.test(node.tagName)){
      if(current)chapters.push(current);
      current={title:(node.textContent||'').trim()||('Chapter '+(chapters.length+1)),content:''};
    }else{
      const text=node.textContent?node.textContent.trim():'';
      if(text){
        if(!current)current={title:'Chapter 1',content:''};
        current.content+=(current.content?'\n\n':'')+text;
      }
    }
  });
  if(current)chapters.push(current);
  return chapters.filter(c=>c.content.trim().length>0);
}

// Groups pdf.js text items into lines by y-position before handing off to
// the regex chapter-detector — plain space-joining loses line breaks
// entirely, which would make "Chapter 1" on its own line invisible.
async function extractPdfText(buf){
  const pdf=await pdfjsLib.getDocument({data:buf}).promise;
  let fullText='';
  for(let i=1;i<=pdf.numPages;i++){
    const page=await pdf.getPage(i);
    const content=await page.getTextContent();
    let lastY=null,lineText='';
    content.items.forEach(item=>{
      const y=item.transform[5];
      if(lastY!==null && Math.abs(y-lastY)>2){
        fullText+=lineText+'\n';
        lineText='';
      }
      lineText+=item.str;
      lastY=y;
    });
    fullText+=lineText+'\n\n';
  }
  return fullText;
}

async function chaptersFromFile(file){
  const ext=file.name.split('.').pop().toLowerCase();
  const buf=await file.arrayBuffer();
  if(ext==='docx'){
    if(typeof mammoth==='undefined')throw new Error('docx reader did not load');
    const result=await mammoth.convertToHtml({arrayBuffer:buf});
    return chaptersFromDocxHtml(result.value);
  }else if(ext==='pdf'){
    if(typeof pdfjsLib==='undefined')throw new Error('pdf reader did not load');
    const text=await extractPdfText(buf);
    return detectChapters(text);
  }
  throw new Error('please upload a .docx or .pdf file');
}

// ═══ UPLOAD: NEW STORY ═══
function toggleAddStory(){
  const panel=$('lib-add-panel');
  panel.style.display=panel.style.display==='none'?'block':'none';
}

async function publishStory(){
  const title=filt($('lib-title').value.trim());
  if(!title){toast('give it a title first');return;}
  const author=filt($('lib-author').value.trim())||'anonymous';
  const genreRaw=filt($('lib-genre').value.trim())||'Other';
  const shelf=$('lib-shelf').value;
  const status=$('lib-status').value;
  const desc=filt($('lib-desc').value.trim());
  const file=$('lib-file').files[0];
  const pasted=$('lib-paste').value.trim();

  let chapters=[];
  try{
    if(file){
      toast('reading your file...');
      chapters=await chaptersFromFile(file);
    }else if(pasted){
      chapters=detectChapters(pasted);
    }else{
      toast('upload a file or paste some text first');
      return;
    }
  }catch(e){
    console.error(e);
    toast("couldn't read that file — try pasting the text instead");
    return;
  }
  if(!chapters.length){toast("couldn't find any readable text in that");return;}

  const story={
    id:'story'+Date.now(),shelf,status,title,author,desc,
    genreRaw,genreCanonical:mapGenre(genreRaw),
    uploadedAt:Date.now(),chapters
  };
  S.library.unshift(story);
  localStorage.setItem('n_library',JSON.stringify(S.library));
  fbSaveStory(story.id,story);

  $('lib-title').value='';$('lib-author').value='';$('lib-genre').value='';
  $('lib-desc').value='';$('lib-paste').value='';$('lib-file').value='';
  toggleAddStory();
  renderBookList();
  toast('published to the keep ✓ ('+chapters.length+' chapter'+(chapters.length!==1?'s':'')+')');
}

// ═══ ADD CHAPTER TO AN ONGOING STORY ═══
function toggleAddChapter(){
  if(!currentBook||currentBook.status!=='ongoing')return;
  const panel=$('lib-add-chapter-panel');
  panel.style.display=panel.style.display==='none'?'block':'none';
}

async function publishChapterToBook(){
  if(!currentBook)return;
  const manualTitle=filt($('ch-title').value.trim());
  const file=$('ch-file').files[0];
  const pasted=$('ch-paste').value.trim();

  let newChapters=[];
  try{
    if(file){
      toast('reading your file...');
      newChapters=await chaptersFromFile(file);
    }else if(pasted){
      newChapters=detectChapters(pasted);
    }else{
      toast('upload a file or paste some text first');
      return;
    }
  }catch(e){
    console.error(e);
    toast("couldn't read that file — try pasting the text instead");
    return;
  }
  if(!newChapters.length){toast("couldn't find any readable text in that");return;}
  if(manualTitle && newChapters.length===1)newChapters[0].title=manualTitle;

  currentBook.chapters=currentBook.chapters.concat(newChapters);
  const idx=S.library.findIndex(b=>b.id===currentBook.id);
  if(idx>-1)S.library[idx]=currentBook;
  localStorage.setItem('n_library',JSON.stringify(S.library));
  fbSaveStory(currentBook.id,currentBook);

  $('ch-title').value='';$('ch-paste').value='';$('ch-file').value='';
  $('lib-add-chapter-panel').style.display='none';
  buildChapterNav(currentBook);
  toast(newChapters.length+' chapter'+(newChapters.length!==1?'s':'')+' added ✓');
}

// ═══ ADMIN: EDIT / DELETE STORIES ═══
function deleteStory(id){
  if(!S.adminUnlocked)return;
  if(!confirm('delete this story permanently?'))return;
  S.library=S.library.filter(b=>b.id!==id);
  localStorage.setItem('n_library',JSON.stringify(S.library));
  fbDeleteStory(id);
  renderBookList();
  toast('story deleted');
}

function editStory(id){
  if(!S.adminUnlocked)return;
  const book=S.library.find(b=>b.id===id);
  if(!book)return;
  const newTitle=prompt('title:',book.title);
  if(newTitle===null)return;
  book.title=filt(newTitle.trim())||book.title;
  const newAuthor=prompt('author:',book.author);
  if(newAuthor!==null)book.author=filt(newAuthor.trim())||book.author;
  const newGenre=prompt('genre:',book.genreRaw);
  if(newGenre!==null){book.genreRaw=filt(newGenre.trim())||book.genreRaw;book.genreCanonical=mapGenre(book.genreRaw);}
  const newStatus=prompt("status — type 'ongoing' or 'completed':",book.status);
  if(newStatus!==null && (newStatus.trim()==='ongoing'||newStatus.trim()==='completed'))book.status=newStatus.trim();
  const newDesc=prompt('description:',book.desc||'');
  if(newDesc!==null)book.desc=filt(newDesc.trim());

  localStorage.setItem('n_library',JSON.stringify(S.library));
  fbSaveStory(book.id,book);
  renderBookList();
  toast('story updated');
}

// Init library on castle open - renderBookList called by tryCastle
