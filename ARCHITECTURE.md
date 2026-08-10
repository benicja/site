# Benicja's Kitchen — Architecture Reference

> Complete mental model of the website for future AI agents. Covers structure, data flows, auth, DB schema, and conventions. File paths are repo-relative; line numbers are pointers, not contracts (verify before editing).

---

## 1. Overview

A family website with two primary surfaces:
- **Public Recipes** — markdown-driven recipe collection with comments, hearts, shopping list
- **Private Gallery** — Google Photos albums, family-only via Google OAuth + email whitelist

**Stack:**
- **Astro 5** (`output: 'server'`) on **Netlify** adapter — SSR via Netlify Functions
- **React 19** for interactive islands (comments, shopping list, notifications, PWA banner)
- **Tailwind CSS 3** for styling
- **Supabase** (Postgres + RLS) for users, sessions, comments, hearts, gallery metadata, recipe ordering
- **Arctic 3** for Google OAuth (PKCE)
- **Netlify Identity + Decap CMS 3** for admin recipe editing at `/admin`
- **Resend 4** for transactional email
- **justified-layout + Fancyapps Fancybox** for gallery grid + lightbox

**Key insight on data split:**
- **Recipes** live in Git (`src/content/recipes/*.md`) — versioned, free, rebuild-on-push
- **Everything else** (users, sessions, comments, hearts, albums, photos, ordering, deletions) lives in Supabase

**Two distinct auth layers — do not confuse:**
- **Google OAuth (Arctic)** → end-users viewing the gallery / commenting
- **Netlify Identity** → admins logging into Decap CMS at `/admin`

---

## 2. Project Structure

