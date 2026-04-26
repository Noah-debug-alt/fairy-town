// Prophecy generation utilities
// Generate future plot predictions based on existing plots

import { Novel, Plot, Character } from '@prisma/client';
import { getLlmModule } from './llm/index';

interface ProphecyData {
    title: string;
    content: string;
    probability: number;
    endingType: string;
    keyFactors: string[];
    involvedCharacterIds: number[];
}

const PROPHECY_GENERATION_PROMPT = `You are a novel plot prediction engine. Based on the following existing plots, predict possible future developments.

Novel Title: {novelTitle}

Existing Plots:
{existingPlots}

Characters:
{characters}

Task:
Generate 3-4 possible future plot branches. Each branch should include:
1. Title and content (200-300 words)
2. Probability (0-100, based on how likely this development is)
3. Ending type (good, bad, hidden, tragic, or normal)
4. Key factors that influence this branch
5. Involved character names

Requirements:
1. Predictions should logically follow from existing plots
2. Different branches should have clear differences
3. Consider character personalities and relationships
4. Include at least one "unexpected" branch
5. Maintain the style and tone of the original novel

Output format (JSON):
{
  "prophecies": [
    {
      "title": "Prophecy Title",
      "content": "Prophecy content...",
      "probability": 35,
      "endingType": "good",
      "keyFactors": ["factor1", "factor2"],
      "involvedCharacters": ["Character1", "Character2"]
    }
  ]
}

Output only the JSON, no additional text.`;

export async function generateProphecies(
    novel: Novel,
    plots: Plot[],
    characters: Character[]
): Promise<ProphecyData[]> {
    try {
        const llm = await getLlmModule();

        // Format existing plots
        const plotsText = plots.map((p, index) => 
            `${index + 1}. Chapter ${p.chapterIndex} Scene ${p.sceneIndex}: ${p.title}\n   ${p.content || p.narrationContent}`
        ).join('\n\n');

        // Format characters
        const charactersText = characters.map(c => 
            `- ${c.name}: ${c.description || 'No description'}`
        ).join('\n');

        // Build prompt
        const prompt = PROPHECY_GENERATION_PROMPT
            .replace('{novelTitle}', novel.title)
            .replace('{existingPlots}', plotsText)
            .replace('{characters}', charactersText);

        // Call LLM
        const response = await llm.chat(prompt);
        
        // Parse response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Failed to parse LLM response as JSON');
        }

        const parsed = JSON.parse(jsonMatch[0]);
        const prophecies: ProphecyData[] = [];

        // Get character ID mapping
        const characterNameToId = new Map<string, number>();
        characters.forEach(c => {
            characterNameToId.set(c.name, c.id);
        });

        for (const p of parsed.prophecies || []) {
            // Map character names to IDs
            const involvedIds: number[] = [];
            for (const name of p.involvedCharacters || []) {
                const id = characterNameToId.get(name);
                if (id) {
                    involvedIds.push(id);
                }
            }

            prophecies.push({
                title: p.title || 'Untitled Prophecy',
                content: p.content || '',
                probability: Math.min(100, Math.max(0, p.probability || 50)),
                endingType: ['good', 'bad', 'hidden', 'tragic', 'normal'].includes(p.endingType) 
                    ? p.endingType 
                    : 'normal',
                keyFactors: p.keyFactors || [],
                involvedCharacterIds: involvedIds
            });
        }

        return prophecies;
    } catch (error) {
        console.error('Error generating prophecies:', error);
        // Return default prophecies if LLM fails
        return [
            {
                title: 'The Path of Light',
                content: 'The protagonist finds the key to solving the crisis and brings hope to everyone. Through courage and wisdom, they overcome all obstacles and achieve a satisfying ending.',
                probability: 35,
                endingType: 'good',
                keyFactors: ['Courage', 'Wisdom', 'Friendship'],
                involvedCharacterIds: characters.slice(0, 2).map(c => c.id)
            },
            {
                title: 'The Shadow Falls',
                content: 'The crisis deepens, and the protagonist faces greater challenges. Despite their efforts, things take a turn for the worse, leading to a difficult ending.',
                probability: 25,
                endingType: 'bad',
                keyFactors: ['Misunderstanding', 'Conflict', 'Loss'],
                involvedCharacterIds: characters.slice(0, 3).map(c => c.id)
            },
            {
                title: 'Hidden Truth',
                content: 'An unexpected revelation changes everything. The protagonist discovers a secret that redefines their journey, leading to a surprising conclusion.',
                probability: 20,
                endingType: 'hidden',
                keyFactors: ['Secret', 'Revelation', 'Choice'],
                involvedCharacterIds: characters.slice(0, 2).map(c => c.id)
            },
            {
                title: 'Sacrifice and Redemption',
                content: 'To protect what matters most, the protagonist makes a difficult sacrifice. Their choice brings both sorrow and hope to those who remain.',
                probability: 20,
                endingType: 'tragic',
                keyFactors: ['Sacrifice', 'Love', 'Redemption'],
                involvedCharacterIds: characters.map(c => c.id)
            }
        ];
    }
}

