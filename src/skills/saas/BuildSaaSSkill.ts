import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import type { BaseSkill, SkillContext } from '../BaseSkill.js';
import { callBedrockConverse } from '../runtime/bedrock.js';
import { callDirectAnthropic, type AnthropicContentBlock } from '../runtime/anthropic.js';
import { renderTemplate } from '../runtime/render.js';
import { searchMobbinScreens, type MobbinScreen } from '../runtime/mobbin.js';
import { analyzeUrl, type UrlAnalysis } from '../runtime/url-analyzer.js';

export const BuildSaaSInputSchema = z.object({
  businessIdea: z.string().describe("Description détaillée de l'idée de SaaS à construire."),
  projectName: z.string().describe("Nom de code ou de marque souhaité pour le projet (ex: 'SaaSify')."),
  modelId: z.string().optional().describe("ID du modèle AWS Bedrock à utiliser (ex: 'us.anthropic.claude-3-5-sonnet-20241022-v2:0')."),
  modeOuss: z.boolean().optional().describe("Active le Mode Oussama : landing page dans le style scalewithouss.com."),
  referenceUrl: z.string().url().optional().describe("URL d'une landing page de référence à reproduire. Si fournie, remplace Mobbin."),
});

export type BuildSaaSInput = z.infer<typeof BuildSaaSInputSchema>;

export interface SaaSGeneratedFile {
  path: string;
  content: string;
}

export interface BuildSaaSOutput {
  projectName: string;
  projectSlug: string;
  files: SaaSGeneratedFile[];
  explanation: string;
  previewUrl: string;
  mobbinQueries?: string[];
  mobbinScreens?: MobbinScreen[];
  mobbinLandingQueries?: string[];
  mobbinAppQueries?: string[];
  mobbinLandingScreens?: MobbinScreen[];
  mobbinAppScreens?: MobbinScreen[];
}

interface ProgressState {
  status: 'generating' | 'completed' | 'failed';
  step: number;
  totalSteps: number;
  statusText: string;
  files: string[];
  referenceUrl?: string;
  referencePageTitle?: string;
  referenceScreenshotUrl?: string;
  referenceHtmlLength?: number;
  referenceCssLength?: number;
  mobbinQueries?: string[];
  mobbinScreens?: MobbinScreen[];
  mobbinLandingQueries?: string[];
  mobbinAppQueries?: string[];
  mobbinLandingScreens?: MobbinScreen[];
  mobbinAppScreens?: MobbinScreen[];
  mobbinSelectionAttempts?: number;
  mobbinSelectedScreen?: MobbinScreen & { relevanceScore: number; reproducibilityScore: number };
  error?: string;
}

interface ScreenScore {
  screenId: string;
  relevanceScore: number;
  reproducibilityScore: number;
  reasoning: string;
}

interface ScoreBatchResult {
  scores: ScreenScore[];
}

const LANDING_SCORE_TOOLS = [
  {
    toolSpec: {
      name: 'save_scores',
      description: 'Enregistre les scores d\'évaluation de chaque landing page candidate.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            scores: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  screenId: { type: 'string', description: 'ID unique du screen évalué' },
                  relevanceScore: { type: 'number', description: 'Score de pertinence 0-100 : à quel point le design de ce screen correspond à la demande SaaS (thème, industrie, structure)' },
                  reproducibilityScore: { type: 'number', description: 'Score de reproductibilité 0-100 : à quel point tu pourrais reproduire ce design à 90%+ en HTML/CSS pur (couleurs, layout, typographies, effets visuels)' },
                  reasoning: { type: 'string', description: 'Explication courte de l\'évaluation' },
                },
                required: ['screenId', 'relevanceScore', 'reproducibilityScore', 'reasoning'],
              },
              description: 'Scores pour chaque screen candidat',
            },
          },
          required: ['scores'],
        },
      },
    },
  },
];

const REFINE_QUERY_TOOLS = [
  {
    toolSpec: {
      name: 'save_queries',
      description: 'Enregistre les nouvelles requêtes Mobbin affinées.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            queries: {
              type: 'array',
              items: { type: 'string', description: 'Requête de recherche Mobbin affinée en anglais' },
              description: '1 ou 2 nouvelles requêtes Mobbin plus ciblées',
            },
          },
          required: ['queries'],
        },
      },
    },
  },
];

const SELECTION_THRESHOLD = 80;
const MAX_LANDING_ATTEMPTS = 6;

async function scoreLandingScreensBatch(
  modelId: string,
  screens: MobbinScreen[],
  businessIdea: string,
  projectName: string
): Promise<ScoreBatchResult> {
  const screenList = screens.map(s =>
    `- ID: "${s.id}" | App: "${s.app_name}" | Image: ${s.image_url}`
  ).join('\n');

  const system = `Tu es un expert UI/UX et développeur frontend d'élite. Tu évalues des captures d'écran de landing pages trouvées sur Mobbin pour déterminer laquelle est la meilleure référence de design à reproduire en code HTML/CSS.
Tu scores chaque screen sur 2 axes :
1. PERTINENCE (0-100) : Le design correspond-il au type de SaaS demandé ? Est-ce le bon type de page (landing page, pas un dashboard ou une page interne) ? Le style, l'industrie et la structure sont-ils adaptés ?
2. REPRODUCTIBILITÉ (0-100) : Pourrais-tu reproduire ce design à 90%+ en HTML/CSS pur ? Les éléments visuels (layout, couleurs, typographies, effets, illustrations) sont-ils réalisables sans assets propriétaires complexes ?
Sois STRICT et EXIGEANT dans tes scores. Un score de 80+ signifie que le screen est excellent sur cet axe.`;

  const userMessage = `Évalue ces landing pages Mobbin pour le SaaS "${projectName}" :
Idée business : ${businessIdea}

Screens candidats :
${screenList}

Tu DOIS appeler l'outil 'save_scores' avec un score pour CHAQUE screen listé.`;

  const result = await executeLLMStep(modelId, system, userMessage, 'save_scores', LANDING_SCORE_TOOLS);
  return result as ScoreBatchResult;
}

async function generateRefinedMobbinQueries(
  modelId: string,
  businessIdea: string,
  projectName: string,
  previousQueries: string[],
  rejectedScreens: { appName: string; reasoning: string }[]
): Promise<string[]> {
  const system = `Tu es un expert en recherche de designs UI/UX. Tu génères des requêtes de recherche en anglais pour l'API Mobbin afin de trouver des landing pages de référence de très haute qualité. Tu dois proposer des requêtes DIFFÉRENTES et MEILLEURES que les précédentes, en tenant compte du feedback sur les screens rejetés.`;

  const rejectedInfo = rejectedScreens.map(s =>
    `- "${s.appName}" : ${s.reasoning}`
  ).join('\n');

  const userMessage = `Je cherche une landing page de référence pour le SaaS "${projectName}" :
Idée business : ${businessIdea}

Requêtes précédentes (qui n'ont pas donné de bons résultats) :
${previousQueries.map(q => `- "${q}"`).join('\n')}

Screens rejetés et raisons :
${rejectedInfo}

Génère 1 ou 2 nouvelles requêtes Mobbin en anglais, plus ciblées et différentes des précédentes.
Tu DOIS appeler l'outil 'save_queries'.`;

  const result = await executeLLMStep(modelId, system, userMessage, 'save_queries', REFINE_QUERY_TOOLS);
  return result.queries || [];
}

