# Benicja Cheat Sheet

## What it is
Family website: **public recipes** + **private photo gallery** (family-only).

## The one-liner per tool

| Tool | Job | Remember it as... |
|---|---|---|
| **Astro** | Framework — pages, routing, server rendering | "The skeleton" |
| **React** | Interactive bits (comments, shopping list) | "The moving parts" |
| **Tailwind** | Styling via utility classes | "The paint" |
| **TypeScript** | Type safety | "The spellchecker" |
| **Supabase** | Postgres database + auth storage | "The filing cabinet" |
| **Arctic** | Handles Google login flow | "The bouncer" |
| **GitHub API** | Stores recipes as markdown files | "The recipe book" |
| **Resend** | Sends emails (approvals, notifications) | "The postman" |
| **Netlify** | Hosts the site, runs the backend | "The landlord" |
| **Decap CMS** | In-browser admin editor for recipes | "The typewriter" |
| **Fancybox + justified-layout** | Gallery photo grid + lightbox | "The photo frames" |

## The data split (key insight)
- **Recipes** → markdown files in GitHub (versioned, free, rebuilds on change)
- **Everything else** (users, comments, hearts, albums, order) → Supabase

## The two auth layers (don't confuse them)
- **Google OAuth** (via Arctic) → for family viewing the gallery
- **Netlify Identity** → for admins using Decap CMS

## Typical flows
- **Visitor views recipe** → Astro serves pre-built page, React loads comments from Supabase
- **Family member views gallery** → Google login → Supabase checks they're approved → photos shown
- **New person requests access** → form → Supabase → Resend emails admin → admin approves → Resend emails them back
- **Admin adds recipe** → portal form → GitHub commit → Netlify rebuilds → live

## Talking points if someone asks "why that stack?"
- **Astro** — fast, mostly-static, but can do dynamic stuff where needed
- **Supabase** — free tier Postgres with auth built in
- **Recipes in Git** — free versioning, no DB needed for content, easy rollback
- **Netlify** — zero-config deploys from GitHub
- **Resend** — simple email API, better than SendGrid for small projects

## If you only remember 3 things
1. **Astro app on Netlify** with React islands for interactive pieces
2. **Recipes live in Git, everything else lives in Supabase**
3. **Google login gates the gallery; the rest is public**
