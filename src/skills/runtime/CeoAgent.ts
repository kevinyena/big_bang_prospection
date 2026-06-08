import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { callClaude, CLAUDE_MODEL } from './anthropic.js';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', '..', '..', '.data');
const DATABASE_PATH = path.join(DATA_DIR, 'whatsapp-ceo.json');
const CONVERSATIONS_PATH = path.join(DATA_DIR, 'whatsapp-conversations.json');

// ----- Database Schemas & Types -----

export const KpiSchema = z.object({
  usersObtained: z.number().int().default(0),
  cashMade: z.number().int().default(0),
  churn: z.number().int().default(0),
  emailSent: z.number().int().default(0),
  emailReplies: z.number().int().default(0),
  emailInterest: z.number().int().default(0),
  xDmSent: z.number().int().default(0),
  xDmReplies: z.number().int().default(0),
  xDmInterest: z.number().int().default(0),
  tiktokPosts: z.number().int().default(0),
  tiktokViews: z.number().int().default(0),
  instaPosts: z.number().int().default(0),
  instaViews: z.number().int().default(0),
  supportRequests: z.number().int().default(0),
  supportResolved: z.number().int().default(0),
  supportEscalated: z.number().int().default(0), // sent to CEO and Dev
  devFeatures: z.array(z.string()).default([]),
  devBugsFixed: z.array(z.string()).default([]),
});

export const OrderSchema = z.object({
  id: z.string(),
  text: z.string(),
  status: z.enum(['accepted', 'rejected']),
  target: z.enum(['dev', 'sales', 'marketing', 'other']),
  reason: z.string(),
  createdAt: z.string(),
});

export const BusinessSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(), // max 5 words
  tasksYesterday: z.array(z.string()),
  kpis: KpiSchema,
  orders: z.array(OrderSchema).default([]),
});

export const CeoDatabaseSchema = z.object({
  businesses: z.array(BusinessSchema),
  userPhoneNumber: z.string().default(''),
  ceoPrompt: z.string().optional(),
  sentinelPrompt: z.string().optional(),
});

export type Kpi = z.infer<typeof KpiSchema>;
export type Order = z.infer<typeof OrderSchema>;
export type Business = z.infer<typeof BusinessSchema>;
export type CeoDatabase = z.infer<typeof CeoDatabaseSchema>;

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ConversationState {
  activeBusinessId: string | null;
  messages: ChatMessage[];
}

export interface ConversationsDb {
  [conversationId: string]: ConversationState;
}

// ----- Default Fallbacks -----

const DEFAULT_BUSINESSES: Business[] = [
  {
    id: 'biz_1',
    name: 'SaaSify',
    description: 'Automated CRM for local businesses',
    tasksYesterday: [
      'Dev: Built the custom stripe billing webhook',
      'Dev: Resolved login freeze on Safari mobile browsers',
      'Sales: Shot 40 cold emails to restaurant owners',
      'Marketing: Posted a video showing CRM calendar workflow',
      'Support: Answered 12 customer setup issues, sent 1 bug to Dev',
    ],
    kpis: {
      usersObtained: 8,
      cashMade: 290,
      churn: 0,
      emailSent: 40,
      emailReplies: 6,
      emailInterest: 2,
      xDmSent: 12,
      xDmReplies: 1,
      xDmInterest: 0,
      tiktokPosts: 1,
      tiktokViews: 2400,
      instaPosts: 0,
      instaViews: 0,
      supportRequests: 13,
      supportResolved: 12,
      supportEscalated: 1,
      devFeatures: ['Custom Stripe billing webhook', 'Stripe customer portal link'],
      devBugsFixed: ['Safari mobile browser login freeze'],
    },
    orders: [],
  },
  {
    id: 'biz_2',
    name: 'AutoPost',
    description: 'AI-powered newsletter publisher',
    tasksYesterday: [
      'Dev: Completed Substack RSS feed polling backend',
      'Marketing: Published 2 TikTok shorts on automation',
      'Support: Answered 4 subscription questions',
      'Sales: Outreached to 25 substack publishers via X DM',
    ],
    kpis: {
      usersObtained: 15,
      cashMade: 180,
      churn: 2,
      emailSent: 0,
      emailReplies: 0,
      emailInterest: 0,
      xDmSent: 25,
      xDmReplies: 5,
      xDmInterest: 3,
      tiktokPosts: 2,
      tiktokViews: 4100,
      instaPosts: 1,
      instaViews: 850,
      supportRequests: 4,
      supportResolved: 4,
      supportEscalated: 0,
      devFeatures: ['Substack RSS feed poller backend'],
      devBugsFixed: [],
    },
    orders: [],
  },
  {
    id: 'biz_3',
    name: 'SiteSpark',
    description: 'No-code portfolio generator',
    tasksYesterday: [
      'Dev: Patched database query timeout during peak traffic',
      'Sales: Emailed 100 freelancer portfolio targets',
      'Support: Resolved 5 ticket issues, escalated 1 db issue to CEO/Dev',
      'Marketing: Posted 1 reel showing portfolio setup in 60s',
    ],
    kpis: {
      usersObtained: 4,
      cashMade: 99,
      churn: 1,
      emailSent: 100,
      emailReplies: 14,
      emailInterest: 4,
      xDmSent: 0,
      xDmReplies: 0,
      xDmInterest: 0,
      tiktokPosts: 0,
      tiktokViews: 0,
      instaPosts: 1,
      instaViews: 1900,
      supportRequests: 6,
      supportResolved: 5,
      supportEscalated: 1,
      devFeatures: [],
      devBugsFixed: ['Database query timeout issue resolved'],
    },
    orders: [],
  },
];

