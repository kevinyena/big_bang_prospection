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
  handleCallback,
  getStatus as getXStatus,
  unlink as xUnlink,
} from './skills/runtime/x-api.js';
import { runSendDMs, SendXDMsInputSchema } from './skills/x_dm/SendXDMsSkill.js';
import { loadQuota as loadXDmQuota, resetQuota as resetXDmQuota } from './skills/runtime/x-dm-quota.js';
import {
  buildAuthorizeUrl as buildTikTokAuthUrl,
  handleCallback as handleTikTokCallback,
  getStatus as getTikTokStatus,
  unlink as tikTokUnlink,
  fetchPublishStatus as fetchTikTokPublishStatus,
  postVideo as postTikTokVideo,
} from './skills/runtime/zernio-api.js';
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

type TikTokPostMode = 'inbox' | 'direct';

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
app.get('/api/auth/x/login', (_req: Request, res: Response) => {
  try {
    const { url } = buildAuthorizeUrl();
    res.redirect(url);
  } catch (e) {
    res.status(500).send(`X OAuth login failed: ${(e as Error).message}`);
  }
});

app.get('/api/auth/x/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;
  const error = req.query.error as string | undefined;
  if (error) {
    return res.status(400).send(`<h1>X OAuth refusé</h1><p>${error}</p><a href="/">Retour</a>`);
  }
  if (!code || !state) {
    return res.status(400).send('<h1>OAuth callback invalide</h1><a href="/">Retour</a>');
  }
  try {
    const stored = await handleCallback({ code, state });
    res.send(`
      <!doctype html><meta charset="utf-8">
      <title>X linked</title>
      <style>body{font-family:system-ui;background:#0b0d12;color:#e7eaf0;padding:40px;max-width:520px;margin:auto}
        a{color:#7c5cff}.ok{color:#2bd4a0}</style>
      <h1>✓ Compte X linké</h1>
      <p>Connecté en tant que <strong>@${stored.username}</strong></p>
      <p class="ok">Scopes: ${stored.scopes.join(', ')}</p>
      <p>Tu peux fermer cet onglet et retourner sur <a href="/">l'app</a>.</p>
      <script>window.opener && window.opener.postMessage({type:'x_linked', username: '${stored.username}'}, '*'); setTimeout(()=>window.close(), 1500);</script>
    `);
  } catch (e) {
    res.status(500).send(`<h1>X OAuth failed</h1><pre>${(e as Error).message}</pre><a href="/">Retour</a>`);
  }
});