function updateProgress(slug: string, state: ProgressState) {
  const projectDir = path.join(process.cwd(), 'public', 'saas-builds', slug);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(
    path.join(projectDir, 'progress.json'),
    JSON.stringify(state, null, 2),
    'utf-8'
  );
}

async function executeLLMStep(
  modelId: string,
  system: string,
  userMessage: string | AnthropicContentBlock[],
  toolName: string,
  tools: any[]
): Promise<any> {
  let response;
  if (modelId.startsWith('direct:')) {
    const directModelId = modelId.substring(7);
    console.log(`[BuildSaaS] Step Calling direct Anthropic model: ${directModelId}`);
    response = await callDirectAnthropic({
      system,
      userMessage,
      modelId: directModelId,
      tools,
      toolChoice: { tool: { name: toolName } },
    });
  } else {
    // Bedrock doesn't support content blocks with images — convert to string
    const msg = typeof userMessage === 'string' ? userMessage : userMessage.filter(b => b.type === 'text').map(b => (b as any).text).join('\n');
    console.log(`[BuildSaaS] Step Calling Bedrock model: ${modelId}`);
    response = await callBedrockConverse({
      system,
      userMessage: msg,
      modelId,
      tools,
      toolChoice: { tool: { name: toolName } },
    });
  }

  const stopReason = response.stopReason || response.stop_reason;
  console.log(`[BuildSaaS] Step complete. stopReason: ${stopReason}`);
  if (stopReason === 'max_tokens' || stopReason === 'maxTokens') {
    throw new Error("La génération du code a été interrompue car le modèle a dépassé sa limite maximale de tokens. Veuillez simplifier votre demande.");
  }

  const content = response.output?.message?.content;
  if (!content || !Array.isArray(content)) {
    throw new Error('Réponse vide ou format de message invalide.');
  }

  let toolUseBlock: any = null;
  for (const block of content) {
    if (block.toolUse) {
      toolUseBlock = block.toolUse;
      break;
    }
  }

  if (!toolUseBlock) {
    throw new Error(`L'assistant n'a pas appelé l'outil '${toolName}'.`);
  }

  return toolUseBlock.input;
}

export class BuildSaaSSkill implements BaseSkill<BuildSaaSInput, BuildSaaSOutput> {
  public readonly name = 'build_saas';
  public readonly description =
    'Conçoit et génère le code source complet d\'un SaaS fonctionnel et interactif à partir d\'une idée, en utilisant AWS Bedrock ou Claude Direct et l\'API Mobbin.';
  public readonly schema = BuildSaaSInputSchema;

  public readonly displayName = 'Build SaaS (Bedrock)';
  public readonly category = 'saas';
  public readonly order = 1;
  public readonly type = 'llm' as const;
  public readonly model = 'AWS Bedrock Claude';

