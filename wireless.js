/* ============================================================
   WIRELESS.JS — Podcast player (v01.05)
   YouTube-backed episodes with wave/video modes, auto-play,
   styled progress bar, prev/next navigation, Firebase passwords
   ============================================================ */

let ytPlayer = null;
let isYTReady = false;
let currentEpisode = null;
let playbackTimer = null;
let currentEpisodeId = null;

function loadEpisodeProgress() {
  const saved = localStorage.getItem('n_podcast_progress');
  S.podcastProgress = saved ? JSON.parse(saved) : {};
}

function saveEpisodeProgress() {
  localStorage.setItem('n_podcast_progress', JSON.stringify(S.podcastProgress));
}

function onYouTubeIframeAPIReady() {
  isYTReady = true;
  console.log('YouTube API ready');
}

function initWirelessPlayer() {
  loadEpisodeProgress();
}

function renderWirelessView() {
  const content = $('wireless-view');
  content.style.display = 'flex';
  content.style.flexDirection = 'column';
  renderEpisodeList();
}

function renderEpisodeList() {
  const list = $('episode-list');
  if (!list) return;
  list.innerHTML = '';

  if (!S.episodes || S.episodes.length === 0) {
    list.innerHTML = '<div style="text-align:center;color:var(--fog);font-size:.8rem;padding:20px">no episodes yet</div>';
    return;
  }

  S.episodes.forEach((ep, i) => {
    const progress = S.podcastProgress[ep.id] || 0;
    const item = document.createElement('div');
    item.style.cssText = 'background:rgba(200,137,42,.08);border:1px solid rgba(200,137,42,.15);border-radius:8px;padding:12px;cursor:pointer;transition:all .2s';
    item.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
        <div style="font-family:'Cinzel Decorative',serif;font-size:.85rem;color:var(--amber);flex:1">${esc(ep.title)}</div>
        <div style="font-size:.7rem;color:var(--fog);opacity:.6;flex-shrink:0">${ep.duration ? ep.duration + 'm' : 'live'}</div>
      </div>
      <div style="font-size:.75rem;color:var(--fog);opacity:.7;margin-bottom:8px">${ep.uploadedAt ? timeAgo(ep.uploadedAt) : 'unknown date'}</div>
      <div style="height:4px;background:rgba(200,137,42,.1);border-radius:2px;overflow:hidden;margin-bottom:8px">
        <div style="height:100%;background:rgba(200,137,42,.6);width:${progress}%;transition:width .2s"></div>
      </div>
      <div style="font-size:.65rem;color:var(--fog);opacity:.5">${Math.round(progress)}% watched</div>
    `;
    item.addEventListener('click', () => {
      playEpisode(ep);
      closeMusicModal();
    });
    item.addEventListener('mouseover', () => item.style.background = 'rgba(200,137,42,.15)');
    item.addEventListener('mouseout', () => item.style.background = 'rgba(200,137,42,.08)');
    list.appendChild(item);
  });
}

function playEpisode(ep) {
  currentEpisode = ep;
  currentEpisodeId = ep.id;
  S.selectedPodcast = ep.id;
  S.musicMode = 'podcast';

  localStorage.setItem('n_last_podcast_ep', ep.id);

  if (!ytPlayer && isYTReady) {
    createYTPlayer(ep);
  } else if (isYTReady) {
    ytPlayer.cueVideoById(ep.videoId);
  }

  $('wp-progress-bar').style.opacity = '1';
  setTimeout(() => {
    if (ytPlayer && isYTReady) {
      ytPlayer.playVideo();
      startProgressTracking(ep);
    }
  }, 500);

  toast(`now playing: ${ep.title}`);
}

function createYTPlayer(ep) {
  ytPlayer = new YT.Player('yt-player', {
    height: '0',
    width: '0',
    videoId: ep.videoId,
    events: {
      onReady: (e) => {
        e.target.playVideo();
        startProgressTracking(ep);
      },
      onStateChange: (e) => {
        if (e.data === YT.PlayerState.ENDED) {
          nextEpisode();
        }
      }
    }
  });
}

function startProgressTracking(ep) {
  if (playbackTimer) clearInterval(playbackTimer);

  playbackTimer = setInterval(() => {
    if (!ytPlayer || !isYTReady) return;

    const current = ytPlayer.getCurrentTime();
    const duration = ytPlayer.getDuration();
    const progress = duration > 0 ? (current / duration) * 100 : 0;

    S.podcastProgress[currentEpisodeId] = progress;
    saveEpisodeProgress();

    const fill = $('wp-progress-fill');
    if (fill) fill.style.width = progress + '%';

    if (progress >= 99) {
      S.podcastProgress[currentEpisodeId] = 100;
      saveEpisodeProgress();
    }
  }, 1000);
}

function nextEpisode(){
  if(!currentEpisode || !S.episodes)return;
  
  const list=S.episodes;
  const i=list.findIndex(e=>e.id===currentEpisode.id);
  
  if(i>0){
    const nextEp = list[i-1];
    playEpisode(nextEp);
    toast(`auto-playing next: ${nextEp.title}`);
    localStorage.setItem('n_last_podcast_ep', nextEp.id);
  }else{
    if(ytPlayer)ytPlayer.pauseVideo();
    activeMusic=null;
    updateNP('🎙 you\'ve listened to everything!');
    toast('end of podcast series reached');
    document.querySelectorAll('.music-opt').forEach(o=>o.classList.remove('playing'));
  }
}

function loadLastPodcastEpisode(){
  const lastId = localStorage.getItem('n_last_podcast_ep');
  if(lastId && S.episodes){
    const ep = S.episodes.find(e=>e.id===lastId);
    if(ep){
      playEpisode(ep);
      return true;
    }
  }
  return false;
}

function toggleWaveMode() {
  const waveContainer = $('wp-wave-container');
  const videoContainer = $('wp-video-container');
  
  if (waveContainer.style.display === 'none') {
    waveContainer.style.display = 'flex';
    videoContainer.style.display = 'none';
    $('wp-mode-toggle').textContent = '📺';
  } else {
    waveContainer.style.display = 'none';
    videoContainer.style.display = 'block';
    $('wp-mode-toggle').textContent = '🌊';
  }
}

function toggleFullscreen() {
  const videoContainer = $('wp-video-container');
  if (videoContainer.requestFullscreen) {
    videoContainer.requestFullscreen();
  } else if (videoContainer.webkitRequestFullscreen) {
    videoContainer.webkitRequestFullscreen();
  }
}

function prevEpisode() {
  if (!S.episodes || !currentEpisode) return;
  const i = S.episodes.findIndex(e => e.id === currentEpisode.id);
  if (i < S.episodes.length - 1) {
    playEpisode(S.episodes[i + 1]);
    toast('previous episode');
  }
}

function skipForward() {
  if (ytPlayer && isYTReady) {
    const current = ytPlayer.getCurrentTime();
    ytPlayer.seekTo(current + 10);
  }
}

function skipBackward() {
  if (ytPlayer && isYTReady) {
    const current = ytPlayer.getCurrentTime();
    ytPlayer.seekTo(Math.max(0, current - 10));
  }
}

function seekToProgress(e) {
  if (!ytPlayer || !isYTReady) return;
  const bar = e.currentTarget;
  const rect = bar.getBoundingClientRect();
  const percent = (e.clientX - rect.left) / rect.width;
  const duration = ytPlayer.getDuration();
  ytPlayer.seekTo(percent * duration);
}

function closeWireless() {
  S.view = 'map';
  renderView();
}

function toggleAddEpisode() {
  const panel = $('add-episode-panel');
  if (!panel) return;
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

async function publishEpisode() {
  const pw = $('ep-pw').value.trim();
  const title = $('ep-title').value.trim();
  const videoId = $('ep-yt').value.trim();

  const isValid = await validatePassword('podcast_password', pw);
  if (!isValid) {
    toast('wrong password');
    return;
  }
  if (!title || !videoId) {
    toast('title and video ID required');
    return;
  }

  const ep = {
    id: 'ep-' + Date.now(),
    title: filt(title),
    videoId,
    uploadedAt: Date.now(),
    duration: 0
  };

  S.episodes.push(ep);
  localStorage.setItem('n_episodes', JSON.stringify(S.episodes));
  fbSaveStory('episodes', JSON.stringify(S.episodes));

  $('ep-pw').value = '';
  $('ep-title').value = '';
  $('ep-yt').value = '';
  toggleAddEpisode();
  renderEpisodeList();
  toast('episode added');
}

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (typeof initWirelessPlayer === 'function') {
      initWirelessPlayer();
    }
  }, 100);
});
