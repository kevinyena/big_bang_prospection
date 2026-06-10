import dotenv from 'dotenv';
// Override: shell env may shadow .env (e.g. an empty ANTHROPIC_API_KEY injected
// by a Claude Code session).
dotenv.config({ override: true });

import express, { type Request, type Response } from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fetchProspectsFromApify } from './skills/runtime/apify-maps.js';
import { fetchLinkedInProspects } from './skills/runtime/apify-linkedin.js';

import { ALL_SKILLS, buildSections, findSkill } from './skills/index.js';
import { startGeneration, pollStatus, proxyDownload, type AspectRatio } from './skills/runtime/veo.js';
import {
  buildAuthorizeUrl,
  unlink as xUnlink,
  exchangeCodeForTokens,
  fetchUserProfile,
  refreshAccessToken,
  postTweet
} from './skills/runtime/x-api.js';

import {
  buildAuthorizeUrl as buildInstaAuthUrl,
  handleCallback as handleInstaCallback,
  getStatus as getInstaStatus,
  unlink as instaUnlink,
  fetchPublishStatus as fetchInstaPublishStatus,
  postVideo as postInstaVideo,
} from './skills/runtime/insta-api.js';
import {
  loadDatabase,
  saveDatabase,
  processUserMessage,
  loadConversations,
  DEFAULT_CEO_PROMPT,
  DEFAULT_SENTINEL_PROMPT,
  getPrompts,
  updatePrompts,
} from './skills/runtime/CeoAgent.js';
import {
  broadcastKpis,
  sendWhatsAppMessage,
  initiateWhatsAppConversation,
} from './skills/runtime/whatsapp-api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY manquante dans .env (skills LLM)');
  process.exit(1);
}
if (!process.env.GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY manquante dans .env (génération vidéo Veo 3.1)');
  process.exit(1);
}
if (!process.env.APIFY_TOKEN) {
  console.warn(
    '[warn] APIFY_TOKEN manquante dans .env — la skill fetch_maps_prospects échouera. Récupérer le token: https://console.apify.com/settings/integrations',
  );
}

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// Serve .tsx files as plain text so Babel Standalone can fetch and compile them via XHR
app.use(express.static(path.join(ROOT, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.tsx')) {
      res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    }
    // Disable caching to prevent browser running cached app.js
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  },
}));

// ---------- Dynamic SaaS API route executor ----------
// This handles relative requests from the generated SaaS client to its api.js backend
app.all('/saas-builds/:slug/api/*', async (req: Request, res: Response) => {
  const slug = String(req.params.slug ?? '');
  const projectDir = path.join(ROOT, 'public', 'saas-builds', slug);
  const apiPath = path.join(projectDir, 'api.js');

  if (!fs.existsSync(apiPath)) {
    return res.status(404).json({ error: `Backend api.js non trouvé pour le SaaS '${slug}'` });
  }

  try {
    // Bypassing ESM cache using timestamp query param so regeneration works instantly
    const module = await import(`${apiPath}?t=${Date.now()}`);
    const handler = module.default;

    if (typeof handler !== 'function') {
      return res.status(500).json({ error: "Le fichier api.js n'exporte pas de fonction handler par défaut." });
    }

    // Rewrite req.url to represent the sub-path relative to /api
    // e.g. /saas-builds/my-app/api/items?id=1 -> /items?id=1
    const originalUrl = req.url;
    const apiPrefix = `/saas-builds/${slug}/api`;
    if (req.url.startsWith(apiPrefix)) {
      req.url = req.url.slice(apiPrefix.length) || '/';
    } else {
      req.url = req.url.substring(req.url.indexOf('/api') + 4) || '/';
    }

    // Decorate response with Express-like helpers if they don't exist
    // to match standard handler expectations
    const decoratedRes = res as any;
    if (!decoratedRes.status) {
      decoratedRes.status = function (code: number) {
        this.statusCode = code;
        return this;
      };
    }
    if (!decoratedRes.json) {
      decoratedRes.json = function (data: any) {
        this.setHeader('Content-Type', 'application/json');
        this.end(JSON.stringify(data));
        return this;
      };
    }

    // Call the dynamic handler
    await handler(req, decoratedRes);

    // Restore req.url
    req.url = originalUrl;
  } catch (err) {
    console.error(`[saas-backend] Erreur lors de l'exécution de ${slug} api.js:`, err);
    res.status(500).json({ error: `Erreur d'exécution du backend: ${(err as Error).message}` });
  }
});


// ---------- Registry endpoint ----------
app.get('/api/skills', (_req: Request, res: Response) => {
  res.json(buildSections());
});

// ---------- Generic skill runner ----------
// Validates input via the skill's Zod schema, then calls execute().
// Works for any registered skill — adding a skill never requires touching server.ts.
app.post('/api/skills/:name/run', async (req: Request, res: Response) => {
  const name = String(req.params.name ?? '');
  const skill = findSkill(name);
  if (!skill) return res.status(404).json({ error: `skill '${name}' inconnue` });
  try {
    const parsed = skill.schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'inputs invalides', issues: parsed.error.issues });
    }
    const output = await skill.execute(parsed.data);
    res.json({ output });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// ---------- Veo split endpoints (UI progress) ----------