  async execute(input: BuildSaaSInput, _ctx?: SkillContext): Promise<BuildSaaSOutput> {
    const slug = input.projectName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'my-saas';

    const modelId = input.modelId || process.env.AWS_BEDROCK_MODEL || 'us.anthropic.claude-3-5-sonnet-20241022-v2:0';

    const projectDir = path.join(process.cwd(), 'public', 'saas-builds', slug);
    fs.mkdirSync(projectDir, { recursive: true });

    const totalSteps = 4;
    const progress: ProgressState = {
      status: 'generating',
      step: 1,
      totalSteps,
      statusText: "Étape 1/4 : Planification et conception de l'architecture...",
      files: [],
    };

    updateProgress(slug, progress);

    try {
      // --- ÉTAPE 1 : Planification & Mobbin Queries ---
      const isModeOuss = !!(input as any).modeOuss && !input.referenceUrl;

      // ====== OUSSAMA DESIGN SYSTEM REFERENCE ======
      const oussDesignSystem = `
=== DESIGN SYSTEM "OUSSAMA" (scalewithouss.com) ===
COULEURS :
- Background principal : #020215 (bleu-noir spatial)
- Primary/Accent : #0303ab (cobalt blue profond)
- Secondary/Highlight : #e278e7 (rose/magenta vif pour annotations, soulignements, textes handwritten)
- Text principal : #ffffff
- Text secondaire : rgba(255,255,255,0.7)
- Bordures de cartes : rgba(255,255,255,0.08) fine (1px)
- Glow/shadow : 0 0 60px rgba(3,3,171,0.3)

TYPOGRAPHIE (Google Fonts) :
- Titres / Headings : 'Space Grotesk', sans-serif (font-weight: 700-900, uppercase, letter-spacing: 2-4px)
- Body / Paragraphes : 'Outfit', sans-serif (font-weight: 300-500)
- Annotations handwritten / accents / badges décoratifs : 'Caveat' ou 'Patrick Hand', cursive (couleur #e278e7)
- Code / Tags techniques : 'JetBrains Mono', monospace

LAYOUT & MOTIFS :
- Hero section : texte centré géant en uppercase Space Grotesk, avec une ligne en couleur #e278e7 (en Caveat, légèrement inclinée -2deg à 3deg) qui sert d'annotation/accent
- Soulignement magenta (trait SVG ou border-bottom en #e278e7 sous certains mots clés)
- Dot pattern subtil en arrière-plan (radial-gradient de petits points semi-transparents)
- Cards avec fond légèrement plus clair que le background (#0a0a2a), border fine translucide, border-radius: 16-20px
- Badges/Tags : petits éléments flottants avec border 1px solid rgba(226,120,231,0.4), border-radius: 20px, texte uppercase en JetBrains Mono
- Blockquotes avec barre verticale à gauche en #e278e7
- Boutons CTA : background #0303ab, border 1px solid rgba(226,120,231,0.5), texte uppercase, letter-spacing
- Boutons secondaires : fond transparent, border 1px solid rgba(255,255,255,0.2)
- Sticky navbar minimaliste en haut avec backdrop-filter blur
- Sections de pricing avec grandes typographies et accents en rose
- Texte de témoignages en italique Caveat
- Sparkle/star decorations (✦ ◇ ☆) comme ornements visuels dans les cards
`;

      const planSystemPromptDefault = `Tu es un chef de projet tech d'élite et UI/UX designer. Tu DOIS concevoir en priorité absolue une Page d'Accueil / Homepage / Landing Page publique magnifique et immersive pour présenter le service. L'application ne doit PAS démarrer directement sur un tableau de bord (dashboard) d'administration générique ou une interface interne vide. Tu dois intégrer des fonctionnalités interactives orientées utilisateur final (par exemple : un système de réservation de coiffeur/barber, un catalogue de véhicules de prestige avec filtres et calculateur de prix de location, un menu de restaurant avec panier de commande interactif, etc.) directement accessibles depuis la page d'accueil ou via une navigation fluide.
CONTRÔLE DE LA TAILLE : L'application Single Page (SPA) doit être très compacte et ciblée pour ne pas dépasser la limite de tokens (max_tokens). Ne multiplie pas les vues ou les sections complexes (limite à : 1 Landing Page principale d'accueil et 1 ou 2 vues/modales fonctionnelles interactives). Si l'utilisateur demande des fonctionnalités secondaires comme une partie d'administration (admin panel), implémente-la sous la forme d'un simple onglet ou d'une modale contenant le strict minimum d'éléments interactifs.
Tu analyses l'idée de SaaS de l'utilisateur, conçois l'architecture de la Single Page Application (SPA), définis le concept, les fonctionnalités clés, le thème visuel, et les routes d'API backend nécessaires.
Tu DOIS également proposer des requêtes en anglais très descriptives pour rechercher des captures d'écran de designs web de classe mondiale sur l'API Mobbin :
- 1 ou 2 requêtes ciblant spécifiquement des Landing Pages / Pages d'accueil (ex: "SaaS landing page with modern dashboard preview", "payment gateway home page dark mode").
- 2 ou 3 requêtes ciblant spécifiquement l'interface interne de l'application, comme le Dashboard et les Features (ex: "SaaS analytics dashboard neon charts", "kanban board workflow editor minimal interface").`;

      const planSystemPromptOuss = `Tu es un chef de projet tech d'élite et UI/UX designer. Tu DOIS concevoir une Landing Page / Homepage publique dans le style EXACT du site scalewithouss.com d'Oussama Ammar.
${oussDesignSystem}
L'application doit démarrer par une Landing Page immersive avec ce design system. Tu dois intégrer des fonctionnalités interactives orientées utilisateur final directement accessibles depuis la page d'accueil.
CONTRÔLE DE LA TAILLE : SPA compacte (1 Landing Page + 1-2 vues/modales). Max tokens limité.
Tu analyses l'idée SaaS, conçois l'architecture, définis le concept et les fonctionnalités clés.
Pour les requêtes Mobbin : tu ne proposes PAS de requêtes pour les landing pages (elles ne sont pas nécessaires car tu suis le design system Oussama). Tu proposes uniquement 2-3 requêtes pour l'interface interne / dashboard / features de l'application.`;

      const clonerPlanSystemPrompt = `Tu es un chef de projet tech d'élite et expert en rétro-conception d'interfaces. Tu analyses le site web de référence fourni (screenshot et code source HTML) et tu conçois un plan détaillé pour cloner sa structure visuelle et son design system à 100% à l'identique (pixel-perfect), tout en adaptant son contenu textuel et ses fonctionnalités au concept de SaaS demandé par l'utilisateur.
Tu dois :
1. Identifier la structure exacte de la page de référence (les sections principales à reproduire : navbar, hero, grilles de fonctionnalités, FAQ, témoignages, footer).
2. Extraire la palette de couleurs exacte (fond, texte, boutons, accents, bordures).
3. Déterminer les typographies et polices de caractères nécessaires.
4. Expliquer comment adapter le contenu textuel et les illustrations de la page de référence pour présenter le SaaS de l'utilisateur ("${input.businessIdea}") sous le nom de marque "${input.projectName}" tout en conservant la structure syntaxique et la mise en page originale.
Tu appelles l'outil 'save_plan' avec le nom final, tes explications techniques détaillées, et tu laisses les requêtes Mobbin vides [] (car la référence de design est entièrement fournie).`;

      const clonerPlanUserMessage = `Conçois le plan détaillé pour cloner la structure de design de la page de référence suivante tout en l'adaptant au SaaS demandé :
URL de référence : ${input.referenceUrl}
Nom du SaaS à construire : ${input.projectName}
Idée de SaaS (Prompt Business) : ${input.businessIdea}

Tu DOIS appeler l'outil 'save_plan' avec ton plan détaillé de clonage visuel et d'adaptation du contenu (en Markdown), et laisser mobbinLandingQueries et mobbinAppQueries vides [] car le design est entièrement fourni par la référence.`;

      let planSystemPrompt = planSystemPromptDefault;
      let planUserMessage = `Conçois le plan d'architecture du SaaS suivant :
Nom du projet : ${input.projectName}
Idée business : ${input.businessIdea}

Tu DOIS appeler l'outil 'save_plan' avec le nom final, tes explications (en Markdown), ainsi que les requêtes spécifiques pour les Landing Pages et l'Application.`;

      if (input.referenceUrl) {
        planSystemPrompt = clonerPlanSystemPrompt;
        planUserMessage = clonerPlanUserMessage;
      } else if (isModeOuss) {
        planSystemPrompt = planSystemPromptOuss;
        planUserMessage = `Conçois le plan d'architecture du SaaS suivant dans le STYLE EXACT de scalewithouss.com :
Nom du projet : ${input.projectName}
Idée business : ${input.businessIdea}

Tu DOIS appeler l'outil 'save_plan' avec le nom final, tes explications (en Markdown). Pour mobbinLandingQueries, renvoie un tableau VIDE [] car le design de la landing est imposé (style Oussama). Génère uniquement des mobbinAppQueries pour le dashboard/features.`;
      }

      const planTools = [
        {
          toolSpec: {
            name: 'save_plan',
            description: 'Enregistre le plan d\'architecture et de design du SaaS, ainsi que les requêtes de recherche de design.',
            inputSchema: {
              json: {
                type: 'object',
                properties: {
                  projectName: { type: 'string', description: 'Nom de projet final' },
                  explanation: { type: 'string', description: 'Explications de fonctionnement, choix techniques et d\'UI/UX (Markdown)' },
                  mobbinLandingQueries: {
                    type: 'array',
                    items: { type: 'string', description: 'Requête de recherche en anglais pour une page d\'accueil / landing (vide en mode Oussama)' },
                    description: 'Requêtes landing page (vide [] en mode Oussama).'
                  },
                  mobbinAppQueries: {
                    type: 'array',
                    items: { type: 'string', description: 'Requête de recherche en anglais pour le dashboard et les fonctionnalités de l\'application (ex: "SaaS dashboard with neon charts", "kanban board task editor interface")' },
                    description: 'Génère 2 ou 3 requêtes en anglais pour trouver des références de l\'application (dashboard, features).'
                  }
                },
                required: ['projectName', 'explanation', 'mobbinLandingQueries', 'mobbinAppQueries'],
              },
            },
          },
        },
      ];

      const planResult = await executeLLMStep(modelId, planSystemPrompt, planUserMessage, 'save_plan', planTools);
      const finalProjectName = planResult.projectName || input.projectName;
      const explanation = planResult.explanation;
      const mobbinLandingQueries = planResult.mobbinLandingQueries || [];
      const mobbinAppQueries = planResult.mobbinAppQueries || [];

      // ====== URL REFERENCE ANALYSIS (replaces Mobbin when referenceUrl is provided) ======
      let urlAnalysis: UrlAnalysis | null = null;
      let referenceImageBlocks: AnthropicContentBlock[] = [];

      if (input.referenceUrl) {
        progress.statusText = `Étape 1/4 : Lancement du navigateur headless pour capturer ${input.referenceUrl}...`;
        progress.referenceUrl = input.referenceUrl;
        updateProgress(slug, progress);

        try {
          urlAnalysis = await analyzeUrl(input.referenceUrl);

          // Save screenshot to project directory so client can display it
          const screenshotPath = path.join(projectDir, 'reference-screenshot.jpg');
          fs.writeFileSync(screenshotPath, Buffer.from(urlAnalysis.screenshotBase64, 'base64'));
          const screenshotUrl = `/saas-builds/${slug}/reference-screenshot.jpg`;

          progress.statusText = `Étape 1/4 : Screenshot capturé de "${urlAnalysis.pageTitle}" (${(urlAnalysis.screenshotBase64.length / 1024).toFixed(0)}KB) — analyse du HTML...`;
          progress.referencePageTitle = urlAnalysis.pageTitle;
          progress.referenceScreenshotUrl = screenshotUrl;
          progress.referenceHtmlLength = urlAnalysis.htmlSource.length;
          progress.referenceCssLength = urlAnalysis.cssSource.length;
          updateProgress(slug, progress);

          console.log(`[BuildSaaS] ✅ URL analysis complete: "${urlAnalysis.pageTitle}" (screenshot: ${(urlAnalysis.screenshotBase64.length / 1024).toFixed(0)}KB b64, HTML: ${urlAnalysis.htmlSource.length} chars)`);

          // Build image content blocks for LLM calls
          referenceImageBlocks = [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: urlAnalysis.screenshotBase64,
              },
            },
          ];
        } catch (urlErr) {
          console.error('[BuildSaaS] URL analysis failed, proceeding without reference:', urlErr);
          progress.statusText = `Étape 1/4 : ⚠️ Échec capture de ${input.referenceUrl} — continuation sans référence...`;
          updateProgress(slug, progress);
          urlAnalysis = null;
        }
      }