// Memory variables for custom prompts
export let customCeoPrompt: string | null = null;
export let customSentinelPrompt: string | null = null;

export const DEFAULT_CEO_PROMPT = `You are the AI CEO chatbot for 3 SaaS businesses.
The businesses are:
{{BUSINESSES_LIST}}

Yesterday's tasks:
{{TASKS_YESTERDAY_LIST}}

Currently active business ID in this chat session: {{ACTIVE_BUSINESS_ID}}.

CRITICAL:
1. Always watch for the user switching businesses or specifying a business name (e.g. "par rapport à SaaSify", "Biz 2:", "pour AutoPost", "Maintenant je parle de AutoPost").
   - If they specify or switch, set "detectedBusinessId" to that business ID.
   - If they don't specify, you should assume the active business is the current one: "{{ACTIVE_BUSINESS_ID}}".
2. Classify the message:
   - If the user asks a question about yesterday's tasks for the active business, classify as "question" and output the answer in "answerText".
   - If the user requests an action, gives an order, or commands a task, classify as "order" and output the command in "detectedOrderText".
   - Otherwise, classify as "general" and respond conversationally in "answerText".
3. Write all responses in English.`;

export const DEFAULT_SENTINEL_PROMPT = `You are Sentinel, a security audit agent for Sideloot, an automated micro-SaaS hosting platform.
Your job is to screen commands given to the AI CEO by the user.

RULES:
1. FORBIDDEN: Accessing databases directly, downloading source code files, querying credential keys, private API keys, user passwords, hosting credentials, hacking databases, or anything sensitive that compromises security.
2. ALLOWED: Simple operational requests, like modifying a website page, creating a database entity cleanly via standard API, updating pricing tables, setting up email outbound scripts, emailing sales targets, or posting marketing videos.
3. Classify the target department as 'dev', 'sales', 'marketing', or 'other'.

Evaluate the following order for the business "{{BUSINESS_NAME}}" ("{{BUSINESS_DESCRIPTION}}"):
Order: "{{ORDER_TEXT}}"

Return JSON matching the schema.`;

// ----- DB Operations -----

export async function loadDatabase(): Promise<CeoDatabase> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(DATABASE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed.userPhoneNumber === undefined) {
      parsed.userPhoneNumber = '';
    }
    const db = CeoDatabaseSchema.parse(parsed);
    if (db.ceoPrompt) customCeoPrompt = db.ceoPrompt;
    if (db.sentinelPrompt) customSentinelPrompt = db.sentinelPrompt;
    return db;
  } catch {
    // Generate 3 business ideas dynamically using Claude if not present
    try {
      const generated = await generateInitialBusinesses();
      await saveDatabase(generated);
      return generated;
    } catch (e) {
      console.error('Claude initial business generation failed, using defaults:', e);
      const db = { businesses: DEFAULT_BUSINESSES, userPhoneNumber: '' };
      await saveDatabase(db);
      return db;
    }
  }
}

export async function saveDatabase(db: CeoDatabase): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATABASE_PATH, JSON.stringify(db, null, 2), 'utf-8');
}

