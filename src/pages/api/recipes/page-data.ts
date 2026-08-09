import type { APIRoute } from 'astro';
import { SESSION_COOKIE, getApprovedUser, getUserFromSession } from '../../../lib/auth';
import { getRecipeHearts, getUserHearts } from '../../../lib/hearts';
import { supabaseAdmin } from '../../../lib/supabase';

export const prerender = false;

// Single round-trip for everything the prerendered recipe pages can't know at
// build time: who's signed in, heart counts, custom ordering and soft-deletes.
export const GET: APIRoute = async ({ cookies }) => {
  const sessionId = cookies.get(SESSION_COOKIE)?.value;
  const user = sessionId ? await getUserFromSession(sessionId) : null;

  let isAdmin = false;
  if (user) {
    const approvedUser = await getApprovedUser(user.user_email);
    isAdmin = approvedUser?.role === 'admin';
  }

  const [hearts, userHearts, deletedRes, orderRes] = await Promise.all([
    getRecipeHearts(),
    user ? getUserHearts(user.user_email) : Promise.resolve(new Set<string>()),
    supabaseAdmin.from('deleted_recipes').select('recipe_slug'),
    supabaseAdmin.from('recipe_order').select('order_slugs').eq('id', 'primary').maybeSingle()
  ]);

  return new Response(
    JSON.stringify({
      authenticated: !!user,
      isAdmin,
      user: user
        ? {
            id: user.id,
            user_email: user.user_email,
            user_name: user.user_name || null,
            user_avatar: user.user_avatar || null
          }
        : null,
      hearts,
      userHearts: Array.from(userHearts),
      deleted: (deletedRes.data || []).map((d: { recipe_slug: string }) => d.recipe_slug),
      order: orderRes.data?.order_slugs || []
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, no-store, max-age=0'
      }
    }
  );
};
