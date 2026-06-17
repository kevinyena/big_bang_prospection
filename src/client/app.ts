// Sideloot Admin Multi-Channel Prospection Frontend Application Logic

// Helper to select elements
function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element with id '${id}' not found`);
  return el as T;
}

// State variables
let activeTab = 'metrics';
let activeDays = '30';
let currentPayingCustomers: any[] = [];
let currentChurnedCustomers: any[] = [];
let currentXPostsPage = 1;
let currentJoinedSubreddits: string[] = [];
let emailCampaignPollTimeout: any = null;

// Initialize
window.addEventListener('DOMContentLoaded', async () => {
  initLoginForm();
  
  const authenticated = await checkAuth();
  if (authenticated) {
    initDashboard();
  }
});

async function checkAuth(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) {
      showLoginScreen();
      return false;
    }
    const data = await res.json();
    showDashboardScreen(data.email);
    return true;
  } catch (err) {
    showLoginScreen();
    return false;
  }
}

function showLoginScreen() {
  $('login-overlay').classList.remove('hidden');
  $('app-dashboard-wrapper').classList.add('hidden');
}

function showDashboardScreen(email: string) {
  $('login-overlay').classList.add('hidden');
  $('app-dashboard-wrapper').classList.remove('hidden');
  
  const headerEmail = $('header-user-email');
  if (headerEmail) {
    headerEmail.textContent = email;
  }
}

let dashboardInitialized = false;

function initDashboard() {
  if (dashboardInitialized) return;
  dashboardInitialized = true;

  initTabs();
  initDateFilters();
  initModals();
  initEditForm();
  initDrawerKeyboard();
  initDrawerStatusListener();
  initXAccountsConnector();
  initRedditAccountConnector();

  // Setup Sign out button click
  const signOutBtn = $('signOutBtn');
  if (signOutBtn) {
    signOutBtn.onclick = async () => {
      try {
        const res = await fetch('/api/auth/logout', { method: 'POST' });
        if (res.ok) {
          window.location.reload();
        }
      } catch (err) {
        showError('Erreur lors de la déconnexion');
      }
    };
  }

  // Load metrics initially
  loadMetrics();
}

function initLoginForm() {
  const form = $('form-login') as HTMLFormElement;
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = ($('login-email') as HTMLInputElement).value;
    const password = ($('login-password') as HTMLInputElement).value;
    const rememberMe = ($('login-remember-me') as HTMLInputElement).checked;

    const errorBox = $('login-error-box');
    errorBox.classList.add('hidden');
    errorBox.textContent = '';

    const btn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = 'Connexion...';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, rememberMe })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Identifiants incorrects.');
      }

      const data = await res.json();
      showDashboardScreen(data.email);
      initDashboard();
    } catch (err) {
      errorBox.textContent = (err as Error).message;
      errorBox.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Se connecter';
    }
  });
}

// Tab Navigation Manager
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      if (!tabId) return;

      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const panels = document.querySelectorAll('.tab-panel');
      panels.forEach(p => p.classList.add('hidden'));
      $(`panel-${tabId}`).classList.remove('hidden');

      activeTab = tabId;
      triggerTabLoad(tabId);
    });
  });
}

// Date Filter pills on Metrics tab
function initDateFilters() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const days = btn.getAttribute('data-days');
      if (days === null) return;

      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      activeDays = days;
      loadMetrics();
    });
  });
}

// Handle loading data based on tab selection
function triggerTabLoad(tabId: string) {
  if (tabId !== 'email' && emailCampaignPollTimeout) {
    clearTimeout(emailCampaignPollTimeout);
    emailCampaignPollTimeout = null;
  }

  switch (tabId) {
    case 'metrics':      loadMetrics(); break;
    case 'email':        loadTabCampaigns('email',   'email-campaign-select',   loadEmails); break;
    case 'x-comments':
      loadXAccounts();
      loadTabCampaigns('x_reply', 'x-comment-campaign-select', loadXComments);
      break;
    case 'reddit-posts': 
      loadTabCampaigns('reddit',  'reddit-campaign-select',  loadRedditPosts); 
      loadRedditAccountStatus();
      break;
  }
}

// 1. Metrics
async function loadMetrics() {
  try {
    const response = await fetch(`/api/prospection/metrics?days=${activeDays}`);
    if (!response.ok) throw new Error('Failed to fetch metrics data');
    const data = await response.json();

    $('kpi-val-visitors').textContent       = String(data.website_visitors || 0);
    $('kpi-val-conversion').textContent     = `${data.signups || 0} (${data.conversion_rate || 0}%)`;
    $('kpi-val-subscribers').textContent    = String(data.paying_subscribers || 0);
    $('kpi-val-revenue').textContent        = formatCurrency(data.revenue || 0);
    $('kpi-val-margin').textContent         = formatCurrency(data.margin_estimation || 0);
    $('kpi-val-churn').textContent          = `${data.churn_rate || 0}%`;

    currentPayingCustomers = data.customers_list || [];
    currentChurnedCustomers = data.churned_list || [];

    $('kpi-val-emails-sent').textContent    = String(data.emails_sent);
    $('kpi-val-emails-received').textContent = String(data.emails_received);
    $('kpi-val-xreplies-sent').textContent  = String(data.x_comments_replied);
    $('kpi-val-reddit-posts').textContent   = String(data.reddit_posts);

    const periodText = activeDays === 'all' ? 'All time' : `Last ${activeDays}d`;
    $('kpi-meta-visitors').textContent = periodText;
    $('kpi-meta-subscribers').textContent = periodText;
    $('kpi-meta-revenue').textContent = `${periodText} · net USD`;
    $('kpi-meta-margin').textContent = `50% of revenue`;
    $('kpi-meta-churn').textContent = `Cancellations ratio`;
  } catch (err) {
    showError('Error loading metrics: ' + (err as Error).message);
  }
}

// 2. Emails
async function loadEmails(campaignId: string) {
  const inboundBody  = $('email-inbound-table-body');
  const outboundBody = $('email-outbound-table-body');
  inboundBody.innerHTML  = '';
  outboundBody.innerHTML = '';

  if (emailCampaignPollTimeout) {
    clearTimeout(emailCampaignPollTimeout);
    emailCampaignPollTimeout = null;
  }

  if (!campaignId || campaignId === 'none') {
    const emptyInbound = '<tr><td colspan="4" class="text-center muted">Veuillez sélectionner ou lancer une campagne pour voir les emails.</td></tr>';
    const emptyOutbound = '<tr><td colspan="3" class="text-center muted">Veuillez sélectionner ou lancer une campagne pour voir les emails.</td></tr>';
    inboundBody.innerHTML  = emptyInbound;
    outboundBody.innerHTML = emptyOutbound;

    const panel = document.getElementById('email-campaign-status-panel');
    if (panel) {
      panel.style.display = 'none';
    }
    return;
  }

  try {
    // Fetch campaign status and logs
    const statusRes = await fetch(`/api/prospection/campaigns/${campaignId}`);
    if (statusRes.ok) {
      const camp = await statusRes.json();
      const panel = document.getElementById('email-campaign-status-panel');
      if (panel) {
        panel.style.display = 'block';
      }
      
      const indicator = document.getElementById('campaign-status-indicator');
      const statusText = document.getElementById('campaign-status-text');
      const logsWindow = document.getElementById('campaign-logs-window');
      const countSent = document.getElementById('campaign-count-sent');
      
      if (indicator) {
        let color = '#95a5a6'; // gray (idle)
        if (camp.status === 'scraping') color = '#f39c12'; // orange
        else if (camp.status === 'sending') color = '#3498db'; // blue
        else if (camp.status === 'completed') color = '#2ecc71'; // green
        else if (camp.status === 'failed') color = '#e74c3c'; // red
        indicator.style.backgroundColor = color;
      }
      
      if (statusText) {
        statusText.textContent = camp.status_text || 'Aucun statut';
      }
      
      if (logsWindow) {
        logsWindow.textContent = camp.logs || '// Pas encore de logs.';
        logsWindow.scrollTop = logsWindow.scrollHeight;
      }
      
      if (countSent) {
        const filters = camp.target_filters || {};
        let total = 0;
        if (campaignId === 'd01ec15b-17c9-429a-9043-428ed29f10e0') {
          total = 1000;
        } else if (filters.type === 'manual' && filters.emailsList) {
          total = filters.emailsList.split(',').map((e: string) => e.trim()).filter(Boolean).length;
        } else if (filters.limit) {
          total = parseInt(filters.limit, 10);
        }
        
        const sentCount = camp.sent_count || 0;
        if (total > 0) {
          countSent.textContent = `${sentCount} / ${total}`;
        } else {
          countSent.textContent = `${sentCount}`;
        }
      }
    }

    const response = await fetch(`/api/prospection/emails?campaignId=${campaignId}`);
    if (!response.ok) throw new Error('Failed to fetch emails');
    const emails = await response.json();

    const inbound  = emails.filter((e: any) => e.direction === 'in');
    const outbound = emails.filter((e: any) => e.direction === 'out');

    if (inbound.length === 0) {
      inboundBody.innerHTML = '<tr><td colspan="4" class="text-center muted">Aucun email reçu.</td></tr>';
    } else {
      inbound.forEach((e: any) => {
        const row = document.createElement('tr');
        row.style.cursor = 'pointer';

        const status = (e.thread_status || 'new').toLowerCase();
        let badgeClass = 'new';
        let badgeLabel = 'NEW';
        if (status === 'open') {
          badgeClass = 'open';
          badgeLabel = 'OPEN';
        } else if (status === 'ok') {
          badgeClass = 'ok';
          badgeLabel = 'OK';
        }

        row.innerHTML = `
          <td><span class="brand-domain">${escapeHtml(e.from_address)}</span></td>
          <td><strong>${escapeHtml(e.subject)}</strong></td>
          <td><span class="status-badge ${badgeClass}">${badgeLabel}</span></td>
          <td><span class="muted small">${formatDate(e.sent_at)}</span></td>
        `;
        row.addEventListener('click', () => {
          highlightRow(row);
          openMessageDrawer(e.thread_id, e.from_address, e.subject);
        });
        inboundBody.appendChild(row);
      });
    }

    if (outbound.length === 0) {
      outboundBody.innerHTML = '<tr><td colspan="3" class="text-center muted">Aucun email envoyé.</td></tr>';
    } else {
      outbound.forEach((e: any) => {
        const row = document.createElement('tr');
        row.style.cursor = 'pointer';
        row.innerHTML = `
          <td><span class="brand-domain">${escapeHtml(e.to_address)}</span></td>
          <td><strong>${escapeHtml(e.subject)}</strong></td>
          <td><span class="muted small">${formatDate(e.sent_at)}</span></td>
        `;
        row.addEventListener('click', () => {
          highlightRow(row);
          openMessageDrawer(e.thread_id, e.to_address, e.subject);
        });
        outboundBody.appendChild(row);
      });
    }
  } catch (err) {
    showError('Error loading emails: ' + (err as Error).message);
  } finally {
    try {
      const currentSelectVal = ($('email-campaign-select') as HTMLSelectElement).value;
      if (currentSelectVal === campaignId && activeTab === 'email') {
        emailCampaignPollTimeout = setTimeout(() => {
          loadEmails(campaignId).catch(console.error);
        }, 3000);
      }
    } catch (e) {
      // Elements might not exist yet during startup
    }
  }
}

// 3. X Accounts
async function loadXAccounts() {
  const tbody = $('x-accounts-table-body');
  tbody.innerHTML = '<tr><td colspan="5" class="text-center">Chargement des comptes...</td></tr>';

  try {
    const response = await fetch('/api/auth/x/status');
    if (!response.ok) throw new Error('Failed to fetch X accounts status');
    const accounts = await response.json();

    if (accounts.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center muted">Aucun compte X lié.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    accounts.forEach((acc: any) => {
      const row = document.createElement('tr');
      
      const badgeClass = acc.status === 'connected' ? 'ok' : 'new';
      const badgeLabel = (acc.status || 'CONNECTED').toUpperCase();

      row.innerHTML = `
        <td><strong>${escapeHtml(acc.displayName || acc.handle)}</strong></td>
        <td><span class="brand-domain">@${escapeHtml(acc.handle)}</span></td>
        <td><span class="muted small">${escapeHtml(acc.accountId)}</span></td>
        <td><span class="status-badge ${badgeClass}">${badgeLabel}</span></td>
        <td class="text-center">
          <button class="btn-signout btn-disconnect-x" data-id="${acc.id}">Déconnecter</button>
        </td>
      `;

      const btnDisconnect = row.querySelector('.btn-disconnect-x') as HTMLButtonElement;
      btnDisconnect.onclick = async () => {
        if (!confirm(`Voulez-vous déconnecter le compte @${acc.handle} ?`)) return;
        btnDisconnect.disabled = true;
        btnDisconnect.textContent = 'Déconnexion...';
        try {
          const res = await fetch('/api/auth/x/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: acc.id })
          });
          if (res.ok) {
            loadXAccounts();
          } else {
            const err = await res.json();
            throw new Error(err.error || 'Failed to disconnect');
          }
        } catch (err) {
          showError('Erreur de déconnexion : ' + (err as Error).message);
          btnDisconnect.disabled = false;
          btnDisconnect.textContent = 'Déconnecter';
        }
      };

      tbody.appendChild(row);
    });
  } catch (err) {
    showError('Error loading X accounts: ' + (err as Error).message);
  }
}

async function populateXAccountsDropdown(selectId: string) {
  const select = $(selectId) as HTMLSelectElement;
  if (!select) return;
  
  select.innerHTML = '<option value="">Sélectionner un compte X...</option>';
  
  try {
    const response = await fetch('/api/auth/x/status');
    if (!response.ok) throw new Error('Failed to fetch X accounts status');
    const accounts = await response.json();
    
    accounts.forEach((acc: any) => {
      const opt = document.createElement('option');
      opt.value = acc.id;
      opt.textContent = `${acc.displayName || acc.handle} (@${acc.handle})`;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error('Error populating X accounts dropdown:', err);
  }
}

// 4. X Comments
async function loadXComments(campaignId: string) {
  const tbody = $('xcomments-table-body');
  if (tbody) tbody.innerHTML = '';

  // Reset page when campaign changes
  currentXPostsPage = 1;
  loadXScannedPosts(campaignId, currentXPostsPage).catch(console.error);

  if (!campaignId) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center muted">Veuillez sélectionner ou lancer une campagne pour voir les commentaires.</td></tr>';
    return;
  }

  try {
    const response = await fetch(`/api/prospection/xcomments?campaignId=${campaignId}`);
    if (!response.ok) throw new Error('Failed to fetch X comments');
    const comments = await response.json();

    if (comments.length === 0) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center muted">Aucun commentaire répondu.</td></tr>';
      return;
    }

    comments.forEach((c: any) => {
      const row = document.createElement('tr');
      row.style.cursor = 'pointer';
      
      const linkUrl = c.tweet_url || (c.in_reply_to_tweet_id ? `https://x.com/any/status/${c.in_reply_to_tweet_id}` : null);
      const linkHtml = linkUrl 
        ? `<a href="${linkUrl}" target="_blank" class="btn-action-primary" style="font-size: 11px; padding: 4px 8px; text-decoration: none; display: inline-block;" onclick="event.stopPropagation()">Voir sur 𝕏</a>`
        : `<span class="muted small">Non disponible</span>`;

      row.innerHTML = `
        <td><strong style="font-family:monospace">${escapeHtml(c.recipient)}</strong></td>
        <td class="text-truncate" style="max-width:300px">${escapeHtml(c.body)}</td>
        <td><span class="multi-hire-badge" style="background-color:var(--success-bg);color:var(--success);border-color:var(--success);">${escapeHtml(c.status)}</span></td>
        <td><span class="muted small">${formatDate(c.sent_at)}</span></td>
        <td class="text-center" style="cursor: default;" onclick="event.stopPropagation()">${linkHtml}</td>
      `;
      row.addEventListener('click', () => openSimpleDrawer('Réponse X', c.recipient, c.body, c.sent_at, 'out'));
      if (tbody) tbody.appendChild(row);
    });
  } catch (err) {
    showError('Error loading X comments: ' + (err as Error).message);
  }
}

