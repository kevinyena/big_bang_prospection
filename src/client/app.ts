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

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initDateFilters();
  initModals();
  initDrawerKeyboard();
  initDrawerStatusListener();

  // Initial load
  loadMetrics();
});

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
  switch (tabId) {
    case 'metrics':      loadMetrics(); break;
    case 'email':        loadTabCampaigns('email',   'email-campaign-select',   loadEmails); break;
    case 'x-dms':       loadTabCampaigns('x_dm',    'x-dm-campaign-select',    loadXDMs); break;
    case 'x-comments':  loadTabCampaigns('x_reply', 'x-comment-campaign-select', loadXComments); break;
    case 'reddit-posts': loadTabCampaigns('reddit',  'reddit-campaign-select',  loadRedditPosts); break;
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
    $('kpi-val-xdms-sent').textContent      = String(data.x_dms_sent);
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

  if (!campaignId) {
    const emptyInbound = '<tr><td colspan="4" class="text-center muted">Veuillez sélectionner ou lancer une campagne pour voir les emails.</td></tr>';
    const emptyOutbound = '<tr><td colspan="3" class="text-center muted">Veuillez sélectionner ou lancer une campagne pour voir les emails.</td></tr>';
    inboundBody.innerHTML  = emptyInbound;
    outboundBody.innerHTML = emptyOutbound;
    return;
  }

  try {
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
  }
}

// 3. X DMs
async function loadXDMs(campaignId: string) {
  const inboundBody  = $('xdm-inbound-table-body');
  const outboundBody = $('xdm-outbound-table-body');
  inboundBody.innerHTML  = '';
  outboundBody.innerHTML = '';

  if (!campaignId) {
    const empty = '<tr><td colspan="3" class="text-center muted">Veuillez sélectionner ou lancer une campagne pour voir les DMs.</td></tr>';
    inboundBody.innerHTML  = empty;
    outboundBody.innerHTML = empty;
    return;
  }

  try {
    const response = await fetch(`/api/prospection/xdms?campaignId=${campaignId}`);
    if (!response.ok) throw new Error('Failed to fetch X DMs');
    const dms = await response.json();

    const inbound  = dms.filter((d: any) => d.direction === 'in');
    const outbound = dms.filter((d: any) => d.direction === 'out');

    if (inbound.length === 0) {
      inboundBody.innerHTML = '<tr><td colspan="3" class="text-center muted">Aucun DM reçu.</td></tr>';
    } else {
      inbound.forEach((d: any) => {
        const row = document.createElement('tr');
        row.style.cursor = 'pointer';
        row.innerHTML = `
          <td><strong style="font-family:monospace">${escapeHtml(d.recipient_handle)}</strong></td>
          <td class="text-truncate" style="max-width:250px">${escapeHtml(d.body)}</td>
          <td><span class="muted small">${formatDate(d.sent_at)}</span></td>
        `;
        row.addEventListener('click', () => openSimpleDrawer('X DM reçu', d.recipient_handle, d.body, d.sent_at, 'in'));
        inboundBody.appendChild(row);
      });
    }

    if (outbound.length === 0) {
      outboundBody.innerHTML = '<tr><td colspan="3" class="text-center muted">Aucun DM envoyé.</td></tr>';
    } else {
      outbound.forEach((d: any) => {
        const row = document.createElement('tr');
        row.style.cursor = 'pointer';
        row.innerHTML = `
          <td><strong style="font-family:monospace">${escapeHtml(d.recipient_handle)}</strong></td>
          <td class="text-truncate" style="max-width:250px">${escapeHtml(d.body)}</td>
          <td><span class="muted small">${formatDate(d.sent_at)}</span></td>
        `;
        row.addEventListener('click', () => openSimpleDrawer('X DM envoyé', d.recipient_handle, d.body, d.sent_at, 'out'));
        outboundBody.appendChild(row);
      });
    }
  } catch (err) {
    showError('Error loading X DMs: ' + (err as Error).message);
  }
}