app.get('/api/auth/x/status', async (_req: Request, res: Response) => {
  try {
    res.json(await getXStatus());
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

app.post('/api/auth/x/logout', async (_req: Request, res: Response) => {
  try {
    await xUnlink();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// ---------- X DM persistent quota (UTC-day counter + stop-loss) ----------
app.get('/api/x-dm/quota', async (_req: Request, res: Response) => {
  try {
    res.json(await loadXDmQuota());
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});
app.post('/api/x-dm/quota/reset', async (_req: Request, res: Response) => {
  try {
    res.json(await resetXDmQuota());
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// ---------- X DM: live progress stream (SSE) ----------
// Mirrors the `send_x_dms` skill but emits per-handle events so the UI can
// show "@foo… sending → ✓ sent" live instead of waiting ~90s for the batch.
// The skill itself (run via /api/skills/send_x_dms/run) still works for agents.
app.post('/api/x-dm/send-stream', async (req: Request, res: Response) => {
  const parsed = SendXDMsInputSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'inputs invalides', issues: parsed.error.issues });
  }
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  res.socket?.setNoDelay(true);
  res.socket?.setKeepAlive(true);
  // Disable ANY socket timeout — with 3-6 min delays between DMs, a full run
  // can easily span 20-30 minutes. Default Node/Express timeouts would kill
  // the stream mid-way and the browser would see ERR_INCOMPLETE_CHUNKED_ENCODING.
  res.socket?.setTimeout(0);
  // Also disable the request-level timeout (Express sets 2 min by default
  // in some setups, even though Node default is 0).
  req.setTimeout(0);
  res.setTimeout?.(0);

  // ──────────────────────────────────────────────────────────────
  // SSE flushing — true real-time delivery
  //
  // Node's `res.write(chunk)` returns immediately and queues the chunk in
  // the outgoing buffer. It doesn't guarantee the chunk has been pushed to
  // the kernel socket. The CALLBACK form `res.write(chunk, cb)` invokes cb
  // ONCE THE WRITE IS FLUSHED. We promisify that, then `await` it before
  // returning from our send helper. Combined with `setNoDelay`, each event
  // hits the wire before we proceed.
  //
  // Previous attempts (padding to 4KB, heartbeat) didn't reliably push
  // because they relied on internal heuristics. This approach explicitly
  // gates progression on flush completion — bulletproof.
  // ──────────────────────────────────────────────────────────────
  const writeAndFlush = (chunk: string): Promise<void> =>
    new Promise((resolve, reject) => {
      res.write(chunk, (err) => (err ? reject(err) : resolve()));
    });

  // Preamble: 2KB padding primes any receive-side buffering.
  await writeAndFlush(`: stream open ${' '.repeat(2048)}\n\n`);

  const send = async (event: string, data: unknown): Promise<void> => {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    await writeAndFlush(payload);
    // eslint-disable-next-line no-console
    console.log(`[SSE] flushed event=${event} (${payload.length}B)`);
  };

  let closed = false;
  req.on('close', () => {
    // eslint-disable-next-line no-console
    console.log(`[SSE] req closed — was it expected? sent=${closed ? 'completed' : 'mid-stream'}`);
    closed = true;
  });
  // Also listen on the socket itself: if it dies (kernel TCP timeout, ngrok
  // reconnect, etc.) we want to know BEFORE the next write fails silently.
  res.socket?.on('close', () => {
    if (!closed) {
      // eslint-disable-next-line no-console
      console.log('[SSE] socket closed unexpectedly — flagging stream as dead');
      closed = true;
    }
  });

  // Heartbeat every 5s keeps the connection visible to any intermediate
  // proxy/timeout. If a heartbeat WRITE fails, that's our smoke-test that
  // the socket is dead — we set `closed=true` so runSendDMs stops emitting.
  const heartbeat = setInterval(() => {
    if (closed) return;
    writeAndFlush(`: ping ${Date.now()}\n\n`).catch(() => {
      // eslint-disable-next-line no-console
      console.warn('[SSE] heartbeat write failed — marking stream closed');
      closed = true;
    });
  }, 5000);

  try {
    await runSendDMs(parsed.data, async (event) => {
      if (closed) return;
      await send(event.kind, event);
    });
  } catch (e) {
    if (!closed) {
      try { await send('error', { error: (e as Error).message }); } catch { /* ignore */ }
    }
  } finally {
    clearInterval(heartbeat);
    closed = true;
    res.end();
  }
});

// ---------- TikTok OAuth ----------
app.get('/api/auth/tiktok/login', async (req: Request, res: Response) => {
  try {
    const { url } = await buildTikTokAuthUrl(req.headers.host);
    res.redirect(url);
  } catch (e) {
    res.status(500).send(`TikTok OAuth login failed: ${(e as Error).message}`);
  }
});

app.get('/api/auth/tiktok/callback', async (req: Request, res: Response) => {
  const error = req.query.error as string | undefined;
  const errorMessage = req.query.error_message as string | undefined;
  if (error) {
    return res.status(400).send(`
      <!doctype html><meta charset="utf-8">
      <title>Erreur de connexion</title>
      <style>body{font-family:system-ui;background:#0b0d12;color:#e7eaf0;padding:40px;max-width:520px;margin:auto}
        a{color:#7c5cff}.err{color:#ff5050}</style>
      <h1 class="err">✗ Échec de la connexion TikTok</h1>
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
    const stored = await handleTikTokCallback({
      accountId,
      username,
      profileId,
    });
    res.send(`
      <!doctype html><meta charset="utf-8">
      <title>TikTok linked</title>
      <style>body{font-family:system-ui;background:#0b0d12;color:#e7eaf0;padding:40px;max-width:520px;margin:auto}
        a{color:#7c5cff}.ok{color:#2bd4a0}</style>
      <h1>✓ Compte TikTok linké via Zernio</h1>
      <p>Connecté en tant que <strong>${stored.username}</strong></p>
      <p>Tu peux fermer cet onglet et retourner sur <a href="/">l'app</a>.</p>
      <script>window.opener && window.opener.postMessage({type:'tiktok_linked', displayName:'${stored.username}'}, '*'); setTimeout(()=>window.close(), 1500);</script>
    `);
  } catch (e) {
    res.status(500).send(`<h1>TikTok OAuth failed</h1><pre>${(e as Error).message}</pre><a href="/">Retour</a>`);
  }
});

app.get('/api/auth/tiktok/status', async (_req: Request, res: Response) => {
  try {
    res.json(await getTikTokStatus());
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.post('/api/auth/tiktok/logout', async (_req: Request, res: Response) => {
  try {
    await tikTokUnlink();
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

// ---------- TikTok: upload + post a LOCAL FILE ----------
// Used when the user picks "Upload fichier" in the TikTok panel instead of
// posting a Veo-generated URI. Body is raw video bytes; metadata travels in
// headers so we don't need a multipart parser library.
app.post(
  '/api/tiktok/upload-and-post',
  // Accept any content type — we'll trust the X-Content-Type header for the
  // actual MIME (browser sends the file's real type). 64MB cap matches TikTok's
  // single-chunk upload limit.
  express.raw({ type: '*/*', limit: '64mb' }),
  async (req: Request, res: Response) => {
    try {
      const buffer = req.body as Buffer;
      if (!Buffer.isBuffer(buffer) || buffer.byteLength === 0) {
        return res.status(400).json({ error: 'Body vide — envoie les bytes vidéo dans le POST body.' });
      }
      const mode = (req.headers['x-tiktok-mode'] as TikTokPostMode | undefined) ?? 'direct';
      const privacy =
        (req.headers['x-tiktok-privacy'] as
          | 'PUBLIC_TO_EVERYONE'
          | 'MUTUAL_FOLLOW_FRIENDS'
          | 'SELF_ONLY'
          | undefined) ?? 'SELF_ONLY';
      // Caption is base64-encoded so it can carry newlines + emoji safely
      // inside an HTTP header.
      const captionB64 = req.headers['x-tiktok-caption'] as string | undefined;
      const caption = captionB64
        ? Buffer.from(captionB64, 'base64').toString('utf8')
        : undefined;

      const { publishId, finalStatus, fellBackToInbox, fallbackReason } = await postTikTokVideo({
        videoBuffer: buffer,
        caption,
        mode,
        privacyLevel: privacy,
      });

      let status: 'inbox_delivered' | 'published' | 'failed' | 'pending';
      switch (finalStatus.status) {
        case 'SEND_TO_USER_INBOX': status = 'inbox_delivered'; break;
        case 'PUBLISH_COMPLETE':    status = 'published'; break;
        case 'FAILED':              status = 'failed'; break;
        default:                    status = 'pending';
      }
      res.json({
        publishId,
        status,
        failReason: finalStatus.failReason,
        publicPostId: finalStatus.publicalyAvailablePostId,
        videoSizeBytes: buffer.byteLength,
        fellBackToInbox,
        fallbackReason,
      });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  },
);

// Allow the UI to re-poll TikTok's publish status when the inbox processing
// takes longer than the skill's internal poll timeout.
app.get('/api/tiktok/publish-status', async (req: Request, res: Response) => {
  try {
    const publishId = req.query.publishId as string | undefined;
    if (!publishId) return res.status(400).json({ error: 'publishId manquant' });
    res.json(await fetchTikTokPublishStatus(publishId));
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

    // X DMs Counts
    const xRes = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE direction = 'out') as sent
      FROM public.x_messages 
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
        SELECT 'x_dm' as type, direction, recipient_handle as recipient, null as title, body, sent_at
        FROM public.x_messages WHERE business_id = $1
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
      x_dms_sent: Number(xRes.rows[0]?.sent || 0),
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
app.get('/api/subscribers', async (_req: Request, res: Response) => {
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
app.get('/api/workers', async (_req: Request, res: Response) => {
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
app.get('/api/plans', async (_req: Request, res: Response) => {
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
      SELECT id, name, description, active, created_at
      FROM public.prospection_campaigns
      WHERE business_id = $1 AND kind = $2
      ORDER BY created_at DESC
    `, [BUSINESS_ID, kind]);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.delete('/api/prospection/campaigns/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // Delete associated elements from database
    await pool.query("DELETE FROM public.email_messages WHERE business_id = $1 AND campaign_id = $2", [BUSINESS_ID, id]);
    await pool.query("DELETE FROM public.x_messages WHERE business_id = $1 AND campaign_id = $2", [BUSINESS_ID, id]);
    await pool.query("DELETE FROM public.prospection_sends WHERE campaign_id = $1", [id]);
    
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
  } else if (kind === 'x_dm') {
    const handles = (handlesList || '').split(',').map((h: string) => h.trim()).filter(Boolean);
    
    const xAccRes = await pool.query('SELECT id FROM public.x_accounts WHERE business_id = $1 LIMIT 1', [BUSINESS_ID]);
    let xAccountId = xAccRes.rows[0]?.id;
    if (!xAccountId) {
      xAccountId = crypto.randomUUID();
      await pool.query(`
        INSERT INTO public.x_accounts (id, business_id, owner_position_id, x_user_id, handle, display_name, status)
        VALUES ($1, $2, 'sales_rep', '123456', 'sideloot_outreach', 'Sideloot Outreach', 'connected')
      `, [xAccountId, BUSINESS_ID]);
    }

    (async () => {
      for (let i = 0; i < handles.length; i++) {
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, interval * 60 * 1000));
        }
        const handle = handles[i];
        const messageText = template.replace('{handle}', handle);
        await pool.query(`
          INSERT INTO public.x_messages (
            id, x_account_id, business_id, direction, recipient_handle, body, status, sent_at, campaign_id
          ) VALUES (
            gen_random_uuid(), $1, $2, 'out', $3, $4, 'sent', NOW(), $5
          )
        `, [xAccountId, BUSINESS_ID, handle, messageText, campaignId]);
      }
    })();
  } else if (kind === 'x_reply') {
    (async () => {
      for (let i = 0; i < 5; i++) {
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, interval * 60 * 1000));
        }
        try {
          const prompt = `Rédige une réponse courte à un commentaire Twitter/X.
Sujet de recherche de feed : ${keyword}
Consignes : ${template}
Fais une réponse concise, percutante, naturelle (moins de 250 caractères). Pas de hashtags.`;

          const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 200
          });

          const aiResponse = completion.choices[0]?.message?.content || '';
          const mockUser = `@user_${Math.floor(Math.random() * 900) + 100}`;
          
          await pool.query(`
            INSERT INTO public.prospection_sends (
              id, campaign_id, campaign_kind, recipient, body, status, sent_at, created_at
            ) VALUES (
              gen_random_uuid(), $1, 'x_reply', $2, $3, 'sent', NOW(), NOW()
            )
          `, [campaignId, mockUser, aiResponse]);
        } catch (err) {
          console.error('[X Reply Campaign Error]:', err);
        }
      }
    })();
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
      SELECT s.id, s.recipient, s.body, s.status, s.sent_at
      FROM public.prospection_sends s
      WHERE s.campaign_id = $1 AND s.campaign_kind = 'x_reply'
      ORDER BY s.sent_at DESC
    `, [campaignId]);
    res.json(result.rows);
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
L'expéditeur est 'Sideloot' (une IA qui lance et fait tourner des side business autonomes). 
L'email doit proposer notre solution automatisée. Ne mets pas de placeholders (ex: [Votre Nom]), signe 'L'équipe Sideloot'.`;
        break;
      case 'email_reply':
        prompt = `Rédige une réponse d'assistance ou de suivi par email pour le prospect ${lead.full_name} qui s'intéresse à Sideloot.
Entreprise: ${lead.company_name || 'Cabinet médical'}
Fais une réponse concise, polie et directe, en l'invitant à réserver un appel de démo. Signe 'L'équipe Sideloot'.`;
        break;
      case 'x_dm':
        prompt = `Rédige un message privé (DM) Twitter/X informel et sympa pour le compte ${lead.x_handle || '@prospect'}.
Prospect: ${lead.full_name}
Secteur: ${lead.industry || 'Freelance'}
Le message doit faire moins de 250 caractères, susciter la curiosité sur le fait de lancer un business autonome avec Sideloot. Pas de hashtags.`;
        break;
      case 'x_reply':
        prompt = `Rédige une réponse courte à un commentaire de ${lead.x_handle || '@prospect'} sur Twitter/X.
Prospect: ${lead.full_name}
Sujet: L'automatisation par IA des tâches chronophages.
La réponse doit faire moins de 150 caractères, être punchy, naturelle, et mentionner discrètement que Sideloot s'occupe de tout. Pas de hashtags.`;
        break;
      case 'reddit':
        prompt = `Rédige un post Reddit de partage d'expérience pour la communauté r/startup ou r/sidehustle.
Le post explique comment Sideloot a aidé un business dans le secteur '${lead.industry || 'Services'}' à s'automatiser à 100%.
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

    } else if (actionType === 'x_dm') {
      const xAccRes = await pool.query('SELECT id FROM public.x_accounts WHERE business_id = $1 LIMIT 1', [BUSINESS_ID]);
      const xAccountId = xAccRes.rows[0]?.id;

      await pool.query(`
        INSERT INTO public.x_messages (
          id, x_account_id, business_id, direction, recipient_handle, body, status, sent_at
        ) VALUES (
          gen_random_uuid(), $1, $2, 'out', $3, $4, 'sent', NOW()
        )
      `, [xAccountId, BUSINESS_ID, lead.x_handle || '@prospect', aiResponse]);

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

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(
      `AI Skills Hub on http://localhost:${PORT} — ${ALL_SKILLS.length} skills registered`,
    );
  });
}

export default app;