async function loadXScannedPosts(campaignId: string, page: number = 1) {
  const tbody = $('xposts-table-body');
  const loader = $('x-posts-loader');
  const infoEl = $('xposts-pagination-info');
  const prevBtn = $('btn-xposts-prev') as HTMLButtonElement | null;
  const nextBtn = $('btn-xposts-next') as HTMLButtonElement | null;
  
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4" class="text-center">Chargement des posts...</td></tr>';
  if (loader) loader.classList.remove('hidden');

  try {
    const url = campaignId 
      ? `/api/prospection/x-scanned-posts?campaignId=${encodeURIComponent(campaignId)}&page=${page}`
      : `/api/prospection/x-scanned-posts?page=${page}`;
      
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch X scanned posts');
    const result = await response.json();
    
    tbody.innerHTML = '';
    const posts = result.posts || [];
    const total = result.total || 0;
    const limit = result.limit || 20;
    
    if (posts.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center muted">Aucun post détecté avec des commentaires ou aucun compte connecté.</td></tr>';
      if (infoEl) infoEl.textContent = 'Affichage des posts 0 - 0 sur 0';
      if (prevBtn) prevBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;
      return;
    }

    posts.forEach((p: any) => {
      const row = document.createElement('tr');
      
      const linkUrl = p.status === 'commented' && p.replyTweetUrl ? p.replyTweetUrl : p.permalink;
      const linkText = p.status === 'commented' ? 'Voir réponse 𝕏' : 'Voir post 𝕏';
      
      const linkHtml = linkUrl
        ? `<a href="${linkUrl}" target="_blank" class="btn-action-primary" style="font-size: 11px; padding: 4px 8px; text-decoration: none; display: inline-block;">${escapeHtml(linkText)}</a>`
        : `<span class="muted small">Non disponible</span>`;

      const truncatedContent = p.content.length > 200
        ? p.content.substring(0, 200) + '...'
        : p.content;

      let badgeStyle = 'background-color:var(--panel-2);color:var(--text);border-color:var(--border);';
      if (p.status === 'commented') {
        badgeStyle = 'background-color:var(--success-bg);color:var(--success);border-color:var(--success);';
      } else if (p.status === 'failed') {
        badgeStyle = 'background-color:#fee2e2;color:#ef4444;border-color:#fca5a5;';
      }

      row.innerHTML = `
        <td><strong style="font-family:monospace">@${escapeHtml(p.accountUsername)}</strong></td>
        <td>${escapeHtml(truncatedContent)}</td>
        <td class="text-center"><span class="multi-hire-badge" style="font-size:12px; font-weight:bold; padding: 2px 8px; ${badgeStyle}">${escapeHtml(p.status || 'scanned')}</span></td>
        <td class="text-center">${linkHtml}</td>
      `;
      tbody.appendChild(row);
    });

    const startIdx = (page - 1) * limit + 1;
    const endIdx = Math.min(page * limit, total);
    if (infoEl) {
      infoEl.textContent = `Affichage des posts ${startIdx} - ${endIdx} sur ${total}`;
    }

    if (prevBtn) {
      prevBtn.disabled = page <= 1;
      prevBtn.onclick = () => {
        currentXPostsPage = page - 1;
        loadXScannedPosts(campaignId, currentXPostsPage).catch(console.error);
      };
    }

    if (nextBtn) {
      nextBtn.disabled = page * limit >= total;
      nextBtn.onclick = () => {
        currentXPostsPage = page + 1;
        loadXScannedPosts(campaignId, currentXPostsPage).catch(console.error);
      };
    }

  } catch (err) {
    console.error('Error loading X scanned posts:', err);
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Erreur: ${(err as Error).message}</td></tr>`;
    if (infoEl) infoEl.textContent = 'Erreur de chargement';
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
  } finally {
    if (loader) loader.classList.add('hidden');
  }
}

// 5. Reddit Posts
let allRedditPosts: any[] = [];
let redditPollTimeout: any = null;
let lastLoadedCampaignId = '';

async function loadRedditPosts(campaignId: string) {
  if (redditPollTimeout) {
    clearTimeout(redditPollTimeout);
    redditPollTimeout = null;
  }

  const tbody = $('reddit-posts-table-body');
  const loader = $('reddit-posts-loader');

  if (!campaignId) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center muted">Veuillez sélectionner ou lancer une campagne pour voir les posts Reddit.</td></tr>';
    lastLoadedCampaignId = '';
    if (loader) loader.classList.add('hidden');
    return;
  }

  if (lastLoadedCampaignId !== campaignId) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center muted">Chargement des posts Reddit...</td></tr>';
    lastLoadedCampaignId = campaignId;
  }

  if (loader) loader.classList.remove('hidden');

  try {
    const response = await fetch(`/api/prospection/reddit?campaignId=${campaignId}`);
    if (!response.ok) throw new Error('Failed to fetch Reddit posts');
    allRedditPosts = await response.json();

    const filterSelect = $('reddit-subreddit-filter') as HTMLSelectElement;
    const selectedSubreddit = filterSelect.value || 'all';

    const subreddits = new Set<string>();
    allRedditPosts.forEach((p: any) => { if (p.subreddit) subreddits.add(p.subreddit); });

    filterSelect.innerHTML = '<option value="all">Tous les subreddits</option>';
    subreddits.forEach(sub => {
      const opt = document.createElement('option');
      opt.value = sub;
      opt.textContent = sub;
      filterSelect.appendChild(opt);
    });
    filterSelect.value = selectedSubreddit;
    filterSelect.onchange = renderRedditPostsFiltered;
    renderRedditPostsFiltered();

    // Setup polling if any post is pending or generating
    const hasActive = allRedditPosts.some((p: any) => p.status === 'pending' || p.status === 'generating');
    if (hasActive) {
      redditPollTimeout = setTimeout(() => loadRedditPosts(campaignId), 3000);
    }
  } catch (err) {
    showError('Error loading Reddit posts: ' + (err as Error).message);
  } finally {
    if (loader) loader.classList.add('hidden');
  }
}

function renderRedditPostsFiltered() {
  const filterSelect = $('reddit-subreddit-filter') as HTMLSelectElement;
  const filterVal = filterSelect.value;
  const tbody = $('reddit-posts-table-body');
  tbody.innerHTML = '';

  const filtered = filterVal === 'all'
    ? allRedditPosts
    : allRedditPosts.filter((p: any) => p.subreddit === filterVal);

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center muted">Aucun post Reddit trouvé.</td></tr>';
    return;
  }

  filtered.forEach((p: any) => {
    const row = document.createElement('tr');
    row.style.cursor = 'pointer';
    
    let badgeStyle = 'background-color:var(--accent-light);color:var(--accent);border-color:var(--accent);';
    let statusLabel = escapeHtml(p.status);
    let bodyText = p.body ? escapeHtml(p.body) : '<span class="muted italic">En attente de génération...</span>';
    
    if (p.status === 'sent') {
      badgeStyle = 'background-color:var(--success-bg);color:var(--success);border-color:var(--success);';
      statusLabel = '✅ SENT';
    } else if (p.status === 'pending') {
      badgeStyle = 'background-color:#FFF2E6;color:#E07A5F;border-color:#E07A5F;';
      statusLabel = '⏳ PENDING';
    } else if (p.status === 'generating') {
      badgeStyle = 'background-color:#FFF9E6;color:#D4A373;border-color:#D4A373;';
      statusLabel = '⚡ GENERATING';
      bodyText = '<span class="muted italic">Génération du post en cours...</span>';
    } else if (p.status === 'failed') {
      badgeStyle = 'background-color:var(--danger-bg);color:var(--danger);border-color:var(--danger);';
      statusLabel = '❌ FAILED';
    }
    
    let linkHtml = '<span class="muted">-</span>';
    if (p.status === 'sent' && p.tweet_url) {
      linkHtml = `<a href="${escapeHtml(p.tweet_url)}" target="_blank" class="accent-link" style="color:var(--accent); font-weight:600; text-decoration:underline;" onclick="event.stopPropagation();">Ouvrir ↗</a>`;
    }

    row.innerHTML = `
      <td><span class="skill-tag">${escapeHtml(p.subreddit)}</span></td>
      <td class="text-truncate" style="max-width:350px">${bodyText}</td>
      <td><span class="multi-hire-badge" style="${badgeStyle}">${statusLabel}</span></td>
      <td><span class="muted small">${formatDate(p.sent_at)}</span></td>
      <td>${linkHtml}</td>
    `;
    row.addEventListener('click', () => openSimpleDrawer('Post Reddit', 'r/' + p.subreddit, p.body || 'Post en attente de génération.', p.sent_at, 'out'));
    tbody.appendChild(row);
  });
}

// --- Campaigns Loader & Selector ---
async function loadTabCampaigns(kind: string, selectId: string, loadDataFn: (campaignId: string) => void) {
  try {
    const select = $<HTMLSelectElement>(selectId);
    select.innerHTML = '<option value="">Chargement...</option>';

    const res = await fetch(`/api/prospection/campaigns?kind=${kind}`);
    if (!res.ok) throw new Error('Failed to fetch campaigns');
    const campaigns = await res.json();

    const deleteBtnId = 'btn-delete-' + selectId.replace('-select', '');
    const deleteBtn = document.getElementById(deleteBtnId) as HTMLButtonElement | null;
    if (deleteBtn) {
      deleteBtn.onclick = async () => {
        const campaignId = select.value;
        if (!campaignId || campaignId === 'none') { 
          alert('Veuillez sélectionner une campagne à supprimer.'); 
          return; 
        }

        const campaignName = select.options[select.selectedIndex]?.text || '';
        if (!confirm(`Êtes-vous sûr de vouloir supprimer la campagne "${campaignName}" et toutes les données associées ?`)) return;

        try {
          deleteBtn.disabled = true;
          const delRes = await fetch(`/api/prospection/campaigns/${campaignId}`, { method: 'DELETE' });
          if (!delRes.ok) throw new Error('Failed to delete campaign');
          const data = await delRes.json();
          if (data.success) {
            await loadTabCampaigns(kind, selectId, loadDataFn);
            await loadMetrics();
          }
        } catch (err) {
          showError('Erreur lors de la suppression : ' + (err as Error).message);
        } finally {
          if (deleteBtn) deleteBtn.disabled = false;
        }
      };
    }

    const editBtnId = 'btn-edit-' + selectId.replace('-select', '');
    const editBtn = document.getElementById(editBtnId) as HTMLButtonElement | null;
    if (editBtn) {
      editBtn.onclick = async () => {
        const campaignId = select.value;
        if (!campaignId || campaignId === 'none') return;
        await openEditCampaignModal(campaignId);
      };
    }

    const relaunchBtnId = 'btn-relaunch-' + selectId.replace('-select', '');
    const relaunchBtn = document.getElementById(relaunchBtnId) as HTMLButtonElement | null;
    if (relaunchBtn) {
      relaunchBtn.onclick = async () => {
        const campaignId = select.value;
        if (!campaignId || campaignId === 'none') return;

        const campaignName = select.options[select.selectedIndex]?.text || '';
        if (!confirm(`Voulez-vous relancer la campagne "${campaignName}" ?`)) return;

        try {
          relaunchBtn.disabled = true;
          const relRes = await fetch(`/api/prospection/campaigns/${campaignId}/relaunch`, { method: 'POST' });
          if (!relRes.ok) throw new Error('Failed to relaunch campaign');
          const data = await relRes.json();
          alert(data.message || 'Campagne relancée avec succès !');
          loadDataFn(campaignId);
        } catch (err) {
          showError('Erreur lors de la relance : ' + (err as Error).message);
        } finally {
          relaunchBtn.disabled = false;
        }
      };
    }

    const reloadBtnId = 'btn-reload-' + selectId.replace('-select', '');
    const reloadBtn = document.getElementById(reloadBtnId) as HTMLButtonElement | null;
    if (reloadBtn) {
      reloadBtn.onclick = () => {
        loadDataFn(select.value);
      };
    }

    select.innerHTML = '';
    
    // Always add "Hors Campagne" option for emails
    if (kind === 'email') {
      const noneOpt = document.createElement('option');
      noneOpt.value = 'none';
      noneOpt.textContent = 'Hors Campagne (Emails directs)';
      select.appendChild(noneOpt);
    }

    if (campaigns.length === 0 && kind !== 'email') {
      select.innerHTML = '<option value="">Aucune campagne active</option>';
      if (deleteBtn) deleteBtn.style.opacity = '0.5';
      if (editBtn) editBtn.style.opacity = '0.5';
      if (relaunchBtn) relaunchBtn.style.opacity = '0.5';
      loadDataFn('');
      return;
    }

    campaigns.forEach((c: any) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      
      let label = c.name;
      const filters = c.target_filters || {};
      const sentCount = c.sent_count || 0;
      
      if (kind === 'email') {
        let total = 10;
        if (filters.type === 'manual' && filters.emailsList) {
          total = filters.emailsList.split(',').map((e: string) => e.trim()).filter(Boolean).length;
        } else if (filters.limit) {
          total = parseInt(filters.limit, 10);
        }
        label = `${c.name} (${sentCount} / ${total})`;
      } else if (kind === 'x_reply') {
        const total = parseInt(filters.max_posts_per_day || '10', 10);
        label = `${c.name} (${sentCount} / ${total} par jour)`;
      }
      
      opt.textContent = label;
      select.appendChild(opt);
    });

    const updateDeleteBtnState = () => {
      const hasVal = select.value && select.value !== 'none';
      if (deleteBtn) {
        deleteBtn.style.opacity = hasVal ? '1' : '0.5';
        deleteBtn.disabled = !hasVal;
      }
      if (editBtn) {
        editBtn.style.opacity = hasVal ? '1' : '0.5';
        editBtn.disabled = !hasVal;
      }
      if (relaunchBtn) {
        relaunchBtn.style.opacity = hasVal ? '1' : '0.5';
        relaunchBtn.disabled = !hasVal;
      }
    };

    select.onchange = () => {
      updateDeleteBtnState();
      loadDataFn(select.value);
    };

    updateDeleteBtnState();
    loadDataFn(select.value);
  } catch (err) {
    showError(`Error loading campaigns for ${kind}: ` + (err as Error).message);
  }
}

async function openEditCampaignModal(campaignId: string) {
  try {
    const res = await fetch(`/api/prospection/campaigns/${campaignId}`);
    if (!res.ok) throw new Error('Failed to fetch campaign details');
    const campaign = await res.json();
    
    // Show modal
    $('modal-edit-campaign').classList.remove('hidden');
    
    // Set hidden fields
    $<HTMLInputElement>('edit-campaign-id').value = campaign.id;
    $<HTMLInputElement>('edit-campaign-kind').value = campaign.kind;
    
    // Populate standard fields
    $<HTMLInputElement>('edit-campaign-name').value = campaign.name || '';
    $<HTMLInputElement>('edit-campaign-interval').value = campaign.send_interval_minutes || '5';
    
    // Hide all sections and disable their inputs
    const sections = [
      'edit-section-email-manual',
      'edit-section-email-automated',
      'edit-section-x-reply',
      'edit-section-reddit'
    ];
    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.add('hidden');
        el.querySelectorAll('input, select, textarea').forEach(input => {
          (input as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).disabled = true;
        });
      }
    });
    
    const filters = campaign.target_filters || {};
    
    if (campaign.kind === 'email') {
      const type = filters.type || 'manual';
      if (type === 'manual') {
        const sec = $('edit-section-email-manual');
        sec.classList.remove('hidden');
        sec.querySelectorAll('input, select, textarea').forEach(input => {
          (input as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).disabled = false;
        });
        $<HTMLTextAreaElement>('edit-email-manual-list').value = filters.emailsList || '';
        $<HTMLInputElement>('edit-email-manual-subject').value = campaign.email_subject || '';
        $<HTMLTextAreaElement>('edit-email-manual-body').value = campaign.email_body || '';
      } else {
        const sec = $('edit-section-email-automated');
        sec.classList.remove('hidden');
        sec.querySelectorAll('input, select, textarea').forEach(input => {
          (input as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).disabled = false;
        });
        $<HTMLTextAreaElement>('edit-email-auto-keywords').value = filters.linkedinKeywords || '';
        $<HTMLInputElement>('edit-email-auto-location').value = filters.linkedinLocation || '';
        $<HTMLInputElement>('edit-email-auto-function').value = filters.linkedinFunction || '';
        $<HTMLInputElement>('edit-email-auto-limit').value = filters.limit || '10';
        $<HTMLInputElement>('edit-email-auto-subject').value = campaign.email_subject || '';
        $<HTMLTextAreaElement>('edit-email-auto-body').value = campaign.email_body || '';
      }
    } else if (campaign.kind === 'x_reply') {
      const sec = $('edit-section-x-reply');
      sec.classList.remove('hidden');
      sec.querySelectorAll('input, select, textarea').forEach(input => {
        (input as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).disabled = false;
      });
      await populateXAccountsDropdown('edit-xreply-x-account-select');
      $<HTMLSelectElement>('edit-xreply-x-account-select').value = filters.x_account_id || '';
      $<HTMLInputElement>('edit-xreply-keyword').value = filters.keyword || '';
      $<HTMLInputElement>('edit-xreply-min-likes').value = filters.min_likes || '10';
      $<HTMLInputElement>('edit-xreply-max-posts-per-day').value = filters.max_posts_per_day || '10';
      $<HTMLTextAreaElement>('edit-xreply-template').value = campaign.email_body || filters.template || '';
    } else if (campaign.kind === 'reddit') {
      const sec = $('edit-section-reddit');
      sec.classList.remove('hidden');
      sec.querySelectorAll('input, select, textarea').forEach(input => {
        (input as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).disabled = false;
      });
      $<HTMLInputElement>('edit-reddit-subreddits').value = filters.subreddits || '';
      $<HTMLTextAreaElement>('edit-reddit-template').value = campaign.email_body || filters.template || '';
    }
  } catch (err) {
    showError('Erreur de chargement des détails : ' + (err as Error).message);
  }
}

function initEditForm() {
  const form = $('form-edit-campaign') as HTMLFormElement;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const campaignId = $<HTMLInputElement>('edit-campaign-id').value;
    const kind = $<HTMLInputElement>('edit-campaign-kind').value;
    
    const formData = new FormData(form);
    const data: Record<string, any> = {};
    formData.forEach((value, key) => { data[key] = value; });
    
    // For email campaign, check outreach type manually
    if (kind === 'email') {
      const manualSection = $('edit-section-email-manual');
      data.type = manualSection.classList.contains('hidden') ? 'automated' : 'manual';
    }
    
    try {
      const res = await fetch(`/api/prospection/campaigns/${campaignId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update campaign');
      }
      
      alert('Campagne modifiée avec succès !');
      $('modal-edit-campaign').classList.add('hidden');
      
      // Reload dropdown based on campaign kind
      if (kind === 'email') {
        await loadTabCampaigns('email', 'email-campaign-select', loadEmails);
      } else if (kind === 'x_reply') {
        await loadTabCampaigns('x_reply', 'x-comment-campaign-select', loadXComments);
      } else if (kind === 'reddit') {
        await loadTabCampaigns('reddit', 'reddit-campaign-select', loadRedditPosts);
      }
    } catch (err) {
      showError('Erreur lors de la mise à jour : ' + (err as Error).message);
    }
  });

  const closeModal = () => $('modal-edit-campaign').classList.add('hidden');
  $('btn-close-edit-modal').addEventListener('click', closeModal);
  $('btn-cancel-edit-campaign').addEventListener('click', closeModal);
}

