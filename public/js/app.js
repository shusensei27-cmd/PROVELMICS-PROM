// ═══════════════════════════════════════════════════════════
// PROVELMICS — Main Application JS (dengan sistem chapter)
// ═══════════════════════════════════════════════════════════

// ── Config ──────────────────────────────────────────────────
const CONFIG = {
  SUPABASE_URL: 'https://erlolklvtjvgblggqhjf.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVybG9sa2x2dGp2Z2JsZ2dxaGpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzODAyMTUsImV4cCI6MjA5MDk1NjIxNX0.Mt5XxOAH4GMkzXlc_fQhtAryqDFiroyeri1I65T4LjY',
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
let supabaseClient = null;

function initSupabase() {
  if (window.supabase && CONFIG.SUPABASE_URL !== 'https://YOUR_SUPABASE_PROJECT.supabase.co') {
    supabaseClient = window.supabase.createClient(
      CONFIG.SUPABASE_URL, 
      CONFIG.SUPABASE_ANON_KEY,
      {
        auth: {
          clockSkewInSeconds: 7200,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true
        }
      }
    );
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
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
  if (!supabaseClient) return showToast('Supabase not configured. Set your credentials in app.js', 'error');
  await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  });
}

async function logout() {
  if (supabaseClient) await supabaseClient.auth.signOut();
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

  const mobileUserInfo = document.getElementById('mobile-user-info');
  const mobileActionBtns = document.getElementById('mobile-action-btns');
  const mobileLoginSection = document.getElementById('mobile-login-section');
  const mobileUserAvatar = document.getElementById('mobile-user-avatar');
  const mobileUserName = document.getElementById('mobile-user-name');
  const mobileUserEmail = document.getElementById('mobile-user-email');

  if (State.user) {
    loginBtn && loginBtn.classList.add('hidden');
    userMenu && userMenu.classList.remove('hidden');

    const photo = State.dbUser?.photo_url || State.user.user_metadata?.avatar_url;
    if (photo && userAvatar) {
      userAvatar.src = photo;
      userAvatar.style.display = 'block';
    }

    mobileUserInfo && mobileUserInfo.classList.remove('hidden');
    mobileActionBtns && mobileActionBtns.classList.remove('hidden');
    if (mobileLoginSection) mobileLoginSection.style.display = 'none';

    if (photo && mobileUserAvatar) {
      mobileUserAvatar.src = photo;
      mobileUserAvatar.style.display = 'block';
    }

    const name = State.dbUser?.display_name || State.user.user_metadata?.full_name || 'User';
    const email = State.user.email || '';
    if (mobileUserName) mobileUserName.textContent = name;
    if (mobileUserEmail) mobileUserEmail.textContent = email;

    const isAdmin = State.user.email === CONFIG.ADMIN_EMAIL;
    adminLink && (adminLink.style.display = isAdmin ? 'block' : 'none');
    mobileAdminLink && (mobileAdminLink.style.display = isAdmin ? 'block' : 'none');

  } else {
    loginBtn && loginBtn.classList.remove('hidden');
    userMenu && userMenu.classList.add('hidden');

    mobileUserInfo && mobileUserInfo.classList.add('hidden');
    mobileActionBtns && mobileActionBtns.classList.add('hidden');
    if (mobileLoginSection) mobileLoginSection.style.display = 'block';

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

    if (el('edit-display-name')) el('edit-display-name').value = p.display_name || '';
    if (el('edit-pen-name')) el('edit-pen-name').value = p.pen_name || '';
    if (el('edit-bio')) el('edit-bio').value = p.bio || '';
    if (el('edit-photo-url')) el('edit-photo-url').value = p.photo_url || '';

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

// ═══════════════════════════════════════════════════════════
// SISTEM CHAPTER BARU (Cover + Daftar Chapter, Upload Chapter)
// ═══════════════════════════════════════════════════════════

// ── PERBAIKAN loadReader (menggunakan fetch langsung dan logging) ──
async function loadReader(id, type) {
  const container = document.getElementById('reader-container');
  if (!container) return;
  container.innerHTML = `<div class="skeleton" style="height:60vh"></div>`;

  try {
    const endpoint = type === 'novel' 
      ? `/novels/${id}` 
      : `/comics/${id}`;
    
    const response = await fetch(`${CONFIG.API_BASE}${endpoint}`, {
      headers: State.token 
        ? { 'Authorization': `Bearer ${State.token}` } 
        : {}
    });
    
    const data = await response.json();
    console.log('Reader data:', data);

    if (!response.ok) throw new Error(data.error || 'Failed to load');

    const item = data.novel || data.comic;
    const chapters = data.chapters || [];

    if (!item) throw new Error('Content not found');

    if (type === 'novel') {
      renderNovelCover(item, chapters);
    } else {
      renderComicCover(item, chapters);
    }

    if (State.user && State.token) {
      try {
        const rData = await api(`/ratings?content_id=${id}&content_type=${type}`);
        if (rData.rating) setStarRating(rData.rating, id);
      } catch(e) {}
    }

  } catch (e) {
    console.error('loadReader error:', e);
    container.innerHTML = `
      <div style="padding:3rem;text-align:center">
        <p class="text-muted text-mono">Error: ${e.message}</p>
        <button class="btn btn-outline btn-sm" style="margin-top:1rem" 
                onclick="navigateTo('home')">← Kembali</button>
      </div>`;
  }
}

// ── PERBAIKAN renderNovelCover (fallback ke novel.content jika chapters kosong) ──
function renderNovelCover(novel, chapters) {
  const container = document.getElementById('reader-container');
  // Gabungkan chapters dari tabel baru + content lama
  let allChapters = [];
  if (chapters && chapters.length > 0) {
    allChapters = chapters;
  } else if (novel.content) {
    // Fallback ke content lama (untuk novel yang belum punya struktur chapter)
    const contentStr = typeof novel.content === 'string' 
      ? novel.content 
      : JSON.stringify(novel.content);
    allChapters = [{ 
      id: 'ch0', 
      chapter_number: 1, 
      title: 'Chapter 1', 
      content: contentStr 
    }];
  }
  const genres = (novel.genre || []).map(g => `<span class="genre-tag">${g}</span>`).join('');
  container.innerHTML = `
    <div style="max-width:800px;margin:0 auto;padding:2rem 1rem">
      <div style="display:flex;gap:2rem;margin-bottom:3rem;flex-wrap:wrap">
        <div style="width:200px;flex-shrink:0">
          ${novel.cover_url ? `<img src="${novel.cover_url}" style="width:100%;aspect-ratio:3/4;object-fit:cover;border:1px solid var(--border-glow);box-shadow:var(--glow-gold)">` : `<div style="width:100%;aspect-ratio:3/4;background:var(--bg-elevated);border:1px solid var(--border-subtle);display:flex;align-items:center;justify-content:center;font-size:4rem">📖</div>`}
        </div>
        <div style="flex:1;min-width:200px">
          <span class="section-label">Novel</span>
          <h2 style="margin:0.3rem 0 0.5rem">${novel.title}</h2>
          <p style="color:var(--text-secondary);font-family:var(--font-mono);font-size:0.75rem;margin-bottom:0.75rem">oleh ${novel.author_name || novel.pen_name || 'Unknown'}</p>
          <div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-bottom:1rem">${genres}</div>
          ${novel.synopsis ? `<p style="color:var(--text-secondary);font-size:0.95rem;line-height:1.7;margin-bottom:1rem">${novel.synopsis}</p>` : ''}
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
            <div style="font-family:var(--font-mono);font-size:0.68rem;color:var(--text-muted)">★ ${(novel.rating_avg||0).toFixed(1)} · ${novel.rating_count||0} rating</div>
            <div style="font-family:var(--font-mono);font-size:0.68rem;color:var(--text-muted)">· ${allChapters.length} chapter</div>
          </div>
          <div style="margin-top:1.5rem;display:flex;gap:0.75rem;flex-wrap:wrap">
            ${allChapters.length > 0 ? `<button class="btn btn-primary" onclick="openNovelChapter('${novel.id}',0,${JSON.stringify(allChapters).replace(/"/g, '&quot;')})">Baca Chapter 1 →</button>` : ''}
            ${State.user ? `<button class="btn btn-outline btn-sm" id="bookmark-btn-${novel.id}" onclick="toggleBookmark('${novel.id}','novel')">🔖 Bookmark</button>` : ''}
          </div>
        </div>
      </div>
      ${ratingWidgetHTML(novel.id, 'novel', novel.rating_avg, novel.rating_count)}
      <div class="divider"></div>
      <div style="margin-top:1.5rem">
        <div class="section-header"><span class="section-label">Daftar Chapter</span></div>
        ${allChapters.length > 0 ? `<div style="display:flex;flex-direction:column;gap:0.4rem">${allChapters.map((ch, idx) => `<div class="pending-item" style="cursor:pointer" onclick="openNovelChapter('${novel.id}',${idx},${JSON.stringify(allChapters).replace(/"/g, '&quot;')})"><div style="flex:1"><div style="font-family:var(--font-display);font-size:0.85rem">Chapter ${ch.chapter_number}: ${ch.title || 'Tanpa Judul'}</div><div style="font-family:var(--font-mono);font-size:0.62rem;color:var(--text-muted);margin-top:2px">${ch.created_at ? new Date(ch.created_at).toLocaleDateString('id-ID') : ''}</div></div><span style="font-family:var(--font-mono);font-size:0.7rem;color:var(--accent-gold)">Baca →</span></div>`).join('')}</div>` : `<p class="text-muted text-mono">Belum ada chapter.</p>`}
      </div>
    </div>`;
}

function openNovelChapter(novelId, chapterIdx, chapters) {
  if (typeof chapters === 'string') { try { chapters = JSON.parse(chapters); } catch { chapters = []; } }
  const container = document.getElementById('reader-container');
  const ch = chapters[chapterIdx];
  if (!ch) return;
  const body = ch.content || '';
  container.innerHTML = `
    <div style="max-width:720px;margin:0 auto;padding:2rem 1rem">
      <button class="btn btn-outline btn-sm" style="margin-bottom:1.5rem" onclick="loadReader('${novelId}','novel')">← Kembali ke Daftar Chapter</button>
      <div class="section-header"><div><span class="section-label">Chapter ${ch.chapter_number}</span><h2>${ch.title || 'Chapter ' + ch.chapter_number}</h2></div></div>
      <div class="divider"></div>
      <div class="reader-content" style="margin-top:1.5rem">${body.split('\n').map(p => p.trim() ? `<p>${p}</p>` : '').join('')}</div>
      <div class="chapter-nav" style="margin-top:3rem">
        <button class="btn btn-outline btn-sm" ${chapterIdx === 0 ? 'disabled' : ''} onclick="openNovelChapter('${novelId}',${chapterIdx-1},${JSON.stringify(chapters).replace(/"/g, '&quot;')})">← Chapter Sebelumnya</button>
        <span class="text-mono text-muted" style="font-size:0.65rem">${chapterIdx+1} / ${chapters.length}</span>
        <button class="btn btn-primary btn-sm" ${chapterIdx === chapters.length-1 ? 'disabled' : ''} onclick="openNovelChapter('${novelId}',${chapterIdx+1},${JSON.stringify(chapters).replace(/"/g, '&quot;')})">Chapter Berikutnya →</button>
      </div>
    </div>`;
  window.scrollTo(0, 0);
  if (State.user) saveProgress(novelId, chapterIdx);
}

// ── renderComicCover (dengan fallback serupa) ──
function renderComicCover(comic, chapters) {
  const container = document.getElementById('reader-container');
  const genres = (comic.genre || []).map(g => `<span class="genre-tag">${g}</span>`).join('');
  let allChapters = [];
  if (chapters && chapters.length > 0) {
    allChapters = chapters;
  } else if (comic.image_urls && comic.image_urls.length > 0) {
    allChapters = [{ id: 'ch0', chapter_number: 1, title: 'Chapter 1', image_urls: comic.image_urls }];
  }
  container.innerHTML = `
    <div style="max-width:800px;margin:0 auto;padding:2rem 1rem">
      <div style="display:flex;gap:2rem;margin-bottom:3rem;flex-wrap:wrap">
        <div style="width:200px;flex-shrink:0">
          ${comic.cover_url ? `<img src="${comic.cover_url}" style="width:100%;aspect-ratio:3/4;object-fit:cover;border:1px solid var(--border-glow);box-shadow:var(--glow-gold)">` : `<div style="width:100%;aspect-ratio:3/4;background:var(--bg-elevated);border:1px solid var(--border-subtle);display:flex;align-items:center;justify-content:center;font-size:4rem">🖼</div>`}
        </div>
        <div style="flex:1;min-width:200px">
          <span class="section-label">Komik</span>
          <h2 style="margin:0.3rem 0 0.5rem">${comic.title}</h2>
          <p style="color:var(--text-secondary);font-family:var(--font-mono);font-size:0.75rem;margin-bottom:0.75rem">oleh ${comic.author_name || comic.pen_name || 'Unknown'}</p>
          <div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-bottom:1rem">${genres}</div>
          ${comic.synopsis ? `<p style="color:var(--text-secondary);font-size:0.95rem;line-height:1.7;margin-bottom:1rem">${comic.synopsis}</p>` : ''}
          <div style="font-family:var(--font-mono);font-size:0.68rem;color:var(--text-muted)">★ ${(comic.rating_avg||0).toFixed(1)} · ${comic.rating_count||0} rating · ${allChapters.length} chapter</div>
          <div style="margin-top:1.5rem;display:flex;gap:0.75rem;flex-wrap:wrap">
            ${allChapters.length > 0 ? `<button class="btn btn-primary" onclick="openComicChapter('${comic.id}',0,${JSON.stringify(allChapters).replace(/"/g, '&quot;')})">Baca Chapter 1 →</button>` : ''}
            ${State.user ? `<button class="btn btn-outline btn-sm" onclick="toggleBookmark('${comic.id}','comic')">🔖 Bookmark</button>` : ''}
          </div>
        </div>
      </div>
      ${ratingWidgetHTML(comic.id, 'comic', comic.rating_avg, comic.rating_count)}
      <div class="divider"></div>
      <div style="margin-top:1.5rem">
        <div class="section-header"><span class="section-label">Daftar Chapter</span></div>
        ${allChapters.length > 0 ? `<div style="display:flex;flex-direction:column;gap:0.4rem">${allChapters.map((ch, idx) => `<div class="pending-item" style="cursor:pointer" onclick="openComicChapter('${comic.id}',${idx},${JSON.stringify(allChapters).replace(/"/g, '&quot;')})"><div style="flex:1"><div style="font-family:var(--font-display);font-size:0.85rem">Chapter ${ch.chapter_number}: ${ch.title || 'Tanpa Judul'}</div><div style="font-family:var(--font-mono);font-size:0.62rem;color:var(--text-muted);margin-top:2px">${Array.isArray(ch.image_urls) ? ch.image_urls.length : 0} halaman${ch.created_at ? ' · ' + new Date(ch.created_at).toLocaleDateString('id-ID') : ''}</div></div><span style="font-family:var(--font-mono);font-size:0.7rem;color:var(--accent-gold)">Baca →</span></div>`).join('')}</div>` : `<p class="text-muted text-mono">Belum ada chapter.</p>`}
      </div>
    </div>`;
}

function openComicChapter(comicId, chapterIdx, chapters) {
  if (typeof chapters === 'string') { try { chapters = JSON.parse(chapters); } catch { chapters = []; } }
  const container = document.getElementById('reader-container');
  const ch = chapters[chapterIdx];
  if (!ch) return;
  const images = Array.isArray(ch.image_urls) ? ch.image_urls : [];
  container.innerHTML = `
    <div style="max-width:800px;margin:0 auto;padding:2rem 1rem">
      <button class="btn btn-outline btn-sm" style="margin-bottom:1.5rem" onclick="loadReader('${comicId}','comic')">← Kembali ke Daftar Chapter</button>
      <div class="section-header"><div><span class="section-label">Chapter ${ch.chapter_number}</span><h2>${ch.title || 'Chapter ' + ch.chapter_number}</h2></div></div>
      <div style="display:flex;flex-direction:column;gap:4px;margin:1.5rem 0">
        ${images.length > 0 ? images.map((url, i) => `<img src="${url}" alt="Halaman ${i+1}" style="width:100%;display:block;border:none" loading="lazy" onerror="this.style.display='none'">`).join('') : `<p class="text-muted text-mono text-center" style="padding:3rem">Halaman tidak ditemukan. Pastikan URL gambar benar.</p>`}
      </div>
      <div class="chapter-nav">
        <button class="btn btn-outline btn-sm" ${chapterIdx === 0 ? 'disabled' : ''} onclick="openComicChapter('${comicId}',${chapterIdx-1},${JSON.stringify(chapters).replace(/"/g, '&quot;')})">← Chapter Sebelumnya</button>
        <span class="text-mono text-muted" style="font-size:0.65rem">${chapterIdx+1} / ${chapters.length}</span>
        <button class="btn btn-primary btn-sm" ${chapterIdx === chapters.length-1 ? 'disabled' : ''} onclick="openComicChapter('${comicId}',${chapterIdx+1},${JSON.stringify(chapters).replace(/"/g, '&quot;')})">Chapter Berikutnya →</button>
      </div>
    </div>`;
  window.scrollTo(0, 0);
}

// ── Upload Page dengan History ───────────────────────────────
async function loadUploadPage() {
  const container = document.getElementById('upload-genres');
  if (!container) return;
  container.innerHTML = GENRES.map(g => `
    <input type="checkbox" class="genre-checkbox" id="genre-${g}" value="${g}" name="genres">
    <label for="genre-${g}">${g}</label>`).join('');
  if (State.user) await loadUploadHistory();
}

async function loadUploadHistory() {
  const historyContainer = document.getElementById('upload-history');
  if (!historyContainer) return;
  historyContainer.innerHTML = `<div class="skeleton" style="height:100px"></div>`;
  try {
    const userId = State.user.sub || State.user.id;
    const [novelsData, comicsData] = await Promise.all([
      api(`/novels?author_id=${userId}&limit=20`),
      api(`/comics?author_id=${userId}&limit=20`)
    ]);
    const myNovels = novelsData.novels || [];
    const myComics = comicsData.comics || [];
    if (myNovels.length === 0 && myComics.length === 0) {
      historyContainer.innerHTML = `<p class="text-muted text-mono" style="padding:1rem 0">Belum ada karya yang diupload.</p>`;
      return;
    }
    historyContainer.innerHTML = `<div style="display:flex;flex-direction:column;gap:0.5rem">
      ${myNovels.map(n => `<div class="pending-item"><div style="width:36px;height:50px;background:var(--bg-elevated);overflow:hidden;flex-shrink:0">${n.cover_url ? `<img src="${n.cover_url}" style="width:100%;height:100%;object-fit:cover">` : '📖'}</div><div class="pending-item-info"><div class="pending-item-title">${n.title}</div><div class="pending-item-meta">Novel · <span style="color:${n.status==='approved'?'var(--accent-pixel)':n.status==='pending'?'var(--accent-amber)':'var(--accent-ember)'}">${n.status}</span></div></div><div class="pending-actions">${n.status === 'approved' ? `<button class="btn btn-sm btn-primary" onclick="showAddChapterForm('${n.id}','novel','${n.title}')">+ Chapter</button>` : `<span class="text-mono" style="font-size:0.62rem;color:var(--text-muted)">Menunggu approval</span>`}</div></div>`).join('')}
      ${myComics.map(c => `<div class="pending-item"><div style="width:36px;height:50px;background:var(--bg-elevated);overflow:hidden;flex-shrink:0">${c.cover_url ? `<img src="${c.cover_url}" style="width:100%;height:100%;object-fit:cover">` : '🖼'}</div><div class="pending-item-info"><div class="pending-item-title">${c.title}</div><div class="pending-item-meta">Komik · <span style="color:${c.status==='approved'?'var(--accent-pixel)':c.status==='pending'?'var(--accent-amber)':'var(--accent-ember)'}">${c.status}</span></div></div><div class="pending-actions">${c.status === 'approved' ? `<button class="btn btn-sm btn-primary" onclick="showAddChapterForm('${c.id}','comic','${c.title}')">+ Chapter</button>` : `<span class="text-mono" style="font-size:0.62rem;color:var(--text-muted)">Menunggu approval</span>`}</div></div>`).join('')}
    </div>`;
  } catch(e) {
    historyContainer.innerHTML = `<p class="text-muted text-mono">Gagal memuat history.</p>`;
  }
}

function showAddChapterForm(contentId, type, title) {
  const modal = document.getElementById('author-modal');
  const content = document.getElementById('author-modal-content');
  content.innerHTML = `<h3 style="margin-bottom:1.5rem">Tambah Chapter Baru</h3><p class="text-mono text-muted" style="font-size:0.7rem;margin-bottom:1.5rem">${type === 'novel' ? '📖' : '🖼'} ${title}</p>
    <div class="form-group"><label class="form-label">Judul Chapter</label><input class="form-input" id="new-chapter-title" type="text" placeholder="Contoh: Pertemuan Pertama"></div>
    ${type === 'novel' ? `<div class="form-group"><label class="form-label">Isi Chapter *</label><textarea class="form-textarea" id="new-chapter-content" placeholder="Tulis isi chapter di sini..." style="min-height:250px" required></textarea></div>` : `<div class="form-group"><label class="form-label">URL Gambar (satu per baris) *</label><textarea class="form-textarea" id="new-chapter-images" placeholder="https://raw.githubusercontent.com/.../page1.jpg&#10;https://raw.githubusercontent.com/.../page2.jpg" style="min-height:150px"></textarea></div>`}
    <div style="display:flex;gap:0.75rem;margin-top:1rem"><button class="btn btn-primary" onclick="submitNewChapter('${contentId}','${type}')">Upload Chapter</button><button class="btn btn-outline" onclick="closeModal('author-modal')">Batal</button></div>`;
  openModal('author-modal');
}

async function submitNewChapter(contentId, type) {
  const title = document.getElementById('new-chapter-title')?.value || '';
  try {
    if (type === 'novel') {
      const content = document.getElementById('new-chapter-content')?.value;
      if (!content) return showToast('Isi chapter tidak boleh kosong', 'error');
      await api('/novels/chapters', { method: 'POST', body: { novel_id: contentId, title, content } });
    } else {
      const imagesRaw = document.getElementById('new-chapter-images')?.value || '';
      const image_urls = imagesRaw.split('\n').map(s => s.trim()).filter(Boolean);
      if (image_urls.length === 0) return showToast('Minimal 1 URL gambar', 'error');
      await api('/comics/chapters', { method: 'POST', body: { comic_id: contentId, title, image_urls } });
    }
    showToast('Chapter berhasil diupload!', 'success');
    closeModal('author-modal');
    await loadUploadHistory();
  } catch(e) {
    showToast(e.message, 'error');
  }
}

// ── Submit Novel / Comic ─────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════
// ADMIN PAGE
// ═══════════════════════════════════════════════════════════

function pendingItemHTML(item, type) {
  const genre = Array.isArray(item.genre) ? item.genre.join(', ') : (item.genre || 'Tidak ada genre');
  return `
    <div class="pending-item" id="pending-${item.id}">
      <div style="width:40px;height:56px;background:var(--bg-elevated);border:1px solid var(--border-subtle);overflow:hidden;flex-shrink:0;border-radius:2px">
        ${item.cover_url ? `<img src="${item.cover_url}" style="width:100%;height:100%;object-fit:cover">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:1.2rem">${type === 'novel' ? '📖' : '🖼'}</div>`}
      </div>
      <div class="pending-item-info">
        <div class="pending-item-title">${item.title || 'Tanpa Judul'}</div>
        <div class="pending-item-meta">by ${item.author_name || item.author_id || 'Unknown'} · ${genre}</div>
      </div>
      <div class="pending-actions">
        <button class="btn btn-sm btn-ghost" onclick="approveContent('${item.id}','${type}','approve')">✓ Approve</button>
        <button class="btn btn-sm btn-danger" onclick="approveContent('${item.id}','${type}','reject')">✕ Reject</button>
        <button class="btn btn-sm btn-outline" onclick="deleteContent('${item.id}','${type}')">🗑</button>
      </div>
    </div>`;
}

async function loadAdmin() {
  if (!State.user || State.user.email !== CONFIG.ADMIN_EMAIL) {
    navigateTo('home');
    return;
  }

  const adminPage = document.getElementById('page-admin');
  if (!adminPage) return;

  const adminContent = document.getElementById('admin-content');
  if (adminContent) {
    adminContent.innerHTML = `<div style="padding:2rem;text-align:center"><div class="loading-spinner" style="margin:0 auto 1rem"></div><p class="text-mono text-muted">Memuat data admin...</p></div>`;
  }

  try {
    const data = await api('/admin?type=pending');
    console.log('Admin data received:', data);

    if (adminContent) {
      adminContent.innerHTML = `
        <div class="admin-stats" id="admin-stats"></div>
        <div class="tabs" data-tab-group="admin" style="margin-top:2rem">
          <button class="tab-btn active" data-tab="tab-admin-novels" onclick="switchTab('admin','tab-admin-novels')">Pending Novels</button>
          <button class="tab-btn" data-tab="tab-admin-comics" onclick="switchTab('admin','tab-admin-comics')">Pending Comics</button>
          <button class="tab-btn" data-tab="tab-admin-all" onclick="switchTab('admin','tab-admin-all');loadAllContent()">All Content</button>
        </div>
        <div class="tab-panel active" id="tab-admin-novels"><div class="pending-list" id="pending-novels-list"></div></div>
        <div class="tab-panel" id="tab-admin-comics"><div class="pending-list" id="pending-comics-list"></div></div>
        <div class="tab-panel" id="tab-admin-all"><div class="pending-list" id="all-content-list"><p class="text-muted text-mono">Klik tab "All Content" untuk memuat.</p></div></div>`;
    }

    const s = data.stats || {};
    document.getElementById('admin-stats').innerHTML = `
      <div class="stat-card"><div class="stat-value">${s.total_users || 0}</div><div class="stat-label">Total Users</div></div>
      <div class="stat-card"><div class="stat-value">${s.approved_novels || 0}</div><div class="stat-label">Live Novels</div></div>
      <div class="stat-card"><div class="stat-value">${s.pending_novels || 0}</div><div class="stat-label">Novels Pending</div></div>
      <div class="stat-card"><div class="stat-value">${s.approved_comics || 0}</div><div class="stat-label">Live Comics</div></div>
      <div class="stat-card"><div class="stat-value">${s.pending_comics || 0}</div><div class="stat-label">Comics Pending</div></div>
      <div class="stat-card"><div class="stat-value">${s.total_ratings || 0}</div><div class="stat-label">Total Ratings</div></div>`;

    const novels = data.novels || [];
    document.getElementById('pending-novels-list').innerHTML = novels.length ? novels.map(item => pendingItemHTML(item, 'novel')).join('') : `<p class="text-muted text-mono" style="padding:1rem 0">Tidak ada novel pending.</p>`;

    const comics = data.comics || [];
    document.getElementById('pending-comics-list').innerHTML = comics.length ? comics.map(item => pendingItemHTML(item, 'comic')).join('') : `<p class="text-muted text-mono" style="padding:1rem 0">Tidak ada komik pending.</p>`;

  } catch (err) {
    console.error('loadAdmin error:', err);
    if (adminContent) {
      adminContent.innerHTML = `<div style="padding:2rem;text-align:center"><p class="text-muted text-mono">Error: ${err.message}</p><button class="btn btn-outline btn-sm" style="margin-top:1rem" onclick="loadAdmin()">Coba Lagi</button></div>`;
    }
  }
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

document.addEventListener('click', (e) => {
  if (!e.target.closest('.nav-search')) {
    document.getElementById('search-results')?.classList.remove('open');
  }
});

// ── Genre Tags on Home ───────────────────────────────────────
function buildGenreList() {
  const container = document.getElementById('genre-chips');
  if (!container) return;
  container.innerHTML = GENRES.map(g => `<button class="filter-chip" onclick="navigateTo('genre',{genre:'${g}'})">${g}</button>`).join('');
}

// ── Utility ──────────────────────────────────────────────────
function contentCardHTML(item, type) {
  const genres = (item.genre || []).slice(0, 2).map(g => `<span class="genre-tag">${g}</span>`).join('');
  return `
    <div class="content-card" onclick="navigateTo('reader',{id:'${item.id}',type:'${type}'})">
      <div class="card-cover-wrap">
        ${item.cover_url ? `<img src="${item.cover_url}" class="card-cover" alt="${item.title}" loading="lazy">` : `<div class="card-cover-placeholder">${type === 'novel' ? '📖' : '🖼'}</div>`}
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

