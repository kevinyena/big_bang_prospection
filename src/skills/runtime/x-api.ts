import dotenv from 'dotenv';
import crypto from 'node:crypto';
dotenv.config();

// ---------- Native X OAuth 2.0 PKCE ----------

export function buildAuthorizeUrl(host: string, state: string, codeVerifier: string): string {
  const clientId = process.env.X_CLIENT_ID || process.env.X_OAUTH_CLIENT_ID;
  if (!clientId) {
    throw new Error('X_CLIENT_ID missing in .env');
  }

  // Determine redirect URI
  const redirectUri = process.env.X_OAUTH_REDIRECT_URI || `${host.includes('localhost') ? 'http' : 'https'}://${host}/api/auth/x/callback`;

  // Compute S256 code challenge
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest()
    .toString('base64url');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'tweet.read tweet.write users.read offline.access',
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return `https://x.com/i/oauth2/authorize?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  host: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('X_CLIENT_ID or X_CLIENT_SECRET missing in .env');
  }

  const redirectUri = process.env.X_OAUTH_REDIRECT_URI || `${host.includes('localhost') ? 'http' : 'https'}://${host}/api/auth/x/callback`;

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const params = new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  const res = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`,
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`X token exchange failed: HTTP ${res.status} - ${text}`);
  }

  return (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
}

export async function fetchUserProfile(accessToken: string): Promise<{ id: string; name: string; username: string }> {
  const res = await fetch('https://api.twitter.com/2/users/me', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`X profile fetch failed: HTTP ${res.status} - ${text}`);
  }

  const body = (await res.json()) as {
    data: {
      id: string;
      name: string;
      username: string;
    };
  };

  return body.data;
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('X_CLIENT_ID or X_CLIENT_SECRET missing in .env');
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  });

  const res = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`,
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`X token refresh failed: HTTP ${res.status} - ${text}`);
  }

  return (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
}

export async function postTweet(
  accessToken: string,
  text: string,
  replyToTweetId?: string
): Promise<{ id: string; text: string }> {
  const body: Record<string, any> = { text };
  if (replyToTweetId) {
    body.reply = {
      in_reply_to_tweet_id: replyToTweetId,
    };
  }

  const res = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`X post tweet failed: HTTP ${res.status} - ${text}`);
  }

  const data = (await res.json()) as {
    data: {
      id: string;
      text: string;
    };
  };

  return data.data;
}

export async function unlink(xUserId: string): Promise<void> {
  console.log(`[X API] Native account unlinked: ${xUserId}`);
}
