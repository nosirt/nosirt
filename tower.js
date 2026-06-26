/* ============================================================
   TOWER.JS — "the tower" (n/ forum) feature
   Load this AFTER core.js.
   Contains: forum navigation, sorting, posts, voting, and comments.
   ============================================================ */

// ═══ FORUM ═══
function renderForumNav(){
  $('forum-nav').innerHTML=FORUMS.map(f=>`<div class="n-tab${f===S.currentForum?' active':''}" onclick="switchForum('${f}')">n/${f}</div>`).join('');
}
function switchForum(f){
  S.currentForum=f;
  document.querySelectorAll('.n-tab').forEach(t=>t.classList.remove('active'));
  document.querySelector(`.n-tab[onclick="switchForum('${f}')"]`).classList.add('active');
  $('forum-sub').textContent='n/'+f;renderPosts();
}
function setSort(s,el){
  S.forumSort=s;
  document.querySelectorAll('.sort-btn').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');renderPosts();
}
function renderPosts(){
  let posts=S.posts.filter(p=>p.forum===S.currentForum);
  posts=S.forumSort==='new'?posts.sort((a,b)=>b.ts-a.ts):posts.sort((a,b)=>(b.votes||0)-(a.votes||0));
  const list=$('post-list');if(!list)return;
  if(!posts.length){list.innerHTML=`<div style="font-family:'IM Fell English',serif;font-style:italic;font-size:.85rem;color:var(--fog);text-align:center;padding:24px;opacity:.55">nothing here yet. be the first.</div>`;return;}
  list.innerHTML=posts.map(p=>`<div class="post-card" onclick="openPost('${p.id}')">
    <div class="post-meta"><span class="post-user">anon·${esc(p.uid)}</span><span class="post-time">${timeAgo(p.ts)}</span></div>
    <div class="post-title">${esc(p.title)}</div>
    ${p.body?`<div class="post-body-preview">${esc(p.body)}</div>`:''}
    <div class="post-actions"><span class="vote-count">▲ ${p.votes||0}</span><span class="comment-count">💬 ${(p.comments||[]).length}</span></div>
  </div>`).join('');
}
function openPost(id){
  S.currentPost=id;const post=S.posts.find(p=>p.id===id);if(!post)return;
  $('detail-title').textContent=post.title;
  $('detail-meta').textContent=`anon·${post.uid} · ${timeAgo(post.ts)} · n/${post.forum}`;
  $('detail-body').textContent=post.body||'';
  const uv=(post.userVotes||{})[S.userId];
  $('detail-votes').innerHTML=`
    <button class="vote-btn${uv===1?' voted-up':''}" onclick="vote('${id}',1);event.stopPropagation()">▲ up</button>
    <span class="vote-count" style="padding:0 6px">${post.votes||0}</span>
    <button class="vote-btn${uv===-1?' voted-down':''}" onclick="vote('${id}',-1);event.stopPropagation()">▼ down</button>`;
  const comms=post.comments||[];
  $('detail-comments').innerHTML=comms.length?comms.map(c=>`<div class="comment-item">
    <div class="comment-user">anon·${esc(c.uid)} · ${timeAgo(c.ts)}</div>
    <div class="comment-text">${esc(c.text)}</div>
  </div>`).join(''):`<div style="font-family:'IM Fell English',serif;font-style:italic;font-size:.8rem;color:var(--fog);opacity:.5;padding:8px 0">no comments yet.</div>`;
  $('post-detail').classList.add('open');
}
function closeDetail(){$('post-detail').classList.remove('open');$('comment-text').value='';S.currentPost=null;renderPosts();}
function vote(id,dir){
  const post=S.posts.find(p=>p.id===id);if(!post)return;
  if(!post.userVotes)post.userVotes={};
  const prev=(post.userVotes[S.userId])||0;
  if(prev===dir){post.userVotes[S.userId]=0;post.votes=(post.votes||0)-dir;}
  else{post.votes=(post.votes||0)-prev+dir;post.userVotes[S.userId]=dir;}
  localStorage.setItem('n_posts',JSON.stringify(S.posts)); fbSave('posts',{v:JSON.stringify(S.posts)});openPost(id);
}
function addComment(){
  const t=$('comment-text').value.trim();if(!t||!S.currentPost)return;
  const post=S.posts.find(p=>p.id===S.currentPost);if(!post)return;
  if(!post.comments)post.comments=[];
  post.comments.push({text:filt(t),uid:S.userId.slice(-6),ts:Date.now()});
  localStorage.setItem('n_posts',JSON.stringify(S.posts)); fbSave('posts',{v:JSON.stringify(S.posts)});
  $('comment-text').value='';openPost(S.currentPost);toast('replied ✓');
}
function openNewPost(){$('new-post-forum').textContent='n/'+S.currentForum;$('new-post-form').classList.add('open');}
function closeNewPost(){$('new-post-form').classList.remove('open');$('post-title-input').value='';$('post-body-input').value='';}
function submitPost(){
  const title=$('post-title-input').value.trim();if(!title)return;
  S.posts.unshift({id:'p'+Date.now(),title:filt(title),body:filt($('post-body-input').value.trim()),
    forum:S.currentForum,uid:S.userId.slice(-6),ts:Date.now(),votes:0,userVotes:{},comments:[]});
  localStorage.setItem('n_posts',JSON.stringify(S.posts)); fbSave('posts',{v:JSON.stringify(S.posts)});
  closeNewPost();renderPosts();toast('posted ✓');
}
