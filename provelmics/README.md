# PROVELMICS
### Produksi Media Web Comics & Web Novel Platform

A full-stack modern reading platform with elegant dark retro-pixel design.

---

## 🏗 Tech Stack

| Layer | Service | Free Tier |
|-------|---------|-----------|
| Frontend + API | **Vercel** | 100GB bandwidth, 1M invocations/month |
| Database | **Cloudflare D1** | 5GB, 5M rows |
| Auth | **Supabase Auth** | 50,000 active users |
| Images | **GitHub Raw** | Free CDN for images |

---

## 📁 Project Structure

```
provelmics/
├── api/
│   ├── _d1.js                  # Cloudflare D1 REST client
│   ├── auth/
│   │   ├── verify.js           # JWT middleware
│   │   └── sync.js             # User sync endpoint
│   ├── novels/
│   │   ├── index.js            # GET list, POST create
│   │   └── [id].js             # GET detail, PATCH approve, DELETE
│   ├── comics/
│   │   └── index.js            # GET list, POST create
│   ├── ratings/
│   │   └── index.js            # GET/POST ratings
│   ├── bookmarks/
│   │   └── index.js            # GET/POST/DELETE bookmarks
│   ├── search.js               # Search endpoint
│   ├── authors.js              # Authors list/detail
│   ├── profile.js              # User profile
│   ├── admin.js                # Admin dashboard data
│   └── progress.js             # Reading progress
├── public/
│   ├── index.html              # SPA main file
│   ├── css/
│   │   └── main.css            # Full stylesheet
│   └── js/
│       └── app.js              # Application logic
├── db/
│   └── schema.sql              # D1 database schema
├── package.json
├── vercel.json
└── wrangler.toml
```

---

## 🚀 Setup Guide

### Step 1: Supabase Auth Setup

