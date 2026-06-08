export interface MobbinScreen {
  id: string;
  image_url: string;
  mobbin_url: string;
  app_name: string;
  platform: string;
}

export async function searchMobbinScreens(
  query: string,
  platform: 'web' | 'ios' = 'web',
  limit: number = 4
): Promise<MobbinScreen[]> {
  const apiKey = process.env.MOBBIN_API_KEY;
  if (!apiKey) {
    console.warn("[Mobbin] MOBBIN_API_KEY is missing in env.");
    return [];
  }

  console.log(`[Mobbin] Searching screens for query: "${query}" on platform: ${platform}`);

  try {
    const res = await fetch('https://api.mobbin.com/v1/screens/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        platform,
        limit,
        mode: 'deep',
        image_quality: 'high',
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[Mobbin] API returned error (${res.status}): ${text}`);
      return [];
    }

    const data = await res.json() as { screens?: MobbinScreen[] };
    const screens = data.screens || [];
    console.log(`[Mobbin] Found ${screens.length} screens.`);
    return screens;
  } catch (err) {
    console.error('[Mobbin] Failed to search screens:', err);
    return [];
  }
}
