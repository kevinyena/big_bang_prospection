import { z } from 'zod';
import type { BaseSkill, SkillContext } from '../BaseSkill.js';
import { callClaude, CLAUDE_MODEL } from '../runtime/anthropic.js';
import { renderTemplate } from '../runtime/render.js';
import { newSeed } from '../runtime/seed.js';
import { expandSpintax } from '../runtime/spintax.js';
import { XOutreachBusinessSchema } from './CreateXOutreachBusinessSkill.js';

// ----- Schemas -----
export const GenerateXDMInputSchema = z.object({
  business: XOutreachBusinessSchema.describe('Business + ICP produits par CreateXOutreachBusinessSkill.'),
  languageName: z.string().describe('Langue du DM.'),
  variantCount: z
    .number()
    .int()
    .min(30)
    .max(60)
    .default(30)
    .describe(
      'Nb minimum de variantes uniques à générer après expansion Spintax. Default 30. X anti-spam détecte les patterns sémantiques — plus de variations = score de confiance préservé.',
    ),
  businessUrl: z
    .string()
    .optional()
    .describe(
      "URL du business (site web, landing page) à inclure naturellement dans le DM. Si fourni, Claude l'intègre dans le template Spintax sous une forme conversationnelle (pas de bloc 'visit ___')." ,
    ),
});
export type GenerateXDMInput = z.infer<typeof GenerateXDMInputSchema>;

export const GeneratedXDMSchema = z.object({
  template: z
    .string()
    .min(20)
    .max(2000)
    .describe(
      "Template DM avec spintax {a/b/c}. 4-6 groupes spintax, au moins 3 options chacun. Pas de placeholder {firstName} ici — c'est juste de la variation linguistique.",
    ),
  rationale: z
    .string()
    .describe('Pourquoi ce hook marche pour cet ICP (mécanique psychologique exploitée).'),
  variants: z
    .array(z.string())
    .describe('Variantes uniques générées par expansion du template (post-traitement).'),
  totalCombos: z
    .number()
    .describe('Nb total de combinaisons possibles dans le template.'),
});
export type GeneratedXDM = z.infer<typeof GeneratedXDMSchema>;

// ----- Prompt -----
// IMPORTANT: this prompt has been tuned hard to kill the "AI smell" that
// makes prospects screenshot DMs for the "this is GPT" laugh:
//   - NO em dash (—) or en dash (–). Use comma, period, or just a space.
//   - NO markdown anywhere (# * ** _ ` > -). Plain text only.
//   - NO "I hope this finds you well", "I came across your profile", or any
//     hedged "noticed you / spotted your thread" filler intro.
//   - Lead with the OFFER, not with flattery. First sentence must already
//     hint at what we sell.
//   - Casual, lowercase OK, contractions encouraged. Short sentences.
const PROMPT = `# ROLE
You are writing cold DMs on X (Twitter) that get replies, not screenshots posted to "look at this AI spam".

# HARD STYLISTIC RULES (violations are auto-rejected by the user)
- NEVER use the em dash character (—) or en dash (–). Use comma, period, or just a space.
- NEVER use markdown of any kind: no #, no *, no **, no _, no \`, no >, no bullet lists.
- NEVER write a generic "saw your tweet" / "noticed your thread" / "came across your profile" opener. Those scream cold-outreach-template.
- NEVER start with "Hello" or "Hi there" or any other neutral greeting that delays the point.
- NEVER use phrases like "I hope this finds you well", "I wanted to reach out", "I'd love to connect", "quick question", "10 minutes of your time".
- NEVER use emojis at the start of the message. One small emoji somewhere in the body is OK if it fits the voice.
- NEVER pitch with "we" or corporate plural. Single human DMing single human.

# OPENING RULE (the most important)
The FIRST sentence must already tell the recipient WHAT YOU SELL or WHAT YOU BUILT. Not after a setup. Not after a compliment. Right away, smoothly woven into a natural opener.

Bad opening (do not do this): "{Hey/Hi}, saw your latest thread on X. I built a tool that helps {ICP}..."
Good opening (do this): "{Built/Just shipped/Made} a tiny tool that {does X} for {ICP_TYPE} like you, figured it might land."

The good opener mentions the product in the first beat, the relevance to them in the second. No 2-sentence runway before the pitch.

# WHAT MAKES IT LAND
- One concrete thing you built. Name it or describe it in 4-6 words.
- One concrete reason it maps to the recipient's life (their handle/bio gave you the keyword).
- A soft door at the end: a question, a "want me to send the link", or a free thing. Not "book a call".
- Total length under 280 characters AFTER expansion. Aim for the 180 to 260 range.

# MISSION
Generate ONE Spintax template in {{languageName}} using {option1/option2/option3} syntax on the variable parts. Server-side expansion will produce {{variantCount}}+ unique variants.

# SPINTAX CONSTRAINTS (HARD — enforced by code)
- The total number of unique combinations MUST be ≥ {{variantCount}}. With {{variantCount}} = 30, you need e.g. 5 groups × 3 options + 1 group × 2 options = 3^5 × 2 = 486 combos. Or 4 groups × 4 options = 256. Pick a layout that gives WAY more than {{variantCount}}.
- 5 to 7 spintax groups in the template (more groups = more semantic variety).
- 3 to 5 options per group.
- Options within a group must be **semantically different**, not just synonyms. e.g. "{built a tool/hacked together a script/just shipped a thing}" — different vibes, not "{made/created/built}".
- No curly braces outside of spintax groups.
- No {firstName} or similar placeholders. The DM is generic for the ICP, not per-prospect personalized.
- Do NOT use em dash inside spintax options. Verify every option.

# WHY THIS MATTERS
X's anti-spam ML now compares semantic embeddings across recent outbound DMs from your account. If 30 cold DMs share the same skeleton with surface-level word swaps, your trust score tanks within 8-10 sends and EVERY subsequent DM gets shadow-blocked (403). So vary the STRUCTURE, not just words.

# VARIANCE
Random seed: {{seed}}

# INPUTS
- Business: {{business}}
- Business URL (include naturally in the message if non-empty, otherwise ignore): {{businessUrl}}
- Language for the DM: {{languageName}}

# BUSINESS URL HANDLING
If a businessUrl is provided, integrate it inside ONE of the spintax groups as a soft mention, e.g.:
  "{want the link? {{businessUrl}}/free if you’re curious|drop the link here {{businessUrl}}|the page is {{businessUrl}} if you wanna peek}"
NEVER put it as a separate "Visit our website: ___" block. Always conversational.
If businessUrl is empty, skip the link entirely (soft CTA stays "want the link?" or similar).

# CALIBRATION EXAMPLE (English, for STYLE only, do NOT copy verbatim, generate fresh in {{languageName}})
"{Built/Shipped/Just put out} {PRODUCT_DESC} for {ICP_TYPE}. {Saw you're/Noticed you're/Looks like you're} {ICP_ACTIVITY}, figured it'd {save you a chunk of time/be up your alley/click}. {Free for the first month/Open beta/Yours to try} if you want the link, no pitch deck."

Notice: product mentioned in word 2. No em dash. No markdown. No bullshit intro. Casual. Comma where most writers would em-dash.

# OUTPUT (strict JSON)
{
  "template": "the full Spintax template, written in {{languageName}}, respecting every rule above",
  "rationale": "one or two sentences explaining why this hook works for this ICP (psychology, not features)",
  "variants": [],
  "totalCombos": 0
}

Leave variants: [] and totalCombos: 0 empty. The code expands them after.
`;

