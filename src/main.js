import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import './style.css';
import { VIDEOS as RAW_VIDEOS } from './data.js';

gsap.registerPlugin(ScrollTrigger);

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let VIDEOS = shuffle(RAW_VIDEOS);

let currentView = 'table';
let expandedTableRow = null;
let expandedGridCard = null;
let lenis = null;
let playHistory = [];

const miniPrevSVG  = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>`;
const miniPlaySVG  = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
const miniPauseSVG = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
const miniNextSVG  = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zm2.5-6 6-4.3V16l-6-4z"/><rect x="16" y="6" width="2" height="12"/></svg>`;

const playSVG = `<svg class="play-icon" viewBox="0 0 24 24"><polygon points="6,3 20,12 6,21"/></svg>`;
const playLargeSVG = `<svg class="play-icon-large" viewBox="0 0 24 24"><polygon points="6,3 20,12 6,21"/></svg>`;

function renderTableView() {
  const frag = document.createDocumentFragment();
  VIDEOS.forEach((v, i) => {
    const row = document.createElement('div');
    row.className = 'table-row reveal';
    row.dataset.videoIndex = i;
    row.dataset.videoId = v.id;

    const num = String(i + 1).padStart(2, '0');
    row.innerHTML = `
      <span class="col col--num">${num}</span>
      <span class="col col--title">
        ${v.title}
        ${v.artist ? `<span class="col--artist-sub">${v.artist}</span>` : ''}
      </span>
      <span class="col col--artist">${v.artist}</span>
      <span class="col col--play">${playSVG}</span>
    `;
    frag.appendChild(row);
  });
  document.getElementById('tableBody').appendChild(frag);
}

function renderGridView() {
  const frag = document.createDocumentFragment();
  VIDEOS.forEach((v, i) => {
    const card = document.createElement('div');
    card.className = 'grid-card reveal';
    card.dataset.videoIndex = i;
    card.dataset.videoId = v.id;
    card.innerHTML = `
      <div class="grid-card__thumb">
        <img src="https://img.youtube.com/vi/${v.id}/mqdefault.jpg"
             alt="${v.artist ? v.artist + ' - ' : ''}${v.title}"
             loading="lazy" decoding="async" />
        <div class="grid-card__play-overlay">${playLargeSVG}</div>
      </div>
      <div class="grid-card__info">
        <span class="grid-card__title">${v.title}</span>
        <span class="grid-card__artist">${v.artist}</span>
      </div>
    `;
    frag.appendChild(card);
  });
  document.getElementById('gridView').appendChild(frag);
}

function initViewToggle() {
  const btn = document.querySelector('.view-toggle');
  const tableView = document.getElementById('tableView');
  const gridView = document.getElementById('gridView');
  const icon = document.getElementById('toggleIcon');

  btn.addEventListener('click', () => {
    collapseAll();

    if (currentView === 'table') {
      currentView = 'grid';
      tableView.classList.remove('active');
      gridView.classList.add('active');
      icon.innerHTML = '&#9776;';
    } else {
      currentView = 'table';
      gridView.classList.remove('active');
      tableView.classList.add('active');
      icon.innerHTML = '&#9638;';
    }

    window.scrollTo({ top: 0, behavior: 'instant' });
    if (lenis) lenis.scrollTo(0, { immediate: true });

    requestAnimationFrame(() => {
      refreshAnimations(currentView);
      if (lenis) lenis.resize();
    });
  });
}

function initAnimations() {
  gsap.fromTo('.site-header .reveal',
    { y: -20, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out', stagger: 0.1, delay: 0.1 }
  );

  gsap.fromTo('.table-header',
    { y: 15, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out', delay: 0.3 }
  );

  animateElements('.view.active .reveal');
}

function animateElements(selector) {
  const elements = document.querySelectorAll(selector);
  if (!elements.length) return;

  const initial = Array.from(elements).slice(0, 20);
  const rest = Array.from(elements).slice(20);

  gsap.fromTo(initial,
    { y: 30, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.6, ease: 'power2.out', stagger: 0.06, delay: 0.4 }
  );

  rest.forEach(el => {
    gsap.fromTo(el,
      { y: 30, opacity: 0 },
      {
        y: 0, opacity: 1, duration: 0.6, ease: 'power2.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 92%',
          toggleActions: 'play none none none',
        }
      }
    );
  });
}

function refreshAnimations(viewType) {
  ScrollTrigger.getAll().forEach(st => st.kill());

  const selector = viewType === 'table' ? '#tableView .reveal' : '#gridView .reveal';
  const elements = document.querySelectorAll(selector);

  gsap.set(elements, { clearProps: 'all' });
  elements.forEach(el => el.classList.add('reveal'));

  animateElements(selector);
  ScrollTrigger.refresh();
}

let ytPlayer = null;

function loadYouTubeAPI() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  return new Promise(resolve => {
    window.onYouTubeIframeAPIReady = resolve;
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  });
}