export async function loadConversations(): Promise<ConversationsDb> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(CONVERSATIONS_PATH, 'utf-8');
    return JSON.parse(raw) as ConversationsDb;
  } catch {
    return {};
  }
}

export async function saveConversations(db: ConversationsDb): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(CONVERSATIONS_PATH, JSON.stringify(db, null, 2), 'utf-8');
}

// ----- Initial Dynamic Business Generation -----

async function generateInitialBusinesses(): Promise<CeoDatabase> {
  const schema = z.object({
    businesses: z.array(
      z.object({
        name: z.string(),
        description: z.string().describe('Max 5 words description'),
        tasksYesterday: z.array(z.string()).describe("List of 3-5 tasks done yesterday, labeled with department (Dev, Sales, Marketing, Support)"),
        kpis: KpiSchema,
      })
    ).length(3),
  });

  const prompt = `Generate 3 distinct, creative business ideas for micro-SaaS or modern digital businesses.
Each business must have:
1. A catchy name
2. A 5-word maximum description explaining what it is.
3. A list of 4-5 realistic activities that were performed yesterday across Dev, Sales, Marketing, and Support.
4. Realistic daily KPI counts (usersObtained, cashMade, churn, supportRequests, emails sent, TikTok posts, etc.) that match the activities.

Ensure the descriptions are precisely 5 words or less. Return valid JSON matching the schema.`;

  const raw = await callClaude({
    userMessage: prompt,
    schema,
    effort: 'medium',
  });

  return {
    businesses: raw.businesses.map((b, i) => ({
      id: `biz_${i + 1}`,
      name: b.name,
      description: b.description,
      tasksYesterday: b.tasksYesterday,
      kpis: b.kpis,
      orders: [],
    })),
    userPhoneNumber: '',
  };
}

// ----- Agent Decision Schemas -----

const CeoClassificationSchema = z.object({
  detectedBusinessId: z.string().nullable().describe("ID of the business the user is referring to (e.g. 'biz_1', 'biz_2', 'biz_3'), or null if no switch or mention was found"),
  intent: z.enum(['question', 'order', 'general']).describe("The intent of the message. 'question' means querying yesterday's tasks. 'order' means commanding/ordering an action to be done. 'general' is conversational chit-chat."),
  answerText: z.string().describe("Conversational answer to the question or general chit-chat. Leave empty if intent is 'order'"),
  detectedOrderText: z.string().describe("Cleaned up command/action order if intent is 'order'. Leave empty if intent is 'question' or 'general'"),
});

const SentinelDecisionSchema = z.object({
  decision: z.enum(['accepted', 'rejected']).describe("Safety decision based on Sideloot hosting rules"),
  target: z.enum(['dev', 'sales', 'marketing', 'other']).describe("The department responsible for this order"),
  reason: z.string().describe("Detailed security rationale for the decision. Why was it accepted or why was it rejected (e.g. database access, private keys, hacking)")
});

const CeoResponseSchema = z.object({
  responseMessage: z.string().describe("Final text response to WhatsApp user from the AI CEO")
});

// ----- Core Agent Execution -----

