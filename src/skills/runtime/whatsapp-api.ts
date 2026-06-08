import { loadDatabase } from './CeoAgent.js';

export interface ZernioConversation {
  _id: string;
  id?: string;
  platform: string;
  accountId: string;
  updatedAt?: string;
  participantId?: string;
  participantUsername?: string;
  contact?: {
    name?: string;
    identifier?: string;
  };
}

export interface ZernioAccount {
  _id: string;
  platform: string;
  username: string;
}

export async function getWhatsAppAccount(): Promise<ZernioAccount> {
  const apiKey = process.env.ZERNIO_API_KEY;
  if (!apiKey) throw new Error('ZERNIO_API_KEY manquante dans .env.');

  const res = await fetch('https://zernio.com/api/v1/accounts', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch Zernio accounts: HTTP ${res.status}`);
  }
  const data = (await res.json()) as { accounts: ZernioAccount[] };
  const waAcc = data.accounts.find((a) => a.platform === 'whatsapp');
  if (!waAcc) {
    throw new Error('Aucun compte WhatsApp lié sur Zernio pour cette clé API.');
  }
  return waAcc;
}

export async function sendWhatsAppMessage(conversationId: string, message: string): Promise<void> {
  const apiKey = process.env.ZERNIO_API_KEY;
  if (!apiKey) throw new Error('ZERNIO_API_KEY manquante dans .env.');

  const waAcc = await getWhatsAppAccount();

  const url = `https://zernio.com/api/v1/inbox/conversations/${conversationId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      accountId: waAcc._id,
      message,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to send WhatsApp message via Zernio (HTTP ${res.status}): ${text}`);
  }
}

export async function findLastActiveConversation(): Promise<string | null> {
  const apiKey = process.env.ZERNIO_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch('https://zernio.com/api/v1/inbox/conversations', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { conversations?: ZernioConversation[]; data?: ZernioConversation[] };
    const conversations = data.data || data.conversations || [];
    const waConvs = conversations.filter((c) => c.platform === 'whatsapp');
    if (waConvs.length > 0) {
      return waConvs[0]!._id || waConvs[0]!.id || null;
    }
  } catch (e) {
    console.error('[whatsapp-api] failed to find last active conversation:', e);
  }
  return null;
}

export async function initiateWhatsAppConversation(phoneNumber: string): Promise<string> {
  const apiKey = process.env.ZERNIO_API_KEY;
  if (!apiKey) throw new Error('ZERNIO_API_KEY missing in .env.');

  const waAcc = await getWhatsAppAccount();
  const cleanNumber = phoneNumber.replace(/\D/g, '');

  // 1. Check if a conversation with this participant already exists
  try {
    const res = await fetch('https://zernio.com/api/v1/inbox/conversations', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.ok) {
      const data = (await res.json()) as { conversations?: ZernioConversation[]; data?: ZernioConversation[] };
      const conversations = data.data || data.conversations || [];
      const existing = conversations.find(
        (c) => c.platform === 'whatsapp' && (c.participantId === cleanNumber || c.participantUsername === cleanNumber || (c.contact && c.contact.identifier === cleanNumber))
      );
      if (existing) {
        const conversationId = existing._id || existing.id;
        if (conversationId) {
          console.log(`[whatsapp-api] Found existing active conversation: ${conversationId}. Sending free-form welcome message...`);
          await sendWhatsAppMessage(conversationId, 'Welcome on sideloot buddy!');
          return conversationId;
        }
      }
    }
  } catch (e) {
    console.error('[whatsapp-api] failed to check for existing conversation:', e);
  }

  // 2. Fallback: If no conversation exists, we MUST try templates
  const templatesToTry = [
    { name: 'welcome_sideloot_simple', lang: 'en_US' },
    { name: 'welcome_sideloot_utility', lang: 'en_US' },
    { name: 'welcome_sideloot_us', lang: 'en_US' },
    { name: 'welcome_sideloot', lang: 'en' },
    { name: 'welcome_var2', lang: 'en' },
  ];

  for (const t of templatesToTry) {
    try {
      console.log(`[whatsapp-api] Attempting to send template: ${t.name} (${t.lang}) to ${cleanNumber}...`);
      const res = await fetch('https://zernio.com/api/v1/inbox/conversations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: waAcc._id,
          participantId: cleanNumber,
          templateName: t.name,
          templateLanguage: t.lang,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { conversationId?: string; id?: string };
        const conversationId = data.conversationId || data.id;
        if (conversationId) {
          console.log(`[whatsapp-api] Success initiating with template ${t.name}: conversationId = ${conversationId}`);
          return conversationId;
        }
      } else {
        const text = await res.text();
        console.warn(`[whatsapp-api] Template ${t.name} failed (HTTP ${res.status}): ${text}`);
      }
    } catch (e) {
      console.error(`[whatsapp-api] Template ${t.name} error:`, e);
    }
  }

  throw new Error(`Failed to initiate WhatsApp conversation: none of the welcome templates (${templatesToTry.map(t => t.name).join(', ')}) could be sent successfully. They might still be PENDING Meta's approval.`);
}

export function formatKpiMessage(businesses: any[]): string {
  let msg = `📊 *SIDELOOT KPI REPORT — ALL BUSINESSES*\n\n`;

  for (const b of businesses) {
    const k = b.kpis;
    const desc = b.description.slice(0, 50);

    msg += `🔹 *${b.name.toUpperCase()}* (${desc})\n`;
    msg += `• *Global KPIs*: ${k.usersObtained} users obtained | $${k.cashMade} cash made | ${k.churn} churn\n`;
    msg += `• *Email Outreach*: ${k.emailSent} sent | ${k.emailReplies} replies | ${k.emailInterest} interested\n`;
    msg += `• *X DM Outreach*: ${k.xDmSent} sent | ${k.xDmReplies} replies | ${k.xDmInterest} interested\n`;
    msg += `• *TikTok Marketing*: ${k.tiktokPosts} videos posted | ${k.tiktokViews} views\n`;
    msg += `• *Instagram Marketing*: ${k.instaPosts} videos posted | ${k.instaViews} views\n`;
    msg += `• *Customer Support*: ${k.supportRequests} received | ${k.supportResolved} resolved | ${k.supportEscalated} escalated\n`;
    
    const devFeats = k.devFeatures && k.devFeatures.length > 0 ? k.devFeatures.join(', ') : 'None';
    const devBugs = k.devBugsFixed && k.devBugsFixed.length > 0 ? k.devBugsFixed.join(', ') : 'None';
    msg += `• *Dev*: Features: [${devFeats}] | Bugs resolved: [${devBugs}]\n\n`;
  }

  msg += `CEO AI Sentinel platform active 🛡️`;
  return msg;
}

export async function broadcastKpis(): Promise<{ conversationId: string; message: string }> {
  const db = await loadDatabase();
  let conversationId = await findLastActiveConversation();

  if (!conversationId) {
    console.log(`[whatsapp-api] No active conversation found. Initiating contact with ${db.userPhoneNumber}...`);
    try {
      await initiateWhatsAppConversation(db.userPhoneNumber);
      // Wait 3 seconds for Zernio to create the conversation thread
      await new Promise((r) => setTimeout(r, 3000));
      conversationId = await findLastActiveConversation();
    } catch (e) {
      console.error('[whatsapp-api] Failed to automatically initiate conversation:', e);
    }
  }

  if (!conversationId) {
    throw new Error(
      `No active WhatsApp conversation found and automatic initiation to ${db.userPhoneNumber} failed. Please verify that your template is approved on Zernio, or click "Démarrer conversation" (Initiate conversation) to try manually.`
    );
  }

  const message = formatKpiMessage(db.businesses);
  await sendWhatsAppMessage(conversationId, message);

  return { conversationId, message };
}