```
src/
├── components/
│   ├── AddAllToShoppingListButton.{astro,tsx}
│   ├── AddToShoppingListIconButton.{astro,tsx}
│   ├── AlbumCommentSection.tsx        # React: album comments
│   ├── CommentSection.tsx             # React: recipe comments
│   ├── NotificationStack.tsx          # React: toasts
│   ├── PWAInstallBanner.tsx           # React: install prompt
│   ├── RecipeCard.astro               # Recipe grid card
│   ├── RecipeCMSCard.astro            # Admin variant
│   ├── ShoppingList.tsx               # React: list state + UI
│   └── ShoppingListButton.tsx         # React: floating toggle
│
├── content/
│   ├── config.ts                      # Zod schema for `recipes` collection
│   └── recipes/                       # ~39 recipe markdown files
│
├── layouts/
│   └── Layout.astro                   # HTML wrapper, navbar, footer, auth resolve
│
├── lib/
│   ├── auth.ts                        # Session helpers, isUserAdmin, SESSION_COOKIE
│   ├── email.ts                       # Resend templates + HMAC-signed action links
│   ├── gallery.ts                     # getAlbums, getAlbumById, getPhotosByAlbumId, date parsing
│   ├── galleryInit.ts                 # justified-layout + Fancybox bootstrap (client)
│   ├── github.ts                      # GitHub helpers (planned/partial)
│   ├── hearts.ts                      # Recipe heart counting
│   ├── notifications.ts               # Toast helpers
│   ├── recipe-cache.ts                # IndexedDB cache (optimistic recipes)
│   ├── recipe-utils.ts                # Misc recipe helpers
│   ├── shopping.ts                    # Shopping list logic
│   └── supabase.ts                    # `supabase` (anon) + `supabaseAdmin` (service)
│
├── pages/
│   ├── index.astro                    # Hero homepage
│   ├── portal.astro                   # Admin portal: approve access requests
│   │
│   ├── auth/
│   │   ├── login.ts                   # Initiate Google OAuth (PKCE)
│   │   ├── callback.ts                # OAuth callback (token exchange, session)
│   │   ├── link-google-photos.ts      # Initiate OAuth in "link photos" mode
│   │   └── logout.ts                  # Clear session cookie
│   │
│   ├── recipes/
│   │   ├── index.astro                # List + search + custom-order sort
│   │   └── [slug].astro               # Detail page + ingredients/instructions/comments
│   │
│   ├── gallery/
│   │   ├── index.astro                # Album list (Albums grid OR Itinerary timeline)
│   │   ├── request-access.astro       # Form for unapproved logged-in users
│   │   └── [albumId].astro            # Photo grid (justified) + lightbox + comments
│   │
│   └── api/
│       ├── request-access.ts          # POST: submit access request
│       │
│       ├── auth/
│       │   ├── me.ts                  # GET current user
│       │   ├── callback.ts            # (mirror of pages/auth/callback)
│       │   ├── link-google-photos.ts  # POST: save photos refresh token
│       │   └── logout.ts              # POST: clear session
│       │
│       ├── admin/
│       │   ├── approved-users.ts      # GET/POST whitelist
│       │   ├── requests.ts            # GET pending / POST approve|deny
│       │   ├── request-action.ts      # GET signed email-link approve|deny
│       │   ├── update-role.ts         # POST: promote to admin
│       │   └── users.ts               # POST: approve|ban|unban|delete any account
│       │
│       ├── recipes/
│       │   ├── create-recipe.ts
│       │   ├── delete-recipe.ts       # Soft-delete via `deleted_recipes`
│       │   ├── get-recipe.ts
│       │   ├── update-recipe.ts
│       │   ├── upload-image.ts
│       │   ├── heart.ts               # Toggle recipe heart
│       │   ├── reorder-recipes.ts     # Save custom slug order
│       │   └── comments/
│       │       ├── create.ts          # Upsert (one comment per user per recipe)
│       │       ├── [recipe_id].ts     # GET list
│       │       ├── delete/[comment_id].ts
│       │       ├── heart.ts
│       │       └── hearts/[recipe_id].ts
│       │
│       ├── gallery/
│       │   ├── image.ts               # Proxy Google image (adds UA + Referer headers)
│       │   ├── video.ts               # Proxy Google video (appends `=dv`)
│       │   ├── stats.ts               # Album/photo counts
│       │   ├── sync-link.ts           # Parse Google Photos share link → DB
│       │   ├── delete-album.ts
│       │   ├── update-album-title.ts
│       │   ├── reorder-albums.ts
│       │   └── comments/
│       │       ├── create.ts
│       │       ├── [album_id].ts
│       │       ├── delete/[id].ts
│       │       ├── heart.ts
│       │       └── hearts/[album_id].ts
│       │
│       └── test-album-comment.ts      # Dev test endpoint (remove for prod)
│
└── env.d.ts

migrations/                            # 001..007 SQL migrations (manual apply via Supabase)
public/                                # Static assets, /admin/index.html (Decap), images
```

---

## 3. Routing

### Public (no auth)
| Route | File | Purpose |
|-------|------|---------|
| `/` | `pages/index.astro` | Hero + CTAs |
| `/recipes` | `pages/recipes/index.astro` | List, search, filter |
| `/recipes/[slug]` | `pages/recipes/[slug].astro` | Detail + comments |
| `/gallery/request-access` | `pages/gallery/request-access.astro` | Access request form |

### Protected (logged in + approved)
| Route | File | Purpose |
|-------|------|---------|
| `/gallery` | `pages/gallery/index.astro` | Album list (Albums or Itinerary view) |
| `/gallery/[albumId]` | `pages/gallery/[albumId].astro` | Photos + lightbox + comments |
| `/portal` | `pages/portal.astro` | Admin: approve requests |

### CMS
| Route | Source | Purpose |
|-------|--------|---------|
| `/admin/*` | `public/admin/index.html` (Netlify redirect 200) | Decap CMS UI |

API routes are listed in §8.

---

## 4. Recipes (Content System)

### Schema — `src/content/config.ts`

```ts
recipeCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    featured_image: z.string().optional(),
    prep_time: z.number(),
    cook_time: z.number(),
    category: z.enum(['Breakfast', 'Dinner', 'Dessert']),
    servings: z.number().optional(),
    ingredients: z.array(z.object({ item: z.string(), amount: z.string() })),
    instructions: z.array(z.object({ step: z.string() })),
    authors: z.array(z.object({ name: z.string(), image: z.string().optional() })).optional(),
    publishDate: z.date().optional(),
    draft: z.boolean().optional(),
  }),
});
```