// ── Mobile Search ────────────────────────────────────────────
function toggleMobileSearch() {
  const overlay = document.getElementById('mobile-search-overlay');
  const input = document.getElementById('mobile-search-input');
  overlay?.classList.toggle('open');
  if (overlay?.classList.contains('open')) {
    setTimeout(() => input?.focus(), 100);
  }
}

function onMobileSearchInput(e) {
  const q = e.target.value.trim();
  const dropdown = document.getElementById('mobile-search-results');
  clearTimeout(searchDebounce);
  if (q.length < 2) { dropdown && dropdown.classList.remove('open'); return; }
  searchDebounce = setTimeout(async () => {
    try {
      const data = await api(`/search?q=${encodeURIComponent(q)}`);
      renderSearchResults(data.results || [], dropdown);
    } catch (e) {
      if (dropdown) dropdown.classList.remove('open');
    }
  }, 300);
}

document.addEventListener('click', (e) => {
  const overlay = document.getElementById('mobile-search-overlay');
  const btn = document.getElementById('mobile-search-btn');
  if (overlay?.classList.contains('open') && !overlay.contains(e.target) && e.target !== btn) {
    overlay.classList.remove('open');
  }
});

// ── Nav scroll effect ────────────────────────────────────────
window.addEventListener('scroll', () => {
  const nav = document.getElementById('main-nav');
  if (nav) nav.classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initSupabase();
  buildGenreList();
  navigateTo('home');

  document.getElementById('mobile-overlay')?.addEventListener('click', toggleBurger);

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
