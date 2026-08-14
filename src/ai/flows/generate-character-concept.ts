'use server';
/**
 * @fileOverview A Genkit flow for generating character concepts based on a chosen game system.
 *
 * - generateCharacterConcept - A function that handles the character concept generation process.
 * - GenerateCharacterConceptInput - The input type for the generateCharacterConcept function.
 * - GenerateCharacterConceptOutput - The return type for the generateCharacterConcept function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateCharacterConceptInputSchema = z.object({
  gameSystem: z.enum(['Dungeons & Dragons', 'Dark Heresy']).describe('The chosen game system (e.g., Dungeons & Dragons, Dark Heresy).'),
  userPrompt: z.string().optional().describe('Any specific ideas or keywords the user wants to include in the concept.'),
});
export type GenerateCharacterConceptInput = z.infer<typeof GenerateCharacterConceptInputSchema>;

const GenerateCharacterConceptOutputSchema = z.object({
  backstory: z.string().describe('A brief backstory for the character.'),
  personalityTraits: z.array(z.string()).describe('A list of personality traits for the character.'),
  startingGear: z.array(z.string()).describe('A list of starting gear items for the character.'),
});
export type GenerateCharacterConceptOutput = z.infer<typeof GenerateCharacterConceptOutputSchema>;

export async function generateCharacterConcept(input: GenerateCharacterConceptInput): Promise<GenerateCharacterConceptOutput> {
  return generateCharacterConceptFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCharacterConceptPrompt',
  input: { schema: GenerateCharacterConceptInputSchema },
  output: { schema: GenerateCharacterConceptOutputSchema },
  prompt: `You are an AI assistant specialized in creating engaging character concepts for tabletop role-playing games.
Your task is to generate a character concept based on the provided game system and user input.

Game System: {{{gameSystem}}}

{{#if userPrompt}}
User Specifics: {{{userPrompt}}}
{{/if}}

Focus on the tone and themes appropriate for the chosen game system:

{{#if (eq gameSystem 'Dungeons & Dragons')}}
For 'Dungeons & Dragons', generate a character concept rooted in high fantasy, magic, adventure, and classic archetypes. Consider elements like races, classes, and common fantasy settings.
{{else if (eq gameSystem 'Dark Heresy')}}
For 'Dark Heresy', generate a grimdark, dystopian character concept within the Warhammer 40,000 universe. Emphasize themes of an oppressive Imperium, zealous faith, dangerous technology, and existential threats like heresy and Xenos. The character should fit within the Inquisition's service or opposition.
{{/if}}

Generate a brief backstory, a list of personality traits, and a list of suitable starting gear.
`,
});

const generateCharacterConceptFlow = ai.defineFlow(
  {
    name: 'generateCharacterConceptFlow',
    inputSchema: GenerateCharacterConceptInputSchema,
    outputSchema: GenerateCharacterConceptOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
