# Benicja's Kitchen - Family Recipes & Gallery

A beautiful, family-focused website built with Astro, featuring a recipe collection and private photo gallery synced with Google Photos.

## 🌟 Features

### Recipe Collection
- **Git-Based Content Management**: Edit recipes directly in markdown files
- **Structured Recipe Data**: Ingredients, instructions, timing
- **Responsive Design**: Beautiful recipe cards and detailed recipe pages
- **Search & Filter**: Find recipes by category

### Private Gallery (Coming Soon)
- **Google Photos Integration**: Seamless sync with your Google Photos albums  
- **Instagram-Style Feed**: Beautiful album browsing experience
- **Secure Authentication**: Google OAuth with family-only access control
- **Photo Comments**: View and interact with photo comments from Google Photos

## 🚀 Tech Stack

- **Frontend**: [Astro](https://astro.build/) with React components
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Content**: Markdown files with frontmatter
- **Authentication**: Google OAuth (planned)
- **Database**: Supabase for user permissions (planned)
- **Deployment**: Netlify
- **Images**: Google Photos API + Cloudinary optimization

## 🏃‍♀️ Quick Start

### Prerequisites
- Node.js 18+ and npm

### Local Development

1. **Clone and install dependencies:**
   ```bash
   git clone <your-repo-url>
   cd benicja-gallery-recipes
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Open your browser:**
   Visit [http://localhost:4321](http://localhost:4321)

## 📝 Adding Recipes

Create a new `.md` file in `src/content/recipes/` with the following structure:

```yaml
---
title: \"Recipe Name\"
description: \"Brief description\"
featured_image: \"/images/recipe-photo.jpg\"
prep_time: 15
cook_time: 30
category: \"Dinner\"
ingredients:
  - item: \"Ingredient name\"
    amount: \"1 cup\"
instructions:
  - step: \"Step description\"
---

Additional recipe notes in markdown format.
```

## 🏗️ Project Structure

```
src/
├── components/          # Reusable Astro components
│   └── RecipeCard.astro
├── content/
│   ├── config.ts        # Content schema definitions  
│   └── recipes/         # Recipe markdown files
├── layouts/
│   └── Layout.astro     # Main page layout
├── pages/
│   ├── index.astro      # Homepage
│   ├── recipes/
│   │   ├── index.astro  # Recipe listing page
│   │   └── [slug].astro # Individual recipe pages
│   └── gallery.astro    # Photo gallery (coming soon)
└── data/                # Site configuration data
```

## 🚧 Development Phases

### ✅ Phase 1: Foundation (Complete)
- [x] Astro project setup with Tailwind CSS
- [x] Recipe content schema and components
- [x] Responsive recipe pages
- [x] Sample recipe content
- [x] Netlify deployment configured

### 🔄 Phase 2: Gallery & Authentication (In Progress)
- [ ] Google OAuth integration
- [ ] User permission system
- [ ] Google Photos API connection
- [ ] Instagram-style gallery interface

### ⏳ Phase 3: Advanced Features (Planned)
- [ ] Photo browsing and comments
- [ ] Recipe search and filtering
- [ ] Mobile app-like experience
- [ ] Performance optimizations

## 🔧 Build Commands

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run preview`: Preview production build locally
- `npm run astro`: Access Astro CLI

## 🌐 Deployment

### Netlify (Recommended)
1. Connect your GitHub repository to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Deploy automatically on git push

### Environment Variables (When implementing gallery)
```bash
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 👨‍👩‍👧‍👦 Family Access

### Recipes
- **Public access**: Anyone can view recipes
- **Content management**: Managed through Git and markdown files

### Gallery (When implemented)
- **Private access**: Google authentication required
- **Family whitelist**: Only approved email addresses
- **Permission requests**: Automated approval workflow

## 🤝 Contributing

This is a personal family website, but here's how you can help:

1. **Report Issues**: Found a bug? Open an issue
2. **Suggest Features**: Have ideas for improvements?
3. **Recipe Testing**: Try the recipes and provide feedback!

## 📄 License

This project is private and built for personal family use.

---

Made with ❤️ for family, powered by [Astro](https://astro.build/)