### Storage and rendering
- Markdown lives in `src/content/recipes/*.md`. Astro content collections compile at build.
- `/recipes` calls `getCollection('recipes')`, removes entries listed in Supabase `deleted_recipes`, sorts using Supabase `recipe_order.order_slugs` first, then `publishDate` desc, then alphabetical.
- `/recipes/[slug]` uses `getEntry('recipes', slug)`. If missing (recently created via CMS, server not yet rebuilt), renders a "ghost" placeholder filled by client-side IndexedDB cache; auto-404 after ~10 min.

### Editing paths
- **Direct git**: edit/commit `.md` → push → Netlify rebuilds.
- **Decap CMS** (`/admin`): WYSIWYG → commits to GitHub via Git Gateway → Netlify rebuild.
- **Order**: drag-and-drop on `/recipes` (admin) → `POST /api/recipes/reorder-recipes` → upserts `recipe_order { id: 'primary', order_slugs: [...] }`.
- **Soft-delete**: `POST /api/recipes/delete-recipe` → row in `deleted_recipes`. Listing hides; detail 404s.

---

## 5. Gallery System

### Concept
Albums and photos are **mirrored from Google Photos share links** into Supabase. The site never proxies the live Google Photos API at request-time for listings — listings are pure DB reads. Image bytes are proxied per-request through `/api/gallery/image` so we can attach Google-required headers and benefit from CDN caching.

### Types — `src/lib/gallery.ts`

```ts
interface Album {
  google_album_id: string;
  title: string;            // often "YY/MM - Name", parsed for date sorting
  cover_image_url: string;
  album_url: string;        // original share link
  photo_count: number;
  created_at: string;
  updated_at: string;
  display_order?: number;   // manual sort
}

interface Photo {
  google_photo_id: string;
  album_id: string;         // FK to gallery_albums.google_album_id
  image_url: string;
  width?: number;
  height?: number;
  media_type?: 'image' | 'video';
  created_at: string;
}
```

### Sync flow (admin only)
1. Admin runs `/auth/link-google-photos` once → Google OAuth with `link_photos_mode=true` → refresh token stored at `site_config.photos_refresh_token`.
2. Admin pastes a Google Photos share link → `POST /api/gallery/sync-link`.
3. Endpoint scrapes the share page HTML, extracts album metadata + photo URLs, and detects video vs image from the page's embedded media-item data (videos carry protobuf field `76647426` — duration/dimensions/download URL — in their trailing metadata object; photos never do). URLs missing from the parsed data fall back to a `=dv` HEAD probe (8s timeout, one retry). Upserts into `gallery_albums` + `gallery_photos`. Returns 429 on Google rate limits.

### Listing — `/gallery`
- Auth-gated. Two modes: **Albums** (grid of cover thumbnails) and **Itinerary** (chronological timeline parsed from titles via `^\d{1,2}\/\d{2,4}` regex).
- Admin can reorder (drag) → `POST /api/gallery/reorder-albums` → updates `display_order`.
- Admin can rename, delete album.

### Album page — `/gallery/[albumId]`
- Server fetches album + photos from Supabase (`getAlbumById`, `getPhotosByAlbumId`).
- Renders `<img>` with `src="/api/gallery/image?url=...&w=..."`.
- Client-side `galleryInit.ts` waits for natural dimensions, runs `justified-layout` (target row height 280px), positions absolutely, binds Fancybox lightbox.
- Album comments below grid (`AlbumCommentSection.tsx`).

### Image / video proxy
- `/api/gallery/image?url=&w=` — fetches Google image with `User-Agent` and `Referer` headers, streams response with cache headers.
- `/api/gallery/video?url=` — same, appends `=dv` to URL for video format.

---

## 6. Authentication

### Layer A — Google OAuth (Arctic, PKCE) for end-users

**`SESSION_COOKIE = 'gallery_session'`** — HttpOnly, SameSite=Lax, 30-day expiry.

**Login (`/auth/login?next=/gallery`)**:
1. Generate `state` + `code_verifier` (PKCE), store in cookies.
2. Redirect to Google consent screen.

