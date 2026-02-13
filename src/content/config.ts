import { z, defineCollection } from 'astro:content';

const recipeCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    featured_image: z.string().optional(),
    prep_time: z.number(),
    cook_time: z.number(),
    category: z.enum(['Breakfast', 'Dinner', 'Dessert']),
    ingredients: z.array(z.object({
      item: z.string(),
      amount: z.string()
    })),
    instructions: z.array(z.object({
      step: z.string()
    })),
    publishDate: z.date().optional(),
    draft: z.boolean().optional()
  })
});

export const collections = {
  'recipes': recipeCollection,
};