      // ====== MOBBIN FLOW ======
      // When referenceUrl is provided: skip LANDING queries only, still run APP/dashboard queries
      // When no referenceUrl: run full Mobbin flow as before
      let mobbinLandingScreens: MobbinScreen[] = [];
      let selectedLandingScreen: (MobbinScreen & { relevanceScore: number; reproducibilityScore: number }) | null = null;
      let mobbinAppScreens: MobbinScreen[] = [];

      if (!input.referenceUrl) {
        // Query Mobbin API for Landing Page screenshots with intelligent selection (SKIP in Mode Oussama)
        if (!isModeOuss && mobbinLandingQueries.length > 0) {
          let currentQueries = [...mobbinLandingQueries];
          let allUsedQueries: string[] = [...mobbinLandingQueries];
          let bestScreenOverall: (MobbinScreen & { relevanceScore: number; reproducibilityScore: number }) | null = null;
          let bestScoreOverall = 0;
          const allRejected: { appName: string; reasoning: string }[] = [];

          for (let attempt = 1; attempt <= MAX_LANDING_ATTEMPTS; attempt++) {
            progress.statusText = `Étape 1/4 : Recherche Mobbin (tentative ${attempt}/${MAX_LANDING_ATTEMPTS})...`;
            progress.mobbinLandingQueries = allUsedQueries;
            progress.mobbinSelectionAttempts = attempt;
            updateProgress(slug, progress);

            let candidateScreens: MobbinScreen[] = [];
            try {
              for (const query of currentQueries) {
                const screens = await searchMobbinScreens(query, 'web', 3);
                candidateScreens = candidateScreens.concat(screens);
              }
              const seenIds = new Set(mobbinLandingScreens.map(s => s.id));
              candidateScreens = candidateScreens.filter(s => {
                if (seenIds.has(s.id) || !s.image_url) return false;
                seenIds.add(s.id);
                return true;
              });
              mobbinLandingScreens = mobbinLandingScreens.concat(candidateScreens);
            } catch (mobbinErr) {
              console.error(`[BuildSaaS] Mobbin landing query failed (attempt ${attempt}):`, mobbinErr);
              continue;
            }

            if (candidateScreens.length === 0) {
              console.log(`[BuildSaaS] No new screens found on attempt ${attempt}, trying refined queries...`);
              if (attempt < MAX_LANDING_ATTEMPTS) {
                try {
                  currentQueries = await generateRefinedMobbinQueries(
                    modelId, input.businessIdea, finalProjectName, allUsedQueries, allRejected
                  );
                  allUsedQueries = allUsedQueries.concat(currentQueries);
                } catch (err) {
                  console.error('[BuildSaaS] Failed to generate refined queries:', err);
                }
              }
              continue;
            }

            progress.statusText = `Étape 1/4 : Analyse et scoring des ${candidateScreens.length} designs (tentative ${attempt})...`;
            updateProgress(slug, progress);

            try {
              const scoreResult = await scoreLandingScreensBatch(
                modelId, candidateScreens, input.businessIdea, finalProjectName
              );
              for (const score of scoreResult.scores) {
                const screen = candidateScreens.find(s => s.id === score.screenId);
                if (!screen) continue;
                const combinedScore = (score.relevanceScore + score.reproducibilityScore) / 2;
                console.log(`[BuildSaaS] Screen "${screen.app_name}" (${screen.id}): relevance=${score.relevanceScore}, reproducibility=${score.reproducibilityScore}, combined=${combinedScore.toFixed(1)}`);
                if (combinedScore > bestScoreOverall) {
                  bestScoreOverall = combinedScore;
                  bestScreenOverall = { ...screen, relevanceScore: score.relevanceScore, reproducibilityScore: score.reproducibilityScore };
                }
                if (score.relevanceScore >= SELECTION_THRESHOLD && score.reproducibilityScore >= SELECTION_THRESHOLD) {
                  selectedLandingScreen = { ...screen, relevanceScore: score.relevanceScore, reproducibilityScore: score.reproducibilityScore };
                  console.log(`[BuildSaaS] ✅ Selected screen "${screen.app_name}" (relevance=${score.relevanceScore}, reproducibility=${score.reproducibilityScore})`);
                  break;
                } else {
                  allRejected.push({ appName: screen.app_name, reasoning: score.reasoning });
                }
              }
            } catch (scoreErr) {
              console.error(`[BuildSaaS] Scoring failed on attempt ${attempt}:`, scoreErr);
            }

            if (selectedLandingScreen) break;

            if (attempt < MAX_LANDING_ATTEMPTS) {
              progress.statusText = `Étape 1/4 : Aucun design parfait trouvé, affinement des requêtes (tentative ${attempt})...`;
              updateProgress(slug, progress);
              try {
                currentQueries = await generateRefinedMobbinQueries(
                  modelId, input.businessIdea, finalProjectName, allUsedQueries, allRejected
                );
                allUsedQueries = allUsedQueries.concat(currentQueries);
                console.log(`[BuildSaaS] Refined queries for attempt ${attempt + 1}:`, currentQueries);
              } catch (err) {
                console.error('[BuildSaaS] Failed to generate refined queries:', err);
              }
            }
          }

          if (!selectedLandingScreen && bestScreenOverall) {
            selectedLandingScreen = bestScreenOverall;
            console.log(`[BuildSaaS] ⚠️ No screen met both thresholds after ${MAX_LANDING_ATTEMPTS} attempts. Using best overall: "${bestScreenOverall.app_name}" (score=${bestScoreOverall.toFixed(1)})`);
          }

          if (selectedLandingScreen) {
            mobbinLandingScreens = [selectedLandingScreen];
          }

          progress.mobbinLandingScreens = mobbinLandingScreens;
          progress.mobbinSelectedScreen = selectedLandingScreen || undefined;
          updateProgress(slug, progress);
        } else if (isModeOuss) {
          console.log('[BuildSaaS] Mode Oussama actif — skip des requêtes Mobbin landing page.');
        }
      } else {
        console.log('[BuildSaaS] referenceUrl provided — skipping Mobbin LANDING queries (URL = landing reference).');
      }