**Callback (`/auth/callback`)**:
1. Validate `state` and `code_verifier`.
2. Exchange code for tokens via Arctic.
3. Fetch user profile (name, email, picture).
4. Upsert into `user_sessions` (keyed by `user_email`).
5. Set `gallery_session` cookie.
6. If email is in `approved_users` → redirect to `next` (default `/gallery`); else → `/gallery/request-access`.

**Double-exchange prevention**: if a session already exists for the request, skip the OAuth exchange and redirect — protects against browser pre-fetch / refresh of the callback URL re-redeeming a one-time code.

### Layer B — Netlify Identity for admins
- Used solely to authenticate Decap CMS at `/admin`.
- Configured via Netlify dashboard (Identity + Git Gateway, invite-only).
- Independent of Layer A — being a Netlify Identity admin does not grant gallery access and vice versa.

### Authorization model
- **Approved**: row in `approved_users` (email match).
- **Admin**: `approved_users.role === 'admin'`.
- `isUserAdmin(sessionId)` in `src/lib/auth.ts` is the canonical check.
- All admin API endpoints must call this before mutating.

---

## 7. Database (Supabase)

Connection — `src/lib/supabase.ts`:
- `supabase` — public anon client (RLS-bound). Use in components.
- `supabaseAdmin` — service-role client. Use server-side only; never ship key to browser.

### Tables

**`user_sessions`** — active logins
```
id UUID PK, user_email TEXT (unique), google_id TEXT,
access_token TEXT, refresh_token TEXT,
user_name TEXT, user_avatar TEXT,
last_login TIMESTAMP, created_at TIMESTAMP
```

**`approved_users`** — whitelist + roles
```
id UUID PK, email TEXT UNIQUE, role TEXT NULL ('admin' | NULL),
approved_by TEXT, approved_at TIMESTAMP, created_at TIMESTAMP
```

**`access_requests`** — pending requests
```
id UUID PK, email TEXT, full_name TEXT, message TEXT,
status TEXT DEFAULT 'pending'  -- 'pending' | 'approved' | 'denied'
request_token TEXT UNIQUE,
requested_at TIMESTAMP, reviewed_by TEXT, reviewed_at TIMESTAMP
```

**`site_config`** — global settings
```
id TEXT PK ('current'),
photos_refresh_token TEXT,  -- Google OAuth refresh token for Photos
source_email TEXT,
updated_at TIMESTAMP
```

**`gallery_albums`**
```
google_album_id TEXT PK, title TEXT, cover_image_url TEXT,
album_url TEXT, photo_count INT,
display_order INT NULL,
created_at TIMESTAMP, updated_at TIMESTAMP
```

**`gallery_photos`**
```
google_photo_id TEXT PK,
album_id TEXT (FK → gallery_albums.google_album_id),
image_url TEXT, width INT, height INT,
media_type TEXT, created_at TIMESTAMP
```

**`recipe_order`**
```
id TEXT PK ('primary'), order_slugs TEXT[]
```

**`deleted_recipes`**
```
recipe_slug TEXT PK, deleted_at TIMESTAMP
```

**`recipe_hearts`**
```
id UUID PK, recipe_slug TEXT, user_email TEXT,
created_at TIMESTAMP, UNIQUE(recipe_slug, user_email)
```

**`comments`** — recipes AND albums share this table
```
id UUID PK,
recipe_id TEXT NULL, album_id TEXT NULL,
user_id UUID (FK → user_sessions.id),
user_name TEXT, user_image TEXT,
content TEXT (1..500),
created_at, updated_at, deleted_at TIMESTAMP NULL,
CHECK (recipe_id IS NOT NULL OR album_id IS NOT NULL),
UNIQUE(recipe_id, user_id) WHERE recipe_id IS NOT NULL,
UNIQUE(album_id,  user_id) WHERE album_id  IS NOT NULL
```
**One comment per user per target.** Posting again is an update, not a new row.

**`comment_hearts`**
```
id UUID PK, comment_id UUID (FK → comments.id), user_id UUID,
created_at TIMESTAMP, UNIQUE(comment_id, user_id)
```