1. Go to [supabase.com](https://supabase.com) → Create new project
2. Go to **Authentication → Providers → Google** → Enable it
3. Set up Google OAuth in [Google Cloud Console](https://console.cloud.google.com):
   - Create a new project
   - Enable Google+ API
   - Create OAuth 2.0 credentials
   - Add your Supabase callback URL (shown in Supabase dashboard)
4. Note down:
   - `Project URL` → `SUPABASE_URL`
   - `anon public key` → `SUPABASE_ANON_KEY`
   - `JWT Secret` (Settings → API) → `SUPABASE_JWT_SECRET`

### Step 2: Cloudflare D1 Setup

1. Install Wrangler: `npm install -g wrangler`
2. Login: `wrangler login`
3. Create database:
   ```bash
   wrangler d1 create provelmics-db
   ```
4. Copy the `database_id` from output → update `wrangler.toml`
5. Run schema migration:
   ```bash
   wrangler d1 execute provelmics-db --file=./db/schema.sql
   ```
6. Note down:
   - `Account ID` → `CLOUDFLARE_ACCOUNT_ID`
   - `Database ID` → `CLOUDFLARE_D1_DATABASE_ID`
   - Create API Token at [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) with D1 Edit permissions → `CLOUDFLARE_API_TOKEN`

### Step 3: Configure Frontend

Edit `public/js/app.js`, update the CONFIG object at the top:

```javascript
const CONFIG = {
  SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'eyJ...',
  API_BASE: '/api',
  ADMIN_EMAIL: 'shusensei27@gmail.com',
};
```

### Step 4: Deploy to Vercel

1. Install Vercel CLI: `npm install -g vercel`
2. Login: `vercel login`
3. Set environment variables:
   ```bash
   vercel env add SUPABASE_JWT_SECRET
   vercel env add CLOUDFLARE_ACCOUNT_ID
   vercel env add CLOUDFLARE_D1_DATABASE_ID
   vercel env add CLOUDFLARE_API_TOKEN
   vercel env add ADMIN_EMAIL
   ```
4. Deploy:
   ```bash
   vercel --prod
   ```

### Step 5: Configure Supabase Redirect URLs

In Supabase Dashboard → Authentication → URL Configuration:
- Add your Vercel URL to **Site URL**: `https://your-project.vercel.app`
- Add to **Redirect URLs**: `https://your-project.vercel.app`

---

## 🔑 Environment Variables

| Variable | Description | Where to get |
|----------|-------------|--------------|
| `SUPABASE_JWT_SECRET` | JWT signing secret | Supabase → Settings → API |
| `CLOUDFLARE_ACCOUNT_ID` | CF Account ID | Cloudflare Dashboard |
| `CLOUDFLARE_D1_DATABASE_ID` | D1 Database ID | `wrangler d1 create` output |
| `CLOUDFLARE_API_TOKEN` | CF API token with D1 Edit | CF Dashboard → API Tokens |
| `ADMIN_EMAIL` | Admin email address | Set to `shusensei27@gmail.com` |

---

## 📚 API Endpoints

### Public
- `GET /api/novels` — List approved novels (`?sort=newest|rating|az&genre=Fantasy&limit=20`)
- `GET /api/novels/:id` — Novel detail
- `GET /api/comics` — List approved comics
- `GET /api/search?q=...` — Search content

### Authenticated (requires `Authorization: Bearer <supabase_jwt>`)
- `POST /api/auth/sync` — Sync user to D1 after login
- `POST /api/novels` — Submit novel for review
- `POST /api/comics` — Submit comic for review
- `GET/POST/DELETE /api/bookmarks` — Manage bookmarks
- `GET/POST /api/ratings` — Rate content
- `GET/PATCH /api/profile` — View/edit profile
- `GET/POST /api/progress` — Reading progress

### Admin only (`shusensei27@gmail.com`)
- `GET /api/admin?type=pending|approved` — Dashboard data
- `PATCH /api/novels/:id?action=approve|reject` — Approve/reject
- `PATCH /api/comics/:id?action=approve|reject` — Approve/reject
- `DELETE /api/novels/:id` — Delete novel
- `DELETE /api/comics/:id` — Delete comic

---

## 🎨 Hosting Comic/Novel Images

Since Cloudflare D1 only stores text, images are stored on GitHub:

1. Create a public GitHub repository (e.g., `my-provelmics-assets`)
2. Upload images to it
3. Get the raw URL: `https://raw.githubusercontent.com/USERNAME/REPO/main/image.jpg`
4. Use this URL when uploading content on the platform

---

## 🎵 Spotify Player (Optional)

Replace the playlist ID in `index.html`:
```html
src="https://open.spotify.com/embed/playlist/YOUR_PLAYLIST_ID?..."
```

---

## 🔧 Local Development

```bash
npm install
vercel dev
```

This starts both the frontend and serverless functions locally.

For D1 local testing:
```bash
wrangler d1 execute provelmics-db --local --file=./db/schema.sql
```

---

## 🛡 Security Notes

- JWT tokens from Supabase are verified on every authenticated request using `HS256`
- Admin access is enforced both in JWT email check AND in each API route
- All SQL queries use parameterized statements to prevent SQL injection
- CORS is set to `*` — restrict to your domain in production

---

## 📐 Features Implemented

- ✅ Google OAuth via Supabase Auth
- ✅ User sync to Cloudflare D1
- ✅ Novel submission & reading system
- ✅ Comic submission & reading system  
- ✅ Admin dashboard with approve/reject
- ✅ 5-star rating system with live recalculation
- ✅ Bookmark system
- ✅ Reading progress tracking
- ✅ Author profiles
- ✅ Search with debounce & caching
- ✅ Genre filtering & browsing
- ✅ Continue Reading widget
- ✅ Futuristic burger menu
- ✅ Spotify embed player
- ✅ Dark mode retro-pixel design
- ✅ Fully responsive (mobile-first)
- ✅ SPA with page routing (no reload)
