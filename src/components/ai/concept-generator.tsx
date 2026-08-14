'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useState } from 'react';
import { Wand2 } from 'lucide-react';
import {
  generateCharacterConcept,
  type GenerateCharacterConceptOutput,
} from '@/ai/flows/generate-character-concept';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader } from '../loader';
import { useRouter } from 'next/navigation';
import { useCharacterContext } from '@/context/character-context';
import { DnD5eCharacter, DarkHeresyCharacter, Character } from '@/lib/types';
import { calculateRank } from '@/lib/dark-heresy-ranks';

const formSchema = z.object({
  gameSystem: z.enum(['Dungeons & Dragons', 'Dark Heresy'], {
    required_error: 'Please select a game system.',
  }),
  userPrompt: z.string().max(300, 'Prompt must be 300 characters or less.'),
});

export function ConceptGenerator() {
  const [generationResult, setGenerationResult] = useState<GenerateCharacterConceptOutput | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { addCharacter } = useCharacterContext();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      userPrompt: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsGenerating(true);
    setGenerationResult(null);
    try {
      const result = await generateCharacterConcept(values);
      setGenerationResult(result);
    } catch (error) {
      console.error('Error generating character concept:', error);
      toast({
        variant: 'destructive',
        title: 'Generation Failed',
        description: 'There was an error generating the character concept. Please try again.',
      });
    } finally {
      setIsGenerating(false);
    }
  }
  
  const createCharacterFromConcept = async () => {
    if (!generationResult || !form.getValues('gameSystem')) {
        return;
    }

    const gameSystem = form.getValues('gameSystem');
    let newCharacter: Omit<Character, 'id' | 'userId'>;

    const inventory = generationResult.startingGear.map((item, index) => ({
        id: `item-${new Date().getTime()}-${index}`,
        name: item,
        status: 'default' as 'default' | 'lost',
    }));

    if (gameSystem === 'Dungeons & Dragons') {
        newCharacter = {
            name: 'New Adventurer', // Placeholder name
            characterClass: 'Artificer', // Placeholder
            race: 'Human', // Default
            background: 'Acolyte', // Default
            level: 1,
            gameSystem: 'Dungeons & Dragons',
            avatar: 'dnd-rogue-avatar',
            backstory: generationResult.backstory,
            stats: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
            armorClass: 10,
            speed: 30,
            hitPoints: { current: 10, max: 10 },
            equipment: [],
            inventory: inventory,
            spells: [],
            notes: '',
            questLog: [],
        } as Omit<DnD5eCharacter, 'id' | 'userId'>;
    } else { // Dark Heresy
        const defaultAgility = 30;
        const agiBonus = Math.floor(defaultAgility / 10);
        newCharacter = {
            name: 'New Acolyte', // Placeholder
            characterClass: 'Adept', // Placeholder
            gameSystem: 'Dark Heresy',
            avatar: 'dh-acolyte-avatar',
            backstory: generationResult.backstory,
            homeWorld: '',
            worldVariant: '',
            careerPath: 'Adept',
            rank: calculateRank('Adept', 0, null, null),
            divination: '',
            divinationEffect: '',
            quirk: '',
            height: '',
            weight: '',
            age: '',
            skinColor: '',
            hairColor: '',
            eyeColor: '',
            experience: 0,
            totalExpSpent: 0,
            advancedPath: null,
            stats: { weaponSkill: 30, ballisticSkill: 30, strength: 30, toughness: 30, agility: defaultAgility, intelligence: 30, perception: 30, willpower: 30, fellowship: 30, influence: 30 },
            wounds: {current: 10, max: 10},
            fatePoints: {current: 1, max: 1},
            insanityPoints: { total: 0, notes: '' },
            corruptionPoints: { total: 0, notes: '' },
            wealth: { throneGelt: 0, monthlyIncome: 0 },
            movement: {
                walkHalf: agiBonus,
                walkFull: agiBonus * 2,
                charge: agiBonus * 3,
                run: agiBonus * 6,
            },
            equipment: { armor: { Head: null, Body: null, 'Left arm': null, 'Right arm': null, 'Left leg': null, 'Right leg': null }, weapons: { melee: [], ranged: [] }},
            inventory: inventory,
            skills: [],
            talents: [],
            notes: '',
            questLog: [],
            statUpgrades: { weaponSkill: [false,false,false,false], ballisticSkill: [false,false,false,false], strength: [false,false,false,false], toughness: [false,false,false,false], agility: [false,false,false,false], intelligence: [false,false,false,false], perception: [false,false,false,false], willpower: [false,false,false,false], fellowship: [false,false,false,false], influence: [false,false,false,false] },
            statNotes: {},
        } as Omit<DarkHeresyCharacter, 'id' | 'userId'>;
    }

    const docRef = await addCharacter(newCharacter);
    
    if (docRef) {
        toast({
          title: "Character Created!",
          description: "A character has been created from the concept. You can edit the details on the character sheet."
        })
        router.push(`/${docRef.id}`);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <Card>
        <CardHeader>
            <CardTitle className="font-headline text-xl">Concept Generator</CardTitle>
        </CardHeader>
        <CardContent>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <FormField
                control={form.control}
                name="gameSystem"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Game System</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a game system" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        <SelectItem value="Dungeons & Dragons">Dungeons & Dragons</SelectItem>
                        <SelectItem value="Dark Heresy">Warhammer 40k: Dark Heresy</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormDescription>
                        The AI will tailor its suggestions to the chosen universe.
                    </FormDescription>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="userPrompt"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Character Ideas (Optional)</FormLabel>
                    <FormControl>
                        <Textarea
                        placeholder="e.g., 'a grizzled space dwarf prospector' or 'an elven rogue who loves baking'"
                        {...field}
                        />
                    </FormControl>
                    <FormDescription>
                        Provide any keywords or concepts to guide the AI.
                    </FormDescription>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <Button type="submit" disabled={isGenerating}>
                {isGenerating ? (
                    <>
                        <Loader className="mr-2 h-4 w-4" />
                        Generating...
                    </>
                ) : (
                    <>
                        <Wand2 className="mr-2 h-4 w-4" />
                        Generate Concept
                    </>
                )}
                </Button>
            </form>
            </Form>
        </CardContent>
      </Card>
      
      <div className="space-y-8">
        {isGenerating && (
            <Card className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center text-muted-foreground">
                    <Loader className="h-8 w-8 mb-4"/>
                    <p className="font-semibold">Generating your character...</p>
                    <p className="text-sm">The AI is weaving a new legend.</p>
                </div>
            </Card>
        )}
        {generationResult ? (
          <Card>
            <CardHeader>
              <CardTitle className="font-headline text-xl">Generated Concept</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Backstory</h3>
                <p className="text-muted-foreground text-sm">{generationResult.backstory}</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Personality Traits</h3>
                <div className="flex flex-wrap gap-2">
                  {generationResult.personalityTraits.map((trait, i) => (
                    <Badge key={i} variant="secondary">{trait}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Starting Gear</h3>
                <div className="flex flex-wrap gap-2">
                  {generationResult.startingGear.map((item, i) => (
                    <Badge key={i} variant="outline">{item}</Badge>
                  ))}
                </div>
              </div>
               <Button className="w-full mt-6" onClick={createCharacterFromConcept}>
                Create Character with this Concept
              </Button>
            </CardContent>
          </Card>
        ) : !isGenerating && (
            <Card className="flex items-center justify-center min-h-[400px] border-dashed">
                 <div className="flex flex-col items-center text-center text-muted-foreground p-8">
                    <Wand2 className="h-12 w-12 mb-4"/>
                    <h3 className="font-semibold text-lg text-foreground mb-2">Your concept awaits</h3>
                    <p className="text-sm">Fill out the form and let the AI generate a character concept for you.</p>
                </div>
            </Card>
        )}
      </div>
    </div>
  );
}