### RLS (comments)
- SELECT: public
- INSERT: authenticated users for their own user_id
- UPDATE/DELETE: owner OR admin

### Migrations — `migrations/`
| File | Purpose |
|------|---------|
| `001_create_comments_table.sql` | initial table + RLS |
| `002_add_comment_tracking.sql` | soft-delete `deleted_at` |
| `003_add_album_comments.sql` | add `album_id` |
| `004_fix_comment_constraints.sql` | CHECK + uniques |
| `005_update_rls_for_album_comments.sql` | RLS for albums |
| `006_simplify_constraints.sql` | reconcile 004/005 |
| `007_make_recipe_id_nullable.sql` | allow NULL recipe_id |

Migrations are **applied manually** in the Supabase SQL editor (see `APPLY_MIGRATIONS.md`); they do not run automatically on deploy.

---

## 8. API Endpoints (full list)

### Auth
- `GET  /auth/login?next=…` — start OAuth
- `GET  /auth/callback` — OAuth callback
- `POST /auth/logout`
- `GET  /auth/link-google-photos` — admin: link Photos refresh token
- `GET  /api/auth/me` — current user
- `POST /api/auth/logout`

### Access control
- `POST /api/request-access` — submit request, emails admin
- `GET  /api/admin/approved-users` — list (admin)
- `POST /api/admin/approved-users` — add/remove (admin)
- `GET  /api/admin/requests` — pending list (admin)
- `POST /api/admin/requests` — approve/deny (admin)
- `GET  /api/admin/request-action?action=&token=&sig=` — one-click email link (HMAC-signed, 7-day expiry)
- `POST /api/admin/update-role` — promote to admin
- `POST /api/admin/users { action: approve|ban|unban|delete, email }` — All Users tab actions. Ban sets `user_sessions.banned` (migration 009) and wipes the account's comments/hearts; banned users are rejected (403) by every comment/heart write endpoint. Delete additionally removes their approval, access requests, and session row.

### Recipes
- `GET  /api/recipes/get-recipe?slug=`
- `POST /api/recipes/create-recipe`
- `POST /api/recipes/update-recipe`
- `POST /api/recipes/delete-recipe`
- `POST /api/recipes/upload-image`
- `POST /api/recipes/heart`
- `POST /api/recipes/reorder-recipes`

### Recipe comments
- `POST   /api/recipes/comments/create` — upsert; emails admin **only on first insert**
- `GET    /api/recipes/comments/[recipe_id]`
- `DELETE /api/recipes/comments/delete/[comment_id]`
- `POST   /api/recipes/comments/heart`
- `GET    /api/recipes/comments/hearts/[recipe_id]`

### Gallery
- `POST   /api/gallery/sync-link` — admin: ingest share link
- `GET    /api/gallery/image?url=&w=` — image proxy
- `GET    /api/gallery/video?url=` — video proxy
- `GET    /api/gallery/stats`
- `DELETE /api/gallery/delete-album`
- `POST   /api/gallery/update-album-title`
- `POST   /api/gallery/reorder-albums`

### Album comments (mirror of recipe comments shape)
- `POST   /api/gallery/comments/create`
- `GET    /api/gallery/comments/[album_id]`
- `DELETE /api/gallery/comments/delete/[id]`
- `POST   /api/gallery/comments/heart`
- `GET    /api/gallery/comments/hearts/[album_id]`

### Dev
- `POST /api/test-album-comment` — remove for production

---

## 9. Comments

Both recipe and album comments share the `comments` table and a near-identical React component.

**UX:**
- One comment per user per target (post-again = edit).
- Max 500 chars (DB constraint + client counter).
- Heart any comment (toggle); counts shown live.
- Owner can edit/delete; admin can delete any.
- Logged-out users see a sign-in prompt instead of the form.
- Avatar/name pulled from Google profile at session creation.

**Email:** new (first-insert) recipe comments trigger an admin notification via Resend. Edits do not.

---

## 10. Configuration

### `astro.config.mjs`
```js
export default defineConfig({
  integrations: [tailwind(), react()],
  output: 'server',
  adapter: netlify(),
  site: 'https://benicja.com',
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
});
```

