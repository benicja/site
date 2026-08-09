// Shared client-side fetch for /api/recipes/page-data. The prerendered recipe
// pages and the CommentSection island both need it on the same view, so the
// promise is cached on window (survives separate script bundles) and cleared
// after each view transition.

export interface RecipePageData {
  authenticated: boolean;
  isAdmin: boolean;
  user: {
    id: string;
    user_email: string;
    user_name: string | null;
    user_avatar: string | null;
  } | null;
  hearts: Record<string, number>;
  userHearts: string[];
  deleted: string[];
  order: string[];
}

const CACHE_KEY = '__benicjaPageData';

export function getPageData(): Promise<RecipePageData | null> {
  const w = window as any;
  if (!w[CACHE_KEY]) {
    w[CACHE_KEY] = fetch('/api/recipes/page-data', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    document.addEventListener(
      'astro:after-swap',
      () => {
        w[CACHE_KEY] = null;
      },
      { once: true }
    );
  }
  return w[CACHE_KEY];
}
