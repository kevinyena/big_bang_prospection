import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', '..', '..', '.data');
const PROFILE_PATH = path.join(DATA_DIR, 'zernio-profile.json');
const ACCOUNT_PATH = path.join(DATA_DIR, 'zernio-insta-account.json');

export interface ZernioStoredInstaAccount {
  accountId: string;
  username: string;
  profileId: string;
}

export interface ZernioStoredProfile {
  profileId: string;
}

// ---------- Cache helpers ----------

async function loadProfileId(): Promise<string | null> {
  try {
    const raw = await fs.readFile(PROFILE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as ZernioStoredProfile;
    return parsed.profileId;
  } catch {
    return null;
  }
}

async function saveProfileId(profileId: string): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(PROFILE_PATH, JSON.stringify({ profileId }, null, 2), 'utf-8');
}

async function loadAccount(): Promise<ZernioStoredInstaAccount | null> {
  try {
    const raw = await fs.readFile(ACCOUNT_PATH, 'utf-8');
    return JSON.parse(raw) as ZernioStoredInstaAccount;
  } catch {
    return null;
  }
}

async function saveAccount(acc: ZernioStoredInstaAccount): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(ACCOUNT_PATH, JSON.stringify(acc, null, 2), 'utf-8');
}

async function clearAccount(): Promise<void> {
  try {
    await fs.unlink(ACCOUNT_PATH);
  } catch {
    // ignore if doesn't exist
  }
}

// ---------- Profile resolution ----------

async function getOrCreateProfileId(): Promise<string> {
  const cached = await loadProfileId();
  if (cached) return cached;

  const apiKey = process.env.ZERNIO_API_KEY;
  if (!apiKey) {
    throw new Error('ZERNIO_API_KEY manquante dans .env. Configure cette clé pour utiliser Zernio.');
  }

  // Fetch profiles
  const res = await fetch('https://zernio.com/api/v1/profiles', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    throw new Error(`Zernio profiles fetch failed: HTTP ${res.status}`);
  }
  const data = (await res.json()) as { profiles: Array<{ _id: string; name: string }> };
  if (data.profiles && data.profiles.length > 0) {
    const profileId = data.profiles[0]!._id;
    await saveProfileId(profileId);
    return profileId;
  }

  // Create a default profile
  const createRes = await fetch('https://zernio.com/api/v1/profiles', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: 'Sideloot' }),
  });
  if (!createRes.ok) {
    throw new Error(`Zernio profile creation failed: HTTP ${createRes.status}`);
  }
  const createData = (await createRes.json()) as { profile: { _id: string } };
  const profileId = createData.profile._id;
  await saveProfileId(profileId);
  return profileId;
}

// ---------- Public OAuth endpoints ----------

export async function buildAuthorizeUrl(host?: string): Promise<{ url: string; state: string }> {
  const profileId = await getOrCreateProfileId();
  const apiKey = process.env.ZERNIO_API_KEY;
  if (!apiKey) throw new Error('ZERNIO_API_KEY manquante dans .env.');

  let redirectUrl = process.env.INSTA_OAUTH_REDIRECT_URI;
  if (!redirectUrl && host) {
    const protocol = host.includes('localhost') ? 'http' : 'https';
    redirectUrl = `${protocol}://${host}/api/auth/insta/callback`;
  }
  if (!redirectUrl) {
    redirectUrl = 'http://localhost:3000/api/auth/insta/callback';
  }

  const params = new URLSearchParams({
    profileId,
    redirect_url: redirectUrl,
  });

  const res = await fetch(`https://zernio.com/api/v1/connect/instagram?${params.toString()}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zernio connect URL generation failed: HTTP ${res.status} ${text}`);
  }
  const data = (await res.json()) as { authUrl: string; state: string };

  return {
    url: data.authUrl,
    state: data.state,
  };
}

export async function handleCallback(params: {
  accountId: string;
  username: string;
  profileId: string;
}): Promise<ZernioStoredInstaAccount> {
  const stored: ZernioStoredInstaAccount = {
    accountId: params.accountId,
    username: params.username,
    profileId: params.profileId,
  };
  await saveAccount(stored);
  return stored;
}

export interface InstaStatus {
  linked: boolean;
  displayName?: string;
  openId?: string;
}

export async function getStatus(): Promise<InstaStatus> {
  const acc = await loadAccount();
  if (acc) {
    return {
      linked: true,
      displayName: acc.username,
      openId: acc.accountId,
    };
  }

  try {
    const apiKey = process.env.ZERNIO_API_KEY;
    if (!apiKey) return { linked: false };

    const res = await fetch('https://zernio.com/api/v1/accounts', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.ok) {
      const data = (await res.json()) as {
        accounts: Array<{
          _id: string;
          platform: string;
          username: string;
          profileId?: { _id: string } | string;
        }>;
      };
      const instaAcc = data.accounts.find((a) => a.platform === 'instagram');
      if (instaAcc) {
        const profileId =
          typeof instaAcc.profileId === 'object' && instaAcc.profileId
            ? instaAcc.profileId._id
            : typeof instaAcc.profileId === 'string'
              ? instaAcc.profileId
              : '6a181cace6c911674d287c40';

        const stored = {
          accountId: instaAcc._id,
          username: instaAcc.username,
          profileId,
        };
        await saveAccount(stored);
        return {
          linked: true,
          displayName: stored.username,
          openId: stored.accountId,
        };
      }
    }
  } catch (e) {
    console.error('[insta-api] self-healing failed:', e);
  }

  return { linked: false };
}