      // Query Mobbin API for App Page screenshots (runs even with referenceUrl — URL is landing-only)
      if (mobbinAppQueries.length > 0) {
        progress.statusText = input.referenceUrl
          ? `Étape 1/4 : Screenshot landing capturé ✔️ Recherche Mobbin pour le dashboard & features...`
          : "Étape 1/4 : Recherche de designs d'application (dashboard & features) sur Mobbin...";
        progress.mobbinAppQueries = mobbinAppQueries;
        updateProgress(slug, progress);

        try {
          for (const query of mobbinAppQueries) {
            const screens = await searchMobbinScreens(query, 'web', 2);
            mobbinAppScreens = mobbinAppScreens.concat(screens);
          }
          const seen = new Set();
          mobbinAppScreens = mobbinAppScreens.filter(s => {
            const duplicate = seen.has(s.id);
            seen.add(s.id);
            return !duplicate && s.image_url;
          });
          progress.mobbinAppScreens = mobbinAppScreens;
          updateProgress(slug, progress);
        } catch (mobbinErr) {
          console.error("[BuildSaaS] Mobbin app query failed, proceeding:", mobbinErr);
        }
      }

      // ====== BUILD DESIGN REFERENCE CONTEXT ======
      let mobbinContext = '';

      if (urlAnalysis) {
        // URL reference mode: text context (HTML source is passed as text, screenshot as image block)
        mobbinContext = `\n[RÉFÉRENCE DESIGN ET CONTENU — URL DIRECTE : ${urlAnalysis.url}]
Titre de la page : "${urlAnalysis.pageTitle}"

⚠️ INSTRUCTION CRITIQUE ET OBLIGATOIRE : Tu as reçu un SCREENSHOT COMPLET de cette page de référence (en image ci-dessus) ainsi que son code source HTML ci-dessous.
Tu DOIS faire un COPIÉ-COLLÉ EXACT ET PARFAIT de ce site. Tu dois reproduire le site à l'IDENTIQUE ABSOLUE (100% de fidélité visuelle et textuelle).
Tu dois copier EXACTEMENT :
1. Le contenu textuel complet : tous les titres, paragraphes, slogans, messages, questions de FAQ, liens de navigation, labels de boutons, témoignages. Ne réinvente rien, copie le texte mot pour mot depuis le code source HTML fourni.
2. La structure et la mise en page (hero, sections, cartes, conteneurs, grilles, flexbox, navigation, footer).
3. Le style visuel complet : la palette de couleurs exacte (couleurs de fond, couleurs de texte, gradients, couleurs de boutons), les polices et tailles de police, les arrondis (rounded-xl, etc.), les espacements (paddings, margins, gaps), les ombres, les bordures, et les effets au survol (hover).
4. Le thème clair ou sombre exact de la page de référence. Si la page est claire avec un fond blanc/gris très clair (comme Mews), le site généré doit être CLAIR avec un fond blanc/gris très clair.

C'est un CLONE 100% PIXEL-PERFECT et TEXT-PERFECT. N'adapte le texte que pour remplacer la marque de référence par le nom du projet "${finalProjectName}" dans les logos ou le titre si c'est pertinent, mais garde toute la structure, les textes, les illustrations et le design du site de référence à l'identique absolu.

=== CODE SOURCE HTML DE LA PAGE DE RÉFÉRENCE ===
${urlAnalysis.htmlSource}
=== FIN DU CODE SOURCE ===

=== CSS ET VARIABLES DE LA PAGE DE RÉFÉRENCE ===
${urlAnalysis.cssSource}
=== FIN DU CSS ===
`;
      } else {
        // Mobbin mode (fallback)
        const totalScreens = [...mobbinLandingScreens, ...mobbinAppScreens];
        if (totalScreens.length > 0) {
          mobbinContext = `\nVoici des captures d'écran de références design réelles issues d'applications web de classe mondiale trouvées sur Mobbin :\n`;
          if (selectedLandingScreen) {
            mobbinContext += `\n[RÉFÉRENCE LANDING PAGE SÉLECTIONNÉE — COPYCAT OBLIGATOIRE] :\n` +
              `- Application : "${selectedLandingScreen.app_name}" (Capture d'écran landing page : ${selectedLandingScreen.image_url} )\n` +
              `- Score de pertinence : ${selectedLandingScreen.relevanceScore}/100\n` +
              `- Score de reproductibilité : ${selectedLandingScreen.reproducibilityScore}/100\n` +
              `\n⚠️ INSTRUCTION CRITIQUE : Tu dois reproduire ce design à AU MINIMUM 90% de fidélité. ` +
              `Copie EXACTEMENT la structure de la page (hero, sections, cartes, CTA), la palette de couleurs, ` +
              `les typographies, les effets visuels (gradients, ombres, glassmorphism, animations), ` +
              `les espacements et les proportions. C'est un COPYCAT PIXEL-PERFECT, pas une "inspiration". ` +
              `Adapte uniquement le contenu textuel et les images au SaaS demandé.\n`;
          } else if (mobbinLandingScreens.length > 0) {
            mobbinContext += `\n[Références Landing Page / Page d'accueil] :\n` +
              mobbinLandingScreens.map(s => `- Application : "${s.app_name}" (Capture d'écran landing page : ${s.image_url} )`).join('\n');
          }
          if (mobbinAppScreens.length > 0) {
            mobbinContext += `\n[Références Interface Interne / Dashboard & Features] :\n` +
              mobbinAppScreens.map(s => `- Application : "${s.app_name}" (Capture d'écran app : ${s.image_url} )`).join('\n');
          }
          mobbinContext += `\nInspire-toi de l'esthétique premium de ces applications pour que le code que tu vas générer ressemble à un produit fini professionnel de niveau international.`;
        }
      }

