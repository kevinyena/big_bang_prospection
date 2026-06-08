import { z } from 'zod';
import type { BaseSkill, SkillContext } from '../BaseSkill.js';
import { callClaude, CLAUDE_MODEL } from '../runtime/anthropic.js';
import { renderTemplate } from '../runtime/render.js';
import { newSeed } from '../runtime/seed.js';
import { BusinessSchema } from '../video_ugc/CreateBusinessIdeaSkill.js';

// ----- Schemas -----
export const GenerateInstagramCaptionInputSchema = z.object({
  business: BusinessSchema.describe(
    'Business idea produced by create_business_idea (Video UGC pipeline).',
  ),
  videoScript: z
    .string()
    .optional()
    .describe(
      "Optionnel — le script vidéo (ou voiceover) tel que dit dans la vidéo UGC. Aide à écrire une caption qui RACCORDE au contenu visuel/audio.",
    ),
  languageName: z
    .string()
    .default('English')
    .describe("Langue de la caption — default English."),
  maxHashtags: z
    .number()
    .int()
    .min(3)
    .max(15)
    .default(8)
    .describe('Nb de hashtags à inclure. Default 8 (sweet spot Instagram).'),
});
export type GenerateInstagramCaptionInput = z.infer<typeof GenerateInstagramCaptionInputSchema>;

export const GeneratedInstagramCaptionSchema = z.object({
  caption: z
    .string()
    .describe(
      "Caption + hashtags prêts à coller. Hashtags fusionnés à la fin. Max 2200 chars.",
    ),
  captionBody: z.string().describe("Le texte sans les hashtags. Strictement maximum 12 mots, très engageant."),
  hashtags: z.array(z.string()).describe("Liste des hashtags (sans le #)."),
  rationale: z
    .string()
    .describe("1-2 phrases : pourquoi cette caption de maximum 12 mots + ce mix de hashtags marche pour ce business sur Instagram."),
});
export type GeneratedInstagramCaption = z.infer<typeof GeneratedInstagramCaptionSchema>;

// ----- Prompt -----
const PROMPT = `# ROLE
You write Instagram captions for Reels that get users to read the caption and engage. You know the algorithm: Instagram favors saves, shares, and comments. The hook should drive curiosity, and the caption should feel premium and native.

# HARD RULES
- Caption body MUST be maximum 12 words (strict limit). Exclude hashtags from this count.
- Caption body MUST always engage the reader (use a hook, question, curiosity gap, or call to action).
- NEVER use em dash (—) or en dash (–). Use comma, period, or space.
- NEVER use generic AI-flavored phrases: "Get ready to discover", "Unlock the power of", "Join us as we explore", "Are you tired of?", "Look no further".
- NEVER write the brand name in ALL CAPS in the caption body.
- NEVER stuff 15+ hashtags. {{maxHashtags}} is the cap.
- Max 2 emojis in the body. Do not spam emojis.

# WHAT WORKS ON INSTAGRAM
- Hook that immediately targets the user's problem.
- Ask a question or add a Call to Action (CTA) like "Save this Reel for later" or "Tag a friend who needs to see this".
- Spacing: use clean paragraphs.
- Hashtags: combine broad niches with hyper-specific tags.

# BUSINESS
{{business}}

# VIDEO SCRIPT
{{videoScript}}

# OUTPUT (strict JSON, written in {{languageName}})
{
  "caption": "full caption with hashtags merged at the end, single string ready to paste",
  "captionBody": "just the body, no hashtags",
  "hashtags": ["hashtag1", "hashtag2", ...],   // {{maxHashtags}} items, lowercase, no # prefix
  "rationale": "1-2 sentences explaining the hook + hashtag strategy for Instagram"
}

# VARIANCE
Random seed: {{seed}}
`;

// ----- Skill -----
export class GenerateInstagramCaptionSkill
  implements BaseSkill<GenerateInstagramCaptionInput, GeneratedInstagramCaption>
{
  public readonly name = 'generate_instagram_caption';
  public readonly description =
    "Génère une caption Instagram + hashtags optimisés pour un business donné, en s'appuyant sur le script vidéo UGC si fourni. Formaté pour Instagram Reels.";
  public readonly schema = GenerateInstagramCaptionInputSchema;

  public readonly displayName = 'Generate Instagram Caption';
  public readonly category = 'insta';
  public readonly order = 0;
  public readonly type = 'llm' as const;
  public readonly model = CLAUDE_MODEL;
  public readonly prompt = PROMPT;

  async execute(
    input: GenerateInstagramCaptionInput,
    _ctx?: SkillContext,
  ): Promise<GeneratedInstagramCaption> {
    const seed = newSeed();
    const userMessage = renderTemplate(this.prompt, {
      business: input.business,
      videoScript: input.videoScript ?? '(non fourni — écris la caption uniquement à partir du business)',
      languageName: input.languageName ?? 'English',
      maxHashtags: input.maxHashtags ?? 8,
      seed,
    });
    const raw = await callClaude({
      userMessage,
      schema: GeneratedInstagramCaptionSchema,
      effort: 'low',
    });

    const sanitize = (s: string): string =>
      s
        .replace(/\s+[—–]\s+/g, ', ')
        .replace(/[—–]/g, ',')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/,\s*,/g, ',')
        .replace(/\s{2,}/g, ' ')
        .trim();

    const cleanBody = sanitize(raw.captionBody);
    const cleanHashtags = raw.hashtags
      .map((h) => h.trim().replace(/^#/, '').toLowerCase())
      .filter((h) => h.length > 0)
      .slice(0, input.maxHashtags ?? 8);
    const fullCaption = `${cleanBody}\n\n${cleanHashtags.map((h) => `#${h}`).join(' ')}`.slice(0, 2200);

    return {
      caption: fullCaption,
      captionBody: cleanBody,
      hashtags: cleanHashtags,
      rationale: raw.rationale,
    };
  }
}