export async function processUserMessage(
  conversationId: string,
  userMessage: string
): Promise<{ reply: string; activeBusinessId: string | null }> {
  // 1. Load context
  const db = await loadDatabase();
  const convs = await loadConversations();
  const session = convs[conversationId] ?? { activeBusinessId: null, messages: [] };

  // Update history
  session.messages.push({ role: 'user', content: userMessage });

  // Code-level business detection (case-insensitive) - check BEFORE calling Claude
  // to ensure the systemPrompt has the correct session.activeBusinessId
  const lowerMsg = userMessage.toLowerCase();
  for (const b of db.businesses) {
    if (lowerMsg.includes(b.name.toLowerCase())) {
      session.activeBusinessId = b.id;
      console.log(`[CeoAgent] Matched business in user message: ${b.name} (${b.id})`);
    }
  }

  // 2. Classify and answer
  const ceoTemplate = customCeoPrompt || DEFAULT_CEO_PROMPT;
  const businessesList = db.businesses.map((b) => `- [${b.id}] ${b.name}: "${b.description}"`).join('\n');
  const tasksYesterdayList = db.businesses.map((b) => `**${b.name} (${b.id})**:\n${b.tasksYesterday.map(t => `  - ${t}`).join('\n')}`).join('\n\n');
  
  const systemPrompt = ceoTemplate
    .replace(/{{BUSINESSES_LIST}}/g, businessesList)
    .replace(/{{TASKS_YESTERDAY_LIST}}/g, tasksYesterdayList)
    .replace(/{{ACTIVE_BUSINESS_ID}}/g, session.activeBusinessId ?? 'None');

  const classification = await callClaude({
    system: systemPrompt,
    userMessage: `User message: "${userMessage}"\nHistory:\n${JSON.stringify(session.messages.slice(-5))}`,
    schema: CeoClassificationSchema,
    effort: 'medium',
  });

  console.log('[CeoAgent] Classification result:', JSON.stringify(classification, null, 2));

  // Switch business context if detected by Claude
  if (classification.detectedBusinessId) {
    session.activeBusinessId = classification.detectedBusinessId;
  }

  const currentBusiness = db.businesses.find((b) => b.id === session.activeBusinessId);

  let finalReply = '';

  if (!currentBusiness) {
    // If no business is active, use Claude's response if available, otherwise prompt
    if (classification.answerText && classification.answerText.trim() !== '') {
      finalReply = classification.answerText;
    } else {
      const bizNames = db.businesses.map((b) => b.name).join(', ');
      finalReply = `Hello! I am your AI CEO. Before we begin, please specify which business you would like to talk about (${bizNames})?`;
    }
    session.messages.push({ role: 'assistant', content: finalReply });
    convs[conversationId] = session;
    await saveConversations(convs);
    return { reply: finalReply, activeBusinessId: session.activeBusinessId };
  }

  if (classification.intent === 'order') {
    const orderText = classification.detectedOrderText || userMessage;

    // Run Sentinel Agent
    const sentinelTemplate = customSentinelPrompt || DEFAULT_SENTINEL_PROMPT;
    const sentinelPrompt = sentinelTemplate
      .replace(/{{BUSINESS_NAME}}/g, currentBusiness.name)
      .replace(/{{BUSINESS_DESCRIPTION}}/g, currentBusiness.description)
      .replace(/{{ORDER_TEXT}}/g, orderText);

    const sentinelResult = await callClaude({
      system: sentinelPrompt,
      userMessage: `Audit this order: "${orderText}"`,
      schema: SentinelDecisionSchema,
      effort: 'medium',
    });

    // Create order entry
    const newOrder: Order = {
      id: crypto.randomUUID(),
      text: orderText,
      status: sentinelResult.decision,
      target: sentinelResult.target,
      reason: sentinelResult.reason,
      createdAt: new Date().toISOString(),
    };

    // Save order in database
    currentBusiness.orders.push(newOrder);
    await saveDatabase(db);

    // CEO Formulates the WhatsApp response
    const ceoFormulatorPrompt = `You are the AI CEO of "${currentBusiness.name}".
Sentinel has audited the order: "${orderText}"
Result: ${sentinelResult.decision}
Target department: ${sentinelResult.target}
Reasoning: "${sentinelResult.reason}"

Respond to the user in English:
1. If REJECTED: Explain politely but strictly that you cannot perform this action ("I cannot perform this action as it violates our security policies...") and mention the reason (e.g. database access or security).
2. If ACCEPTED: Confirm enthusiastically that the order is scheduled.
   - If target is 'dev': Say something like "Okay, got it. I will sync with the dev team"
   - If target is 'sales': Say something like "Understood, I will tell the sales team to handle it"
   - Maintain a helpful CEO persona.`;

    const responseGen = await callClaude({
      system: ceoFormulatorPrompt,
      userMessage: `Format the CEO response.`,
      schema: CeoResponseSchema,
      effort: 'low',
    });

    finalReply = responseGen.responseMessage;
  } else {
    // Answer text already generated by classifier
    finalReply = classification.answerText;
  }

  // Update history & save
  session.messages.push({ role: 'assistant', content: finalReply });
  // Keep history reasonable
  if (session.messages.length > 20) {
    session.messages = session.messages.slice(-20);
  }

  convs[conversationId] = session;
  await saveConversations(convs);

  return {
    reply: finalReply,
    activeBusinessId: session.activeBusinessId,
  };
}

export function getPrompts() {
  return {
    ceoPrompt: customCeoPrompt || DEFAULT_CEO_PROMPT,
    sentinelPrompt: customSentinelPrompt || DEFAULT_SENTINEL_PROMPT,
  };
}

export function updatePrompts(ceo: string, sentinel: string) {
  customCeoPrompt = ceo;
  customSentinelPrompt = sentinel;
}