// The Veo skill's blocking execute() is for agents. The interactive UI uses
// these primitives directly so it can show a live progress indicator.
app.post('/api/veo/start', async (req: Request, res: Response) => {
  try {
    const { prompt, aspectRatio = '9:16' } = (req.body ?? {}) as {
      prompt?: string;
      aspectRatio?: AspectRatio;
    };
    if (!prompt) return res.status(400).json({ error: 'prompt manquant' });
    const out = await startGeneration({ prompt, aspectRatio });
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.get('/api/veo/status', async (req: Request, res: Response) => {
  try {
    const name = req.query.name as string | undefined;
    if (!name) return res.status(400).json({ error: 'name manquant' });
    res.json(await pollStatus(name));
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.get('/api/veo/proxy', async (req: Request, res: Response) => {
  try {
    const uri = req.query.uri as string | undefined;
    if (!uri) return res.status(400).json({ error: 'uri manquant' });
    const { buffer, contentType } = await proxyDownload(uri);
    res.setHeader('Content-Type', contentType);
    res.send(buffer);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// ---------- X (Twitter) OAuth ----------
const pkceCache = new Map<string, string>();

app.get('/api/auth/x/login', async (req: Request, res: Response) => {
  try {
    const state = crypto.randomBytes(16).toString('hex');
    const codeVerifier = crypto.randomBytes(32).toString('hex');
    pkceCache.set(state, codeVerifier);

    // Expire state after 15 minutes
    setTimeout(() => pkceCache.delete(state), 15 * 60 * 1000);

    const url = buildAuthorizeUrl(req.headers.host || 'localhost:3000', state, codeVerifier);
    res.redirect(url);
  } catch (e) {
    res.status(500).send(`X OAuth login failed: ${(e as Error).message}`);
  }
});

app.get('/api/auth/x/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;
  const error = req.query.error as string | undefined;
  const errorDescription = req.query.error_description as string | undefined;

  if (error) {
    return res.status(400).send(`
      <!doctype html><meta charset="utf-8">
      <title>Erreur de connexion</title>
      <style>body{font-family:system-ui;background:#0b0d12;color:#e7eaf0;padding:40px;max-width:520px;margin:auto}
        a{color:#7c5cff}.err{color:#ff5050}</style>
      <h1 class="err">✗ Échec de la connexion X (Twitter)</h1>
      <p><strong>Détails :</strong> ${escapeHtml(errorDescription ?? error)}</p>
      <p>Essaie de fermer cet onglet et de recliquer sur le bouton de connexion.</p>
      <a href="/">Retour</a>
    `);
  }

  if (!code || !state) {
    return res.status(400).send(`
      <!doctype html><meta charset="utf-8">
      <title>Erreur de connexion</title>
      <style>body{font-family:system-ui;background:#0b0d12;color:#e7eaf0;padding:40px;max-width:520px;margin:auto}
        a{color:#7c5cff}</style>
      <h1>Callback X invalide</h1>
      <p>Les paramètres requis (code/state) sont absents.</p>
      <a href="/">Retour</a>
    `);
  }

  const codeVerifier = pkceCache.get(state);
  if (!codeVerifier) {
    return res.status(400).send(`
      <!doctype html><meta charset="utf-8">
      <title>Erreur de connexion</title>
      <style>body{font-family:system-ui;background:#0b0d12;color:#e7eaf0;padding:40px;max-width:520px;margin:auto}
        a{color:#7c5cff}</style>
      <h1>Session expirée</h1>
      <p>La session d'authentification a expiré (15 min max) ou a été modifiée.</p>
      <a href="/">Retour</a>
    `);
  }
  pkceCache.delete(state);

  try {
    const tokenData = await exchangeCodeForTokens(code, codeVerifier, req.headers.host || 'localhost:3000');
    const profile = await fetchUserProfile(tokenData.access_token);

    const accountId = profile.id;
    const username = profile.username;
    const displayName = profile.name;
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    const existing = await pool.query(
      'SELECT id FROM public.x_accounts WHERE business_id = $1 AND x_user_id = $2 LIMIT 1',
      [BUSINESS_ID, accountId]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE public.x_accounts 
         SET handle = $1, display_name = $2, status = 'connected', 
             x_access_token = $3, x_refresh_token = $4, x_token_expires_at = $5,
             updated_at = NOW()
         WHERE business_id = $6 AND x_user_id = $7`,
        [username, displayName, tokenData.access_token, tokenData.refresh_token, expiresAt, BUSINESS_ID, accountId]
      );
    } else {
      await pool.query(
        `INSERT INTO public.x_accounts (id, business_id, owner_position_id, x_user_id, handle, display_name, status, x_access_token, x_refresh_token, x_token_expires_at, created_at, updated_at)
         VALUES ($1, $2, 'sales_rep', $3, $4, $5, 'connected', $6, $7, $8, NOW(), NOW())`,
        [crypto.randomUUID(), BUSINESS_ID, accountId, username, displayName, tokenData.access_token, tokenData.refresh_token, expiresAt]
      );
    }

    res.send(`
      <!doctype html><meta charset="utf-8">
      <title>X (Twitter) linked</title>
      <style>body{font-family:system-ui;background:#0b0d12;color:#e7eaf0;padding:40px;max-width:520px;margin:auto}
        a{color:#7c5cff}.ok{color:#2bd4a0}</style>
      <h1>✓ Compte X lié directement</h1>
      <p>Connecté en tant que <strong>@${username}</strong></p>
      <p>Tu peux fermer cet onglet et retourner sur <a href="/">l'app</a>.</p>
      <script>window.opener && window.opener.postMessage({type:'x_linked', username: '${username}'}, '*'); setTimeout(()=>window.close(), 1500);</script>
    `);
  } catch (e) {
    res.status(500).send(`<h1>X OAuth failed</h1><pre>${(e as Error).message}</pre><a href="/">Retour</a>`);
  }
});

app.get('/api/auth/x/status', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, x_user_id as "accountId", handle, display_name as "displayName", status, metadata FROM public.x_accounts WHERE business_id = $1 ORDER BY created_at DESC',
      [BUSINESS_ID]
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// ---------- AWS Bedrock config check ----------
app.get('/api/auth/aws/status', (_req: Request, res: Response) => {
  res.json({
    configured: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
    region: process.env.AWS_REGION || 'us-east-1',
    modelId: process.env.AWS_BEDROCK_MODEL || 'us.anthropic.claude-3-5-sonnet-20241022-v2:0'
  });
});

app.post('/api/auth/x/logout', async (req: Request, res: Response) => {
  const { id } = req.body as { id?: string };
  if (!id) {
    return res.status(400).json({ error: 'id de compte manquant' });
  }
  try {
    const accRes = await pool.query(
      'SELECT x_user_id FROM public.x_accounts WHERE business_id = $1 AND id = $2 LIMIT 1',
      [BUSINESS_ID, id]
    );
    if (accRes.rows.length > 0) {
      const zernioAccountId = accRes.rows[0].x_user_id;
      await xUnlink(zernioAccountId);
    }
    await pool.query(
      'DELETE FROM public.x_accounts WHERE business_id = $1 AND id = $2',
      [BUSINESS_ID, id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});


// ---------- Instagram OAuth ----------
app.get('/api/auth/insta/login', async (req: Request, res: Response) => {
  try {
    const { url } = await buildInstaAuthUrl(req.headers.host);
    res.redirect(url);
  } catch (e) {
    res.status(500).send(`Instagram OAuth login failed: ${(e as Error).message}`);
  }
});

app.get('/api/auth/insta/callback', async (req: Request, res: Response) => {
  const error = req.query.error as string | undefined;
  const errorMessage = req.query.error_message as string | undefined;
  if (error) {
    return res.status(400).send(`
      <!doctype html><meta charset="utf-8">
      <title>Erreur de connexion</title>
      <style>body{font-family:system-ui;background:#0b0d12;color:#e7eaf0;padding:40px;max-width:520px;margin:auto}
        a{color:#7c5cff}.err{color:#ff5050}</style>
      <h1 class="err">✗ Échec de la connexion Instagram</h1>
      <p><strong>Détails :</strong> ${escapeHtml(errorMessage ?? error)}</p>
      <p>Essaie de fermer cet onglet et de recliquer sur le bouton de connexion.</p>
      <a href="/">Retour</a>
    `);
  }

  const accountId = req.query.accountId as string | undefined;
  const username = req.query.username as string | undefined;
  const profileId = req.query.profileId as string | undefined;

  if (!accountId || !username || !profileId) {
    return res.status(400).send(`
      <!doctype html><meta charset="utf-8">
      <title>Erreur de connexion</title>
      <style>body{font-family:system-ui;background:#0b0d12;color:#e7eaf0;padding:40px;max-width:520px;margin:auto}
        a{color:#7c5cff}</style>
      <h1>Callback Zernio invalide</h1>
      <p>Les paramètres requis sont absents de la réponse Zernio.</p>
      <a href="/">Retour</a>
    `);
  }
  try {
    const stored = await handleInstaCallback({
      accountId,
      username,
      profileId,
    });
    res.send(`
      <!doctype html><meta charset="utf-8">
      <title>Instagram linked</title>
      <style>body{font-family:system-ui;background:#0b0d12;color:#e7eaf0;padding:40px;max-width:520px;margin:auto}
        a{color:#7c5cff}.ok{color:#2bd4a0}</style>
      <h1>✓ Compte Instagram linké via Zernio</h1>
      <p>Connecté en tant que <strong>${stored.username}</strong></p>
      <p>Tu peux fermer cet onglet et retourner sur <a href="/">l'app</a>.</p>
      <script>window.opener && window.opener.postMessage({type:'insta_linked', displayName:'${stored.username}'}, '*'); setTimeout(()=>window.close(), 1500);</script>
    `);
  } catch (e) {
    res.status(500).send(`<h1>Instagram OAuth failed</h1><pre>${(e as Error).message}</pre><a href="/">Retour</a>`);
  }
});

app.get('/api/auth/insta/status', async (_req: Request, res: Response) => {
  try {
    res.json(await getInstaStatus());
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.post('/api/auth/insta/logout', async (_req: Request, res: Response) => {
  try {
    await instaUnlink();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// ---------- Instagram: upload + post a LOCAL FILE ----------
app.post(
  '/api/insta/upload-and-post',
  express.raw({ type: 'video/*', limit: '64mb' }),
  async (req: Request, res: Response) => {
    try {
      const buffer = req.body as Buffer;
      if (!buffer || buffer.length === 0) {
        return res.status(400).json({ error: 'corps de requête vide' });
      }
      const captionB64 = req.headers['x-insta-caption'] as string | undefined;
      const caption = captionB64 ? Buffer.from(captionB64, 'base64').toString('utf-8') : undefined;

      const { publishId, finalStatus } = await postInstaVideo({
        videoBuffer: buffer,
        caption,
      });

      res.json({
        publishId,
        status: finalStatus.status === 'PUBLISH_COMPLETE' ? 'published' : 'failed',
        failReason: finalStatus.failReason,
        publicPostUrl: finalStatus.publicPostUrl,
        videoSizeBytes: buffer.length,
      });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  }
);

app.get('/api/insta/publish-status', async (req: Request, res: Response) => {
  try {
    const publishId = req.query.publishId as string | undefined;
    if (!publishId) return res.status(400).json({ error: 'publishId manquant' });
    res.json(await fetchInstaPublishStatus(publishId));
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});


// ---------- WhatsApp CEO IA & Sentinel ----------

app.get('/api/whatsapp/config', async (_req: Request, res: Response) => {
  try {
    const db = await loadDatabase();
    res.json(db);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.post('/api/whatsapp/update-phone', async (req: Request, res: Response) => {
  try {
    const { phoneNumber } = req.body as { phoneNumber?: string };
    if (!phoneNumber) return res.status(400).json({ error: 'Numéro manquant' });

    const db = await loadDatabase();
    db.userPhoneNumber = phoneNumber;
    await saveDatabase(db);

    res.json({ ok: true, userPhoneNumber: db.userPhoneNumber });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.post('/api/whatsapp/initiate', async (req: Request, res: Response) => {
  try {
    const { phoneNumber } = req.body as { phoneNumber?: string };
    if (!phoneNumber) return res.status(400).json({ error: 'Numéro manquant' });

    const conversationId = await initiateWhatsAppConversation(phoneNumber);
    res.json({ ok: true, conversationId });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.post('/api/whatsapp/send-kpis', async (_req: Request, res: Response) => {
  try {
    const result = await broadcastKpis();
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.post('/api/whatsapp/chat-simulator', async (req: Request, res: Response) => {
  try {
    const { message, conversationId } = req.body as { message?: string; conversationId?: string };
    if (!message) return res.status(400).json({ error: 'message manquant' });
    const convId = conversationId || 'web-chat-simulator';

    const result = await processUserMessage(convId, message);
    const updatedDb = await loadDatabase();

    res.json({
      reply: result.reply,
      activeBusinessId: result.activeBusinessId,
      db: updatedDb,
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// ---------- WhatsApp Prompts Endpoints ----------

app.get('/api/whatsapp/prompts', async (_req: Request, res: Response) => {
  try {
    const db = await loadDatabase();
    res.json({
      ceoPrompt: db.ceoPrompt || DEFAULT_CEO_PROMPT,
      sentinelPrompt: db.sentinelPrompt || DEFAULT_SENTINEL_PROMPT,
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.post('/api/whatsapp/prompts', async (req: Request, res: Response) => {
  try {
    const { ceoPrompt, sentinelPrompt } = req.body as { ceoPrompt?: string; sentinelPrompt?: string };
    const db = await loadDatabase();
    
    if (ceoPrompt !== undefined) {
      db.ceoPrompt = ceoPrompt;
      updatePrompts(ceoPrompt, db.sentinelPrompt || DEFAULT_SENTINEL_PROMPT);
    }
    if (sentinelPrompt !== undefined) {
      db.sentinelPrompt = sentinelPrompt;
      updatePrompts(db.ceoPrompt || DEFAULT_CEO_PROMPT, sentinelPrompt);
    }
    
    await saveDatabase(db);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// ---------- WhatsApp Webhook (Deduplicated & Asynchronous) ----------

const processedMessageIds = new Set<string>();
const activeConversations = new Set<string>();

app.post('/api/whatsapp/webhook', async (req: Request, res: Response) => {
  try {
    console.log('[whatsapp-webhook] Received webhook payload:', JSON.stringify(req.body));

    const body = req.body as {
      event?: string;
      data?: {
        messageId?: string;
        conversationId?: string;
        text?: string;
        message?: {
          id?: string;
          text?: string;
          conversationId?: string;
          direction?: string;
        };
        thread?: {
          id?: string;
        };
      };
      message?: {
        id?: string;
        conversationId?: string;
        text?: string;
        direction?: string;
      };
      conversation?: {
        id?: string;
      };
    };

    if (body.event !== 'message.received') {
      return res.status(200).send('Event non géré');
    }

    let conversationId = '';
    let text = '';
    let msgId = '';
    let direction = '';

    // 1. Try direct root structures (Zernio real format)
    if (body.message) {
      conversationId = body.message.conversationId || '';
      text = body.message.text || '';
      msgId = body.message.id || '';
      direction = body.message.direction || '';
    }
    if (!conversationId && body.conversation) {
      conversationId = body.conversation.id || '';
    }

    // 2. Try nested body.data structure as a fallback
    if ((!conversationId || !text) && body.data) {
      const data = body.data;
      conversationId = conversationId || data.conversationId || (data.thread && data.thread.id) || (data.message && data.message.conversationId) || '';
      text = text || data.text || (data.message && data.message.text) || '';
      msgId = msgId || data.messageId || (data.message && data.message.id) || '';
      direction = direction || (data.message && data.message.direction) || '';
    }

    // If direction is explicitly set and not incoming (i.e. outgoing/bot's own message), ignore it
    if (direction && direction !== 'incoming') {
      console.log(`[whatsapp-webhook] Ignoring non-incoming message (direction: ${direction})`);
      return res.status(200).send('Ignored outgoing message');
    }

    if (!conversationId || !text) {
      console.warn('[whatsapp-webhook] Webhook received message but could not find conversationId or text in payload:', JSON.stringify(body));
      return res.status(400).send('Missing conversationId or text in webhook payload');
    }

    // Deduplication check
    if (msgId) {
      if (processedMessageIds.has(msgId)) {
        console.log(`[whatsapp-webhook] Duplicate message detected (msgId: ${msgId}). Skipping.`);
        return res.status(200).json({ status: 'ok', duplicate: true });
      }
      processedMessageIds.add(msgId);
      // Keep memory bounded
      if (processedMessageIds.size > 1000) {
        const firstValue = processedMessageIds.values().next().value;
        if (firstValue !== undefined) {
          processedMessageIds.delete(firstValue);
        }
      }
    }

    // Concurrency lock to prevent multiple concurrent Claude calls for the same conversation
    if (activeConversations.has(conversationId)) {
      console.log(`[whatsapp-webhook] Conversation ${conversationId} is currently being processed. Ignoring to prevent concurrent loops.`);
      return res.status(200).json({ status: 'ok', processing: true });
    }

    console.log(`[whatsapp-webhook] Processing message asynchronously: msgId=${msgId}, conversationId=${conversationId}: "${text}"`);
    
    // Respond immediately to Zernio to prevent timeout and retries
    res.status(200).json({ status: 'ok', received: true });

    activeConversations.add(conversationId);

    // Process in background
    (async () => {
      try {
        const result = await processUserMessage(conversationId, text);
        await sendWhatsAppMessage(conversationId, result.reply);
        console.log(`[whatsapp-webhook] Successfully replied to msgId=${msgId}`);
      } catch (err) {
        console.error(`[whatsapp-webhook] Asynchronous processing error for msgId=${msgId}:`, err);
      } finally {
        activeConversations.delete(conversationId);
        console.log(`[whatsapp-webhook] Released lock for conversation ${conversationId}`);
      }
    })();

  } catch (e) {
    console.error('[whatsapp-webhook] Error in webhook router:', e);
    if (!res.headersSent) {
      res.status(500).json({ error: (e as Error).message });
    }
  }
});

// ---------- Mailgun Inbound Webhook ----------
import multer from 'multer';
const upload = multer();

function verifyMailgunSignature(token: string, timestamp: string, signature: string): boolean {
  const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY || '';
  if (!signingKey) return true; // Bypass validation if key is not configured
  
  const value = timestamp + token;
  const hash = crypto.createHmac('sha256', signingKey).update(value).digest('hex');
  return hash === signature;
}

app.post('/api/mailgun/webhook', upload.none(), async (req: Request, res: Response) => {
  try {
    console.log('[mailgun-webhook] Received inbound email payload:', JSON.stringify(req.body));
    
    const sender = String(req.body.sender || req.body.From || '').trim();
    const recipient = String(req.body.recipient || req.body.To || '').trim();
    const subject = String(req.body.subject || '').trim();
    const token = String(req.body.token || '');
    const timestamp = String(req.body.timestamp || '');
    const signature = String(req.body.signature || '');

    if (!sender || !recipient) {
      console.warn('[mailgun-webhook] Missing sender or recipient in email body');
      return res.status(400).send('Missing sender or recipient');
    }

    if (token && timestamp && signature) {
      if (!verifyMailgunSignature(token, timestamp, signature)) {
        console.warn('[mailgun-webhook] Signature verification failed. Rejecting.');
        return res.status(401).json({ error: 'Signature verification failed' });
      }
    } else {
      console.log('[mailgun-webhook] Bypassing signature check (missing parameters)');
    }

    // 1. Find the mailbox matching recipient
    const mbRes = await pool.query("SELECT id FROM public.mailboxes WHERE business_id = $1 AND lower(email_address) = lower($2) LIMIT 1", [BUSINESS_ID, recipient]);
    const mailboxId = mbRes.rows[0]?.id;
    if (!mailboxId) {
      console.warn(`[mailgun-webhook] Mailbox not found for recipient: ${recipient}`);
      return res.status(404).json({ error: 'Mailbox not found' });
    }

    // 2. Find or create the lead based on sender email
    let leadId;
    const leadRes = await pool.query("SELECT id FROM public.leads WHERE business_id = $1 AND lower(email) = lower($2) LIMIT 1", [BUSINESS_ID, sender]);
    if (leadRes.rows.length > 0) {
      leadId = leadRes.rows[0].id;
    } else {
      leadId = crypto.randomUUID();
      await pool.query(`
        INSERT INTO public.leads (id, business_id, full_name, email, source)
        VALUES ($1, $2, $3, $4, 'reply')
      `, [leadId, BUSINESS_ID, sender.split('@')[0], sender]);
    }

    // 3. Find if there is an active thread for this lead and mailbox
    const threadRes = await pool.query(`
      SELECT id FROM public.email_threads 
      WHERE business_id = $1 AND lead_id = $2 AND mailbox_id = $3
      ORDER BY last_message_at DESC NULLS LAST, created_at DESC LIMIT 1
    `, [BUSINESS_ID, leadId, mailboxId]);

    let threadId;
    let campaignId = null;

    if (threadRes.rows.length > 0) {
      threadId = threadRes.rows[0].id;
      // Retrieve the campaign_id from the last sent email in this thread
      const lastMsgRes = await pool.query(`
        SELECT campaign_id FROM public.email_messages 
        WHERE thread_id = $1 AND campaign_id IS NOT NULL 
        LIMIT 1
      `, [threadId]);
      campaignId = lastMsgRes.rows[0]?.campaign_id || null;
    } else {
      threadId = crypto.randomUUID();
      await pool.query(`
        INSERT INTO public.email_threads (id, business_id, mailbox_id, lead_id, subject, last_message_at, inbound_count, outbound_count, unread)
        VALUES ($1, $2, $3, $4, $5, NOW(), 0, 0, true)
      `, [threadId, BUSINESS_ID, mailboxId, leadId, subject]);
    }

    // 4. Insert the message into email_messages
    const bodyVal = req.body['stripped-text'] || req.body['body-plain'] || '';
    await pool.query(`
      INSERT INTO public.email_messages (
        id, thread_id, business_id, mailbox_id, direction, from_address, to_address, subject, body_text, status, sent_at, campaign_id
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, 'in', $4, $5, $6, $7, 'received', NOW(), $8
      )
    `, [threadId, BUSINESS_ID, mailboxId, sender, recipient, subject, bodyVal, campaignId]);

    // 5. Update thread metadata
    await pool.query(`
      UPDATE public.email_threads
      SET last_message_at = NOW(),
          inbound_count = COALESCE(inbound_count, 0) + 1,
          unread = true
      WHERE id = $1
    `, [threadId]);

    console.log(`[mailgun-webhook] Successfully processed inbound email: threadId=${threadId}, campaignId=${campaignId}`);
    res.status(200).json({ success: true, threadId });
  } catch (err) {
    console.error('[mailgun-webhook] Error processing webhook:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// --- Sideloot Multi-Channel Prospecting Additions ---
import pg from 'pg';
import OpenAI from 'openai';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase')
    ? { rejectUnauthorized: false }
    : undefined
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const BUSINESS_ID = '8490ff47-45cf-4b96-b149-aa1961280032';



async function fetchTweetsByKeyword(keyword: string, minLikes: number): Promise<any[]> {
  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) {
    console.error("[Apify] APIFY_TOKEN is missing in the environment");
    return [];
  }

  const actorId = 'apidojo~tweet-scraper';
  const query = `${keyword} lang:en min_faves:${minLikes}`;
  console.log(`[Apify] Starting search with query: "${query}"`);
  
  const input = {
    searchTerms: [query],
    maxItems: 5,
    onlyImage: false,
    onlyVideo: false,
    onlyTwitterBlue: false,
    onlyVerifiedUsers: false
  };

  const startUrl = `https://api.apify.com/v2/acts/${actorId}/runs?token=${encodeURIComponent(apifyToken)}`;
  
  try {
    const startRes = await fetch(startUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!startRes.ok) {
      const errText = await startRes.text();
      console.error(`[Apify] Failed to start Apify run: HTTP ${startRes.status} - ${errText}`);
      return [];
    }

    const startBody = await startRes.json() as any;
    const runId = startBody.data.id;
    const datasetId = startBody.data.defaultDatasetId;
    console.log(`[Apify] Actor started! Run ID: ${runId}, Dataset ID: ${datasetId}`);

    const pollUrl = `https://api.apify.com/v2/actor-runs/${runId}?token=${encodeURIComponent(apifyToken)}`;
    const deadline = Date.now() + 3 * 60 * 1000;
    let success = false;

    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      const pollRes = await fetch(pollUrl);
      if (!pollRes.ok) {
        console.warn(`[Apify] Poll run status failed (HTTP ${pollRes.status}), retrying...`);
        continue;
      }
      const pollBody = await pollRes.json() as any;
      const status = pollBody.data.status;
      console.log(`[Apify] Current run status: ${status}`);

      if (status === 'SUCCEEDED') {
        success = true;
        break;
      }
      if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
        console.error(`[Apify] Actor run failed with status: ${status}. Message: ${pollBody.data.statusMessage}`);
        break;
      }
    }

    if (!success) {
      console.error("[Apify] Actor run did not succeed or timed out.");
      return [];
    }

    const itemsUrl = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${encodeURIComponent(apifyToken)}&clean=true&format=json`;
    console.log("[Apify] Fetching dataset items...");
    const itemsRes = await fetch(itemsUrl);
    if (!itemsRes.ok) {
      const errText = await itemsRes.text();
      console.error(`[Apify] Failed to fetch dataset items: HTTP ${itemsRes.status} - ${errText}`);
      return [];
    }

    const items = await itemsRes.json() as any[];
    console.log(`[Apify] Successfully retrieved ${items.length} tweets.`);
    return items;
  } catch (e) {
    console.error("[Apify] Error during fetching tweets:", e);
    return [];
  }
}


// Initialize Auth DB Tables & Seed admin user
async function initAuthDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.dashboard_users (
        id UUID PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.dashboard_sessions (
        token VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.x_scanned_posts (
        id VARCHAR(255) PRIMARY KEY,
        campaign_id UUID NOT NULL REFERENCES public.prospection_campaigns(id) ON DELETE CASCADE,
        url VARCHAR(1024) NOT NULL,
        text TEXT NOT NULL,
        author_username VARCHAR(255) NOT NULL,
        author_name VARCHAR(255),
        author_profile_picture VARCHAR(1024),
        like_count INT DEFAULT 0,
        reply_count INT DEFAULT 0,
        retweet_count INT DEFAULT 0,
        status VARCHAR(50) DEFAULT 'scanned',
        reply_tweet_url VARCHAR(1024),
        scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        commented_at TIMESTAMP WITH TIME ZONE
      );
    `);

    await pool.query(`
      ALTER TABLE public.prospection_sends ADD COLUMN IF NOT EXISTS tweet_url TEXT;
    `);

    const checkUser = await pool.query("SELECT id FROM public.dashboard_users WHERE email = $1 LIMIT 1", ['toedembo@gmail.com']);
    if (checkUser.rows.length === 0) {
      const password = 'SideBiBang35!@';
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.scryptSync(password, salt, 64).toString('hex');
      const passwordHash = `${salt}:${hash}`;
      
      await pool.query(`
        INSERT INTO public.dashboard_users (id, email, password_hash, created_at)
        VALUES ($1, $2, $3, NOW())
      `, [crypto.randomUUID(), 'toedembo@gmail.com', passwordHash]);
      console.log('[Auth DB] Seeded admin user: toedembo@gmail.com');
    }
  } catch (err) {
    console.error('[Auth DB] Initialization failed:', err);
  }
}

initAuthDatabase();

// Cookie Parser Helper
function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    list[parts.shift()!.trim()] = decodeURI(parts.join('='));
  });
  return list;
}

// Password Verification Helper
function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const checkHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return hash === checkHash;
}

// requireAuth Middleware
async function requireAuth(req: any, res: any, next: any) {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies['sideloot_session'];
    
    if (!token) {
      return res.status(401).json({ error: 'Non authentifié. Session expirée.' });
    }

    const sessionRes = await pool.query(`
      SELECT email, expires_at FROM public.dashboard_sessions 
      WHERE token = $1 LIMIT 1
    `, [token]);

    if (sessionRes.rows.length === 0) {
      return res.status(401).json({ error: 'Session invalide ou inexistante.' });
    }

    const session = sessionRes.rows[0];
    if (new Date(session.expires_at) < new Date()) {
      await pool.query("DELETE FROM public.dashboard_sessions WHERE token = $1", [token]);
      return res.status(401).json({ error: 'Session expirée. Veuillez vous reconnecter.' });
    }

    req.adminEmail = session.email;
    next();
  } catch (err) {
    console.error('[Auth Middleware Error]:', err);
    res.status(500).json({ error: (err as Error).message });
  }
}

// Apply authentication to prospection namespace
app.use('/api/prospection', requireAuth);

// Auth Endpoints
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password, rememberMe } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis.' });
    }

    const userRes = await pool.query("SELECT password_hash FROM public.dashboard_users WHERE email = $1 LIMIT 1", [email.trim().toLowerCase()]);
    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Identifiants invalides.' });
    }

    const dbUser = userRes.rows[0];
    const isPasswordValid = verifyPassword(password, dbUser.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Identifiants invalides.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const isRemembered = rememberMe === true || rememberMe === 'true';
    const durationMs = isRemembered ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + durationMs);

    await pool.query(`
      INSERT INTO public.dashboard_sessions (token, email, expires_at, created_at)
      VALUES ($1, $2, $3, NOW())
    `, [token, email.trim().toLowerCase(), expiresAt]);

    res.setHeader('Set-Cookie', `sideloot_session=${token}; HttpOnly; Path=/; SameSite=Lax${isRemembered ? `; Max-Age=${durationMs / 1000}` : ''}`);
    res.json({ success: true, email: email.trim().toLowerCase() });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.get('/api/auth/me', async (req: Request, res: Response) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies['sideloot_session'];

    if (!token) {
      return res.status(401).json({ error: 'Non connecté' });
    }

    const sessionRes = await pool.query("SELECT email, expires_at FROM public.dashboard_sessions WHERE token = $1 LIMIT 1", [token]);
    if (sessionRes.rows.length === 0) {
      return res.status(401).json({ error: 'Session non trouvée' });
    }

    const session = sessionRes.rows[0];
    if (new Date(session.expires_at) < new Date()) {
      await pool.query("DELETE FROM public.dashboard_sessions WHERE token = $1", [token]);
      return res.status(401).json({ error: 'Session expirée' });
    }

    res.json({ email: session.email });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.post('/api/auth/logout', async (req: Request, res: Response) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies['sideloot_session'];

    if (token) {
      await pool.query("DELETE FROM public.dashboard_sessions WHERE token = $1", [token]);
    }

    res.setHeader('Set-Cookie', 'sideloot_session=; HttpOnly; Path=/; Max-Age=0');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// Stripe Caching & Fetcher
let cachedStripeData: {
  subscriptions: any[];
  charges: any[];
  customers: any[];
  fetchedAt: number;
} | null = null;
const STRIPE_CACHE_TTL = 10000; // 10 seconds

async function getStripeData() {
  const now = Date.now();
  if (cachedStripeData && (now - cachedStripeData.fetchedAt < STRIPE_CACHE_TTL)) {
    return cachedStripeData;
  }

  const stripeKey = process.env.STRIPE_RESTRICTED_KEY;
  if (!stripeKey) {
    throw new Error('STRIPE_RESTRICTED_KEY is missing in env');
  }
  
  // Fetch subscriptions
  let subscriptions: any[] = [];
  let hasMoreSubs = true;
  let startingAfterSub: string | undefined = undefined;
  
  while (hasMoreSubs && subscriptions.length < 500) {
    let url = `https://api.stripe.com/v1/subscriptions?status=all&limit=100`;
    if (startingAfterSub) {
      url += `&starting_after=${startingAfterSub}`;
    }
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${stripeKey}` } });
    if (!res.ok) {
      throw new Error(`Stripe subscription fetch failed with status ${res.status}`);
    }
    const data: any = await res.json();
    const chunk = data.data || [];
    subscriptions.push(...chunk);
    hasMoreSubs = data.has_more && chunk.length > 0;
    if (chunk.length > 0) {
      startingAfterSub = chunk[chunk.length - 1].id;
    }
  }

  // Fetch charges
  let charges: any[] = [];
  let hasMoreCharges = true;
  let startingAfterCharge: string | undefined = undefined;
  
  while (hasMoreCharges && charges.length < 500) {
    let url = `https://api.stripe.com/v1/charges?limit=100`;
    if (startingAfterCharge) {
      url += `&starting_after=${startingAfterCharge}`;
    }
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${stripeKey}` } });
    if (!res.ok) {
      throw new Error(`Stripe charges fetch failed with status ${res.status}`);
    }
    const data: any = await res.json();
    const chunk = data.data || [];
    charges.push(...chunk);
    hasMoreCharges = data.has_more && chunk.length > 0;
    if (chunk.length > 0) {
      startingAfterCharge = chunk[chunk.length - 1].id;
    }
  }

  // Fetch customers
  let customers: any[] = [];
  let hasMoreCustomers = true;
  let startingAfterCustomer: string | undefined = undefined;
  
  while (hasMoreCustomers && customers.length < 500) {
    let url = `https://api.stripe.com/v1/customers?limit=100`;
    if (startingAfterCustomer) {
      url += `&starting_after=${startingAfterCustomer}`;
    }
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${stripeKey}` } });
    if (!res.ok) {
      throw new Error(`Stripe customers fetch failed with status ${res.status}`);
    }
    const data: any = await res.json();
    const chunk = data.data || [];
    customers.push(...chunk);
    hasMoreCustomers = data.has_more && chunk.length > 0;
    if (chunk.length > 0) {
      startingAfterCustomer = chunk[chunk.length - 1].id;
    }
  }

  cachedStripeData = {
    subscriptions,
    charges,
    customers,
    fetchedAt: now
  };
  return cachedStripeData;
}

// 1. Metrics Endpoint
app.get('/api/prospection/metrics', async (req: Request, res: Response) => {
  try {
    const daysParam = req.query.days ? String(req.query.days) : '30';
    let dateFilter = '';
    let params: any[] = [BUSINESS_ID];

    const nowSecs = Math.floor(Date.now() / 1000);
    let startTs = 0;
    
    if (daysParam === '0') {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      startTs = Math.floor(d.getTime() / 1000);
      dateFilter = `AND sent_at >= NOW() - '1 day'::interval`;
    } else if (daysParam !== 'all') {
      const days = Number(daysParam) || 30;
      startTs = nowSecs - (days * 24 * 3600);
      dateFilter = `AND sent_at >= NOW() - $2::interval`;
      params.push(`${days} days`);
    }

    // Email Counts
    const emailRes = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE direction = 'out') as sent,
        COUNT(*) FILTER (WHERE direction = 'in') as received
      FROM public.email_messages 
      WHERE business_id = $1 ${dateFilter}
    `, params);



    // X Comments & Reddit Counts
    const sendsDateFilter = dateFilter.replace('sent_at', 's.sent_at');
    const sendsRes = await pool.query(`
      SELECT 
        campaign_kind, 
        COUNT(*) as count
      FROM public.prospection_sends s
      JOIN public.prospection_campaigns c ON s.campaign_id = c.id
      WHERE c.business_id = $1 ${sendsDateFilter}
      GROUP BY campaign_kind
    `, params);

    const kindsCount: Record<string, number> = { x_reply: 0, reddit: 0 };
    for (const row of sendsRes.rows) {
      kindsCount[row.campaign_kind] = Number(row.count);
    }

    // Fetch Stripe Data & Compute Metrics
    const stripe = await getStripeData();

    // paying_subscribers: active/trialing/past_due created before period end, not canceled before period start
    const activeSubs = stripe.subscriptions.filter(s => {
      const isCreatedBeforeEnd = s.created <= nowSecs;
      const isNotCanceledOrCanceledAfterStart = !s.canceled_at || s.canceled_at > startTs;
      const isActiveStatus = ['active', 'trialing', 'past_due'].includes(s.status);
      return isCreatedBeforeEnd && isNotCanceledOrCanceledAfterStart && isActiveStatus;
    });
    const payingSubscribers = activeSubs.length;

    // revenue: captured, non-refunded charges in that period
    const periodCharges = stripe.charges.filter(c => c.created >= startTs && c.created <= nowSecs && c.captured && !c.refunded);
    const revenue = periodCharges.reduce((acc, c) => acc + (c.amount - c.amount_refunded), 0) / 100;
    const marginEstimation = revenue * 0.5;

    // mrr: sum of active subs monthly amounts
    const mrr = activeSubs.reduce((acc, s) => {
      const item = s.items?.data?.[0];
      if (!item) return acc;
      const price = item.price?.unit_amount || 0;
      const interval = item.price?.recurring?.interval || 'month';
      let monthlyAmount = price / 100;
      if (interval === 'year') {
        monthlyAmount = (price / 100) / 12;
      } else if (interval === 'week') {
        monthlyAmount = (price / 100) * 4.33;
      } else if (interval === 'day') {
        monthlyAmount = (price / 100) * 30;
      }
      return acc + monthlyAmount;
    }, 0);

    // churn: cancellations in period / active in period * 100
    const canceledInPeriod = stripe.subscriptions.filter(s => s.canceled_at && s.canceled_at >= startTs && s.canceled_at <= nowSecs).length;
    const activeInPeriod = stripe.subscriptions.filter(s => s.created <= nowSecs && (!s.canceled_at || s.canceled_at >= startTs)).length;
    const churnRate = activeInPeriod > 0 ? Number(((canceledInPeriod / activeInPeriod) * 100).toFixed(1)) : 0;

    // Simulated Website Visitors & Conversion Rate
    let visitors = 0;
    let conversionRate = 0;
    if (daysParam === '0') {
      visitors = 142;
      conversionRate = 3.5;
    } else if (daysParam === '3') {
      visitors = 428;
      conversionRate = 3.2;
    } else if (daysParam === '7') {
      visitors = 984;
      conversionRate = 2.9;
    } else if (daysParam === '14') {
      visitors = 1945;
      conversionRate = 2.7;
    } else if (daysParam === '30') {
      visitors = 4120;
      conversionRate = 2.5;
    } else if (daysParam === '60') {
      visitors = 8340;
      conversionRate = 2.4;
    } else if (daysParam === '90') {
      visitors = 12450;
      conversionRate = 2.3;
    } else {
      visitors = 32800;
      conversionRate = 2.4;
    }
    const signups = Math.round(visitors * (conversionRate / 100));

    // Customers List mapping
    const customersList = activeSubs.map(s => {
      const cust = stripe.customers.find(c => c.id === s.customer);
      const item = s.items?.data?.[0];
      const price = item?.price?.unit_amount || 0;
      const currency = (item?.price?.currency || 'usd').toUpperCase();
      const interval = item?.price?.recurring?.interval || 'month';
      
      let planDesc = '';
      if (price > 0) {
        planDesc = `$${(price / 100).toFixed(2)} ${currency}/${interval}`;
      } else {
        planDesc = 'Unknown Plan';
      }

      return {
        id: s.customer,
        name: cust?.name || cust?.description || 'Unknown Customer',
        email: cust?.email || 'No Email',
        plan: planDesc,
        status: s.status
      };
    });

    // Churned Customers List mapping
    const churnedSubs = stripe.subscriptions.filter(s => s.canceled_at && s.canceled_at >= startTs && s.canceled_at <= nowSecs);
    const churnedList = churnedSubs.map(s => {
      const cust = stripe.customers.find(c => c.id === s.customer);
      const item = s.items?.data?.[0];
      const price = item?.price?.unit_amount || 0;
      const currency = (item?.price?.currency || 'usd').toUpperCase();
      const interval = item?.price?.recurring?.interval || 'month';
      
      let planDesc = '';
      if (price > 0) {
        planDesc = `$${(price / 100).toFixed(2)} ${currency}/${interval}`;
      } else {
        planDesc = 'Unknown Plan';
      }

      const cancelTime = s.canceled_at || 0;
      const dateObj = new Date(cancelTime * 1000);
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const canceledDate = `${year}-${month}-${day}`;

      return {
        id: s.customer,
        name: cust?.name || cust?.description || 'Unknown Customer',
        email: cust?.email || 'No Email',
        plan: planDesc,
        canceled_at: canceledDate
      };
    });

    // Recent Feed activity
    const recentRes = await pool.query(`
      (
        SELECT 'email' as type, direction, to_address as recipient, subject as title, body_text as body, sent_at
        FROM public.email_messages WHERE business_id = $1
      ) UNION ALL (
        SELECT campaign_kind as type, 'out' as direction, recipient, null as title, body, s.sent_at
        FROM public.prospection_sends s
        JOIN public.prospection_campaigns c ON s.campaign_id = c.id
        WHERE c.business_id = $1
      )
      ORDER BY sent_at DESC LIMIT 15
    `, [BUSINESS_ID]);

    res.json({
      website_visitors: visitors,
      conversion_rate: conversionRate,
      signups,
      paying_subscribers: payingSubscribers,
      revenue,
      margin_estimation: marginEstimation,
      mrr,
      churn_rate: churnRate,
      customers_list: customersList,
      churned_list: churnedList,
      emails_sent: Number(emailRes.rows[0]?.sent || 0),
      emails_received: Number(emailRes.rows[0]?.received || 0),
      x_dms_sent: 0,
      x_comments_replied: kindsCount.x_reply || 0,
      reddit_posts: kindsCount.reddit || 0,
      recent_activity: recentRes.rows
    });
  } catch (e) {
    console.error('Error fetching metrics:', e);
    res.status(500).json({ error: (e as Error).message });
  }
});

// 2. Leads list for simulator
app.get('/api/prospection/leads', async (_req: Request, res: Response) => {
  try {
    const leadsRes = await pool.query(`
      SELECT id, full_name, email, x_handle, company_name, industry
      FROM public.leads 
      WHERE business_id = $1 AND email IS NOT NULL AND x_handle IS NOT NULL
      LIMIT 20
    `, [BUSINESS_ID]);

    if (leadsRes.rows.length === 0) {
      const allLeads = await pool.query(`
        SELECT id, full_name, email, x_handle, company_name, industry
        FROM public.leads 
        WHERE business_id = $1
        LIMIT 20
      `, [BUSINESS_ID]);
      return res.json(allLeads.rows);
    }
    res.json(leadsRes.rows);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// 3. Subscribers list
app.get('/api/subscribers', requireAuth, async (_req: Request, res: Response) => {
  try {
    const subsRes = await pool.query(`
      SELECT p.email, p.display_name, s.plan_id, s.status, s.billing_interval, s.current_period_end
      FROM public.profiles p
      JOIN public.subscriptions s ON s.user_id = p.id
      ORDER BY s.created_at DESC
    `);
    res.json(subsRes.rows);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// 4. Workers and Positions lists
app.get('/api/workers', requireAuth, async (_req: Request, res: Response) => {
  try {
    const posRes = await pool.query(`
      SELECT id, display_name, emoji, multi_hire, sort_order, description
      FROM public.positions
      ORDER BY sort_order
    `);
    
    const workers = [];
    for (const pos of posRes.rows) {
      const skillsRes = await pool.query(`
        SELECT s.id, s.display_name, s.category
        FROM public.skills s
        JOIN public.position_skills ps ON ps.skill_id = s.id
        WHERE ps.position_id = $1
      `, [pos.id]);
      workers.push({
        ...pos,
        skills: skillsRes.rows
      });
    }
    res.json(workers);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// 5. Plan Features list
app.get('/api/plans', requireAuth, async (_req: Request, res: Response) => {
  try {
    const plansRes = await pool.query(`
      SELECT id, display_name, monthly_price_usd, annual_price_usd, monthly_credits, description
      FROM public.plans
      ORDER BY display_order
    `);
    res.json(plansRes.rows);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// ---------- Mailgun Sender Helper ----------
async function sendMailgunEmail(to: string, subject: string, body: string) {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN || 'sideloot.xyz';
  if (!apiKey) {
    throw new Error('Mailgun API Key is missing in .env');
  }

  const auth = 'Basic ' + Buffer.from('api:' + apiKey).toString('base64');
  const formData = new URLSearchParams();
  formData.append('from', 'Grace <grace@sideloot.xyz>');
  formData.append('to', to);
  formData.append('subject', subject);
  formData.append('text', body);

  const res = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': auth,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: formData.toString()
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Mailgun send failed with status ${res.status}: ${errText}`);
  }

  return await res.json();
}

// ---------- Extended Sideloot Prospecting Endpoints ----------

// 1. Campaigns endpoints
app.get('/api/prospection/campaigns', async (req: Request, res: Response) => {
  try {
    const kind = req.query.kind as string | undefined;
    if (!kind) {
      return res.status(400).json({ error: 'kind requis' });
    }
    const result = await pool.query(`
      SELECT c.id, c.name, c.description, c.active, c.created_at, c.target_filters,
             CASE 
               WHEN c.kind = 'email' THEN 
                 (SELECT COUNT(*)::int FROM public.email_messages m WHERE m.campaign_id = c.id AND m.direction = 'out')
               WHEN c.kind = 'x_reply' THEN
                 (SELECT COUNT(*)::int FROM public.prospection_sends s WHERE s.campaign_id = c.id AND s.sent_at >= CURRENT_DATE)
               ELSE 0
             END as sent_count
      FROM public.prospection_campaigns c
      WHERE c.business_id = $1 AND c.kind = $2
      ORDER BY c.created_at DESC
    `, [BUSINESS_ID, kind]);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.delete('/api/prospection/campaigns/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM public.email_messages WHERE business_id = $1 AND campaign_id = $2", [BUSINESS_ID, id]);
    await pool.query("DELETE FROM public.prospection_sends WHERE campaign_id = $1", [id]);
    await pool.query("DELETE FROM public.x_scanned_posts WHERE campaign_id = $1", [id]);
    
    // Delete the campaign itself
    const delRes = await pool.query(`
      DELETE FROM public.prospection_campaigns
      WHERE business_id = $1 AND id = $2
    `, [BUSINESS_ID, id]);
    
    res.json({ success: true, count: delRes.rowCount });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.post('/api/prospection/scrape/preview', async (req: Request, res: Response) => {
  try {
    const { linkedinKeywords, linkedinLocation, linkedinFunction } = req.body;
    const prospects = await fetchLinkedInProspects({
      keywords: linkedinKeywords || '',
      location: linkedinLocation || '',
      functionName: linkedinFunction || '',
      limit: 10
    });
    res.json(prospects);
  } catch (e) {
    console.error('[LinkedIn Preview Error]:', e);
    res.status(500).json({ error: (e as Error).message });
  }
});

// Stands for running campaign outreach in background
async function runCampaignOutreach(campaignId: string, kind: string, payload: any) {
  const {
    type,
    emailsList,
    linkedinKeywords,
    linkedinLocation,
    linkedinFunction,
    limit,
    subject,
    body,
    template,
    handlesList,
    keyword,
    subreddits,
    send_interval_minutes
  } = payload;

  let interval = 5;
  if (send_interval_minutes !== undefined) {
    const parsed = parseInt(send_interval_minutes, 10);
    if (!isNaN(parsed)) {
      interval = Math.max(1, Math.min(30, parsed));
    }
  }

  if (kind === 'email') {
    // Fetch or create mailbox
    const mbRes = await pool.query("SELECT id FROM public.mailboxes WHERE business_id = $1 AND email_address = 'grace@sideloot.xyz' LIMIT 1", [BUSINESS_ID]);
    let mailboxId = mbRes.rows[0]?.id;
    if (!mailboxId) {
      await pool.query("DELETE FROM public.mailboxes WHERE business_id = $1 AND position_id = 'sales_rep'", [BUSINESS_ID]);
      mailboxId = crypto.randomUUID();
      await pool.query(`
        INSERT INTO public.mailboxes (id, business_id, email_address, position_id, local_part, status)
        VALUES ($1, $2, 'grace@sideloot.xyz', 'sales_rep', 'grace', 'active')
      `, [mailboxId, BUSINESS_ID]);
    }

    if (type === 'manual') {
      const emails = (emailsList || '').split(',').map((e: string) => e.trim()).filter(Boolean);
      
      // Send emails in background
      (async () => {
        for (let i = 0; i < emails.length; i++) {
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, interval * 60 * 1000));
          }
          const email = emails[i];
          let finalLeadId;
          const existingLead = await pool.query("SELECT id FROM public.leads WHERE business_id = $1 AND lower(email) = lower($2) LIMIT 1", [BUSINESS_ID, email]);
          if (existingLead.rows.length > 0) {
            finalLeadId = existingLead.rows[0].id;
          } else {
            finalLeadId = crypto.randomUUID();
            await pool.query(`
              INSERT INTO public.leads (id, business_id, full_name, email, source)
              VALUES ($1, $2, $3, $4, 'manual')
              ON CONFLICT DO NOTHING
            `, [finalLeadId, BUSINESS_ID, email.split('@')[0], email]);
            
            const retryFetch = await pool.query("SELECT id FROM public.leads WHERE business_id = $1 AND lower(email) = lower($2) LIMIT 1", [BUSINESS_ID, email]);
            if (retryFetch.rows.length > 0) {
              finalLeadId = retryFetch.rows[0].id;
            }
          }

          const threadId = crypto.randomUUID();
          await pool.query(`
            INSERT INTO public.email_threads (id, business_id, mailbox_id, lead_id, subject)
            VALUES ($1, $2, $3, $4, $5)
          `, [threadId, BUSINESS_ID, mailboxId, finalLeadId, subject]);

          try {
            await sendMailgunEmail(email, subject || '', body || '');
            await pool.query(`
              INSERT INTO public.email_messages (id, thread_id, business_id, mailbox_id, direction, from_address, to_address, subject, body_text, status, sent_at, campaign_id)
              VALUES (gen_random_uuid(), $1, $2, $3, 'out', 'grace@sideloot.xyz', $4, $5, $6, 'sent', NOW(), $7)
            `, [threadId, BUSINESS_ID, mailboxId, email, subject, body, campaignId]);
          } catch (err) {
            console.error(`[Manual Email Campaign] Failed for ${email}:`, err);
            await pool.query(`
              INSERT INTO public.email_messages (id, thread_id, business_id, mailbox_id, direction, from_address, to_address, subject, body_text, status, error, sent_at, campaign_id)
              VALUES (gen_random_uuid(), $1, $2, $3, 'out', 'grace@sideloot.xyz', $4, $5, $6, 'failed', $7, NOW(), $8)
            `, [threadId, BUSINESS_ID, mailboxId, email, subject, body, (err as Error).message, campaignId]);
          }
        }
      })();
    } else if (type === 'automated') {
      // Run Apify scraping in background
      (async () => {
        try {
          const prospects = await fetchLinkedInProspects({
            keywords: linkedinKeywords || '',
            location: linkedinLocation || '',
            functionName: linkedinFunction || '',
            limit: Number(limit) || 10
          });
          
          let first = true;
          for (const p of prospects) {
            if (p.email) {
              const email = p.email;
              if (!first) {
                await new Promise(resolve => setTimeout(resolve, interval * 60 * 1000));
              }
              first = false;

              let finalLeadId;
              const existingLead = await pool.query("SELECT id FROM public.leads WHERE business_id = $1 AND lower(email) = lower($2) LIMIT 1", [BUSINESS_ID, email]);
              if (existingLead.rows.length > 0) {
                finalLeadId = existingLead.rows[0].id;
              } else {
                finalLeadId = crypto.randomUUID();
                await pool.query(`
                  INSERT INTO public.leads (id, business_id, full_name, email, source)
                  VALUES ($1, $2, $3, $4, 'linkedin')
                  ON CONFLICT DO NOTHING
                `, [finalLeadId, BUSINESS_ID, p.name, email]);
                
                const retryFetch = await pool.query("SELECT id FROM public.leads WHERE business_id = $1 AND lower(email) = lower($2) LIMIT 1", [BUSINESS_ID, email]);
                if (retryFetch.rows.length > 0) {
                  finalLeadId = retryFetch.rows[0].id;
                }
              }

              const threadId = crypto.randomUUID();
              await pool.query(`
                INSERT INTO public.email_threads (id, business_id, mailbox_id, lead_id, subject)
                VALUES ($1, $2, $3, $4, $5)
              `, [threadId, BUSINESS_ID, mailboxId, finalLeadId, subject]);

              try {
                await sendMailgunEmail(email, subject || '', body || '');
                await pool.query(`
                  INSERT INTO public.email_messages (id, thread_id, business_id, mailbox_id, direction, from_address, to_address, subject, body_text, status, sent_at, campaign_id)
                  VALUES (gen_random_uuid(), $1, $2, $3, 'out', 'grace@sideloot.xyz', $4, $5, $6, 'sent', NOW(), $7)
                `, [threadId, BUSINESS_ID, mailboxId, email, subject, body, campaignId]);
              } catch (err) {
                await pool.query(`
                  INSERT INTO public.email_messages (id, thread_id, business_id, mailbox_id, direction, from_address, to_address, subject, body_text, status, error, sent_at, campaign_id)
                  VALUES (gen_random_uuid(), $1, $2, $3, 'out', 'grace@sideloot.xyz', $4, $5, $6, 'failed', $7, NOW(), $8)
                `, [threadId, BUSINESS_ID, mailboxId, email, subject, body, (err as Error).message, campaignId]);
              }
            }
          }
        } catch (err) {
          console.error('[Apify LinkedIn Scrape Campaign Error]:', err);
        }
      })();
    }
  } else if (kind === 'x_reply') {
    console.log(`[Campaign Outreach] X Comment campaign ${campaignId} started. Triggering background worker runCommentsAutoReply immediately...`);
    runCommentsAutoReply().catch(err => {
      console.error('[Campaign Outreach] Failed to run comments auto-reply immediately:', err);
    });

  } else if (kind === 'reddit') {
    const subList = (subreddits || '').split(',').map((s: string) => s.trim()).filter(Boolean);

    (async () => {
      for (let i = 0; i < subList.length; i++) {
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, interval * 60 * 1000));
        }
        const sub = subList[i];
        try {
          const prompt = `Rédige un post Reddit de partage d'expérience pour la communauté ${sub}.
Sujet : ${template}
Génère un titre accrocheur et un court texte de partage d'expérience.`;

          const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 300
          });

          const aiResponse = completion.choices[0]?.message?.content || '';

          await pool.query(`
            INSERT INTO public.prospection_sends (
              id, campaign_id, campaign_kind, recipient, body, status, sent_at, created_at
            ) VALUES (
              gen_random_uuid(), $1, 'reddit', $2, $3, 'sent', NOW(), NOW()
            )
          `, [campaignId, sub, aiResponse]);
        } catch (err) {
          console.error('[Reddit Campaign Error]:', err);
        }
      }
    })();
  }
}

app.post('/api/prospection/campaigns', async (req: Request, res: Response) => {
  try {
    const { name, kind, send_interval_minutes, subject, body, template } = req.body;
    if (!name || !kind) {
      return res.status(400).json({ error: 'name et kind requis' });
    }

    const campaignId = crypto.randomUUID();
    
    let interval = 5;
    if (send_interval_minutes !== undefined) {
      const parsed = parseInt(send_interval_minutes, 10);
      if (!isNaN(parsed)) {
        interval = Math.max(1, Math.min(30, parsed));
      }
    }
    
    // Save campaign to database including target_filters
    await pool.query(`
      INSERT INTO public.prospection_campaigns (
        id, business_id, kind, name, active, created_at, updated_at, email_subject, email_body, email_from_local, send_interval_minutes, target_filters
      ) VALUES (
        $1, $2, $3, $4, true, NOW(), NOW(), $5, $6, 'grace', $7, $8
      )
    `, [campaignId, BUSINESS_ID, kind, name, subject || null, body || template || null, interval, JSON.stringify(req.body)]);

    // Start outreach loop in background
    runCampaignOutreach(campaignId, kind, req.body).catch(err => {
      console.error(`[Outreach Error] campaign ${campaignId}:`, err);
    });

    res.json({ success: true, campaignId, message: 'Campagne lancée avec succès !' });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// GET single campaign detail
app.get('/api/prospection/campaigns/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT id, name, kind, description, active, created_at, email_subject, email_body, send_interval_minutes, target_filters
      FROM public.prospection_campaigns
      WHERE business_id = $1 AND id = $2
    `, [BUSINESS_ID, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Campagne non trouvée' });
    }
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// UPDATE campaign settings
app.put('/api/prospection/campaigns/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, send_interval_minutes, subject, body, template } = req.body;
    
    let interval = 5;
    if (send_interval_minutes !== undefined) {
      const parsed = parseInt(send_interval_minutes, 10);
      if (!isNaN(parsed)) {
        interval = Math.max(1, Math.min(30, parsed));
      }
    }

    const result = await pool.query(`
      UPDATE public.prospection_campaigns
      SET name = $1,
          send_interval_minutes = $2,
          email_subject = $3,
          email_body = $4,
          target_filters = $5,
          updated_at = NOW()
      WHERE business_id = $6 AND id = $7
      RETURNING id
    `, [name, interval, subject || null, body || template || null, JSON.stringify(req.body), BUSINESS_ID, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Campagne non trouvée' });
    }
    res.json({ success: true, message: 'Campagne mise à jour avec succès !' });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// RELAUNCH campaign
app.post('/api/prospection/campaigns/:id/relaunch', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    
    // Fetch campaign from DB to get its current filters and kind
    const result = await pool.query(`
      SELECT id, kind, send_interval_minutes, email_subject, email_body, target_filters
      FROM public.prospection_campaigns
      WHERE business_id = $1 AND id = $2
    `, [BUSINESS_ID, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Campagne non trouvée' });
    }

    const campaign = result.rows[0];
    
    // Set campaign as active in DB
    await pool.query(`
      UPDATE public.prospection_campaigns
      SET active = true, updated_at = NOW()
      WHERE id = $1
    `, [id]);

    // Construct the payload from target_filters or fallbacks from campaign columns
    const payload = campaign.target_filters || {
      subject: campaign.email_subject,
      body: campaign.email_body,
      template: campaign.email_body,
      send_interval_minutes: campaign.send_interval_minutes
    };

    // Run outreach loop in background
    runCampaignOutreach(id, campaign.kind, payload).catch(err => {
      console.error(`[Relaunch Outreach Error] campaign ${id}:`, err);
    });

    res.json({ success: true, message: 'Campagne relancée avec succès !' });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// 2. Channels data endpoints (filtered by campaignId)
app.get('/api/prospection/emails', async (req: Request, res: Response) => {
  try {
    const campaignId = req.query.campaignId as string | undefined;
    if (!campaignId) {
      return res.json([]);
    }
    let result;
    if (campaignId === 'none') {
      result = await pool.query(`
        SELECT 
          m.id, 
          m.thread_id, 
          m.direction, 
          m.from_address, 
          m.to_address, 
          m.subject, 
          m.body_text, 
          m.status, 
          m.sent_at,
          t.status as thread_status,
          t.unread as thread_unread
        FROM public.email_messages m
        LEFT JOIN public.email_threads t ON m.thread_id = t.id
        WHERE m.business_id = $1 AND m.campaign_id IS NULL
        ORDER BY m.sent_at DESC
      `, [BUSINESS_ID]);
    } else {
      result = await pool.query(`
        SELECT 
          m.id, 
          m.thread_id, 
          m.direction, 
          m.from_address, 
          m.to_address, 
          m.subject, 
          m.body_text, 
          m.status, 
          m.sent_at,
          t.status as thread_status,
          t.unread as thread_unread
        FROM public.email_messages m
        LEFT JOIN public.email_threads t ON m.thread_id = t.id
        WHERE m.business_id = $1 AND m.campaign_id = $2
        ORDER BY m.sent_at DESC
      `, [BUSINESS_ID, campaignId]);
    }
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// Thread detail: all messages in a given email thread
app.get('/api/prospection/thread/:threadId', async (req: Request, res: Response) => {
  try {
    const { threadId } = req.params;

    // Auto-update thread status/unread on open
    const currentThread = await pool.query(`
      SELECT status, unread FROM public.email_threads WHERE business_id = $1 AND id = $2
    `, [BUSINESS_ID, threadId]);
    if (currentThread.rows.length > 0) {
      const { status, unread } = currentThread.rows[0];
      let needsUpdate = false;
      let newStatus = status;
      let newUnread = unread;
      if (status === 'new') {
        newStatus = 'open';
        needsUpdate = true;
      }
      if (unread) {
        newUnread = false;
        needsUpdate = true;
      }
      if (needsUpdate) {
        await pool.query(`
          UPDATE public.email_threads
          SET status = $1, unread = $2
          WHERE business_id = $3 AND id = $4
        `, [newStatus, newUnread, BUSINESS_ID, threadId]);
      }
    }

    const result = await pool.query(`
      SELECT id, direction, from_address, to_address, subject, body_text, status, sent_at
      FROM public.email_messages
      WHERE business_id = $1 AND thread_id = $2
      ORDER BY sent_at ASC
    `, [BUSINESS_ID, threadId]);

    // Also get thread meta (subject, lead email, status)
    const threadRes = await pool.query(`
      SELECT t.subject, t.inbound_count, t.outbound_count, t.status, l.email as lead_email, l.full_name as lead_name
      FROM public.email_threads t
      LEFT JOIN public.leads l ON l.id = t.lead_id
      WHERE t.business_id = $1 AND t.id = $2
    `, [BUSINESS_ID, threadId]);

    res.json({ thread: threadRes.rows[0] || null, messages: result.rows });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// Update thread status
app.put('/api/prospection/thread/:threadId/status', async (req: Request, res: Response) => {
  try {
    const { threadId } = req.params;
    const { status } = req.body as { status: string };
    if (!['new', 'open', 'ok'].includes(status)) {
      return res.status(400).json({ error: 'Status invalide' });
    }
    await pool.query(`
      UPDATE public.email_threads
      SET status = $1
      WHERE business_id = $2 AND id = $3
    `, [status, BUSINESS_ID, threadId]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// Send a manual reply from grace@sideloot.xyz to a given thread/lead
app.post('/api/prospection/email/reply', async (req: Request, res: Response) => {
  try {
    const { threadId, body } = req.body as { threadId: string; body: string };
    if (!threadId || !body?.trim()) {
      return res.status(400).json({ error: 'threadId et body sont requis' });
    }

    // Get thread info (lead email, mailbox, campaign, subject)
    const threadRes = await pool.query(`
      SELECT t.mailbox_id, t.lead_id, t.subject, t.id,
             l.email as lead_email,
             (SELECT campaign_id FROM public.email_messages WHERE thread_id = t.id AND campaign_id IS NOT NULL LIMIT 1) as campaign_id
      FROM public.email_threads t
      LEFT JOIN public.leads l ON l.id = t.lead_id
      WHERE t.business_id = $1 AND t.id = $2
    `, [BUSINESS_ID, threadId]);

    if (threadRes.rows.length === 0) {
      return res.status(404).json({ error: 'Thread non trouvé' });
    }

    const t = threadRes.rows[0];
    const toEmail = t.lead_email;
    const subject = t.subject?.startsWith('Re: ') ? t.subject : `Re: ${t.subject || '(no subject)'}`;

    // Send via Mailgun
    await sendMailgunEmail(toEmail, subject, body.trim());

    // Store the sent message
    const from = `grace@sideloot.xyz`;
    await pool.query(`
      INSERT INTO public.email_messages (
        id, thread_id, business_id, mailbox_id, direction, from_address, to_address, subject, body_text, status, sent_at, campaign_id
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, 'out', $4, $5, $6, $7, 'sent', NOW(), $8
      )
    `, [threadId, BUSINESS_ID, t.mailbox_id, from, toEmail, subject, body.trim(), t.campaign_id]);

    // Update thread metadata
    await pool.query(`
      UPDATE public.email_threads
      SET last_message_at = NOW(), 
          outbound_count = COALESCE(outbound_count, 0) + 1,
          status = 'ok'
      WHERE id = $1
    `, [threadId]);

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.get('/api/prospection/xdms', async (req: Request, res: Response) => {
  try {
    const campaignId = req.query.campaignId as string | undefined;
    if (!campaignId) {
      return res.json([]);
    }
    const result = await pool.query(`
      SELECT id, direction, recipient_handle, body, status, sent_at
      FROM public.x_messages
      WHERE business_id = $1 AND campaign_id = $2
      ORDER BY sent_at DESC
    `, [BUSINESS_ID, campaignId]);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.get('/api/prospection/xcomments', async (req: Request, res: Response) => {
  try {
    const campaignId = req.query.campaignId as string | undefined;
    if (!campaignId) {
      return res.json([]);
    }
    const result = await pool.query(`
      SELECT s.id, s.recipient, s.body, s.status, s.sent_at, s.in_reply_to_tweet_id, s.tweet_url
      FROM public.prospection_sends s
      WHERE s.campaign_id = $1 AND s.campaign_kind = 'x_reply'
      ORDER BY s.sent_at DESC
    `, [campaignId]);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.get('/api/prospection/x-scanned-posts', async (req: Request, res: Response) => {
  try {
    const campaignId = req.query.campaignId as string | undefined;
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = 20;
    const offset = (page - 1) * limit;

    let postsQuery = '';
    let countQuery = '';

    if (campaignId) {
      postsQuery = `
        SELECT id, campaign_id as "campaignId", url as permalink, text as content, 
               author_username as "accountUsername", author_name as "accountName", 
               author_profile_picture as "accountProfilePicture", like_count as "likeCount", 
               reply_count as "commentCount", retweet_count as "retweetCount", 
               status, reply_tweet_url as "replyTweetUrl", scanned_at as "createdTime"
        FROM public.x_scanned_posts
        WHERE campaign_id = $1
        ORDER BY scanned_at DESC
        LIMIT $2 OFFSET $3
      `;
      countQuery = `SELECT COUNT(*) FROM public.x_scanned_posts WHERE campaign_id = $1`;
    } else {
      postsQuery = `
        SELECT id, campaign_id as "campaignId", url as permalink, text as content, 
               author_username as "accountUsername", author_name as "accountName", 
               author_profile_picture as "accountProfilePicture", like_count as "likeCount", 
               reply_count as "commentCount", retweet_count as "retweetCount", 
               status, reply_tweet_url as "replyTweetUrl", scanned_at as "createdTime"
        FROM public.x_scanned_posts
        ORDER BY scanned_at DESC
        LIMIT $1 OFFSET $2
      `;
      countQuery = `SELECT COUNT(*) FROM public.x_scanned_posts`;
    }

    const postsRes = await pool.query(postsQuery, campaignId ? [campaignId, limit, offset] : [limit, offset]);
    const countRes = await pool.query(countQuery, campaignId ? [campaignId] : []);
    const total = parseInt(countRes.rows[0].count, 10);

    const posts = postsRes.rows.map(row => ({
      id: row.id,
      campaignId: row.campaignId,
      accountUsername: row.accountUsername,
      content: row.content,
      commentCount: row.commentCount,
      permalink: row.permalink,
      status: row.status,
      replyTweetUrl: row.replyTweetUrl,
      createdTime: row.createdTime
    }));

    res.json({ success: true, posts, total, page, limit });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});


app.get('/api/prospection/reddit', async (req: Request, res: Response) => {
  try {
    const campaignId = req.query.campaignId as string | undefined;
    if (!campaignId) {
      return res.json([]);
    }
    const result = await pool.query(`
      SELECT s.id, s.recipient as subreddit, s.body, s.status, s.sent_at
      FROM public.prospection_sends s
      WHERE s.campaign_id = $1 AND s.campaign_kind = 'reddit'
      ORDER BY s.sent_at DESC
    `, [campaignId]);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});


// 6. ChatGPT Action Executor
app.post('/api/prospection/run', async (req: Request, res: Response) => {
  try {
    const { leadId, actionType } = req.body as { leadId: string; actionType: string };
    if (!leadId || !actionType) {
      return res.status(400).json({ error: 'leadId et actionType requis' });
    }

    const leadRes = await pool.query(`
      SELECT id, full_name, email, x_handle, company_name, industry
      FROM public.leads 
      WHERE id = $1
    `, [leadId]);

    if (leadRes.rows.length === 0) {
      return res.status(404).json({ error: 'Lead non trouvé' });
    }

    const lead = leadRes.rows[0];
    let prompt = '';
    
    switch (actionType) {
      case 'email_outreach':
        prompt = `Rédige un email d'outreach court et percutant pour un prospect.
Prospect: ${lead.full_name}
Entreprise: ${lead.company_name || 'Cabinet médical'}
Secteur: ${lead.industry || 'Santé / Dentaire'}
L'expéditeur est 'Big Bang Loot' (une IA qui lance et fait tourner des side business autonomes). 
L'email doit proposer notre solution automatisée. Ne mets pas de placeholders (ex: [Votre Nom]), signe 'L'équipe Big Bang Loot'.`;
        break;
      case 'email_reply':
        prompt = `Rédige une réponse d'assistance ou de suivi par email pour le prospect ${lead.full_name} qui s'intéresse à Big Bang Loot.
Entreprise: ${lead.company_name || 'Cabinet médical'}
Fais une réponse concise, polie et directe, en l'invitant à réserver un appel de démo. Signe 'L'équipe Big Bang Loot'.`;
        break;

      case 'x_reply':
        prompt = `Rédige une réponse courte à un commentaire de ${lead.x_handle || '@prospect'} sur Twitter/X.
Prospect: ${lead.full_name}
Sujet: L'automatisation par IA des tâches chronophages.
La réponse doit faire moins de 150 caractères, être punchy, naturelle, et mentionner discrètement que Big Bang Loot s'occupe de tout. Pas de hashtags.`;
        break;
      case 'reddit':
        prompt = `Rédige un post Reddit de partage d'expérience pour la communauté r/startup ou r/sidehustle.
Le post explique comment Big Bang Loot a aidé un business dans le secteur '${lead.industry || 'Services'}' à s'automatiser à 100%.
Donne un titre accrocheur et un court texte récapitulatif.`;
        break;
      default:
        return res.status(400).json({ error: 'actionType non valide' });
    }

    console.log(`[ChatGPT Run] Calling OpenAI for action ${actionType} on lead ${lead.id}...`);
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.7
    });

    const aiResponse = completion.choices[0]?.message?.content || '';

    // Insert into respective tables based on type
    if (actionType === 'email_outreach' || actionType === 'email_reply') {
      const mbRes = await pool.query('SELECT id FROM public.mailboxes WHERE business_id = $1 LIMIT 1', [BUSINESS_ID]);
      const mailboxId = mbRes.rows[0]?.id;

      let threadId = 'a1f33f24-3ada-4dd6-9343-87da30c84845';
      const threadRes = await pool.query('SELECT id FROM public.email_threads WHERE business_id = $1 LIMIT 1', [BUSINESS_ID]);
      if (threadRes.rows.length > 0) {
        threadId = threadRes.rows[0].id;
      }

      await pool.query(`
        INSERT INTO public.email_messages (
          id, thread_id, business_id, mailbox_id, direction, from_address, to_address, subject, body_text, status, sent_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, 'grace@sideloot.xyz', $5, $6, $7, 'sent', NOW()
        )
      `, [threadId, BUSINESS_ID, mailboxId, actionType === 'email_outreach' ? 'out' : 'in', lead.email || 'dentist@sideloot.xyz', actionType === 'email_outreach' ? 'Prise de contact Sideloot' : 'Re: Votre projet Sideloot', aiResponse]);



    } else if (actionType === 'x_reply' || actionType === 'reddit') {
      // Find campaign id
      const kind = actionType === 'x_reply' ? 'x_reply' : 'x_reply'; // Use x_reply campaign for both
      const campRes = await pool.query('SELECT id FROM public.prospection_campaigns WHERE business_id = $1 AND kind = $2 LIMIT 1', [BUSINESS_ID, kind]);
      const campaignId = campRes.rows[0]?.id;

      await pool.query(`
        INSERT INTO public.prospection_sends (
          id, campaign_id, campaign_kind, recipient, body, status, sent_at, created_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, 'sent', NOW(), NOW()
        )
      `, [campaignId, actionType, lead.x_handle || (actionType === 'reddit' ? 'r/startup' : '@prospect'), aiResponse]);
    }

    res.json({
      prompt,
      response: aiResponse,
      lead: lead
    });
  } catch (e) {
    console.error('Error running ChatGPT action:', e);
    res.status(500).json({ error: (e as Error).message });
  }
});

export async function runCommentsAutoReply() {

  try {
    console.log('[comments-worker] Starting active X reply prospection worker...');

    // 1. Get all active x_reply campaigns
    const campaignsRes = await pool.query(
      "SELECT id, email_body as template, target_filters FROM public.prospection_campaigns WHERE business_id = $1 AND kind = 'x_reply' AND active = true",
      [BUSINESS_ID]
    );

    if (campaignsRes.rows.length === 0) {
      console.log('[comments-worker] No active X reply campaigns found.');
      return;
    }

    // Keep track of tweet IDs replied to in the DB
    const repliedRes = await pool.query(
      "SELECT in_reply_to_tweet_id FROM public.prospection_sends WHERE campaign_kind = 'x_reply' AND in_reply_to_tweet_id IS NOT NULL"
    );
    const repliedInDb = new Set<string>(repliedRes.rows.map(r => r.in_reply_to_tweet_id));

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    // Loop through each active campaign
    for (const campaign of campaignsRes.rows) {
      const campaignId = campaign.id;
      const campaignTemplate = campaign.template;
      const targetFilters = campaign.target_filters || {};
      const xAccountId = targetFilters.x_account_id;
      const keyword = targetFilters.keyword || '';

      const minLikesVal = targetFilters.min_likes;
      let minLikes = 10;
      if (minLikesVal !== undefined && minLikesVal !== null) {
        const parsed = parseInt(String(minLikesVal), 10);
        if (!isNaN(parsed)) {
          minLikes = parsed;
        }
      }

      const maxPostsPerDayVal = targetFilters.max_posts_per_day;
      let maxPostsPerDay = 10;
      if (maxPostsPerDayVal !== undefined && maxPostsPerDayVal !== null) {
        const parsed = parseInt(String(maxPostsPerDayVal), 10);
        if (!isNaN(parsed) && parsed > 0) {
          maxPostsPerDay = parsed;
        }
      }

      // Check daily limit of posts sent today
      const sendsCountRes = await pool.query(
        "SELECT COUNT(*) FROM public.prospection_sends WHERE campaign_id = $1 AND sent_at >= CURRENT_DATE",
        [campaignId]
      );
      const postsSentToday = parseInt(sendsCountRes.rows[0].count, 10);

      if (postsSentToday >= maxPostsPerDay) {
        console.log(`[comments-worker] Campaign ${campaignId} reached its daily limit of ${maxPostsPerDay} posts (${postsSentToday} sent today). Skipping.`);
        continue;
      }

      if (!xAccountId || !uuidRegex.test(xAccountId)) {
        console.warn(`[comments-worker] Campaign ${campaignId} has no valid X account ID. Skipping.`);
        continue;
      }

      if (!keyword || !keyword.trim()) {
        console.warn(`[comments-worker] Campaign ${campaignId} has no keyword configured. Skipping.`);
        continue;
      }

      // Fetch the specific connected X account matching the campaign target
      const xAccRes = await pool.query(
        'SELECT x_user_id as "accountId", handle, x_access_token, x_refresh_token, x_token_expires_at FROM public.x_accounts WHERE id = $1 AND business_id = $2 AND status = \'connected\'',
        [xAccountId, BUSINESS_ID]
      );

      if (xAccRes.rows.length === 0) {
        console.warn(`[comments-worker] X Account ${xAccountId} for campaign ${campaignId} is not connected or doesn't exist.`);
        continue;
      }

      const account = xAccRes.rows[0];
      const accountId = account.accountId;
      const handle = account.handle;
      let accessToken = account.x_access_token;
      let refreshToken = account.x_refresh_token;
      const expiresAt = account.x_token_expires_at ? new Date(account.x_token_expires_at) : null;

      if (!accessToken) {
        console.warn(`[comments-worker] X Account ${xAccountId} has no access token. Skipping campaign.`);
        continue;
      }

      // Refresh token if expired or about to expire in 5 minutes
      const now = new Date();
      const needsRefresh = !expiresAt || (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000);

      if (needsRefresh) {
        if (!refreshToken) {
          console.warn(`[comments-worker] X Account ${xAccountId} requires token refresh but has no refresh token. Skipping campaign.`);
          continue;
        }
        console.log(`[comments-worker] X access token for @${handle} is expired or expiring soon. Refreshing...`);
        try {
          const tokenData = await refreshAccessToken(refreshToken);
          accessToken = tokenData.access_token;
          refreshToken = tokenData.refresh_token;
          const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

          await pool.query(
            `UPDATE public.x_accounts
             SET x_access_token = $1, x_refresh_token = $2, x_token_expires_at = $3, updated_at = NOW()
             WHERE id = $4`,
            [accessToken, refreshToken, newExpiresAt, xAccountId]
          );
          console.log(`[comments-worker] X access token refreshed successfully for @${handle}.`);
        } catch (refreshErr) {
          console.error(`[comments-worker] Failed to refresh X token for @${handle}:`, refreshErr);
          continue;
        }
      }

      console.log(`[comments-worker] Scraping tweets for campaign ${campaignId} (Keyword: "${keyword}", Min Likes: ${minLikes}) using account @${handle}...`);

      const scrapedTweets = await fetchTweetsByKeyword(keyword, minLikes);

      if (scrapedTweets.length === 0) {
        console.log(`[comments-worker] No tweets found for keyword "${keyword}" with >= ${minLikes} likes.`);
        continue;
      }

      // Add to scanned posts database table
      for (const tweet of scrapedTweets) {
        const tweetUrl = tweet.url || `https://x.com/${tweet.author?.userName || 'user'}/status/${tweet.id}`;
        const tweetText = tweet.fullText || tweet.text || '';
        const authorUsername = tweet.author?.userName || 'user';
        const authorName = tweet.author?.name || '';
        const authorProfilePicture = tweet.author?.profilePicture || '';
        const likeCount = tweet.likeCount || 0;
        const replyCount = tweet.replyCount || 0;
        const retweetCount = tweet.retweetCount || 0;

        await pool.query(
          `INSERT INTO public.x_scanned_posts (
            id, campaign_id, url, text, author_username, author_name, author_profile_picture, like_count, reply_count, retweet_count, status, scanned_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'scanned', NOW())
           ON CONFLICT (id) DO UPDATE SET
             like_count = EXCLUDED.like_count,
             reply_count = EXCLUDED.reply_count,
             retweet_count = EXCLUDED.retweet_count`,
          [
            tweet.id,
            campaignId,
            tweetUrl,
            tweetText,
            authorUsername,
            authorName,
            authorProfilePicture,
            likeCount,
            replyCount,
            retweetCount
          ]
        );
      }

      // Trim to keep max 1000 scanned posts per campaign
      await pool.query(
        `DELETE FROM public.x_scanned_posts
         WHERE campaign_id = $1 AND id NOT IN (
           SELECT id FROM public.x_scanned_posts
           WHERE campaign_id = $1
           ORDER BY scanned_at DESC
           LIMIT 1000
         )`,
        [campaignId]
      );

      // Filter tweets that have already been replied to, or are our own
      const tweetsToReply = scrapedTweets.filter(tweet => {
        if (repliedInDb.has(tweet.id)) {
          return false;
        }
        const authorHandle = tweet.author?.userName || 'user';
        if (authorHandle.toLowerCase() === handle.toLowerCase() && process.env.NODE_ENV !== 'test') {
          return false;
        }
        return true;
      });

      console.log(`[comments-worker] Found ${tweetsToReply.length} new tweets to reply to out of ${scrapedTweets.length} scraped.`);

      let currentSentCount = postsSentToday;
      for (const tweet of tweetsToReply) {
        if (currentSentCount >= maxPostsPerDay) {
          console.log(`[comments-worker] Campaign ${campaignId} reached its daily limit of ${maxPostsPerDay} posts during processing. Stopping.`);
          break;
        }
        const authorHandle = tweet.author?.userName || 'user';
        const tweetText = tweet.fullText || tweet.text || '';
        console.log(`[comments-worker] Generating reply to tweet ${tweet.id} from @${authorHandle}: "${tweetText.substring(0, 80)}..."`);

        const systemPrompt = `You are a human replying naturally, intelligently, and concisely to a comment/tweet on Twitter/X.
The tweet to reply to: "${tweetText}"

CRITICAL INSTRUCTIONS:
1. You MUST write your reply in English (Speak only English).
2. Keep it short and smart, max 3 sentences.
3. Write in an extremely human, casual tone, as if typing quickly on a phone (no corporate speak, no pompous intros or conclusions).
4. NEVER use hashtags (#).
5. NEVER use asterisks (* or **).
6. NEVER use list dashes (- or —) or bullet points.
7. Be natural and engaging.
8. If you mention the platform, tool, or website, you MUST write "sideloot.co" (with the ".co" extension) and never just "Sideloot" or "sideloot".
${campaignTemplate ? `Custom instructions to follow: ${campaignTemplate}` : ''}`;

        let aiResponse = '';
        try {
          const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: systemPrompt }],
            max_tokens: 150,
            temperature: 0.8
          });
          aiResponse = completion.choices[0]?.message?.content || '';
          aiResponse = aiResponse.replace(/[#*`\-–—]/g, '').replace(/\s+/g, ' ').trim();
          // Ensure sideloot.co link format
          aiResponse = aiResponse.replace(/\b(sideloot|sideload|sidelot)(?:\.[a-z]+)?\b/gi, 'sideloot.co');
        } catch (e) {
          console.error('[comments-worker] OpenAI generation failed:', e);
          continue;
        }

        if (!aiResponse) {
          console.warn('[comments-worker] Generated empty AI response. Skipping.');
          continue;
        }

        console.log(`[comments-worker] Replying to tweet ${tweet.id} with: "${aiResponse}"`);

        let replyTweetId = '';
        let replyTweetUrl = '';
        let isRestricted = false;

        // Try to post as a reply first using native X API v2
        try {
          const replyText = `@${authorHandle} ${aiResponse}`;
          const tweetResponse = await postTweet(accessToken, replyText, tweet.id);
          replyTweetId = tweetResponse.id;
          replyTweetUrl = `https://x.com/${handle}/status/${replyTweetId}`;
        } catch (postErr: any) {
          const errMessage = String(postErr.message || postErr);
          console.error(`[comments-worker] Direct X API reply failed for tweet ${tweet.id}:`, errMessage);
          isRestricted = true;
        }

        // If reply failed, retry as a standalone mention tweet
        if (isRestricted && !replyTweetId) {
          console.log(`[comments-worker] Retrying as a standalone mention tweet for tweet ${tweet.id}...`);
          try {
            const fallbackText = `@${authorHandle} ${aiResponse}`;
            const tweetResponse = await postTweet(accessToken, fallbackText);
            replyTweetId = tweetResponse.id;
            replyTweetUrl = `https://x.com/${handle}/status/${replyTweetId}`;
          } catch (fallbackErr: any) {
            console.error(`[comments-worker] Fallback standalone post failed for tweet ${tweet.id}:`, fallbackErr.message || fallbackErr);
          }
        }

        if (!replyTweetId) {
          console.error(`[comments-worker] Both reply and fallback failed or timed out for tweet ${tweet.id}`);
          await pool.query(
            "UPDATE public.x_scanned_posts SET status = 'failed' WHERE id = $1",
            [tweet.id]
          );
          continue;
        }

        // Save to DB
        const sendId = crypto.randomUUID();
        await pool.query(
          `INSERT INTO public.prospection_sends (
             id, campaign_id, campaign_kind, recipient, body, status, sent_at, created_at, in_reply_to_tweet_id, tweet_url
           ) VALUES ($1, $2, 'x_reply', $3, $4, 'sent', NOW(), NOW(), $5, $6)`,
          [sendId, campaignId, `@${authorHandle}`, aiResponse, tweet.id, replyTweetUrl]
        );
        repliedInDb.add(tweet.id);
        currentSentCount++;
        
        await pool.query(
          `UPDATE public.x_scanned_posts 
           SET status = 'commented', reply_tweet_url = $1, commented_at = NOW() 
           WHERE id = $2`,
          [replyTweetUrl, tweet.id]
        );
        console.log(`[comments-worker] Replied successfully and logged to DB: id=${sendId}`);
      }
    }
  } catch (err) {
    console.error('[comments-worker] Background loop error:', err);
  }
}

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(
      `AI Skills Hub on http://localhost:${PORT} — ${ALL_SKILLS.length} skills registered`,
    );
    
    // Launch comments auto-reply background worker
    setTimeout(runCommentsAutoReply, 5000);
    setInterval(runCommentsAutoReply, 3 * 60 * 1000);
  });
}

export default app;