function updateMiniPlayer(idx) {
  const v = VIDEOS[idx];
  document.getElementById('miniThumb').src = `https://img.youtube.com/vi/${v.id}/mqdefault.jpg`;
  document.getElementById('miniThumb').alt = v.title;
  document.getElementById('miniTitle').textContent = v.title;
  document.getElementById('miniArtist').textContent = v.artist;
  document.getElementById('miniPlayPause').innerHTML = miniPauseSVG;
  document.getElementById('miniPlayer').classList.add('is-active');
  document.body.classList.add('mini-player-open');
}

function hideMiniPlayer() {
  document.getElementById('miniPlayer').classList.remove('is-active');
  document.body.classList.remove('mini-player-open');
}

function setMiniPlayState(playing) {
  const btn = document.getElementById('miniPlayPause');
  if (btn) btn.innerHTML = playing ? miniPauseSVG : miniPlaySVG;
}

function initMiniPlayer() {
  document.getElementById('miniPrev').innerHTML = miniPrevSVG;
  document.getElementById('miniPlayPause').innerHTML = miniPlaySVG;
  document.getElementById('miniNext').innerHTML = miniNextSVG;

  document.getElementById('miniPrev').addEventListener('click', () => {
    if (playHistory.length < 2) return;
    playHistory.pop(); // remove current
    const prevIdx = playHistory.pop(); // grab previous (expand will re-push it)
    if (currentView === 'table') {
      const row = document.querySelector(`.table-row[data-video-index="${prevIdx}"]`);
      if (row) expandTableRow(row);
    } else {
      const card = document.querySelector(`.grid-card[data-video-index="${prevIdx}"]`);
      if (card) expandGridCard(card);
    }
  });

  document.getElementById('miniPlayPause').addEventListener('click', () => {
    if (!ytPlayer) return;
    const state = ytPlayer.getPlayerState();
    if (state === YT.PlayerState.PLAYING) {
      ytPlayer.pauseVideo();
    } else {
      ytPlayer.playVideo();
    }
  });

  document.getElementById('miniNext').addEventListener('click', () => playNext());
}

function createYTPlayer(elementId, videoId) {
  if (ytPlayer) { ytPlayer.destroy(); ytPlayer = null; }
  ytPlayer = new YT.Player(elementId, {
    videoId,
    playerVars: { autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1 },
    events: {
      onStateChange: ({ data }) => {
        if (data === YT.PlayerState.ENDED) playNext();
        if (data === YT.PlayerState.PLAYING) setMiniPlayState(true);
        if (data === YT.PlayerState.PAUSED)  setMiniPlayState(false);
      }
    }
  });
}

function playNext() {
  let currentIdx = -1;
  if (currentView === 'table' && expandedTableRow) {
    currentIdx = parseInt(expandedTableRow.dataset.videoIndex, 10);
  } else if (currentView === 'grid' && expandedGridCard) {
    currentIdx = parseInt(expandedGridCard.dataset.videoIndex, 10);
  }
  if (currentIdx === -1) return;

  const nextIdx = (currentIdx + 1) % VIDEOS.length;

  if (currentView === 'table') {
    const nextRow = document.querySelector(`.table-row[data-video-index="${nextIdx}"]`);
    if (nextRow) expandTableRow(nextRow);
  } else {
    const nextCard = document.querySelector(`.grid-card[data-video-index="${nextIdx}"]`);
    if (nextCard) expandGridCard(nextCard);
  }
}

function initSmoothScroll() {
  lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    orientation: 'vertical',
    smoothWheel: true,
  });

  lenis.on('scroll', ScrollTrigger.update);

  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);
}

function expandTableRow(row) {
  const idx = parseInt(row.dataset.videoIndex, 10);
  const v = VIDEOS[idx];

  if (expandedTableRow === row) { collapseTableRow(); hideMiniPlayer(); playHistory = []; return; }
  if (expandedTableRow) collapseTableRow(true);

  row.classList.add('is-active');
  expandedTableRow = row;
  playHistory.push(idx);
  updateMiniPlayer(idx);

  const playerId = `yt-table-${idx}`;
  const wrapper = document.createElement('div');
  wrapper.className = 'table-row-player';
  wrapper.innerHTML = `
    <div class="table-row-player__inner">
      <div id="${playerId}" class="yt-player-target"></div>
      <button class="table-row-player__close" aria-label="Close">&times;</button>
    </div>
  `;
  row.after(wrapper);

  gsap.fromTo(wrapper, { height: 0, opacity: 0 }, {
    height: 'auto', opacity: 1, duration: 0.5, ease: 'power2.out',
    onStart: () => createYTPlayer(playerId, v.id),
    onComplete: () => {
      if (lenis) lenis.scrollTo(wrapper, { offset: -80, duration: 0.8 });
      ScrollTrigger.refresh();
    }
  });

  wrapper.querySelector('.table-row-player__close').addEventListener('click', (e) => {
    e.stopPropagation();
    collapseTableRow();
    hideMiniPlayer();
    playHistory = [];
  });
}