export async function unlink(): Promise<void> {
  const acc = await loadAccount();
  if (acc) {
    try {
      const apiKey = process.env.ZERNIO_API_KEY;
      if (apiKey) {
        await fetch(`https://zernio.com/api/v1/accounts/${acc.accountId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${apiKey}` },
        });
      }
    } catch (e) {
      console.error('[insta-api] Failed to delete account from Zernio:', e);
    }
  }
  await clearAccount();
}

// ---------- Publishing ----------

async function pollPostStatus(postId: string): Promise<{
  status: 'PUBLISH_COMPLETE' | 'FAILED' | 'UNKNOWN';
  failReason?: string;
  publicPostUrl?: string;
}> {
  const apiKey = process.env.ZERNIO_API_KEY;
  const interval = 3000;
  const timeout = 5 * 60 * 1000;
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, interval));
    const res = await fetch(`https://zernio.com/api/v1/posts/${postId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) continue;
    const data = (await res.json()) as {
      post: {
        status: string;
        platforms: Array<{
          platform: string;
          status: string;
          errorMessage?: string;
          platformPostUrl?: string;
          platformPostId?: string;
        }>;
      };
    };

    const target = data.post.platforms.find((p) => p.platform === 'instagram');
    if (!target) throw new Error("Cible Instagram introuvable dans le post Zernio.");

    if (target.status === 'published') {
      return {
        status: 'PUBLISH_COMPLETE',
        publicPostUrl: target.platformPostUrl ?? undefined,
      };
    } else if (target.status === 'failed') {
      return {
        status: 'FAILED',
        failReason: target.errorMessage ?? 'Erreur inconnue',
      };
    }
  }
  return { status: 'UNKNOWN' };
}

export async function fetchPublishStatus(postId: string): Promise<{
  status:
    | 'PROCESSING_UPLOAD'
    | 'PROCESSING_DOWNLOAD'
    | 'PUBLISH_COMPLETE'
    | 'FAILED'
    | 'UNKNOWN';
  failReason?: string;
  publicPostUrl?: string;
}> {
  const apiKey = process.env.ZERNIO_API_KEY;
  if (!apiKey) throw new Error('ZERNIO_API_KEY manquante dans .env.');

  const res = await fetch(`https://zernio.com/api/v1/posts/${postId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    throw new Error(`Zernio status fetch failed (${res.status})`);
  }
  const data = (await res.json()) as {
    post: {
      status: string;
      platforms: Array<{
        platform: string;
        status: string;
        errorMessage?: string;
        platformPostUrl?: string;
        platformPostId?: string;
      }>;
    };
  };
  const target = data.post.platforms.find((p) => p.platform === 'instagram');
  if (!target) throw new Error("Cible Instagram introuvable dans le post Zernio.");

  if (target.status === 'published') {
    return {
      status: 'PUBLISH_COMPLETE',
      publicPostUrl: target.platformPostUrl ?? undefined,
    };
  } else if (target.status === 'failed') {
    return {
      status: 'FAILED',
      failReason: target.errorMessage,
    };
  } else if (target.status === 'publishing' || target.status === 'pending') {
    return {
      status: 'PROCESSING_UPLOAD',
    };
  }
  return { status: 'UNKNOWN' };
}

export async function postVideo(params: {
  videoBuffer: Buffer;
  caption?: string;
}): Promise<{
  publishId: string;
  finalStatus: {
    status: 'PUBLISH_COMPLETE' | 'FAILED' | 'UNKNOWN';
    failReason?: string;
    publicPostUrl?: string;
  };
}> {
  const apiKey = process.env.ZERNIO_API_KEY;
  if (!apiKey) throw new Error('ZERNIO_API_KEY manquante dans .env.');

  const account = await loadAccount();
  if (!account) throw new Error("Aucun compte Instagram lié via Zernio.");

  // 1. Get presigned upload URL
  const presignRes = await fetch('https://zernio.com/api/v1/media/presign', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filename: 'video.mp4',
      contentType: 'video/mp4',
      size: params.videoBuffer.byteLength,
    }),
  });
  if (!presignRes.ok) {
    const errorBody = await presignRes.text();
    throw new Error(`Zernio media/presign failed (${presignRes.status}): ${errorBody}`);
  }
  const presignData = (await presignRes.json()) as { uploadUrl: string; publicUrl: string };

  // 2. PUT video buffer to Zernio storage
  const uploadRes = await fetch(presignData.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(params.videoBuffer.byteLength),
    },
    body: new Uint8Array(params.videoBuffer),
  });
  if (!uploadRes.ok) {
    const errorBody = await uploadRes.text();
    throw new Error(`Zernio media upload PUT failed (${uploadRes.status}): ${errorBody}`);
  }

  // 3. Create post via Zernio
  const postBody = {
    content: params.caption ?? '',
    publishNow: true,
    mediaItems: [
      {
        type: 'video',
        url: presignData.publicUrl,
      },
    ],
    platforms: [
      {
        platform: 'instagram',
        accountId: account.accountId,
      },
    ],
  };

  const postRes = await fetch('https://zernio.com/api/v1/posts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(postBody),
  });
  if (!postRes.ok) {
    const errorBody = await postRes.text();
    throw new Error(`Zernio post creation failed (${postRes.status}): ${errorBody}`);
  }
  const postData = (await postRes.json()) as { post: { _id: string } };
  const postId = postData.post._id;

  // 4. Poll status
  const finalStatus = await pollPostStatus(postId);
  return {
    publishId: postId,
    finalStatus,
  };
}
