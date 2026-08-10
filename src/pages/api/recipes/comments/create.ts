import type { APIRoute } from 'astro';
import { SESSION_COOKIE, getUserFromSession } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase';
import { sendCommentNotificationEmail } from '../../../../lib/email';
import { getCollection } from 'astro:content';

export const POST: APIRoute = async (context) => {
  try {
    // Check authentication
    const sessionId = context.cookies.get(SESSION_COOKIE)?.value;
    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401 }
      );
    }

    const user = await getUserFromSession(sessionId);
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Session invalid' }),
        { status: 401 }
      );
    }

    if (user.banned) {
      return new Response(
        JSON.stringify({ error: 'This account is restricted from commenting and hearting' }),
        { status: 403 }
      );
    }

    // Parse request body
    const body = await context.request.json();
    const { recipe_id, content } = body;

    // Validate inputs
    if (!recipe_id || typeof recipe_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid recipe_id' }),
        { status: 400 }
      );
    }

    if (!content || typeof content !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Content is required' }),
        { status: 400 }
      );
    }

    // Trim and validate length (max 500 chars)
    const trimmedContent = content.trim();
    if (trimmedContent.length === 0 || trimmedContent.length > 500) {
      return new Response(
        JSON.stringify({ 
          error: 'Comment must be between 1 and 500 characters' 
        }),
        { status: 400 }
      );
    }

    // Check if user already has a comment on this recipe
    const { data: existingCommentData } = await supabaseAdmin
      .from('comments')
      .select('id')
      .eq('user_id', user.id)
      .eq('recipe_id', recipe_id)
      .maybeSingle();

    // If they already have a comment, this is an update, not a new comment
    const existingComment = !!existingCommentData;

    let data, error;
    if (existingComment) {
      // Update existing comment
      const result = await supabaseAdmin
        .from('comments')
        .update({
          content: trimmedContent,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('recipe_id', recipe_id)
        .select()
        .single();
      data = result.data;
      error = result.error;
    } else {
      // Insert new comment
      const result = await supabaseAdmin
        .from('comments')
        .insert({
          recipe_id,
          album_id: null,
          user_id: user.id,
          user_name: user.user_name || user.user_email,
          user_image: user.user_avatar || null,
          content: trimmedContent
        })
        .select()
        .single();
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error('Comment creation error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to create comment' }),
        { status: 500 }
      );
    }

    // Send email notification if this is a NEW comment (not an update)
    if (!existingComment) {
      // Check if user has previously deleted a comment on this recipe
      const { data: previouslyDeleted } = await supabaseAdmin
        .from('comments')
        .select('id')
        .eq('user_id', user.id)
        .eq('recipe_id', recipe_id)
        .not('deleted_at', 'is', null)
        .limit(1);

      // Only send email if user hasn't previously deleted a comment on this recipe
      const hasPreviouslyDeleted = previouslyDeleted && previouslyDeleted.length > 0;
      
      if (!hasPreviouslyDeleted) {
        try {
          // Get recipe name from collection
          const recipes = await getCollection('recipes');
          const recipe = recipes.find(r => r.id === recipe_id);
          const recipeName = recipe?.data.title || recipe_id;
          const recipeUrl = `${new URL(context.request.url).origin}/recipes/${recipe_id}`;
          
          await sendCommentNotificationEmail({
            recipeName,
            userName: user.user_name || user.user_email,
            userEmail: user.user_email,
            commentContent: trimmedContent,
            recipeUrl
          });
        } catch (emailErr) {
          // Log but don't fail the request
          console.error('Failed to send comment notification email:', emailErr);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        comment: data,
        isUpdate: existingComment 
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error('Comment API error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    );
  }
};