      // --- ÉTAPE 2 : index.html (React + Tailwind CDN shell) ---
      progress.step = 2;
      progress.statusText = "Étape 2/4 : Génération du fichier index.html (React + Tailwind CDN)...";
      updateProgress(slug, progress);

      const htmlSystemPromptDefault = `Tu es un développeur Frontend d'élite spécialisé en React et Tailwind CSS. Tu génères le fichier 'index.html' qui sert de shell minimal pour une Single Page Application React.
LE HTML EST UN SHELL MINIMALISTE. Toute la logique UI est dans 'app.tsx' (chargé via Babel Standalone).
STRUCTURE OBLIGATOIRE du <head> :
1. Meta charset UTF-8, viewport responsive
2. <title> avec le nom du SaaS
3. Google Fonts : <link> pour Inter (weights 300-900) et toute autre police ou famille de polices pertinente visible dans la page de référence (comme des polices serif ou display si présentes)
4. Tailwind CSS v4 CDN : <script src="https://cdn.tailwindcss.com"></script>
5. Configuration Tailwind inline : <script>tailwind.config = { theme: { extend: { colors: {...}, fontFamily: {...} } } }</script> avec les couleurs et polices du thème. Tu DOIS extraire la palette de couleurs exacte (couleur de fond, couleur de texte, boutons, accents) à partir du screenshot/code HTML de référence fourni et les définir ici pour pouvoir les utiliser dans app.tsx (ex. si la référence a un fond blanc/clair et des boutons roses comme Mews, définis les couleurs correspondantes).
ATTENTION : NE PAS mettre React/Babel dans le <head>.
STRUCTURE OBLIGATOIRE du <body> (dans cet ORDRE EXACT) :
1. <div id="root"></div>
2. <script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
3. <script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
4. <script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.27.2/babel.min.js"></script>
5. <script type="text/babel" data-presets="react" src="app.tsx"></script>
L'ORDRE EST CRITIQUE : React et Babel DOIVENT être chargés AVANT le script app.tsx sinon 'React is not defined'.
LE HTML NE DOIT PAS contenir de composants React, pas de sections, pas de contenu visible. C'est UNIQUEMENT un loader.
Pour les icônes, utilise des emoji ou des SVG inline dans app.tsx (PAS de CDN d'icônes externe).
CRITIQUE : Le fichier doit faire 30-50 lignes maximum. Pas de CSS inline (tout est via Tailwind dans app.tsx). Configure tailwind.config avec les bonnes couleurs et le bon thème (clair ou sombre) de la page de référence.`;

      const htmlSystemPromptOuss = `Tu es un développeur Frontend d'élite. Tu génères le fichier 'index.html' shell pour une app React + Tailwind dans le STYLE du site scalewithouss.com.
STRUCTURE OBLIGATOIRE du <head> :
1. Meta charset UTF-8, viewport responsive
2. <title> avec le nom du SaaS
3. Google Fonts : Space Grotesk, Outfit, Caveat, Patrick Hand, JetBrains Mono
4. Tailwind CSS v4 CDN : <script src="https://cdn.tailwindcss.com"></script>
5. Tailwind config avec le thème Oussama :
<script>tailwind.config = { theme: { extend: { colors: { bg: '#020215', 'bg-card': '#0a0a2a', primary: '#0303ab', accent: '#e278e7', 'text-muted': 'rgba(255,255,255,0.7)', border: 'rgba(255,255,255,0.08)' }, fontFamily: { grotesk: ['Space Grotesk', 'sans-serif'], body: ['Outfit', 'sans-serif'], hand: ['Caveat', 'cursive'], mono: ['JetBrains Mono', 'monospace'] } } } }</script>
ATTENTION : NE PAS mettre React/Babel dans le <head>.
STRUCTURE OBLIGATOIRE du <body> (dans cet ORDRE EXACT) :
<body class="bg-bg text-white font-body">
  <div id="root"></div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.27.2/babel.min.js"></script>
  <script type="text/babel" data-presets="react" src="app.tsx"></script>
</body>
CRITIQUE : 30-50 lignes max. Shell uniquement, pas de contenu visible.`;

      const clonerHtmlSystemPrompt = `Tu es un développeur Frontend d'élite expert en rétro-conception (clonage pixel-perfect). Tu génères le fichier 'index.html' qui sert de shell minimal pour une Single Page Application React.
LE HTML EST UN SHELL MINIMALISTE. Toute la logique UI est dans 'app.tsx' (chargé via Babel Standalone).
OBLIGATION DE COPIER-COLLER EXACT : Tu DOIS faire un copié-collé visuel exact et parfait du design et de la structure du site de référence. Le layout, l'agencement des éléments, la disposition des colonnes, l'en-tête, le pied de page, les sections, le style des boutons, et le jeu de couleurs doivent être à 100% identiques au site original.
RÈGLES DE RÉTRO-CONCEPTION & EXTRACTION DES DESIGN TOKENS :
1. Tu DOIS analyser la page de référence (le screenshot, le code HTML source, et les variables/règles CSS fournis) et en extraire tous les design tokens.
2. Définis la palette de couleurs exacte (couleur de fond principale, couleur de texte principal/secondaire/muted, accents, boutons, bordures, ombres) et configure-les dans tailwind.config de manière à ce qu'elles puissent être réutilisées dans app.tsx.
3. Détecte le thème de couleur global : si la page de référence est claire (comme le blanc/gris clair de Mews), tu DOIS configurer un thème clair avec un fond clair. Ne force pas un mode sombre s'il n'est pas présent dans la référence !
4. Détecte la typographie (polices Google Fonts utilisées) et ajoute les liens <link> nécessaires dans le <head>, puis configure-les dans le theme.extend.fontFamily de Tailwind.
5. STRUCTURE OBLIGATOIRE du <head> :
   - Meta charset UTF-8, viewport responsive.
   - <title> contenant le nom du nouveau SaaS "${finalProjectName}".
   - Meta tag description présentant le concept de SaaS de l'utilisateur.
   - Les balises <link> de Google Fonts nécessaires.
   - Tailwind CSS v4 CDN : <script src="https://cdn.tailwindcss.com"></script>.
   - La configuration tailwind.config dans une balise <script> :
     <script>tailwind.config = { theme: { extend: { colors: { ... }, fontFamily: { ... } } } }</script>.
6. STRUCTURE OBLIGATOIRE du <body> (dans cet ORDRE EXACT) :
   - <div id="root"></div>
   - <script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
   - <script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
   - <script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.27.2/babel.min.js"></script>
   - <script type="text/babel" data-presets="react" src="app.tsx"></script>
7. CRITIQUE : Le fichier index.html ne doit contenir aucun contenu visible ou composant React direct. C'est uniquement un loader (30-50 lignes maximum).`;

