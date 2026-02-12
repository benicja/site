# Gallery Setup Guide

Complete step-by-step guide to set up the private family photo gallery with Google Photos integration.

---

## Part 1: Google Cloud Console Setup

### Step 1.1: Create a Google Cloud Project

1. **Go to Google Cloud Console**  
   Visit: https://console.cloud.google.com/

2. **Create New Project**
   - Click the project dropdown at the top (says "Select a project")
   - Click **"New Project"**
   - Project name: `Benicja Family Gallery`
   - Organization: Leave as "No organization"
   - Click **"Create"**
   - Wait 30 seconds, then select your new project from the dropdown

### Step 1.2: Enable Google Photos API

1. **Navigate to APIs & Services**
   - In the left sidebar, click **"APIs & Services"** → **"Library"**
   - Or visit: https://console.cloud.google.com/apis/library

2. **Enable Photos Library API**
   - Search for: `Photos Library API`
   - Click on **"Photos Library API"** result
   - Click the blue **"Enable"** button
   - Wait for it to enable (~30 seconds)

### Step 1.3: Configure OAuth Consent Screen

1. **Go to OAuth consent screen**
   - Left sidebar: **"APIs & Services"** → **"OAuth consent screen"**
   - Or visit: https://console.cloud.google.com/apis/credentials/consent

2. **Choose User Type**
   - Select **"External"** (allows any Google account)
   - Click **"Create"**

3. **Fill in App Information**
   - **App name:** `Benicja's Family Gallery`
   - **User support email:** Your email address
   - **App logo:** (optional - skip for now)
   - **Application home page:** `https://benicja.netlify.app`
   - **Authorized domains:** 
     - Add: `netlify.app`
     - Add: `benicja.com`
   - **Developer contact email:** Your email address
   - Click **"Save and Continue"**

4. **Scopes**
   - Click **"Add or Remove Scopes"**
   - Search and check these scopes:
     - ✅ `.../auth/userinfo.email` - See your email address
     - ✅ `.../auth/userinfo.profile` - See your personal info
     - ✅ `.../auth/photoslibrary.readonly` - View your Google Photos library
   - Click **"Update"**
   - Click **"Save and Continue"**

5. **Test Users** (Important!)
   - Click **"Add Users"**
   - Add your own Google email address
   - Add other family members' Gmail addresses (up to 100)
   - Click **"Add"**
   - Click **"Save and Continue"**
   - Click **"Back to Dashboard"**

   ⚠️ **Note:** While in "Testing" mode, only added test users can log in. This is perfect for a private family gallery!

### Step 1.4: Create OAuth Credentials

1. **Navigate to Credentials**
   - Left sidebar: **"APIs & Services"** → **"Credentials"**
   - Or visit: https://console.cloud.google.com/apis/credentials

2. **Create OAuth Client ID**
   - Click **"+ Create Credentials"** → **"OAuth client ID"**
   - Application type: **"Web application"**
   - Name: `Benicja Gallery Web Client`

3. **Configure Authorized Origins & Redirects**
   - **Authorized JavaScript origins:**
     - Add: `http://localhost:4321` (for local development)
     - Add: `https://benicja.netlify.app`
     - Add: `https://benicja.com`
   
   - **Authorized redirect URIs:**
     - Add: `http://localhost:4321/auth/callback`
     - Add: `https://benicja.netlify.app/auth/callback`
     - Add: `https://benicja.com/auth/callback`
   
   - Click **"Create"**

