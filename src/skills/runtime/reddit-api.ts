import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', '..', '..', '.data');
const PROFILE_PATH = path.join(DATA_DIR, 'zernio-profile.json');
const ACCOUNT_PATH = path.join(DATA_DIR, 'zernio-reddit-account.json');

export interface ZernioStoredRedditAccount {
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

async function loadAccount(): Promise<ZernioStoredRedditAccount | null> {
  try {
    const raw = await fs.readFile(ACCOUNT_PATH, 'utf-8');
    return JSON.parse(raw) as ZernioStoredRedditAccount;
  } catch {
    return null;
  }
}

async function saveAccount(acc: ZernioStoredRedditAccount): Promise<void> {
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

export async function buildRedditAuthUrl(host?: string): Promise<{ url: string; state: string }> {
  const profileId = await getOrCreateProfileId();
  const apiKey = process.env.ZERNIO_API_KEY;
  if (!apiKey) throw new Error('ZERNIO_API_KEY manquante dans .env.');

  let redirectUrl = process.env.REDDIT_OAUTH_REDIRECT_URI;
  if (!redirectUrl && host) {
    const protocol = host.includes('localhost') ? 'http' : 'https';
    redirectUrl = `${protocol}://${host}/api/auth/reddit/callback`;
  }
  if (!redirectUrl) {
    redirectUrl = 'http://localhost:3000/api/auth/reddit/callback';
  }

  const params = new URLSearchParams({
    profileId,
    redirect_url: redirectUrl,
  });

  const res = await fetch(`https://zernio.com/api/v1/connect/reddit?${params.toString()}`, {
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

export async function handleRedditCallback(params: {
  accountId: string;
  username: string;
  profileId: string;
}): Promise<ZernioStoredRedditAccount> {
  const stored: ZernioStoredRedditAccount = {
    accountId: params.accountId,
    username: params.username,
    profileId: params.profileId,
  };
  await saveAccount(stored);
  return stored;
}

export interface RedditStatus {
  linked: boolean;
  displayName?: string;
  openId?: string;
}

export async function getRedditStatus(): Promise<RedditStatus> {
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
      const redditAcc = data.accounts.find((a) => a.platform === 'reddit');
      if (redditAcc) {
        const profileId =
          typeof redditAcc.profileId === 'object' && redditAcc.profileId
            ? redditAcc.profileId._id
            : typeof redditAcc.profileId === 'string'
              ? redditAcc.profileId
              : '6a181cace6c911674d287c40';

        const stored = {
          accountId: redditAcc._id,
          username: redditAcc.username,
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
    console.error('[reddit-api] self-healing failed:', e);
  }

  return { linked: false };
}

export async function redditUnlink(): Promise<void> {
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
      console.error('[reddit-api] Failed to delete account from Zernio:', e);
    }
  }
  await clearAccount();
}

// ---------- Subreddit Fetching ----------

export async function getRedditSubreddits(accountId: string): Promise<string[]> {
  const apiKey = process.env.ZERNIO_API_KEY;
  if (!apiKey) throw new Error('ZERNIO_API_KEY manquante dans .env.');

  const res = await fetch(`https://zernio.com/api/v1/accounts/${accountId}/reddit-subreddits`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Zernio fetch subreddits failed (${res.status}): ${errorBody}`);
  }

  const data = await res.json() as any;
  console.log('[reddit-api] raw subreddits data response:', JSON.stringify(data));

  // Extract array of subreddits safely
  const rawList = data.subreddits || data.data || data;
  if (Array.isArray(rawList)) {
    return rawList.map((item: any) => {
      if (typeof item === 'string') return item;
      return item.display_name || item.name || item.title || String(item);
    }).filter(Boolean);
  }

  return [];
}