      const htmlSystemPrompt = input.referenceUrl ? clonerHtmlSystemPrompt : (isModeOuss ? htmlSystemPromptOuss : htmlSystemPromptDefault);
      // Build user message with optional screenshot image block
      const htmlUserText = `Génère le fichier 'index.html' shell React + Tailwind CDN pour le SaaS '${finalProjectName}' en te basant sur le plan :
${explanation}
${mobbinContext}

Rappel : ce fichier est un SHELL MINIMALISTE (30-50 lignes). Toute l'UI React est dans app.tsx.
Tu DOIS appeler l'outil 'write_file_content' pour enregistrer le fichier.`;

      const htmlUserMessage: string | AnthropicContentBlock[] = referenceImageBlocks.length > 0
        ? [...referenceImageBlocks, { type: 'text' as const, text: htmlUserText }]
        : htmlUserText;

      const fileTools = [
        {
          toolSpec: {
            name: 'write_file_content',
            description: 'Enregistre le contenu complet du fichier généré.',
            inputSchema: {
              json: {
                type: 'object',
                properties: {
                  content: { type: 'string', description: 'Contenu complet du fichier' },
                },
                required: ['content'],
              },
            },
          },
        },
      ];

      const htmlResult = await executeLLMStep(modelId, htmlSystemPrompt, htmlUserMessage, 'write_file_content', fileTools);
      const htmlContent = htmlResult.content;
      fs.writeFileSync(path.join(projectDir, 'index.html'), htmlContent, 'utf-8');
      progress.files.push('index.html');
      updateProgress(slug, progress);

      // --- ÉTAPE 3 : app.tsx (React components + Tailwind) ---
      progress.step = 3;
      progress.statusText = "Étape 3/4 : Génération du fichier app.tsx (React + Tailwind)...";
      updateProgress(slug, progress);

      const tsxSystemPromptDefault = `Tu es un développeur React et Tailwind CSS d'élite. Tu écris le fichier 'app.tsx' qui contient TOUTE l'application React : composants, state, navigation, et logique.
CONTEXTE TECHNIQUE :
- React 18 est chargé comme UMD global (window.React, window.ReactDOM). N'utilise PAS d'import/export ES modules.
- Utilise les hooks React directement : const { useState, useEffect, useRef, useCallback } = React;
- Tailwind CSS est chargé via CDN. Utilise UNIQUEMENT des classes Tailwind pour le styling (pas de CSS custom).
- Babel Standalone transforme le JSX. N'utilise PAS de TypeScript-only features (types, interfaces) car Babel en mode browser ne les supporte pas bien. Écris du JSX pur.
- Pour les icônes, utilise des SVG inline soignés (ne laisse jamais de carte sans icône). Pour les images, avatars ou illustrations de fond, utilise de vraies images esthétiques d'Unsplash (ex: 'https://images.unsplash.com/photo-...') adaptées au thème du SaaS.

STRUCTURE DE L'APPLICATION :
1. TOUJOURS commencer par une Landing Page / Page d'accueil magnifique et immersive :
   - Navbar fixe avec backdrop-blur (style adapté au thème : bg-white/80 border-gray-200/50 si le design de référence est clair/blanc, ou bg-gray-950/80 border-white/10 si le design de référence est sombre)
   - Hero section percutante avec titre géant, sous-titre, CTA buttons
   - Sections features avec cartes, grilles, illustrations (ne laisse JAMAIS de carte vide ou de placeholder neutre sans image Unsplash ou icône SVG descriptive appropriée)
   - Section témoignages ou preuve sociale (avec de vrais avatars de personnes via Unsplash)
   - CTA finale et footer
2. Fonctionnalités interactives orientées utilisateur final (réservation, catalogue, etc.) accessibles via modales ou navigation interne
3. Appels API fetch vers 'api/' pour les données backend (ex: fetch('api/items'))

INSPIRATION DESIGN & COPYCAT (MOBBIN OU URL RÉFÉRENCE) :
Si une référence (Mobbin ou URL directe/screenshot) est fournie, tu DOIS reproduire son design à 90%+ de fidélité en utilisant les classes Tailwind. 
Copie la structure exacte (layout, sections, cartes), le thème de couleur (ne force PAS un dark mode si la référence est en light mode - si la référence a un fond blanc/clair comme Mews, utilise un fond blanc/clair et respecte la palette de couleurs originale, ex. boutons roses, cartes claires, etc.), les typographies, les espacements, les arrondis, et les effets visuels.

CRITIQUE : Le fichier ne doit pas dépasser 250-300 lignes. Code ultra-compact, pas de commentaires. Chaque composant est une fonction. À la fin du fichier :
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));`;

      const tsxSystemPromptOuss = `Tu es un développeur React et Tailwind CSS d'élite. Tu écris le fichier 'app.tsx' avec le STYLE EXACT du site scalewithouss.com.
${oussDesignSystem}
CONTEXTE TECHNIQUE :
- React 18 UMD global (pas d'import/export). Hooks via const { useState, useEffect } = React;
- Tailwind CSS CDN avec thème Oussama configuré dans index.html.
- Babel Standalone. Écris du JSX pur (pas de TypeScript-only features).

STRUCTURE OBLIGATOIRE (composants React) :
1. function Navbar() — fixed top, backdrop-blur-xl, bg-bg/80, border-b border-border
2. function Hero() — texte centré géant font-grotesk uppercase tracking-widest text-white, <span className="font-hand text-accent -rotate-2"> pour les accents, sous-titre font-body text-text-muted
3. function Quote() — blockquote avec border-l-4 border-accent, texte italic font-hand
4. function Features() — grille de cards bg-bg-card border border-border rounded-2xl, décorations sparkle (✦ ◇ ☆), sous-titres font-hand text-accent
5. function CTA() — section finale avec boutons bg-primary border border-accent/50
6. function Footer() — minimaliste
7. function App() — compose tous les composants

CRITIQUE : 250-300 lignes max. Code ultra-compact, pas de commentaires. Adapte le contenu au SaaS demandé.`;