export async function convertProphecyToPlots(
    prophecy: { title: string; content: string },
    novelId: number,
    startChapterIndex: number
): Promise<{
    chapterIndex: number;
    sceneIndex: number;
    title: string;
    content: string;
    narrationContent: string;
    dialogueContent: string[];
    involvedCharacterIds: number[];
    location: string;
}[]> {
    try {
        const llm = await getLlmModule();

        const prompt = `Convert the following prophecy into 2-3 detailed plot segments that can be simulated in a town.

Prophecy Title: ${prophecy.title}
Prophecy Content: ${prophecy.content}

For each plot segment, provide:
1. Scene title
2. Narration content (scene description)
3. Dialogue content (character conversations)
4. Location name

Output format (JSON):
{
  "plots": [
    {
      "title": "Scene Title",
      "narration": "Scene description...",
      "dialogues": [
        "Character A: Dialogue content",
        "Character B: Dialogue content"
      ],
      "location": "Location Name"
    }
  ]
}

Output only the JSON, no additional text.`;

        const response = await llm.chat(prompt);
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) {
            throw new Error('Failed to parse plot conversion response');
        }

        const parsed = JSON.parse(jsonMatch[0]);
        const plots = [];

        for (let i = 0; i < (parsed.plots || []).length; i++) {
            const p = parsed.plots[i];
            plots.push({
                chapterIndex: startChapterIndex,
                sceneIndex: i + 1,
                title: p.title || `Scene ${i + 1}`,
                content: p.narration || '',
                narrationContent: p.narration || '',
                dialogueContent: p.dialogues || [],
                involvedCharacterIds: [],
                location: p.location || ''
            });
        }

        return plots;
    } catch (error) {
        console.error('Error converting prophecy to plots:', error);
        // Return a simple plot if conversion fails
        return [{
            chapterIndex: startChapterIndex,
            sceneIndex: 1,
            title: prophecy.title,
            content: prophecy.content,
            narrationContent: prophecy.content,
            dialogueContent: [],
            involvedCharacterIds: [],
            location: 'Unknown'
        }];
    }
}

// AI assisted plot rewrite
export async function generatePlotRewrite(
    plot: Plot,
    characters: Character[],
    prompt: string
): Promise<{ speaker: string; content: string; emotion?: string }[]> {
    try {
        const llm = await getLlmModule();

        const charactersText = characters.map(c => c.name).join(', ');

        const fullPrompt = `You are a dialogue rewrite assistant. Based on the user's requirements, rewrite the following dialogue content.

Original Plot: ${plot.title}
Original Narration: ${plot.narrationContent || 'None'}
Original Dialogue: ${plot.dialogueContent || 'None'}
Available Characters: ${charactersText}

User Requirements: ${prompt}

Please generate new dialogue content. Each line should include:
- Speaker name
- Dialogue content
- Optional emotion

Output format (JSON):
{
  "dialogues": [
    {
      "speaker": "Character Name",
      "content": "Dialogue content",
      "emotion": "emotion (optional)"
    }
  ]
}

Output only the JSON, no additional text.`;

        const response = await llm.chat(fullPrompt);
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) {
            throw new Error('Failed to parse rewrite response');
        }

        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.dialogues || [];
    } catch (error) {
        console.error('Error generating plot rewrite:', error);
        // Return empty dialogues if generation fails
        return [];
    }
}

// Generate plot branch options
export async function generatePlotBranches(
    plot: Plot,
    characters: Character[]
): Promise<{ label: string; description: string; dialogues: { speaker: string; content: string }[] }[]> {
    try {
        const llm = await getLlmModule();

        const charactersText = characters.map(c => `${c.name}: ${c.description || 'No description'}`).join('\n');

        const fullPrompt = `You are a plot branch generator. Based on the current plot, generate 3 different development branches.

Current Plot: ${plot.title}
Narration: ${plot.narrationContent || 'None'}
Current Dialogue: ${plot.dialogueContent || 'None'}

Characters:
${charactersText}

Generate 3 different branches:
1. Branch A: A continuation that maintains the original tone
2. Branch B: A twist that introduces tension or conflict
3. Branch C: An unexpected turn of events

For each branch, provide:
- Label (short title)
- Description (brief explanation)
- Sample dialogues (3-5 lines)

Output format (JSON):
{
  "branches": [
    {
      "label": "Branch Title",
      "description": "Brief description",
      "dialogues": [
        { "speaker": "Character", "content": "Dialogue content" }
      ]
    }
  ]
}

Output only the JSON, no additional text.`;

        const response = await llm.chat(fullPrompt);
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) {
            throw new Error('Failed to parse branch response');
        }

        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.branches || [];
    } catch (error) {
        console.error('Error generating plot branches:', error);
        // Return default branches if generation fails
        return [
            {
                label: 'Continue as Planned',
                description: 'The story continues according to the original direction',
                dialogues: [
                    { speaker: 'Character', content: 'Let us continue on our journey.' }
                ]
            },
            {
                label: 'Unexpected Encounter',
                description: 'A new character appears and changes the situation',
                dialogues: [
                    { speaker: 'Stranger', content: 'Excuse me, may I join you?' }
                ]
            },
            {
                label: 'Hidden Secret',
                description: 'A secret is revealed that changes everything',
                dialogues: [
                    { speaker: 'Character', content: 'I have something to tell you...' }
                ]
            }
        ];
    }
}