4. **Save Your Credentials** ⚠️ IMPORTANT
   - A popup will show your **Client ID** and **Client Secret**
   - **Copy both and save them securely** (you'll need them later)
   - Format:
     ```
     Client ID: 123456789-abc123def456.apps.googleusercontent.com
     Client Secret: GOCSPX-abc123def456xyz789
     ```
   - Click **"OK"**

✅ **Google Cloud Console setup complete!**

---

## Part 2: Supabase Setup

### Step 2.1: Create Supabase Project

1. **Go to Supabase**
   - Visit: https://supabase.com/
   - Click **"Start your project"** (or sign in if you have an account)
   - Sign up with your GitHub account

2. **Create New Project**
   - Click **"New Project"**
   - **Name:** `benicja-gallery`
   - **Database Password:** (generate a strong password and save it)
   - **Region:** Choose closest to you (e.g., `us-east-1` or `eu-central-1`)
   - **Pricing Plan:** Start with **Free** tier (50,000 monthly active users)
   - Click **"Create new project"**
   - Wait 2-3 minutes for provisioning

### Step 2.2: Create Database Tables

1. **Open SQL Editor**
   - In your project dashboard, click **"SQL Editor"** in left sidebar
   - Click **"New query"**

2. **Create Tables**
   - Copy and paste this SQL:

```sql
-- Table for approved users (email whitelist)
CREATE TABLE approved_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  approved_by TEXT,
  approved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for access requests
CREATE TABLE access_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  message TEXT,
  status TEXT DEFAULT 'pending', -- pending, approved, denied
  request_token TEXT UNIQUE,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_by TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE
);

-- Table for user sessions (tracks who's logged in)
CREATE TABLE user_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  google_id TEXT,
  access_token TEXT,
  refresh_token TEXT,
  user_name TEXT,
  user_avatar TEXT,
  last_login TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_approved_users_email ON approved_users(email);
CREATE INDEX idx_access_requests_email ON access_requests(email);
CREATE INDEX idx_access_requests_token ON access_requests(request_token);

-- Add yourself as the first approved user (CHANGE THIS EMAIL!)
INSERT INTO approved_users (email, approved_by) 
VALUES ('your-email@gmail.com', 'system');
```

   - **⚠️ IMPORTANT:** Change `your-email@gmail.com` to your actual email
   - Click **"Run"** (or Ctrl+Enter)
   - You should see "Success. No rows returned"

### Step 2.3: Get Supabase Credentials

1. **Go to Project Settings**
   - Click the ⚙️ **Settings** icon in left sidebar
   - Click **"API"**

2. **Copy These Values** (save them securely):
   ```
   Project URL: https://your-project.supabase.co
   anon/public key: eyJhbGc...
   service_role key: eyJhbGc... (keep this secret!)
   ```

✅ **Supabase setup complete!**

---

## Part 3: Configure Your Project

### Step 3.1: Add Environment Variables

Create a file called `.env` in your project root:

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-secret-here

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_KEY=your-service-role-key-here

# Site URL (for redirects)
SITE_URL=https://benicja.netlify.app
```

⚠️ **Never commit `.env` to Git!** (already in `.gitignore`)

### Step 3.2: Add Environment Variables to Netlify

1. **Go to Netlify Dashboard**
   - Visit: https://app.netlify.com/
   - Click on your **"site"** project

2. **Add Environment Variables**
   - Go to **Site settings** → **Environment variables**
   - Click **"Add a variable"** for each:
     - `GOOGLE_CLIENT_ID`
     - `GOOGLE_CLIENT_SECRET`
     - `SUPABASE_URL`
     - `SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_KEY`
     - `SITE_URL` = `https://benicja.com`

✅ **Configuration complete!**

---

## Part 4: What Happens Next

Once you've completed the above steps, I'll build:

1. **Authentication System**
   - "Sign in with Google" button on gallery page
   - Email whitelist check after login
   - Access request form for non-approved users

2. **Access Request Flow**
   - User clicks "Request Access"
   - Fills in name + optional message
   - You receive email with one-click approval link
   - After approval, user can log in

3. **Admin Panel** (`/admin/access`)
   - View pending access requests
   - Manually add/remove approved emails
   - See who's logged in recently

4. **Gallery Features**
   - Fetch albums matching "YY/MM - Name" pattern
   - Instagram-style grid layout
   - Organized by album with toggle for "all photos" view
   - Display photo captions/comments from Google Photos
   - Lazy loading & image optimization

---

## Ready to Continue?

Once you've completed:
- ✅ Google Cloud Console setup (Client ID & Secret saved)
- ✅ Supabase project created (Tables created, credentials saved)
- ✅ Environment variables configured locally

Let me know and I'll start building the authentication and gallery features!
