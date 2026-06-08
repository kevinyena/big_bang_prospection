import puppeteer from 'puppeteer';

/**
 * Captures a full-page screenshot, fetches the HTML source, and extracts CSS styling of a URL.
 * Used as design reference input for SaaS generation.
 */

export interface UrlAnalysis {
  screenshotBase64: string;  // JPEG screenshot encoded as base64
  htmlSource: string;        // Raw HTML source (truncated to fit in LLM context)
  cssSource: string;         // Extracted CSS variables, themes, and styles
  pageTitle: string;
  url: string;
}

const MAX_HTML_LENGTH = 15000; // ~15k chars to stay within token limits
const MAX_CSS_LENGTH = 20000;  // ~20k chars limit for styles to avoid bloating context

export async function analyzeUrl(url: string): Promise<UrlAnalysis> {
  console.log(`[url-analyzer] Launching headless browser for: ${url}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();

    // Desktop viewport for landing page screenshots
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

    // Navigate with generous timeout for slow marketing sites
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait a bit for lazy-loaded content and animations to settle
    await new Promise(r => setTimeout(r, 2000));

    // Get page title
    const pageTitle = await page.title();

    // Determine page height to avoid exceeding Claude's 8000px image limit
    const pageHeight = await page.evaluate(() => {
      return Math.max(
        document.documentElement.scrollHeight,
        document.body ? document.body.scrollHeight : 0,
        document.documentElement.offsetHeight,
        document.body ? document.body.offsetHeight : 0,
        document.documentElement.clientHeight
      );
    });

    const maxScreenshotHeight = 6000;
    const screenshotHeight = Math.max(900, Math.min(pageHeight || 900, maxScreenshotHeight));
    
    console.log(`[url-analyzer] Resizing viewport to 1440x${screenshotHeight} (page height was ${pageHeight}px)`);
    await page.setViewport({ width: 1440, height: screenshotHeight, deviceScaleFactor: 1 });

    // Wait a bit for layout to settle and lazy-loaded elements to trigger
    await new Promise(r => setTimeout(r, 1000));

    // Take screenshot of the viewport (which covers the page up to 6000px)
    // Use JPEG with quality 75 to keep image size well under 10MB limit
    const screenshotBuffer = await page.screenshot({
      type: 'jpeg',
      quality: 75,
      fullPage: false,
    }) as Buffer;
    const screenshotBase64 = screenshotBuffer.toString('base64');
    console.log(`[url-analyzer] Screenshot captured (${(screenshotBuffer.length / 1024).toFixed(0)}KB)`);

    // Fetch HTML source
    const fullHtml = await page.content();

    // Extract inline styles and stylesheet link hrefs from browser context
    const cssData = await page.evaluate(() => {
      // Inline styles
      const styleTags = Array.from(document.querySelectorAll('style'));
      let inlineCss = '';
      for (const tag of styleTags) {
        if (tag.textContent) {
          inlineCss += tag.textContent + '\n';
        }
      }

      // Stylesheet link hrefs
      const linkHrefs = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .map(el => (el as HTMLLinkElement).href)
        .filter(Boolean);

      return { inlineCss, linkHrefs };
    });

    // Truncate HTML to stay within LLM token limits
    let htmlSource = fullHtml;
    if (htmlSource.length > MAX_HTML_LENGTH) {
      // Try to keep <head> intact and truncate body
      const headEnd = htmlSource.indexOf('</head>');
      if (headEnd > 0 && headEnd < MAX_HTML_LENGTH * 0.6) {
        const head = htmlSource.substring(0, headEnd + 7);
        const bodyStart = htmlSource.indexOf('<body');
        const remainingBudget = MAX_HTML_LENGTH - head.length - 100;
        const bodyContent = htmlSource.substring(bodyStart, bodyStart + remainingBudget);
        htmlSource = head + '\n<!-- ... body truncated ... -->\n' + bodyContent + '\n<!-- ... truncated -->';
      } else {
        htmlSource = htmlSource.substring(0, MAX_HTML_LENGTH) + '\n<!-- ... truncated -->';
      }
    }
    console.log(`[url-analyzer] HTML source captured (${htmlSource.length} chars)`);

    // Fetch external stylesheets and extract variables/themes in Node to bypass browser CORS
    let cssSource = '';
    let extractedVariables = '';

    // Extract variables from inline styles first
    const inlineRootMatches = cssData.inlineCss.match(/:root\s*\{([^}]+)\}/g) || [];
    const inlineThemeMatches = cssData.inlineCss.match(/@theme\s*\{([^}]+)\}/g) || [];
    extractedVariables += inlineRootMatches.join('\n') + '\n' + inlineThemeMatches.join('\n') + '\n';

    // Fetch external stylesheets in parallel/sequence
    console.log(`[url-analyzer] Found ${cssData.linkHrefs.length} external stylesheets`);
    for (const href of cssData.linkHrefs.slice(0, 5)) { // Process top 5 sheets max
      try {
        console.log(`[url-analyzer] Fetching external sheet: ${href}`);
        const response = await fetch(href, { signal: AbortSignal.timeout(3000) });
        if (response.ok) {
          const text = await response.text();
          const rootMatches = text.match(/:root\s*\{([^}]+)\}/g) || [];
          const themeMatches = text.match(/@theme\s*\{([^}]+)\}/g) || [];
          if (rootMatches.length > 0 || themeMatches.length > 0) {
            extractedVariables += `/* From stylesheet link: ${new URL(href).pathname} */\n` + rootMatches.join('\n') + '\n' + themeMatches.join('\n') + '\n';
          }
        }
      } catch (fetchErr) {
        console.warn(`[url-analyzer] Failed to fetch stylesheet ${href}:`, (fetchErr as Error).message);
      }
    }

    // Clean inline CSS to save tokens (remove @font-face, keyframes, SVG inline data URIs)
    let cleanInlineCss = cssData.inlineCss
      .replace(/@font-face\s*\{[^}]*\}/g, '')
      .replace(/url\(\s*['"]?data:[^)]*\)/g, 'url()')
      .replace(/@keyframes\s*[^{]*\{([^{}]*\{[^{}]*\})*[^{}]*\}/g, ''); // Remove animations

    cssSource = `/* Extracted CSS Variables & Themes */\n${extractedVariables}\n/* Cleaned Inline CSS Styles */\n${cleanInlineCss}`;

    if (cssSource.length > MAX_CSS_LENGTH) {
      cssSource = cssSource.substring(0, MAX_CSS_LENGTH) + '\n/* ... CSS truncated ... */';
    }
    console.log(`[url-analyzer] CSS source captured (${cssSource.length} chars)`);

    return {
      screenshotBase64,
      htmlSource,
      cssSource,
      pageTitle,
      url,
    };
  } finally {
    await browser.close();
  }
}