### `netlify.toml`
```toml
[build]
  command = "npm run build"
  publish = "dist"
[build.environment]
  NODE_VERSION = "20"
[[redirects]]
  from = "/admin/*"
  to   = "/admin/index.html"
  status = 200
```

### Required environment variables
```
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY      # server only
RESEND_API_KEY
RESEND_FROM               # e.g. no-reply@benicja.com
ADMIN_REQUESTS_EMAIL      # where access requests go
REQUEST_ACTION_SECRET     # HMAC key for signed email links
SITE_URL                  # e.g. https://benicja.com
```

---

## 11. Layout & Components

### `src/layouts/Layout.astro`
- Resolves session (cookie → `user_sessions`) unless `resolveAuth={false}`.
- Sets `Cache-Control: private, no-store, max-age=0` when auth-resolved (prevents serving one user's HTML to another via CDN).
- Includes navbar (Recipes / Gallery / Sign in | Logout | Admin), `<ClientRouter />` for view transitions, and global islands: `ShoppingListButton`, `NotificationStack`, `PWAInstallBanner`.

### Component matrix
| Component | Type | Hydration | Purpose |
|-----------|------|-----------|---------|
| `Layout` | Astro | — | shell |
| `RecipeCard` | Astro | — | grid card |
| `RecipeCMSCard` | Astro | — | admin variant |
| `CommentSection` | React | `client:visible` | recipe comments |
| `AlbumCommentSection` | React | `client:visible` | album comments |
| `ShoppingList` | React | `client:load` | list state + UI |
| `ShoppingListButton` | React | `client:visible` | floating toggle |
| `NotificationStack` | React | `client:load` | toasts |
| `PWAInstallBanner` | React | `client:visible` | install prompt |
| `AddAllToShoppingListButton` | Astro+React | `client:visible` | "add all ingredients" |
| `AddToShoppingListIconButton` | Astro+React | `client:visible` | per-ingredient |

---

## 12. Key Data Flows

### Recipe page view
```
GET /recipes/<slug>
  → [slug].astro getEntry('recipes', slug)        (build-time data)
  → render HTML
  → CommentSection mounts
  → GET /api/recipes/comments/<slug>              (Supabase SELECT)
  → GET /api/recipes/comments/hearts/<slug>       (counts + per-user)
```

### Gallery album view
```
GET /gallery/<albumId>
  → check SESSION_COOKIE → user_sessions
  → check approved_users (else redirect /gallery/request-access)
  → getAlbumById + getPhotosByAlbumId             (Supabase)
  → render <img src="/api/gallery/image?url=…">   (proxy adds UA/Referer)
  → galleryInit.ts: measure → justified-layout → Fancybox bind
  → AlbumCommentSection loads comments
```

### Access request lifecycle
```
[user]   POST /api/request-access
         → insert access_requests (status='pending')
         → Resend → admin email (with HMAC-signed approve/deny links)

[admin]  click email link OR /portal Approve
         → POST /api/admin/requests   (or signed GET /api/admin/request-action)
         → insert approved_users
         → update access_requests.status='approved'
         → Resend → user notification

[user]   next sign-in → approved_users hit → /gallery
```

### Comment heart toggle
```
React POST /api/recipes/comments/heart { comment_id }
  → session → user_id
  → if exists in comment_hearts → DELETE, else INSERT
  → return updated counts
  → optimistic UI update
```

---

## 13. Email (Resend)

`src/lib/email.ts` — templates for:
1. **Admin: new access request** — to `ADMIN_REQUESTS_EMAIL`, includes signed approve/deny buttons.
2. **User: access decision** — approval or denial.
3. **Admin: new comment** (first-insert only) — recipe title, commenter, excerpt, link.

**Signed links**: `HMAC-SHA256(REQUEST_ACTION_SECRET, token:action:expiresAt)`, base64-url. 7-day expiration. Lets admin act from email without logging in.

---

## 14. Performance & Caching

- **Astro prefetch** (`prefetchAll`, hover) speeds in-app navigation.
- **`Cache-Control: private, no-store`** on auth-resolved pages prevents CDN cross-user leakage.
- **Image proxy** uses upstream Google cache headers; no local persistent cache.
- **Recipe IndexedDB cache** (`src/lib/recipe-cache.ts`) backs the "ghost recipe" UX after CMS publish but before rebuild (10-min TTL).
- **Justified gallery** waits for natural dimensions then positions absolutely (avoids reflow).

---

## 15. Security Notes

- PKCE on Google OAuth, HttpOnly + SameSite=Lax session cookie.
- Service-role key is server-only; client uses anon key gated by RLS.
- Email action links are HMAC-signed and expire (7d).
- Comment content length is constrained at the DB; sanitize on render.
- All mutating endpoints must re-check session + role server-side; do not trust client claims.

---

## 16. Edge Cases Worth Knowing

- **Concurrent OAuth callbacks** (browser prefetch): handled — second call sees existing session, skips token exchange.
- **Ghost recipes**: detail page renders placeholder if `getEntry` misses; client cache fills it in; auto-404 after ~10 min.
- **Google rate-limit on sync** (`429`): user-friendly error; no auto-retry — space out syncs manually.
- **Itinerary view date parsing**: relies on titles starting with `\d{1,2}\/\d{2,4}` (e.g. `25/02 - Trip`). Untitled albums fall back to `created_at`.
- **`comments` row must reference exactly one of recipe_id/album_id** (CHECK constraint, plus partial uniques).

---

## 17. Deployment

1. Push to GitHub → Netlify webhook → `npm run build` → deploy `dist/`.
2. CMS edits commit straight to GitHub → same pipeline.
3. **Database migrations are not deployed automatically** — run SQL in Supabase manually (`APPLY_MIGRATIONS.md`).
4. Env vars set in Netlify dashboard.

**Pre-launch checklist:**
- [ ] All env vars set in Netlify
- [ ] All 7 migrations applied in Supabase
- [ ] Netlify Identity + Git Gateway enabled, admin invited
- [ ] Google OAuth consent screen + credentials configured (correct redirect URIs)
- [ ] Resend API key valid + sending domain verified
- [ ] End-to-end smoke: request access → approve email link → sign in → view album → comment

---

## 18. Common Workflows

**Add a recipe**
- Direct: create `src/content/recipes/<slug>.md` with required frontmatter → push.
- CMS: `/admin` → "New Recipe" → fill form → Publish.

**Approve gallery access**
- Email: click signed Approve link.
- Or `/portal` → row → Approve.

**Sync a Google Photos album**
- Admin grabs share link → admin UI on `/gallery` → paste → `POST /api/gallery/sync-link`.

**Promote a user to admin**
- `POST /api/admin/update-role { email, role: 'admin' }` (admin only).

---

## 19. Troubleshooting

| Symptom | Likely cause | Where to look |
|---------|--------------|---------------|
| `invalid_grant` on OAuth | Code re-redeemed | `pages/auth/callback.ts` (handled, redirects) |
| New CMS recipe not showing | Netlify still building | Netlify deploy log; ghost page should bridge |
| Album photos blank | Image proxy failing or Google 429 | `/api/gallery/image` logs |
| Comment won't save | Session expired or RLS denial | Network tab; `comments` RLS policies |
| Email not arriving | Resend key/domain | Resend dashboard; `RESEND_FROM` verified |
| Approve link rejected | HMAC mismatch / expired | `REQUEST_ACTION_SECRET` consistent? 7d window? |

---

## 20. Mental Model TL;DR

- **Astro** = skeleton (routing, SSR).
- **React** = interactive islands (comments, shopping, toasts).
- **Tailwind** = styling.
- **Supabase** = everything dynamic (users, sessions, comments, hearts, gallery metadata, ordering).
- **Arctic** = Google login for end-users.
- **Netlify Identity + Decap** = admin recipe editing.
- **Resend** = transactional email.
- **Netlify** = host + serverless functions.
- **justified-layout + Fancybox** = gallery look.

Recipes live in Git. Everything else lives in Supabase. Two auth layers (Google for users, Netlify Identity for CMS admins) — never confuse them.
