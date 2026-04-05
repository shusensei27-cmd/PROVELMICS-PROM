// ═══════════════════════════════════════════════════════════
// PROVELMICS — Main Application JS
// ═══════════════════════════════════════════════════════════

// ── Config ──────────────────────────────────────────────────
const CONFIG = {
  SUPABASE_URL: 'https://YOUR_SUPABASE_PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_KEY',
  API_BASE: '/api',
  ADMIN_EMAIL: 'shusensei27@gmail.com',
};

const GENRES = [
  'Action','Adventure','Comedy','Drama','Fantasy','Horror',
  'Mystery','Romance','Sci-Fi','Slice of Life','Supernatural',
  'Thriller','Historical','Martial Arts','Isekai','Psychological'
];

// ── State ────────────────────────────────────────────────────
const State = {
  user: null,
  dbUser: null,
  token: null,
  currentPage: 'home',
  novels: [],
  comics: [],
  searchHistory: JSON.parse(localStorage.getItem('pvm_search_history') || '[]'),
};

// ── Supabase Init ────────────────────────────────────────────
let supabase = null;

function initSupabase() {
  if (window.supabase && CONFIG.SUPABASE_URL !== 'https://YOUR_SUPABASE_PROJECT.supabase.co') {
    supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        State.user = session.user;
        State.token = session.access_token;
        await syncUserToD1();
        updateAuthUI();
      } else {
        State.user = null;
        State.token = null;
        State.dbUser = null;
        updateAuthUI();
      }
    });
  }
}