// ----- Skill -----
export class GenerateXDMSkill implements BaseSkill<GenerateXDMInput, GeneratedXDM> {
  public readonly name = 'generate_x_dm';
  public readonly description =
    'Crée un template de DM X au format Spintax {a/b/c} qui s\'expanse en N (≥6) variantes uniques. Adapté à l\'ICP du business.';
  public readonly schema = GenerateXDMInputSchema;

  public readonly displayName = 'Generate X DM';
  public readonly category = 'x_dm';
  public readonly order = 3;
  public readonly type = 'llm' as const;
  public readonly model = CLAUDE_MODEL;
  public readonly prompt = PROMPT;

  async execute(input: GenerateXDMInput, _ctx?: SkillContext): Promise<GeneratedXDM> {
    const seed = newSeed();
    const target = input.variantCount ?? 30;
    const userMessage = renderTemplate(this.prompt, {
      business: input.business,
      languageName: input.languageName,
      variantCount: target,
      businessUrl: input.businessUrl ?? '',
      seed,
    });
    const raw = await callClaude({
      userMessage,
      schema: GeneratedXDMSchema,
      effort: 'high',
    });

    // Belt-and-suspenders sanitizer. The prompt forbids these but Claude
    // occasionally slips a single em dash through, especially at higher temp
    // equivalents. Strip them out so no DM ever ships with the AI-tell.
    const sanitized = sanitizeAITells(raw.template);

    // Server-side expansion — Claude can't reliably enumerate the combinations
    // itself, so we always re-derive variants from the template.
    const expansion = expandSpintax(sanitized, target);
    return {
      template: sanitized,
      rationale: raw.rationale,
      variants: expansion.variants,
      totalCombos: expansion.totalCombos,
    };
  }
}

/**
 * Remove the telltale markers that scream "AI wrote this":
 *   - em dash (—) and en dash (–) → comma + space (preserves rhythm)
 *   - markdown emphasis (* ** _) → strip
 *   - leading heading markers (# ## ###) → strip
 *   - leading bullet hyphens "- " → strip
 *   - " — " inside spintax options is the worst offender; we hit it first.
 */
function sanitizeAITells(template: string): string {
  let s = template;
  // Dashes (the #1 AI tell) → comma. Handle space-padded and unpadded.
  s = s.replace(/\s+[—–]\s+/g, ', ');
  s = s.replace(/[—–]/g, ',');
  // Markdown bold/italic (** _ * around words)
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1');
  s = s.replace(/\*([^*]+)\*/g, '$1');
  s = s.replace(/(?<!\w)_([^_]+)_(?!\w)/g, '$1');
  // Markdown headings if any line starts with #
  s = s.replace(/^#{1,6}\s+/gm, '');
  // Leading bullet hyphens
  s = s.replace(/^\s*-\s+/gm, '');
  // Collapse any double commas/spaces introduced by replacements
  s = s.replace(/,\s*,/g, ',').replace(/\s{2,}/g, ' ').replace(/\s+,/g, ',');
  return s.trim();
}
