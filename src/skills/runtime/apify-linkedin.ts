const APIFY_BASE = 'https://api.apify.com/v2';
export const APIFY_LINKEDIN_ACTOR_ID = 'M2FMdjRVeF1HPGFcc';

function apifyToken(): string {
  const t = process.env.APIFY_TOKEN;
  if (!t) {
    throw new Error('APIFY_TOKEN is missing in the environment');
  }
  return t;
}

export interface LinkedInProspect {
  name: string;
  firstName?: string;
  email: string | null;
  functionName: string;
  location: string;
}

export interface FetchLinkedInParams {
  keywords: string;
  location?: string;
  functionName?: string;
  limit: number;
}

/**
 * Runs the LinkedIn scraper actor M2FMdjRVeF1HPGFcc in "Full + email search" mode.
 */
export async function fetchLinkedInProspects(
  params: FetchLinkedInParams
): Promise<LinkedInProspect[]> {
  const token = apifyToken();
  const limit = Number(params.limit) || 10;
  
  // Target number of prospects WITH emails: limit + 10% margin
  const targetEmailsCount = Math.ceil(limit * 1.1);
  
  const prospectsWithEmails: LinkedInProspect[] = [];
  const allProspects: LinkedInProspect[] = []; // to fall back to if safety limit is reached
  
  let currentStartPage = 1;
  let currentMaxItems = limit;
  let iteration = 0;
  const maxIterations = 15; // safety limit to prevent infinite loops

  while (prospectsWithEmails.length < targetEmailsCount && iteration < maxIterations) {
    iteration++;
    
    // For subsequent runs, request a solid chunk to reach the target emails limit
    if (iteration > 1) {
      currentMaxItems = Math.max(200, targetEmailsCount - prospectsWithEmails.length);
    }
    
    const takePages = Math.max(1, Math.ceil(currentMaxItems / 10));

    const locations = params.location
      ? params.location.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    const currentJobTitles = params.functionName
      ? params.functionName.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    const input = {
      profileScraperMode: 'Full + email search',
      maxItems: currentMaxItems,
      takePages,
      searchQuery: params.keywords || '',
      currentJobTitles: currentJobTitles.length > 0 ? currentJobTitles : undefined,
      locations: locations.length > 0 ? locations : undefined,
      startPage: currentStartPage,
    };

    console.log(`[LinkedIn Scraper] Run #${iteration} (page: ${currentStartPage}, items requested: ${currentMaxItems}) starting...`);
    
    let runId, datasetId;
    try {
      const res = await startAndPollRun(input);
      runId = res.runId;
      datasetId = res.datasetId;
    } catch (runErr) {
      console.error(`[LinkedIn Scraper] Run #${iteration} failed:`, runErr);
      break; // Stop loop on error
    }

    console.log(`[LinkedIn Scraper] Run #${iteration} succeeded (ID: ${runId}). Fetching dataset items...`);

    const itemsRes = await fetch(
      `${APIFY_BASE}/datasets/${datasetId}/items?token=${encodeURIComponent(token)}&clean=true&format=json`
    );
    if (!itemsRes.ok) {
      console.error(`[LinkedIn Scraper] Dataset fetch failed: ${itemsRes.status}`);
      break;
    }
    const items = (await itemsRes.json()) as any[];
    if (!Array.isArray(items) || items.length === 0) {
      console.log(`[LinkedIn Scraper] No more items found. Ending search.`);
      break;
    }

    // Process new items
    for (const it of items) {
      const name = `${it.firstName || ''} ${it.lastName || ''}`.trim() || 'Unknown';
      const email = it.emails?.[0]?.email || null;
      const functionName = it.headline || it.experience?.[0]?.title || 'Unknown';
      const locationText = it.location?.linkedinText || it.location?.parsed?.text || 'Unknown';

      const prospect = {
        name,
        firstName: it.firstName || '',
        email,
        functionName,
        location: locationText,
      };

      allProspects.push(prospect);
      if (email) {
        prospectsWithEmails.push(prospect);
      }
    }

    console.log(`[LinkedIn Scraper] After run #${iteration}: collected ${prospectsWithEmails.length}/${targetEmailsCount} prospects with email (Total prospects so far: ${allProspects.length})`);

    // Advance start page for pagination
    currentStartPage += takePages;
  }

  // Return only prospects with emails, sliced up to our target emails count
  return prospectsWithEmails.slice(0, targetEmailsCount);
}

const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 6 * 60 * 1000; // 6 mins timeout

async function startAndPollRun(input: unknown): Promise<{ runId: string; datasetId: string }> {
  const token = apifyToken();

  // 1. Start the run
  const startUrl = `${APIFY_BASE}/acts/${APIFY_LINKEDIN_ACTOR_ID}/runs?token=${encodeURIComponent(token)}`;
  const startRes = await fetch(startUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!startRes.ok) {
    throw new Error(`Apify start run ${startRes.status}: ${await startRes.text()}`);
  }
  const startBody = (await startRes.json()) as any;
  if (!startBody.data?.id) {
    throw new Error(`Apify start run: malformed response: ${JSON.stringify(startBody).slice(0, 300)}`);
  }
  const runId = startBody.data.id;
  const datasetId = startBody.data.defaultDatasetId;

  // 2. Poll until terminal status
  const pollUrl = `${APIFY_BASE}/actor-runs/${runId}?token=${encodeURIComponent(token)}`;
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let lastStatus = 'READY';

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    const pollRes = await fetch(pollUrl);
    if (!pollRes.ok) {
      continue;
    }
    const pollBody = (await pollRes.json()) as any;
    if (!pollBody.data) continue;
    lastStatus = pollBody.data.status;
    if (lastStatus === 'SUCCEEDED') {
      return { runId, datasetId };
    }
    if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(lastStatus)) {
      throw new Error(
        `Apify run ${runId} ended with status=${lastStatus} (${pollBody.data.statusMessage ?? 'no message'})`
      );
    }
  }
  throw new Error(`Apify run ${runId} did not finish within ${POLL_TIMEOUT_MS / 1000}s (last status: ${lastStatus})`);
}