// ── API Helper ───────────────────────────────────────────────
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (State.token) headers['Authorization'] = `Bearer ${State.token}`;

  const res = await fetch(`${CONFIG.API_BASE}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── Auth ─────────────────────────────────────────────────────
async function loginWithGoogle() {
  if (!supabase) return showToast('Supabase not configured. Set your credentials in app.js', 'error');
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  });
}

async function logout() {
  if (supabase) await supabase.auth.signOut();
  State.user = null;
  State.token = null;
  State.dbUser = null;
  updateAuthUI();
  navigateTo('home');
  showToast('Logged out successfully');
}

async function syncUserToD1() {
  try {
    const data = await api('/auth/sync', { method: 'POST' });
    State.dbUser = data.user;
    updateAuthUI();
  } catch (e) {
    console.error('Sync error:', e);
  }
}

function updateAuthUI() {
  const loginBtn = document.getElementById('login-btn');
  const userMenu = document.getElementById('user-menu');
  const userAvatar = document.getElementById('user-avatar');
  const adminLink = document.getElementById('admin-link');
  const mobileAdminLink = document.getElementById('mobile-admin-link');

  if (State.user) {
    loginBtn && loginBtn.classList.add('hidden');
    userMenu && userMenu.classList.remove('hidden');
    if (userAvatar) {
      const photo = State.dbUser?.photo_url || State.user.user_metadata?.avatar_url;
      if (photo) {
        userAvatar.src = photo;
        userAvatar.style.display = 'block';
      }
    }
    const isAdmin = State.user.email === CONFIG.ADMIN_EMAIL;
    adminLink && (adminLink.style.display = isAdmin ? 'block' : 'none');
    mobileAdminLink && (mobileAdminLink.style.display = isAdmin ? 'block' : 'none');
  } else {
    loginBtn && loginBtn.classList.remove('hidden');
    userMenu && userMenu.classList.add('hidden');
    adminLink && (adminLink.style.display = 'none');
    mobileAdminLink && (mobileAdminLink.style.display = 'none');
  }
}

// ── Router ───────────────────────────────────────────────────
function navigateTo(page, params = {}) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(`page-${page}`);
  if (target) {
    target.classList.add('active');
    State.currentPage = page;
    window.scrollTo(0, 0);
    document.querySelectorAll('.nav-links a').forEach(a => {
      a.classList.toggle('active', a.dataset.page === page);
    });
    switch (page) {
      case 'home': loadHome(); break;
      case 'novels': loadNovels(); break;
      case 'comics': loadComics(); break;
      case 'authors': loadAuthors(); break;
      case 'profile': loadProfile(); break;
      case 'admin': loadAdmin(); break;
      case 'upload': loadUploadPage(); break;
      case 'genre': loadGenrePage(params.genre); break;
      case 'reader': loadReader(params.id, params.type); break;
    }
  }
}

// ── Home Page ────────────────────────────────────────────────
async function loadHome() {
  await Promise.all([loadFeatured(), loadLatest(), loadContinueReading()]);
}

async function loadFeatured() {
  const container = document.getElementById('featured-strip');
  if (!container) return;
  container.innerHTML = skeletons(3, 'featured-skeleton');

  try {
    const [novelsData, comicsData] = await Promise.all([
      api('/novels?sort=rating&limit=3'),
      api('/comics?sort=rating&limit=3'),
    ]);
    const featured = [...(novelsData.novels || []), ...(comicsData.comics || [])]
      .sort((a, b) => b.rating_avg - a.rating_avg).slice(0, 5);

    container.innerHTML = featured.length
      ? featured.map(item => featuredCardHTML(item)).join('')
      : `<p class="text-muted text-mono" style="padding:1rem">No featured content yet.</p>`;
  } catch (e) {
    container.innerHTML = `<p class="text-muted text-mono" style="padding:1rem">Could not load featured content.</p>`;
  }
}

function featuredCardHTML(item) {
  const type = item.image_urls !== undefined ? 'comic' : 'novel';
  const bg = item.cover_url ? `style="background-image:url('${item.cover_url}')"` : '';
  const genres = (item.genre || []).slice(0, 2).map(g => `<span class="genre-tag">${g}</span>`).join('');
  return `
    <div class="featured-card" onclick="navigateTo('reader',{id:'${item.id}',type:'${type}'})">
      <div class="featured-card-bg" ${bg}></div>
      <div class="featured-card-content">
        <div class="card-genres" style="margin-bottom:0.4rem">${genres}</div>
        <div class="card-title" style="font-size:1rem;margin-bottom:0.3rem">${item.title}</div>
        <div class="card-rating">
          <span class="stars">${starsHTML(item.rating_avg)}</span>
          <span class="text-mono" style="font-size:0.65rem">${(item.rating_avg||0).toFixed(1)}</span>
        </div>
      </div>
    </div>`;
}

async function loadLatest() {
  const container = document.getElementById('latest-grid');
  if (!container) return;
  container.innerHTML = skeletons(6, 'skeleton-card');

  try {
    const [nd, cd] = await Promise.all([
      api('/novels?sort=newest&limit=3'),
      api('/comics?sort=newest&limit=3'),
    ]);
    const items = [
      ...(nd.novels||[]).map(n=>({...n,_type:'novel'})),
      ...(cd.comics||[]).map(c=>({...c,_type:'comic'})),
    ].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

    container.innerHTML = items.length
      ? items.map(i => contentCardHTML(i, i._type)).join('')
      : `<p class="text-muted text-mono">No content yet.</p>`;
  } catch (e) {
    container.innerHTML = `<p class="text-muted text-mono">Could not load content.</p>`;
  }
}

async function loadContinueReading() {
  const container = document.getElementById('continue-reading');
  if (!container || !State.user) { container && (container.style.display = 'none'); return; }

  try {
    const data = await api('/progress');
    const prog = data.progress?.[0];
    if (!prog) { container.style.display = 'none'; return; }

    container.style.display = 'flex';
    container.innerHTML = `
      <div class="continue-progress-bar" style="width:${prog.scroll_position||0}%"></div>
      <div style="width:48px;height:64px;background:var(--bg-elevated);border:1px solid var(--border-glow);overflow:hidden;flex-shrink:0">
        ${prog.cover_url ? `<img src="${prog.cover_url}" style="width:100%;height:100%;object-fit:cover">` : ''}
      </div>
      <div style="flex:1">
        <div class="card-title">${prog.title || 'Unknown'}</div>
        <div class="text-mono text-muted mt-1">Chapter ${(prog.chapter_index||0)+1}</div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="navigateTo('reader',{id:'${prog.novel_id}',type:'novel'})">
        Continue ▶
      </button>`;
  } catch (e) {
    container.style.display = 'none';
  }
}

// ── Novels Page ──────────────────────────────────────────────
async function loadNovels(sort = 'newest', genre = '') {
  const container = document.getElementById('novels-grid');
  if (!container) return;
  container.innerHTML = skeletons(8, 'skeleton-card');

  try {
    let url = `/novels?sort=${sort}&limit=24`;
    if (genre) url += `&genre=${encodeURIComponent(genre)}`;
    const data = await api(url);
    State.novels = data.novels || [];
    container.innerHTML = State.novels.length
      ? State.novels.map(n => contentCardHTML(n, 'novel')).join('')
      : `<p class="text-muted text-mono" style="padding:2rem 0">No novels found.</p>`;
  } catch (e) {
    container.innerHTML = `<p class="text-muted text-mono">Error loading novels.</p>`;
  }
}

// ── Comics Page ──────────────────────────────────────────────
async function loadComics(sort = 'newest', genre = '') {
  const container = document.getElementById('comics-grid');
  if (!container) return;
  container.innerHTML = skeletons(8, 'skeleton-card');

  try {
    let url = `/comics?sort=${sort}&limit=24`;
    if (genre) url += `&genre=${encodeURIComponent(genre)}`;
    const data = await api(url);
    State.comics = data.comics || [];
    container.innerHTML = State.comics.length
      ? State.comics.map(c => contentCardHTML(c, 'comic')).join('')
      : `<p class="text-muted text-mono" style="padding:2rem 0">No comics found.</p>`;
  } catch (e) {
    container.innerHTML = `<p class="text-muted text-mono">Error loading comics.</p>`;
  }
}

// ── Genre Page ───────────────────────────────────────────────
async function loadGenrePage(genre) {
  if (!genre) return;
  const title = document.getElementById('genre-page-title');
  if (title) title.textContent = genre;
  const container = document.getElementById('genre-grid');
  if (!container) return;
  container.innerHTML = skeletons(8, 'skeleton-card');

  try {
    const [nd, cd] = await Promise.all([
      api(`/novels?genre=${encodeURIComponent(genre)}&limit=12`),
      api(`/comics?genre=${encodeURIComponent(genre)}&limit=12`),
    ]);
    const items = [
      ...(nd.novels||[]).map(n=>({...n,_type:'novel'})),
      ...(cd.comics||[]).map(c=>({...c,_type:'comic'})),
    ];
    container.innerHTML = items.length
      ? items.map(i => contentCardHTML(i, i._type)).join('')
      : `<p class="text-muted text-mono" style="padding:2rem 0">No content for this genre yet.</p>`;
  } catch (e) {
    container.innerHTML = `<p class="text-muted text-mono">Error loading genre content.</p>`;
  }
}

// ── Authors Page ─────────────────────────────────────────────
async function loadAuthors() {
  const container = document.getElementById('authors-grid');
  if (!container) return;
  container.innerHTML = `<div class="skeleton" style="height:200px"></div>`.repeat(6);

  try {
    const data = await api('/authors');
    const authors = data.authors || [];
    container.innerHTML = authors.length
      ? authors.map(a => authorCardHTML(a)).join('')
      : `<p class="text-muted text-mono" style="padding:2rem 0">No authors yet.</p>`;
  } catch (e) {
    container.innerHTML = `<p class="text-muted text-mono">Error loading authors.</p>`;
  }
}

function authorCardHTML(a) {
  const initials = (a.display_name || 'A').charAt(0).toUpperCase();
  return `
    <div class="author-card" onclick="showAuthorDetail('${a.id}')">
      ${a.photo_url
        ? `<img src="${a.photo_url}" class="author-photo" alt="${a.display_name}">`
        : `<div class="author-photo-placeholder">${initials}</div>`}
      <div class="author-name">${a.display_name || 'Anonymous'}</div>
      ${a.pen_name ? `<div class="author-pen-name">✒ ${a.pen_name}</div>` : ''}
      <div class="author-stats">
        <span>📖 ${a.novel_count||0} novels</span>
        <span>🖼 ${a.comic_count||0} comics</span>
      </div>
      ${a.avg_rating ? `<div class="card-rating mt-2 flex-center"><span class="stars">${starsHTML(a.avg_rating)}</span>&nbsp;<span class="text-mono" style="font-size:0.65rem">${a.avg_rating}</span></div>` : ''}
    </div>`;
}

async function showAuthorDetail(id) {
  try {
    const data = await api(`/authors?id=${id}`);
    const { author } = data;
    const modal = document.getElementById('author-modal');
    const content = document.getElementById('author-modal-content');
    const initials = (author.display_name||'A').charAt(0).toUpperCase();

    content.innerHTML = `
      <div class="profile-header" style="margin-bottom:1.5rem">
        ${author.photo_url
          ? `<img src="${author.photo_url}" class="profile-avatar" alt="${author.display_name}">`
          : `<div class="profile-avatar-placeholder">${initials}</div>`}
        <div>
          <div class="profile-name">${author.display_name || 'Anonymous'}</div>
          ${author.pen_name ? `<div class="profile-pen-name">✒ ${author.pen_name}</div>` : ''}
          ${author.bio ? `<div class="profile-bio mt-1">${author.bio}</div>` : ''}
          ${author.avg_rating ? `<div class="card-rating mt-2"><span class="stars">${starsHTML(author.avg_rating)}</span>&nbsp;${author.avg_rating} avg rating</div>` : ''}
        </div>
      </div>
      ${author.novels?.length ? `
        <div class="section-header"><span class="section-label">Novels</span></div>
        <div class="card-grid">${author.novels.map(n=>contentCardHTML(n,'novel')).join('')}</div>` : ''}
      ${author.comics?.length ? `
        <div class="section-header mt-3"><span class="section-label">Comics</span></div>
        <div class="card-grid">${author.comics.map(c=>contentCardHTML(c,'comic')).join('')}</div>` : ''}`;

    openModal('author-modal');
  } catch (e) {
    showToast('Failed to load author', 'error');
  }
}

// ── Profile Page ─────────────────────────────────────────────
async function loadProfile() {
  if (!State.user) {
    document.getElementById('profile-logged-out')?.classList.remove('hidden');
    document.getElementById('profile-content')?.classList.add('hidden');
    return;
  }

  document.getElementById('profile-logged-out')?.classList.add('hidden');
  document.getElementById('profile-content')?.classList.remove('hidden');

  try {
    const data = await api('/profile');
    const p = data.profile;
    const el = id => document.getElementById(id);

    const initials = (p.display_name||'A').charAt(0).toUpperCase();
    const avatarEl = el('profile-avatar-img');
    const avatarPlaceholder = el('profile-avatar-placeholder');

    if (p.photo_url && avatarEl) {
      avatarEl.src = p.photo_url;
      avatarEl.style.display = 'block';
      avatarPlaceholder && (avatarPlaceholder.style.display = 'none');
    } else {
      avatarEl && (avatarEl.style.display = 'none');
      avatarPlaceholder && (avatarPlaceholder.textContent = initials);
    }

    if (el('profile-name')) el('profile-name').textContent = p.display_name || '';
    if (el('profile-pen')) el('profile-pen').textContent = p.pen_name ? `✒ ${p.pen_name}` : '';
    if (el('profile-email')) el('profile-email').textContent = p.email || '';
    if (el('profile-bio')) el('profile-bio').textContent = p.bio || '';
    if (el('profile-role')) {
      el('profile-role').textContent = p.role === 'admin' ? '⚡ ADMIN' : 'USER';
      el('profile-role').style.display = 'block';
    }

    // Fill edit form
    if (el('edit-display-name')) el('edit-display-name').value = p.display_name || '';
    if (el('edit-pen-name')) el('edit-pen-name').value = p.pen_name || '';
    if (el('edit-bio')) el('edit-bio').value = p.bio || '';
    if (el('edit-photo-url')) el('edit-photo-url').value = p.photo_url || '';

    // Load bookmarks
    loadBookmarks();
  } catch (e) {
    showToast('Failed to load profile', 'error');
  }
}

async function saveProfile() {
  const display_name = document.getElementById('edit-display-name')?.value;
  const pen_name = document.getElementById('edit-pen-name')?.value;
  const bio = document.getElementById('edit-bio')?.value;
  const photo_url = document.getElementById('edit-photo-url')?.value;

  try {
    await api('/profile', { method: 'PATCH', body: { display_name, pen_name, bio, photo_url } });
    showToast('Profile updated!', 'success');
    loadProfile();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function loadBookmarks() {
  const container = document.getElementById('bookmarks-list');
  if (!container) return;

  try {
    const data = await api('/bookmarks');
    const bookmarks = data.bookmarks || [];
    container.innerHTML = bookmarks.length
      ? bookmarks.map(b => `
          <div class="pending-item">
            <div class="pending-item-info">
              <div class="pending-item-title">${b.title || 'Unknown'}</div>
              <div class="pending-item-meta">${b.content_type.toUpperCase()} · Chapter ${b.chapter||0} · ${b.progress_percent||0}%</div>
            </div>
            <div class="pending-actions">
              <button class="btn btn-sm btn-ghost" onclick="navigateTo('reader',{id:'${b.content_id}',type:'${b.content_type}'})">Read</button>
              <button class="btn btn-sm btn-danger" onclick="removeBookmark('${b.content_id}','${b.content_type}')">✕</button>
            </div>
          </div>`).join('')
      : `<p class="text-muted text-mono" style="padding:1rem 0">No bookmarks yet.</p>`;
  } catch (e) {
    container.innerHTML = `<p class="text-muted text-mono">Error loading bookmarks.</p>`;
  }
}

async function removeBookmark(content_id, content_type) {
  try {
    await api(`/bookmarks?content_id=${content_id}&content_type=${content_type}`, { method: 'DELETE' });
    showToast('Bookmark removed');
    loadBookmarks();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ── Reader ───────────────────────────────────────────────────
async function loadReader(id, type) {
  const container = document.getElementById('reader-container');
  if (!container) return;
  container.innerHTML = `<div class="skeleton" style="height:60vh"></div>`;

  try {
    const endpoint = type === 'novel' ? `/novels/${id}` : `/comics/${id}`;
    const data = await api(endpoint);
    const item = data.novel || data.comic;

    if (type === 'novel') {
      renderNovelReader(item);
    } else {
      renderComicReader(item);
    }

    // Load user rating
    if (State.user) {
      try {
        const rData = await api(`/ratings?content_id=${id}&content_type=${type}`);
        setStarRating(rData.rating, id, type);
      } catch(e) {}
    }

  } catch (e) {
    container.innerHTML = `<p class="text-muted text-mono">Content not found or still pending approval.</p>`;
  }
}

function renderNovelReader(novel) {
  const container = document.getElementById('reader-container');
  const chapters = Array.isArray(novel.content) ? novel.content : [{ title: 'Chapter 1', body: novel.content }];

  let currentChapter = 0;
  const render = (idx) => {
    const ch = chapters[idx] || chapters[0];
    const body = typeof ch === 'string' ? ch : (ch.body || ch);
    container.innerHTML = `
      <div style="max-width:720px;margin:0 auto;padding:3rem 1rem">
        <div class="section-header">
          <div>
            <span class="section-label">Novel</span>
            <h2>${novel.title}</h2>
          </div>
        </div>
        <div class="text-mono text-muted mb-4" style="font-size:0.68rem">
          by ${novel.author_name || 'Unknown'} · Chapter ${idx+1} of ${chapters.length}
        </div>
        <div class="divider"></div>
        <div class="reader-content" id="novel-body">${typeof body === 'string' ? body.split('\n').map(p=>p?`<p>${p}</p>`:'').join('') : ''}</div>
        <div class="chapter-nav">
          <button class="btn btn-outline btn-sm" onclick="changeChapter(${idx-1})" ${idx===0?'disabled':''}>← Previous</button>
          <span class="text-mono text-muted" style="font-size:0.65rem">Ch. ${idx+1} / ${chapters.length}</span>
          <button class="btn btn-primary btn-sm" onclick="changeChapter(${idx+1})" ${idx===chapters.length-1?'disabled':''}>Next →</button>
        </div>
        ${ratingWidgetHTML(novel.id, 'novel', novel.rating_avg, novel.rating_count)}
        ${bookmarkButtonHTML(novel.id, 'novel')}
      </div>`;

    if (State.user) {
      saveProgress(novel.id, idx);
    }
  };

  window.changeChapter = (idx) => {
    if (idx < 0 || idx >= chapters.length) return;
    currentChapter = idx;
    render(idx);
    window.scrollTo(0, 0);
  };

  render(0);
}

function renderComicReader(comic) {
  const container = document.getElementById('reader-container');
  const images = comic.image_urls || [];

  container.innerHTML = `
    <div style="max-width:800px;margin:0 auto;padding:2rem 1rem">
      <div class="section-header">
        <div>
          <span class="section-label">Comic</span>
          <h2>${comic.title}</h2>
        </div>
      </div>
      <div class="text-mono text-muted mb-4" style="font-size:0.68rem">
        by ${comic.author_name || 'Unknown'} · ${images.length} pages
      </div>
      <div style="display:flex;flex-direction:column;gap:0.5rem;margin:2rem 0">
        ${images.length
          ? images.map((url, i) => `<img src="${url}" alt="Page ${i+1}" style="width:100%;display:block;border:1px solid var(--border-subtle)">`).join('')
          : `<p class="text-muted text-mono text-center" style="padding:3rem">No pages uploaded yet.</p>`}
      </div>
      ${ratingWidgetHTML(comic.id, 'comic', comic.rating_avg, comic.rating_count)}
      ${bookmarkButtonHTML(comic.id, 'comic')}
    </div>`;
}

function ratingWidgetHTML(id, type, avg, count) {
  return `
    <div class="divider"></div>
    <div style="padding:1.5rem 0">
      <div class="section-label" style="margin-bottom:0.75rem">Rate This ${type === 'novel' ? 'Novel' : 'Comic'}</div>
      <div class="rating-widget" id="rating-widget-${id}">
        ${[1,2,3,4,5].map(n => `<span class="rating-star" data-val="${n}" onclick="submitRating('${id}','${type}',${n})">★</span>`).join('')}
      </div>
      <div class="card-rating mt-2" id="rating-display-${id}">
        <span class="stars">${starsHTML(avg)}</span>
        <span class="text-mono" style="font-size:0.68rem">${(avg||0).toFixed(1)} (${count||0} ratings)</span>
      </div>
    </div>`;
}

function bookmarkButtonHTML(id, type) {
  if (!State.user) return `<p class="text-mono text-muted" style="font-size:0.68rem">Login to bookmark</p>`;
  return `
    <button class="btn btn-outline btn-sm" id="bookmark-btn-${id}" onclick="toggleBookmark('${id}','${type}')">
      🔖 Bookmark
    </button>`;
}

async function submitRating(contentId, contentType, rating) {
  if (!State.user) { showToast('Login to rate', 'error'); return; }

  try {
    const data = await api('/ratings', { method: 'POST', body: { content_id: contentId, content_type: contentType, rating } });
    showToast('Rating submitted!', 'success');
    setStarRating(rating, contentId, contentType);
    const display = document.getElementById(`rating-display-${contentId}`);
    if (display) {
      display.innerHTML = `<span class="stars">${starsHTML(data.rating_avg)}</span><span class="text-mono" style="font-size:0.68rem">${data.rating_avg} (${data.rating_count} ratings)</span>`;
    }
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function setStarRating(rating, id) {
  const widget = document.getElementById(`rating-widget-${id}`);
  if (!widget || !rating) return;
  widget.querySelectorAll('.rating-star').forEach(s => {
    s.classList.toggle('filled', parseInt(s.dataset.val) <= rating);
  });
}

async function toggleBookmark(contentId, contentType) {
  try {
    await api('/bookmarks', { method: 'POST', body: { content_id: contentId, content_type: contentType } });
    showToast('Bookmarked!', 'success');
    const btn = document.getElementById(`bookmark-btn-${contentId}`);
    if (btn) btn.textContent = '🔖 Bookmarked';
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function saveProgress(novelId, chapterIndex) {
  try {
    await api('/progress', { method: 'POST', body: { novel_id: novelId, chapter_index: chapterIndex } });
  } catch(e) {}
}

// ── Upload Page ──────────────────────────────────────────────
function loadUploadPage() {
  const container = document.getElementById('upload-genres');
  if (!container) return;
  container.innerHTML = GENRES.map(g => `
    <input type="checkbox" class="genre-checkbox" id="genre-${g}" value="${g}" name="genres">
    <label for="genre-${g}">${g}</label>`).join('');
}

async function submitNovel(e) {
  e.preventDefault();
  if (!State.user) { showToast('Login required', 'error'); return; }

  const title = document.getElementById('novel-title')?.value;
  const synopsis = document.getElementById('novel-synopsis')?.value;
  const content = document.getElementById('novel-content')?.value;
  const cover_url = document.getElementById('novel-cover')?.value;
  const genre = [...document.querySelectorAll('.genre-checkbox:checked')].map(c => c.value);

  if (!title || !content) { showToast('Title and content required', 'error'); return; }

  try {
    const btn = document.getElementById('submit-novel-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }

    await api('/novels', { method: 'POST', body: { title, synopsis, content, cover_url, genre } });
    showToast('Novel submitted! Awaiting admin approval.', 'success');
    document.getElementById('upload-novel-form')?.reset();
    if (btn) { btn.disabled = false; btn.textContent = 'Submit for Review'; }
  } catch (e) {
    showToast(e.message, 'error');
    const btn = document.getElementById('submit-novel-btn');
    if (btn) { btn.disabled = false; btn.textContent = 'Submit for Review'; }
  }
}

async function submitComic(e) {
  e.preventDefault();
  if (!State.user) { showToast('Login required', 'error'); return; }

  const title = document.getElementById('comic-title')?.value;
  const synopsis = document.getElementById('comic-synopsis')?.value;
  const cover_url = document.getElementById('comic-cover')?.value;
  const images_raw = document.getElementById('comic-images')?.value;
  const genre = [...document.querySelectorAll('.genre-checkbox:checked')].map(c => c.value);
  const image_urls = images_raw ? images_raw.split('\n').map(s=>s.trim()).filter(Boolean) : [];

  try {
    await api('/comics', { method: 'POST', body: { title, synopsis, cover_url, image_urls, genre } });
    showToast('Comic submitted! Awaiting admin approval.', 'success');
    document.getElementById('upload-comic-form')?.reset();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ── Admin Page ───────────────────────────────────────────────
async function loadAdmin() {
  if (!State.user || State.user.email !== CONFIG.ADMIN_EMAIL) {
    navigateTo('home');
    return;
  }

  const container = document.getElementById('admin-content');
  if (!container) return;
  container.innerHTML = `<div class="skeleton" style="height:300px"></div>`;

  try {
    const data = await api('/admin?type=pending');
    renderAdminStats(data.stats);
    renderPendingList(data.novels, 'novel', 'pending-novels-list');
    renderPendingList(data.comics, 'comic', 'pending-comics-list');
    container.classList.remove('hidden');
  } catch (e) {
    container.innerHTML = `<p class="text-muted text-mono">Error loading admin data.</p>`;
  }
}

function renderAdminStats(stats) {
  const s = document.getElementById('admin-stats');
  if (!s || !stats) return;
  s.innerHTML = `
    <div class="stat-card"><div class="stat-value">${stats.total_users||0}</div><div class="stat-label">Total Users</div></div>
    <div class="stat-card"><div class="stat-value">${stats.approved_novels||0}</div><div class="stat-label">Live Novels</div></div>
    <div class="stat-card"><div class="stat-value">${stats.pending_novels||0}</div><div class="stat-label">Novels Pending</div></div>
    <div class="stat-card"><div class="stat-value">${stats.approved_comics||0}</div><div class="stat-label">Live Comics</div></div>
    <div class="stat-card"><div class="stat-value">${stats.pending_comics||0}</div><div class="stat-label">Comics Pending</div></div>
    <div class="stat-card"><div class="stat-value">${stats.total_ratings||0}</div><div class="stat-label">Total Ratings</div></div>`;
}

function renderPendingList(items, type, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!items?.length) { el.innerHTML = `<p class="text-muted text-mono" style="padding:1rem 0">Nothing pending.</p>`; return; }

  el.innerHTML = items.map(item => `
    <div class="pending-item" id="pending-${item.id}">
      <div style="width:40px;height:56px;background:var(--bg-elevated);border:1px solid var(--border-subtle);overflow:hidden;flex-shrink:0">
        ${item.cover_url ? `<img src="${item.cover_url}" style="width:100%;height:100%;object-fit:cover">` : ''}
      </div>
      <div class="pending-item-info">
        <div class="pending-item-title">${item.title}</div>
        <div class="pending-item-meta">by ${item.author_name||'Unknown'} (${item.author_email||''}) · ${(item.genre||[]).join(', ')||'No genre'}</div>
      </div>
      <div class="pending-actions">
        <button class="btn btn-sm btn-ghost" onclick="approveContent('${item.id}','${type}','approve')">✓ Approve</button>
        <button class="btn btn-sm btn-danger" onclick="approveContent('${item.id}','${type}','reject')">✕ Reject</button>
        <button class="btn btn-sm btn-outline" onclick="deleteContent('${item.id}','${type}')">🗑</button>
      </div>
    </div>`).join('');
}

async function approveContent(id, type, action) {
  try {
    await api(`/${type}s/${id}?action=${action}`, { method: 'PATCH' });
    showToast(`${type} ${action}d!`, 'success');
    document.getElementById(`pending-${id}`)?.remove();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function deleteContent(id, type) {
  if (!confirm('Delete this content permanently?')) return;
  try {
    await api(`/${type}s/${id}`, { method: 'DELETE' });
    showToast('Deleted', 'success');
    document.getElementById(`pending-${id}`)?.remove();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ── Search ───────────────────────────────────────────────────
let searchDebounce = null;

function onSearchInput(e) {
  const q = e.target.value.trim();
  const dropdown = document.getElementById('search-results');

  clearTimeout(searchDebounce);
  if (q.length < 2) { dropdown && dropdown.classList.remove('open'); return; }

  searchDebounce = setTimeout(async () => {
    try {
      const data = await api(`/search?q=${encodeURIComponent(q)}`);
      renderSearchResults(data.results || [], dropdown);

      // Save to history
      if (!State.searchHistory.includes(q)) {
        State.searchHistory.unshift(q);
        State.searchHistory = State.searchHistory.slice(0, 10);
        localStorage.setItem('pvm_search_history', JSON.stringify(State.searchHistory));
      }
    } catch (e) {
      if (dropdown) dropdown.classList.remove('open');
    }
  }, 300);
}

function renderSearchResults(results, dropdown) {
  if (!dropdown) return;
  if (!results.length) { dropdown.classList.remove('open'); return; }

  dropdown.innerHTML = results.map(r => `
    <div class="search-item" onclick="navigateTo('reader',{id:'${r.id}',type:'${r.type}'})">
      <div style="width:36px;height:50px;background:var(--bg-elevated);overflow:hidden;flex-shrink:0">
        ${r.cover_url ? `<img src="${r.cover_url}" class="search-item-cover" style="width:100%;height:100%;object-fit:cover">` : ''}
      </div>
      <div class="search-item-info">
        <div class="search-item-title">${r.title}</div>
        <div class="search-item-meta">by ${r.author_name||'Unknown'} · ★ ${(r.rating_avg||0).toFixed(1)}</div>
      </div>
      <span class="search-type-badge badge-${r.type}">${r.type}</span>
    </div>`).join('');

  dropdown.classList.add('open');
}

// Close search on outside click
document.addEventListener('click', (e) => {
  if (!e.target.closest('.nav-search')) {
    document.getElementById('search-results')?.classList.remove('open');
  }
});

// ── Genre Tags on Home ───────────────────────────────────────
function buildGenreList() {
  const container = document.getElementById('genre-chips');
  if (!container) return;
  container.innerHTML = GENRES.map(g => `
    <button class="filter-chip" onclick="navigateTo('genre',{genre:'${g}'})">${g}</button>`).join('');
}

// ── Utility ──────────────────────────────────────────────────
function contentCardHTML(item, type) {
  const genres = (item.genre || []).slice(0, 2).map(g => `<span class="genre-tag">${g}</span>`).join('');
  return `
    <div class="content-card" onclick="navigateTo('reader',{id:'${item.id}',type:'${type}'})">
      <div class="card-cover-wrap">
        ${item.cover_url
          ? `<img src="${item.cover_url}" class="card-cover" alt="${item.title}" loading="lazy">`
          : `<div class="card-cover-placeholder">${type === 'novel' ? '📖' : '🖼'}</div>`}
        <div class="card-overlay">
          <div class="card-quick-actions">
            <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();navigateTo('reader',{id:'${item.id}',type:'${type}'})">Read</button>
            ${State.user ? `<button class="btn btn-outline btn-sm" onclick="event.stopPropagation();toggleBookmark('${item.id}','${type}')">🔖</button>` : ''}
          </div>
        </div>
      </div>
      <div class="card-body">
        <div class="card-type">${type}</div>
        <div class="card-title">${item.title}</div>
        <div class="card-author">${item.author_name || item.pen_name || 'Unknown'}</div>
        <div class="card-genres">${genres}</div>
        <div class="card-rating">
          <span class="stars">${starsHTML(item.rating_avg)}</span>
          <span>${(item.rating_avg||0).toFixed(1)}</span>
        </div>
      </div>
    </div>`;
}

function starsHTML(avg) {
  const filled = Math.round(avg || 0);
  return '★'.repeat(filled) + '☆'.repeat(5 - filled);
}

function skeletons(n, cls = '') {
  return Array(n).fill(`<div class="skeleton ${cls}" style="min-height:280px;border:1px solid var(--border-subtle)"></div>`).join('');
}

function showToast(msg, type = '') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type ? 'toast-'+type : ''}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

// ── Modals ───────────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id)?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
  document.body.style.overflow = '';
}

// Close modal on backdrop click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-backdrop')) closeModal(e.target.id);
});

// ── Burger Menu ──────────────────────────────────────────────
function toggleBurger() {
  const btn = document.getElementById('burger-btn');
  const menu = document.getElementById('mobile-menu');
  const overlay = document.getElementById('mobile-overlay');

  btn?.classList.toggle('open');
  menu?.classList.toggle('open');
  overlay?.classList.toggle('open');
}

// ── Spotify Player ───────────────────────────────────────────
function toggleSpotify() {
  const player = document.getElementById('spotify-player');
  player?.classList.toggle('collapsed');
  const btn = document.getElementById('spotify-toggle-btn');
  if (btn) btn.textContent = player?.classList.contains('collapsed') ? '♪ MUSIC ▲' : '♪ MUSIC ▼';
}

// ── Tab Switching ────────────────────────────────────────────
function switchTab(groupId, tabId) {
  document.querySelectorAll(`[data-tab-group="${groupId}"] .tab-btn`).forEach(b => b.classList.remove('active'));
  document.querySelectorAll(`[data-tab-group="${groupId}"] .tab-panel`).forEach(p => p.classList.remove('active'));
  document.querySelector(`[data-tab-group="${groupId}"] [data-tab="${tabId}"]`)?.classList.add('active');
  document.getElementById(tabId)?.classList.add('active');
}

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initSupabase();
  buildGenreList();
  navigateTo('home');

  // Burger overlay click
  document.getElementById('mobile-overlay')?.addEventListener('click', toggleBurger);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop.open').forEach(m => closeModal(m.id));
      const menu = document.getElementById('mobile-menu');
      if (menu?.classList.contains('open')) toggleBurger();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      document.getElementById('nav-search-input')?.focus();
    }
  });
});
