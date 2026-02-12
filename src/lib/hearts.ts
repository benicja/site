import { supabaseAdmin } from './supabase';

export async function getRecipeHearts() {
  const { data, error } = await supabaseAdmin
    .from('recipe_hearts')
    .select('recipe_slug');
  
  if (error || !data) return {};

  const counts: Record<string, number> = {};
  data.forEach((heart) => {
    counts[heart.recipe_slug] = (counts[heart.recipe_slug] || 0) + 1;
  });

  return counts;
}

export async function getUserHearts(email: string) {
  const { data, error } = await supabaseAdmin
    .from('recipe_hearts')
    .select('recipe_slug')
    .eq('user_email', email);
  
  if (error || !data) return new Set<string>();

  return new Set(data.map((heart) => heart.recipe_slug));
}