// --- Modals ---
function initModals() {
  const setupModal = (modalId: string, openBtnId: string, closeBtnId: string, cancelBtnId: string) => {
    const modal     = $(modalId);
    const openBtn   = $(openBtnId);
    const closeBtn  = $(closeBtnId);
    const cancelBtn = $(cancelBtnId);

    openBtn.addEventListener('click', () => modal.classList.remove('hidden'));
    const close = () => modal.classList.add('hidden');
    closeBtn.addEventListener('click', close);
    cancelBtn.addEventListener('click', close);
  };

  setupModal('modal-email-campaign',    'btn-new-email-campaign',    'btn-close-email-modal',    'btn-cancel-email-campaign');
  setupModal('modal-x-comment-campaign','btn-new-x-comment-campaign','btn-close-xcomment-modal', 'btn-cancel-xcomment-campaign');
  const btnNewXComment = $('btn-new-x-comment-campaign');
  if (btnNewXComment) {
    btnNewXComment.addEventListener('click', () => {
      populateXAccountsDropdown('campaign-x-account-select');
    });
  }
  setupModal('modal-reddit-campaign',   'btn-new-reddit-campaign',   'btn-close-reddit-modal',   'btn-cancel-reddit-campaign');

  // Email outreach type toggle
  const btnManual    = $('btn-toggle-email-manual');
  const btnAutomated = $('btn-toggle-email-automated');
  const manualFields    = $('email-manual-fields');
  const automatedFields = $('email-automated-fields');
  const outreachTypeInput = $<HTMLInputElement>('email-outreach-type');

  btnManual.addEventListener('click', () => {
    btnManual.classList.add('active'); btnAutomated.classList.remove('active');
    manualFields.classList.remove('hidden'); automatedFields.classList.add('hidden');
    outreachTypeInput.value = 'manual';
  });
  btnAutomated.addEventListener('click', () => {
    btnAutomated.classList.add('active'); btnManual.classList.remove('active');
    automatedFields.classList.remove('hidden'); manualFields.classList.add('hidden');
    outreachTypeInput.value = 'automated';

    // Pre-fill Sideloot automated outreach values
    const kwField = document.querySelector('#email-automated-fields textarea[name="linkedinKeywords"]') as HTMLTextAreaElement | null;
    const locField = document.querySelector('#email-automated-fields input[name="linkedinLocation"]') as HTMLInputElement | null;
    const funcField = document.querySelector('#email-automated-fields input[name="linkedinFunction"]') as HTMLInputElement | null;
    const limitField = document.querySelector('#email-automated-fields input[name="limit"]') as HTMLInputElement | null;
    
    const subField = document.querySelector('#form-email-campaign input[name="subject"]') as HTMLInputElement | null;
    const bodyField = document.querySelector('#form-email-campaign textarea[name="body"]') as HTMLTextAreaElement | null;
    const intervalField = document.querySelector('#form-email-campaign input[name="send_interval_minutes"]') as HTMLInputElement | null;

    if (kwField) {
      kwField.value = ''; // Empty keywords as we search by position/job title instead
    }
    if (locField) {
      locField.value = 'United States, Canada, Australia, United Kingdom, Singapore, Dubai';
    }
    if (funcField) {
      funcField.value = 'student, professor, marketer, sales representative, nurse, dentist, accountant, lawyer, designer, developer, copywriter, freelancer, entrepreneur, startup founder, real estate agent, architect, manager, recruiter, product manager, consultant, coach, artist, writer, editor, analyst, engineer, virtual assistant, social media manager, content creator, photographer, videographer, web designer, seo expert, translator, teacher, tutor, instructor, personal trainer, nutritionist, therapist, doctor, pharmacist, veterinarian, chef, baker, caterer, event planner, travel agent, advisor, specialist';
    }
    if (limitField) {
      limitField.value = '1000';
    }
    if (subField) {
      subField.value = 'Side business run by AI autonomously';
    }
    if (bodyField) {
      bodyField.value = `Hi {first_name},

I am Sideloot, an AI that launches and runs side businesses for you, 100% autonomously.

I imagine you've had at least 10 side business ideas you'd love to launch, but never had the time to actually execute them.

I took the liberty of reaching out because I thought this might resonate with you. If you're curious, check out my profile,  you'll find the website link here : www.sideloot.co

Would love to hear what you think.`;
    }
    if (intervalField) {
      intervalField.value = '1';
    }
  });

  const setupFormSubmit = (formId: string, modalId: string, kind: string, selectId: string, loadDataFn: (id: string) => void) => {
    const form = $(formId) as HTMLFormElement;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Read form data BEFORE disabling inputs, otherwise they won't be collected by FormData
      const formData = new FormData(form);
      const data: Record<string, any> = {};
      formData.forEach((value, key) => { data[key] = value; });
      data.kind = kind;

      const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;
      const originalText = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '⏳ Lancement...';
      }

      const inputs = form.querySelectorAll('input, textarea, select, button');
      inputs.forEach(el => (el as any).disabled = true);

      try {
        const response = await fetch('/api/prospection/campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Failed to launch campaign');
        }

        const result = await response.json();
        alert(result.message || 'Campagne lancée avec succès !');
        $(modalId).classList.add('hidden');
        form.reset();
        await loadTabCampaigns(kind, selectId, loadDataFn);
      } catch (err) {
        showError('Erreur lors du lancement : ' + (err as Error).message);
      } finally {
        inputs.forEach(el => (el as any).disabled = false);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        }
      }
    });
  };

  setupFormSubmit('form-email-campaign',    'modal-email-campaign',    'email',   'email-campaign-select',   loadEmails);
  setupFormSubmit('form-x-comment-campaign','modal-x-comment-campaign','x_reply', 'x-comment-campaign-select', loadXComments);
  setupFormSubmit('form-reddit-campaign',   'modal-reddit-campaign',   'reddit',  'reddit-campaign-select',  loadRedditPosts);

  // LinkedIn Leads Preview
  const btnPreview = $('btn-preview-leads');
  btnPreview.addEventListener('click', async () => {
    const form = $('form-email-campaign') as HTMLFormElement;
    const formData = new FormData(form);
    const linkedinKeywords = formData.get('linkedinKeywords') as string;
    const linkedinLocation = formData.get('linkedinLocation') as string;
    const linkedinFunction = formData.get('linkedinFunction') as string;

    const container = $('lead-preview-container');
    container.classList.remove('hidden');
    container.innerHTML = '<div class="preview-loading">Scraping LinkedIn en cours</div>';
    
    btnPreview.setAttribute('disabled', 'true');
    const originalText = btnPreview.innerHTML;
    btnPreview.innerHTML = '⚡ Chargement de la prévisualisation...';

    try {
      const response = await fetch('/api/prospection/scrape/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkedinKeywords, linkedinLocation, linkedinFunction })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to fetch preview');
      }

      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: var(--muted); padding: 10px;">Aucun profil trouvé. Vérifiez vos mots-clés.</div>';
      } else {
        container.innerHTML = data.map((p: any) => `
          <div class="preview-lead-item">
            <div class="preview-lead-name">${escapeHtml(p.name)}</div>
            <div class="preview-lead-role">${escapeHtml(p.functionName)}</div>
            <div class="preview-lead-meta-row">
              <span class="preview-meta-badge">${escapeHtml(p.location)}</span>
              <span class="preview-meta-badge ${p.email ? 'email-found' : 'email-missing'}">
                ${p.email ? escapeHtml(p.email) : 'Pas d\'email trouvé'}
              </span>
            </div>
          </div>
        `).join('');
      }
    } catch (err) {
      container.innerHTML = `<div style="color: var(--danger); text-align: center; padding: 10px;">Erreur: ${escapeHtml((err as Error).message)}</div>`;
    } finally {
      btnPreview.removeAttribute('disabled');
      btnPreview.innerHTML = originalText;
    }
  });

  // Paying Customers Modal
  const modalCustomers = $('modal-paying-customers');
  const btnShowSubs = $('btn-show-subscribers');
  
  btnShowSubs.addEventListener('click', () => {
    modalCustomers.classList.remove('hidden');
    const tbody = $('paying-customers-table-body');
    if (currentPayingCustomers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center muted" style="padding:20px;">Aucun abonné actif sur cette période.</td></tr>';
    } else {
      tbody.innerHTML = currentPayingCustomers.map(c => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid var(--border); font-weight: bold;">${escapeHtml(c.name)}</td>
          <td style="padding: 10px; border-bottom: 1px solid var(--border); font-family: monospace; font-size: 12px;">${escapeHtml(c.email)}</td>
          <td style="padding: 10px; border-bottom: 1px solid var(--border); font-size: 13px;">${escapeHtml(c.plan)}</td>
          <td style="padding: 10px; border-bottom: 1px solid var(--border); text-align: center;">
            <span class="multi-hire-badge" style="background-color: var(--success-bg); color: var(--success); border-color: var(--success); text-transform: uppercase; font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 4px; border: 1px solid;">
              ${escapeHtml(c.status)}
            </span>
          </td>
        </tr>
      `).join('');
    }
  });

  const closeCustomersModal = () => modalCustomers.classList.add('hidden');
  $('btn-close-customers-modal').addEventListener('click', closeCustomersModal);
  $('btn-close-customers-footer').addEventListener('click', closeCustomersModal);

  // Churned Customers Modal
  const modalChurned = $('modal-churned-customers');
  const btnShowChurn = $('btn-show-churn');
  
  btnShowChurn.addEventListener('click', () => {
    modalChurned.classList.remove('hidden');
    const tbody = $('churned-customers-table-body');
    if (currentChurnedCustomers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center muted" style="padding:20px;">Aucun client désabonné sur cette période.</td></tr>';
    } else {
      tbody.innerHTML = currentChurnedCustomers.map(c => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid var(--border); font-weight: bold;">${escapeHtml(c.name)}</td>
          <td style="padding: 10px; border-bottom: 1px solid var(--border); font-family: monospace; font-size: 12px;">${escapeHtml(c.email)}</td>
          <td style="padding: 10px; border-bottom: 1px solid var(--border); font-size: 13px;">${escapeHtml(c.plan)}</td>
          <td style="padding: 10px; border-bottom: 1px solid var(--border); text-align: center; font-family: monospace; font-size: 12px;">
            ${escapeHtml(c.canceled_at)}
          </td>
        </tr>
      `).join('');
    }
  });

  const closeChurnedModal = () => modalChurned.classList.add('hidden');
  $('btn-close-churn-modal').addEventListener('click', closeChurnedModal);
  $('btn-close-churn-footer').addEventListener('click', closeChurnedModal);
}