// 4. X Comments
async function loadXComments(campaignId: string) {
  const tbody = $('xcomments-table-body');
  tbody.innerHTML = '';

  if (!campaignId) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center muted">Veuillez sélectionner ou lancer une campagne pour voir les commentaires.</td></tr>';
    return;
  }

  try {
    const response = await fetch(`/api/prospection/xcomments?campaignId=${campaignId}`);
    if (!response.ok) throw new Error('Failed to fetch X comments');
    const comments = await response.json();

    if (comments.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center muted">Aucun commentaire répondu.</td></tr>';
      return;
    }

    comments.forEach((c: any) => {
      const row = document.createElement('tr');
      row.style.cursor = 'pointer';
      row.innerHTML = `
        <td><strong style="font-family:monospace">${escapeHtml(c.recipient)}</strong></td>
        <td class="text-truncate" style="max-width:350px">${escapeHtml(c.body)}</td>
        <td><span class="multi-hire-badge" style="background-color:var(--success-bg);color:var(--success);border-color:var(--success);">${escapeHtml(c.status)}</span></td>
        <td><span class="muted small">${formatDate(c.sent_at)}</span></td>
      `;
      row.addEventListener('click', () => openSimpleDrawer('Réponse X', c.recipient, c.body, c.sent_at, 'out'));
      tbody.appendChild(row);
    });
  } catch (err) {
    showError('Error loading X comments: ' + (err as Error).message);
  }
}

// 5. Reddit Posts
let allRedditPosts: any[] = [];

async function loadRedditPosts(campaignId: string) {
  const tbody = $('reddit-posts-table-body');
  tbody.innerHTML = '';

  if (!campaignId) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center muted">Veuillez sélectionner ou lancer une campagne pour voir les posts Reddit.</td></tr>';
    return;
  }

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
  } catch (err) {
    showError('Error loading Reddit posts: ' + (err as Error).message);
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
    tbody.innerHTML = '<tr><td colspan="4" class="text-center muted">Aucun post Reddit trouvé.</td></tr>';
    return;
  }

  filtered.forEach((p: any) => {
    const row = document.createElement('tr');
    row.style.cursor = 'pointer';
    row.innerHTML = `
      <td><span class="skill-tag">${escapeHtml(p.subreddit)}</span></td>
      <td class="text-truncate" style="max-width:350px">${escapeHtml(p.body)}</td>
      <td><span class="multi-hire-badge" style="background-color:var(--accent-light);color:var(--accent);border-color:var(--accent);">${escapeHtml(p.status)}</span></td>
      <td><span class="muted small">${formatDate(p.sent_at)}</span></td>
    `;
    row.addEventListener('click', () => openSimpleDrawer('Post Reddit', 'r/' + p.subreddit, p.body, p.sent_at, 'out'));
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
      if (deleteBtn) {
        deleteBtn.style.opacity = '0.5';
        deleteBtn.disabled = true;
      }
      loadDataFn('');
      return;
    }

    campaigns.forEach((c: any) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      select.appendChild(opt);
    });

    const updateDeleteBtnState = () => {
      if (deleteBtn) {
        if (!select.value || select.value === 'none') {
          deleteBtn.style.opacity = '0.5';
          deleteBtn.disabled = true;
        } else {
          deleteBtn.style.opacity = '1';
          deleteBtn.disabled = false;
        }
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
  setupModal('modal-x-dm-campaign',     'btn-new-x-dm-campaign',     'btn-close-xdm-modal',      'btn-cancel-xdm-campaign');
  setupModal('modal-x-comment-campaign','btn-new-x-comment-campaign','btn-close-xcomment-modal', 'btn-cancel-xcomment-campaign');
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
  });

  const setupFormSubmit = (formId: string, modalId: string, kind: string, selectId: string, loadDataFn: (id: string) => void) => {
    const form = $(formId) as HTMLFormElement;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const data: Record<string, any> = {};
      formData.forEach((value, key) => { data[key] = value; });
      data.kind = kind;

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
      }
    });
  };

  setupFormSubmit('form-email-campaign',    'modal-email-campaign',    'email',   'email-campaign-select',   loadEmails);
  setupFormSubmit('form-x-dm-campaign',     'modal-x-dm-campaign',     'x_dm',   'x-dm-campaign-select',    loadXDMs);
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
    from_address: direction === 'in' ? contact : 'grace@sideloot.xyz',
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

    const sender  = dir === 'out' ? (msg.from_address || 'grace@sideloot.xyz') : (msg.from_address || 'Prospect');
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