function collapseTableRow(instant) {
  if (!expandedTableRow) return;

  if (ytPlayer) { ytPlayer.destroy(); ytPlayer = null; }
  expandedTableRow.classList.remove('is-active');
  const wrapper = expandedTableRow.nextElementSibling;

  if (wrapper && wrapper.classList.contains('table-row-player')) {
    if (instant) {
      wrapper.remove();
    } else {
      gsap.to(wrapper, {
        height: 0, opacity: 0, duration: 0.35, ease: 'power2.in',
        onComplete: () => { wrapper.remove(); ScrollTrigger.refresh(); }
      });
    }
  }
  expandedTableRow = null;
}

function expandGridCard(card) {
  const idx = parseInt(card.dataset.videoIndex, 10);
  const v = VIDEOS[idx];

  if (expandedGridCard === card) { collapseGridCard(); hideMiniPlayer(); playHistory = []; return; }
  if (expandedGridCard) collapseGridCard(true);

  card.classList.add('grid-card--expanded');
  expandedGridCard = card;
  playHistory.push(idx);
  updateMiniPlayer(idx);

  const playerId = `yt-grid-${idx}`;
  const playerEl = document.createElement('div');
  playerEl.className = 'grid-card__player';
  playerEl.innerHTML = `
    <div id="${playerId}" class="yt-player-target"></div>
    <button class="grid-card__player-close" aria-label="Close">&times;</button>
    <div class="grid-card__player-info">
      <span class="grid-card__player-title">${v.title}</span>
      <span class="grid-card__player-artist">${v.artist}</span>
    </div>
  `;
  card.prepend(playerEl);

  gsap.fromTo(playerEl, { opacity: 0, scaleY: 0.9 }, {
    opacity: 1, scaleY: 1, duration: 0.45, ease: 'power2.out',
    transformOrigin: 'top center',
    onStart: () => createYTPlayer(playerId, v.id),
    onComplete: () => {
      if (lenis) lenis.scrollTo(card, { offset: -80, duration: 0.8 });
      ScrollTrigger.refresh();
    }
  });

  playerEl.querySelector('.grid-card__player-close').addEventListener('click', (e) => {
    e.stopPropagation();
    collapseGridCard();
    hideMiniPlayer();
    playHistory = [];
  });
}

function collapseGridCard(instant) {
  if (!expandedGridCard) return;

  if (ytPlayer) { ytPlayer.destroy(); ytPlayer = null; }
  const playerEl = expandedGridCard.querySelector('.grid-card__player');
  expandedGridCard.classList.remove('grid-card--expanded');

  if (playerEl) {
    if (instant) {
      playerEl.remove();
    } else {
      gsap.to(playerEl, {
        opacity: 0, scaleY: 0.9, duration: 0.3, ease: 'power2.in',
        onComplete: () => { playerEl.remove(); ScrollTrigger.refresh(); }
      });
    }
  }
  expandedGridCard = null;
}

function collapseAll() {
  collapseTableRow(true);
  collapseGridCard(true);
  hideMiniPlayer();
  playHistory = [];
}

function initShuffleButton() {
  document.querySelector('.shuffle-btn').addEventListener('click', () => {
    collapseAll();
    VIDEOS = shuffle(RAW_VIDEOS);

    document.getElementById('tableBody').innerHTML = '';
    document.getElementById('gridView').innerHTML = '';

    renderTableView();
    renderGridView();

    window.scrollTo({ top: 0, behavior: 'instant' });
    if (lenis) lenis.scrollTo(0, { immediate: true });

    requestAnimationFrame(() => {
      ScrollTrigger.getAll().forEach(st => st.kill());
      refreshAnimations(currentView);
      if (lenis) lenis.resize();
    });
  });
}

function initClickHandlers() {
  document.getElementById('tableBody').addEventListener('click', (e) => {
    const row = e.target.closest('.table-row');
    if (!row) return;
    expandTableRow(row);
  });

  document.getElementById('gridView').addEventListener('click', (e) => {
    if (e.target.closest('.grid-card__player-close')) return;
    const card = e.target.closest('.grid-card');
    if (!card) return;
    if (card.classList.contains('grid-card--expanded')) return;
    expandGridCard(card);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') collapseAll();
  });
}

async function init() {
  await loadYouTubeAPI();
  renderTableView();
  renderGridView();
  initSmoothScroll();
  initAnimations();
  initViewToggle();
  initShuffleButton();
  initMiniPlayer();
  initClickHandlers();
}

document.addEventListener('DOMContentLoaded', init);