// =====================================================
// MESSAGE DRAWER
// =====================================================

let drawerCurrentThreadId: string | null = null;

function initDrawerKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      (window as any).closeMessageDrawer();
    }
    if (e.key === 'Enter' && !e.shiftKey && document.activeElement?.id === 'drawer-reply-input') {
      e.preventDefault();
      (window as any).sendDrawerReply();
    }
  });
}

function initDrawerStatusListener() {
  const statusSelect = $('drawer-status-select') as HTMLSelectElement;
  if (statusSelect) {
    statusSelect.addEventListener('change', async () => {
      if (!drawerCurrentThreadId) return;
      const status = statusSelect.value;
      try {
        const res = await fetch(`/api/prospection/thread/${drawerCurrentThreadId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status })
        });
        if (!res.ok) throw new Error('Failed to update status');
        // Reload emails to update the status tag in the table
        const emailSelect = $('email-campaign-select') as HTMLSelectElement;
        if (emailSelect && emailSelect.value) {
          loadEmails(emailSelect.value);
        }
      } catch (err) {
        showError('Erreur mise à jour statut : ' + (err as Error).message);
      }
    });
  }
}

// Open drawer with full email thread
async function openMessageDrawer(threadId: string, contactLabel: string, subject: string) {
  drawerCurrentThreadId = threadId;

  $('message-drawer-overlay').classList.remove('hidden');

  const initial = (contactLabel ? contactLabel[0] || '?' : '?').toUpperCase();
  $('drawer-avatar').textContent  = initial;
  $('drawer-contact').textContent = contactLabel;
  $('drawer-subject').textContent = subject || '(sans objet)';

  const bodyEl = $('drawer-messages');
  bodyEl.innerHTML = `
    <div class="msg-drawer-loading">
      <span class="msg-spinner"></span>
      <span>Chargement du fil...</span>
    </div>
  `;
  ($('drawer-reply-input') as HTMLTextAreaElement).value = '';

  // Show reply footer for emails
  const footer = document.querySelector('.msg-drawer-footer') as HTMLElement;
  if (footer) footer.style.display = '';

  try {
    const res = await fetch(`/api/prospection/thread/${threadId}`);
    if (!res.ok) throw new Error('Erreur chargement thread');
    const data = await res.json();
    renderThreadMessages(bodyEl, data.messages || []);
    bodyEl.scrollTop = bodyEl.scrollHeight;

    const statusSelect = $('drawer-status-select') as HTMLSelectElement;
    if (statusSelect && data.thread) {
      statusSelect.value = data.thread.status || 'new';
    }
    // Refresh the emails table in background (as opening automatically sets status to 'open')
    const emailSelect = $('email-campaign-select') as HTMLSelectElement;
    if (emailSelect && emailSelect.value) {
      loadEmails(emailSelect.value);
    }
  } catch (err) {
    bodyEl.innerHTML = `<div class="msg-drawer-empty">Erreur : ${escapeHtml((err as Error).message)}</div>`;
  }
}

// Open drawer for non-email items (single message)
function openSimpleDrawer(type: string, contact: string, bodyText: string, sentAt: string, direction: 'in' | 'out') {
  drawerCurrentThreadId = null;

  $('message-drawer-overlay').classList.remove('hidden');

  $('drawer-avatar').textContent  = (contact ? contact[0] || '?' : '?').toUpperCase();
  $('drawer-contact').textContent = contact;
  $('drawer-subject').textContent = type;

  const messagesEl = $('drawer-messages');
  const fakeMsg = {
    direction,
    from_address: direction === 'in' ? contact : 'grace@bigbangloot.xyz',
    body_text: bodyText,
    sent_at: sentAt
  };
  renderThreadMessages(messagesEl, [fakeMsg]);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  // Hide reply for non-email
  const footer = document.querySelector('.msg-drawer-footer') as HTMLElement;
  if (footer) footer.style.display = 'none';
}

function renderThreadMessages(container: HTMLElement, messages: any[]) {
  container.innerHTML = '';

  if (!messages || messages.length === 0) {
    container.innerHTML = '<div class="msg-drawer-empty">Aucun message dans ce fil.</div>';
    return;
  }

  let lastDay = '';

  messages.forEach((msg: any) => {
    const dir   = msg.direction === 'out' ? 'out' : 'in';
    const date  = msg.sent_at ? new Date(msg.sent_at) : new Date();
    const dayStr = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

    if (dayStr !== lastDay) {
      lastDay = dayStr;
      const sep = document.createElement('div');
      sep.className   = 'msg-day-separator';
      sep.textContent = dayStr;
      container.appendChild(sep);
    }

    const row   = document.createElement('div');
    row.className = `msg-bubble-row ${dir}`;

    const sender  = dir === 'out' ? (msg.from_address || 'grace@bigbangloot.xyz') : (msg.from_address || 'Prospect');
    const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    row.innerHTML = `
      <div class="msg-bubble">${escapeHtml(msg.body_text || '')}</div>
      <span class="msg-bubble-meta">${escapeHtml(sender)} · ${timeStr}</span>
    `;
    container.appendChild(row);
  });
}

// Close drawer
(window as any).closeMessageDrawer = function(event?: Event) {
  if (event && (event as MouseEvent).target !== document.getElementById('message-drawer-overlay')) return;
  $('message-drawer-overlay').classList.add('hidden');
  drawerCurrentThreadId = null;
  document.querySelectorAll('tr.msg-row-active').forEach(r => r.classList.remove('msg-row-active'));
  const footer = document.querySelector('.msg-drawer-footer') as HTMLElement;
  if (footer) footer.style.display = '';
};

// Send reply
(window as any).sendDrawerReply = async function() {
  if (!drawerCurrentThreadId) return;

  const textarea = $<HTMLTextAreaElement>('drawer-reply-input');
  const body = textarea.value.trim();
  if (!body) return;

  const btn     = $<HTMLButtonElement>('btn-send-reply');
  const btnText = $('btn-send-reply-text');
  btn.disabled = true;
  btnText.textContent = 'Envoi...';

  try {
    const res = await fetch('/api/prospection/email/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId: drawerCurrentThreadId, body })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur envoi');
    }

    textarea.value = '';

    // Reload thread
    const messagesEl = $('drawer-messages');
    const reloadRes  = await fetch(`/api/prospection/thread/${drawerCurrentThreadId}`);
    if (reloadRes.ok) {
      const data = await reloadRes.json();
      renderThreadMessages(messagesEl, data.messages || []);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  } catch (err) {
    showError('Erreur : ' + (err as Error).message);
  } finally {
    btn.disabled = false;
    btnText.textContent = 'Envoyer ↑';
  }
};

function highlightRow(row: HTMLTableRowElement) {
  document.querySelectorAll('tr.msg-row-active').forEach(r => r.classList.remove('msg-row-active'));
  row.classList.add('msg-row-active');
}


// --- Utilities ---

function formatCurrency(v: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  
  const dateStr = d.toLocaleDateString('fr-FR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return `${dateStr} ${timeStr}`;
}

function escapeHtml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showError(msg: string) {
  const box = $('errorBox');
  box.textContent = msg;
  box.classList.remove('hidden');
  setTimeout(() => box.classList.add('hidden'), 5000);
}

function initXAccountsConnector() {
  const btnConnectX = document.getElementById('btn-connect-x-account');
  if (btnConnectX) {
    btnConnectX.onclick = () => {
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      window.open(
        '/api/auth/x/login',
        'Lier un compte X',
        `width=${width},height=${height},left=${left},top=${top}`
      );
    };
  }

  // Reload accounts when message is received from OAuth callback popup
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'x_linked') {
      loadXAccounts();
    } else if (e.data && e.data.type === 'reddit_linked') {
      loadRedditAccountStatus();
    }
  });
}

// ---------- Reddit Zernio Connector ----------

async function loadRedditAccountStatus() {
  try {
    const response = await fetch('/api/auth/reddit/status');
    if (!response.ok) throw new Error('Failed to fetch Reddit status');
    const data = await response.json();

    const notLinkedEl = $('reddit-account-not-linked');
    const linkedEl = $('reddit-account-linked');

    if (data.linked) {
      notLinkedEl.style.display = 'none';
      linkedEl.style.display = 'block';
      $('reddit-username').textContent = `u/${data.displayName}`;
      loadRedditSubreddits();
    } else {
      notLinkedEl.style.display = 'block';
      linkedEl.style.display = 'none';
    }
  } catch (err) {
    console.error('Error loading Reddit account status:', err);
  }
}

async function loadRedditSubreddits() {
  const container = $('reddit-subreddits-container');
  container.innerHTML = '<p class="muted small" style="margin: 0; align-self: center;">Chargement des subreddits...</p>';
  $('reddit-subreddits-count').textContent = '0';

  try {
    const response = await fetch('/api/auth/reddit/subreddits');
    if (!response.ok) throw new Error('Failed to fetch subreddits');
    const data = await response.json();
    const list = data.subreddits || [];
    currentJoinedSubreddits = list;

    $('reddit-subreddits-count').textContent = String(list.length);

    if (list.length === 0) {
      container.innerHTML = '<p class="muted small" style="margin: 0; align-self: center;">Aucun subreddit trouvé.</p>';
      return;
    }

    container.innerHTML = '';
    list.forEach((sub: string) => {
      const badge = document.createElement('span');
      badge.className = 'skill-tag';
      badge.style.backgroundColor = '#ff4500';
      badge.style.color = 'white';
      badge.style.border = 'none';
      badge.style.fontSize = '11px';
      badge.style.padding = '4px 8px';
      badge.style.fontWeight = '600';
      badge.textContent = `r/${sub}`;
      container.appendChild(badge);
    });
  } catch (err) {
    container.innerHTML = `<p class="err small" style="margin: 0; align-self: center;">Erreur : ${(err as Error).message}</p>`;
  }
}
function initRedditAccountConnector() {
  try {
    const btnConnect = $('btn-connect-reddit') as HTMLButtonElement;
    btnConnect.onclick = () => {
      const width = 600;
      const height = 750;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      window.open(
        '/api/auth/reddit/login',
        'Lier un compte Reddit',
        `width=${width},height=${height},left=${left},top=${top}`
      );
    };
  } catch (e) {
    console.warn('Reddit connect button not found in current view');
  }

  try {
    const btnLogout = $('btn-logout-reddit') as HTMLButtonElement;
    btnLogout.onclick = async () => {
      if (!confirm('Voulez-vous déconnecter votre compte Reddit ?')) return;
      btnLogout.disabled = true;
      btnLogout.textContent = 'Déconnexion...';
      try {
        const res = await fetch('/api/auth/reddit/logout', { method: 'POST' });
        if (res.ok) {
          loadRedditAccountStatus();
        } else {
          throw new Error('Logout request failed');
        }
      } catch (err) {
        showError('Erreur de déconnexion Reddit : ' + (err as Error).message);
      } finally {
        btnLogout.disabled = false;
        btnLogout.textContent = 'Déconnecter';
      }
    };
  } catch (e) {
    console.warn('Reddit logout button not found in current view');
  }

  // Bind 'Tous les subreddits' buttons for Reddit Campaign Creation / Modification
  const setupAllSubredditsBtn = (btnId: string, inputId: string) => {
    try {
      const btn = $(btnId);
      btn.onclick = () => {
        if (currentJoinedSubreddits.length === 0) {
          alert("Aucun subreddit disponible. Connectez d'abord votre compte Reddit ou attendez sa synchronisation.");
          return;
        }
        const input = $(inputId) as HTMLInputElement;
        input.value = currentJoinedSubreddits.join(', ');
      };
    } catch (e) {
      // Ignored if button is not in DOM
    }
  };

  setupAllSubredditsBtn('btn-reddit-all-subreddits', 'create-reddit-subreddits');
  setupAllSubredditsBtn('btn-reddit-edit-all-subreddits', 'edit-reddit-subreddits');
}