      const clonerTsxSystemPrompt = `Tu es un développeur React et Tailwind CSS d'élite spécialisé dans le clonage et l'adaptation de sites web. Tu écris le fichier 'app.tsx' qui contient toute la Single Page Application React.
RÈGLES CRITIQUES DE CLONAGE VISUEL ET D'ADAPTATION DU CONCEPT :
1. CLONAGE VISUEL 100% PIXEL-PERFECT (COPIÉ-COLLÉ EXACT OBLIGATOIRE) : Tu DOIS faire un copié-collé visuel exact et parfait du design, de la structure en sections, de la disposition des grilles, de la navbar, du footer, des espacements (paddings, margins, gaps), des arrondis, des ombres, des bordures fines, des transitions, et de la palette de couleurs du site de référence (screenshot, code source HTML, et variables/règles CSS fournis). Le site construit doit être un clone visuel 100% à l'identique.
2. ADAPTATION DU CONCEPT BUSINESS : Contrairement au design, le CONTENU TEXTUEL, les features, les témoignages, la FAQ et les plans de prix doivent être entièrement adaptés pour présenter le SaaS / l'idée business de l'utilisateur :
   - Idée de SaaS (Prompt Business) : "${input.businessIdea}"
   - Nom du SaaS : "${finalProjectName}"
   - Réécris les titres, paragraphes, slogans, features, et FAQs pour ce nouveau produit.
   - Conserve la structure syntaxique et la longueur approximative des textes d'origine (ex. si un titre d'origine comporte un verbe d'action fort et 5 mots, fais de même pour le nouveau titre de ton SaaS).
3. ESTHÉTIQUE & DESIGN SYSTEM :
   - Respecte strictement le thème clair ou sombre de la référence. Si le fond est blanc/clair (ex. Mews), utilise un fond blanc/clair.
   - Utilise les classes Tailwind pour reproduire à l'identique les styles de boutons, de navbar, de cartes, et les effets au survol (hover) observés.
4. ICÔNES & IMAGES (OBLIGATION D'UNSPLASH & VISUELS) :
   - Pour les icônes (ex: flèches, coches, logos), utilise des SVG inline soignés (ne laisse jamais une carte de fonctionnalité ou un badge sans icône).
   - Pour toutes les illustrations, images de fond, photos d'avatar, images de cartes ou mockups de produits, utilise de VRAIES images pertinentes et esthétiques provenant d'Unsplash via des URLs directes (ex: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=800&q=80'). Choisis des photos Unsplash qui correspondent exactement au thème de ton SaaS.
   - Ne laisse JAMAIS de carte vide, de section ou de placeholder neutre sans image, sans illustration visuelle colorée ou sans icône descriptive appropriée.
5. COMPOSANTS INTERACTIFS :
   - Implémente la barre de navigation avec son style (sticky, backdrop-blur, couleurs exactes).
   - Intègre tous les composants interactifs (ex. menu mobile responsive fonctionnel avec state de toggle, accordéons FAQ interactifs qui s'ouvrent/se ferment via state React, sliders ou carrousels basiques, onglets cliquables, formulaires interactifs).
6. CONTEXTE TECHNIQUE :
   - React 18 est chargé en global (window.React, window.ReactDOM). N'utilise PAS d'import/export ES modules.
   - Hooks via : const { useState, useEffect, useRef, useCallback } = React;
   - Écris du JSX pur sans syntaxe TypeScript-only (pas d'interfaces ou de types TS).
7. CRITIQUE : Le fichier ne doit pas dépasser 300-350 lignes. Supprime les commentaires inutiles, écris du code compact et ultra-propre.
À la fin du fichier, initialise React :
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));`;

      const tsxSystemPrompt = input.referenceUrl ? clonerTsxSystemPrompt : (isModeOuss ? tsxSystemPromptOuss : tsxSystemPromptDefault);
      // Build TSX user message with optional screenshot image block
      const tsxUserText = `Génère le fichier 'app.tsx' complet (composants React + Tailwind CSS) pour le SaaS '${finalProjectName}'.
Plan technique :
${explanation}
${mobbinContext}

Fichier index.html (shell React + Tailwind CDN) :
\`\`\`html
${htmlContent}
\`\`\`

RAPPEL CRITIQUE : 
- React est un UMD global. PAS d'import/export. Utilise const { useState, useEffect } = React;
- Tailwind classes pour TOUT le styling. Pas de CSS custom.
- À la fin : const root = ReactDOM.createRoot(document.getElementById('root')); root.render(React.createElement(App));
Tu DOIS appeler l'outil 'write_file_content' pour enregistrer le fichier.`;

      const tsxUserMessage: string | AnthropicContentBlock[] = referenceImageBlocks.length > 0
        ? [...referenceImageBlocks, { type: 'text' as const, text: tsxUserText }]
        : tsxUserText;

      const tsxResult = await executeLLMStep(modelId, tsxSystemPrompt, tsxUserMessage, 'write_file_content', fileTools);
      const tsxContent = tsxResult.content;
      fs.writeFileSync(path.join(projectDir, 'app.tsx'), tsxContent, 'utf-8');
      progress.files.push('app.tsx');
      updateProgress(slug, progress);

      // --- ÉTAPE 4 : api.js ---
      progress.step = 4;
      progress.statusText = "Étape 4/4 : Génération du fichier api.js...";
      updateProgress(slug, progress);

      const apiSystemPrompt = `Tu es un développeur Backend Node.js d'élite. Tu écris le script backend 'api.js' (ESM module) qui exporte par défaut une fonction handler de type Express : \`export default function handler(req, res)\`. Ce handler gère un état en mémoire et répond aux requêtes fetch de app.tsx. Le corps de la requête JSON (req.body) est pré-parsé par le serveur principal. Pas de placeholders, le code doit être 100% complet. Écris du code compact, propre, sans commentaires inutiles.`;
      const apiUserMessage = `Génère le fichier 'api.js' complet pour le SaaS '${finalProjectName}'.
Plan technique :
${explanation}

Fichier app.tsx (qui appelle ton API via fetch) :
\`\`\`jsx
${tsxContent}
\`\`\`

Fichier index.html pour référence :
\`\`\`html
${htmlContent}
\`\`\`

Tu DOIS appeler l'outil 'write_file_content' pour enregistrer le fichier.`;

      const apiResult = await executeLLMStep(modelId, apiSystemPrompt, apiUserMessage, 'write_file_content', fileTools);
      const apiContent = apiResult.content;
      fs.writeFileSync(path.join(projectDir, 'api.js'), apiContent, 'utf-8');
      progress.files.push('api.js');

      // Complete!
      progress.status = 'completed';
      progress.statusText = "Génération complétée avec succès !";
      updateProgress(slug, progress);

      const previewUrl = `/saas-builds/${slug}/index.html`;

      return {
        projectName: finalProjectName,
        projectSlug: slug,
        files: [
          { path: 'index.html', content: htmlContent },
          { path: 'app.tsx', content: tsxContent },
          { path: 'api.js', content: apiContent },
        ],
        explanation,
        previewUrl,
        mobbinLandingQueries,
        mobbinAppQueries,
        mobbinLandingScreens,
        mobbinAppScreens,
      };
    } catch (err) {
      progress.status = 'failed';
      progress.statusText = `Erreur : ${(err as Error).message}`;
      progress.error = (err as Error).message;
      updateProgress(slug, progress);
      throw err;
    }
  }
}
