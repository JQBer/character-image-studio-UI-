/**
 * Character Image Studio — Frontend
 *
 * API field names per SKILL.md:
 *   seed:       { prompt, aspect_ratio } → { generation_id, status, credits_used }
 *   create:     { prompt, reference_image_urls[], input_image_url } → { generation_id }
 *   random:     { reference_image_urls[], character_description } → { generation_id }
 *   turnaround: { seed_image_url, prompts[], reference_image_urls[] } → { images[{generation_id}] }
 *   asset/status/{gen_id}: { generation_id, status, download_available }
 *   asset/download/{gen_id}: { download_url }
 *   credits/pricing: [{ endpoint, credits_per_call, credits_per_image }]
 *   payments/checkout: { bundle_id } → { payment_id, payment_url }
 *   payments/bundles: { bundles[{id, name, credits, price_in_usd}] }
 */

// ══════════ CONSTANTS ══════════
const DEFAULT_TURNAROUND_PROMPTS = [
  "in the same style and medium as the reference image, this character seen from the front, full body, standing in a relaxed pose, clean even lighting, simple background",
  "in the same style and medium as the reference image, this character seen from the left side, full body, neutral pose, clean even lighting, simple background",
  "in the same style and medium as the reference image, this character seen from behind, full body, simple background, even lighting",
  "in the same style and medium as the reference image, this character seen from the right side, full body, neutral standing pose, simple background",
  "in the same style and medium as the reference image, this character in a three-quarter view from the front-left, medium distance, neutral lighting",
  "in the same style and medium as the reference image, close up on this character's face, head and shoulders, detailed features visible, clean lighting",
  "in the same style and medium as the reference image, close up on this character's face from a slight angle, warm lighting",
  "in the same style and medium as the reference image, this character's face in dramatic side lighting, close up, simple background",
  "in the same style and medium as the reference image, this character sitting casually, full body visible, relaxed pose, neutral background",
  "in the same style and medium as the reference image, this character crouching down, seen from a slight angle, neutral lighting, simple background",
  "in the same style and medium as the reference image, this character with arms crossed, confident pose, front view, medium distance",
  "in the same style and medium as the reference image, this character walking, mid-stride, seen from the side, clean lighting",
  "in the same style and medium as the reference image, this character looking up, seen from a low angle, dramatic perspective",
  "in the same style and medium as the reference image, this character seen from above, looking up at the camera, interesting angle",
  "in the same style and medium as the reference image, full body of this character in warm golden light, simple background",
  "in the same style and medium as the reference image, this character in cool blue lighting, medium shot, moody atmosphere",
  "in the same style and medium as the reference image, this character in dramatic rim lighting, dark background, silhouette edge visible",
  "in the same style and medium as the reference image, this character leaning against something, casual pose, three-quarter view",
  "in the same style and medium as the reference image, this character in an action pose, dynamic angle, full body visible",
  "in the same style and medium as the reference image, this character in natural outdoor lighting, full body, relaxed stance, simple environment"
];

// ══════════ STATE ══════════
let selectedBundleId = null;
let cachedCharacters = [];
const uploadedFiles = {
  setchar: null // single base64 data URL for seed image
};

// ══════════ INIT ══════════
document.addEventListener('DOMContentLoaded', () => {
  // Auth
  document.getElementById('btn-register').addEventListener('click', doRegister);
  document.getElementById('btn-login').addEventListener('click', doLogin);

  // Nav tabs
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => switchPanel(tab.dataset.panel));
  });

  // Generation type tabs
  document.querySelectorAll('.gen-tab').forEach(tab => {
    tab.addEventListener('click', () => selectGenType(tab.dataset.type));
  });

  // Generation buttons
  document.getElementById('btn-gen-setchar').addEventListener('click', generateSetChar);
  document.getElementById('btn-gen-generate').addEventListener('click', generateWithCharacter);
  document.getElementById('btn-gen-random').addEventListener('click', generateRandom);

  // Credits
  document.getElementById('btn-buy').addEventListener('click', buySelected);
  document.getElementById('btn-refresh-balance').addEventListener('click', refreshBalance);

  // Account
  document.getElementById('btn-export-creds').addEventListener('click', exportCredentials);
  document.getElementById('btn-rotate-secret').addEventListener('click', rotateSecret);
  document.getElementById('btn-logout').addEventListener('click', doLogout);

  // File upload — only SetChar seed image
  setupFileUpload('setchar-upload-zone', 'setchar-file-input', 'setchar-upload-preview', 'setchar', false);

  // Try auto-login
  tryAutoLogin();
});

// ══════════ FILE UPLOAD ══════════
function setupFileUpload(zoneId, inputId, previewId, storeKey, multiple) {
  const zone = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  if (!zone || !input) return;
  const preview = document.getElementById(previewId);

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files, storeKey, multiple, preview);
  });
  input.addEventListener('change', () => {
    handleFiles(input.files, storeKey, multiple, preview);
    input.value = '';
  });
}

function handleFiles(files, storeKey, multiple, previewEl) {
  const fileArray = Array.from(files);
  if (!fileArray.length) return;

  fileArray.forEach(file => {
    if (!file.type.startsWith('image/')) {
      toast('Only image files are accepted', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result;
      if (multiple) {
        if (!uploadedFiles[storeKey]) uploadedFiles[storeKey] = [];
        uploadedFiles[storeKey].push(base64);
      } else {
        uploadedFiles[storeKey] = base64;
      }
      renderUploadPreview(storeKey, previewEl, multiple);
    };
    reader.readAsDataURL(file);
  });
}

function renderUploadPreview(storeKey, previewEl, multiple) {
  if (!previewEl) return;
  let html = '';
  if (multiple) {
    const files = uploadedFiles[storeKey] || [];
    if (files.length === 0) { previewEl.innerHTML = ''; return; }
    html = files.map((f, i) =>
      `<div style="display:inline-block;margin:4px;position:relative;">
        <img src="${f}" style="width:80px;height:80px;object-fit:cover;border-radius:6px;border:1px solid var(--border);">
        <button onclick="removeUpload('${storeKey}',${i})" style="position:absolute;top:-4px;right:-4px;width:18px;height:18px;border-radius:50%;background:var(--accent);color:#fff;border:none;cursor:pointer;font-size:10px;line-height:18px;">×</button>
      </div>`
    ).join('');
  } else {
    const file = uploadedFiles[storeKey];
    if (!file) { previewEl.innerHTML = ''; return; }
    html = `<div style="display:inline-block;margin:4px;position:relative;">
      <img src="${file}" style="max-width:200px;max-height:200px;border-radius:6px;border:1px solid var(--border);">
      <button onclick="removeUpload('${storeKey}',-1)" style="position:absolute;top:-4px;right:-4px;width:18px;height:18px;border-radius:50%;background:var(--accent);color:#fff;border:none;cursor:pointer;font-size:10px;line-height:18px;">×</button>
    </div>`;
  }
  previewEl.innerHTML = html;
}

function removeUpload(storeKey, index) {
  if (index >= 0) {
    uploadedFiles[storeKey].splice(index, 1);
  } else {
    uploadedFiles[storeKey] = null;
  }
  const previewEl = document.getElementById(storeKey + '-upload-preview');
  const multiple = index >= 0;
  renderUploadPreview(storeKey, previewEl, multiple);
}

// ══════════ AUTH ══════════
async function tryAutoLogin() {
  try {
    const res = await fetch('/api/auto-login', { method: 'POST' });
    const data = await res.json();
    if (data.success) enterApp(data.client_id);
  } catch { /* stay on auth */ }
}

async function doRegister() {
  const btn = document.getElementById('btn-register');
  btn.disabled = true;
  btn.textContent = 'Creating...';
  try {
    const res = await fetch('/api/register', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      document.getElementById('new-cred-id').textContent = data.client_id || '—';
      document.getElementById('new-cred-secret').textContent = data.client_secret || '(not returned)';
      document.getElementById('creds-modal').classList.add('active');
      enterApp(data.client_id);
      toast('Account created!', 'success');
    } else {
      toast('Registration failed: ' + (data.error || 'unknown'), 'error');
    }
  } catch (e) {
    toast('Network error: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create New Account';
  }
}

async function doLogin() {
  const clientId = document.getElementById('auth-client-id').value.trim();
  const clientSecret = document.getElementById('auth-client-secret').value.trim();
  if (!clientId || !clientSecret) { toast('Enter Client ID and Secret', 'warning'); return; }

  const btn = document.getElementById('btn-login');
  btn.disabled = true;
  btn.textContent = 'Logging in...';
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret })
    });
    const data = await res.json();
    if (data.success) {
      enterApp(clientId);
      toast('Logged in!', 'success');
    } else {
      toast('Login failed: ' + (data.error || 'invalid credentials'), 'error');
    }
  } catch (e) {
    toast('Network error: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Log In';
  }
}

function enterApp(clientId) {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
  if (clientId) {
    const short = clientId.length > 16 ? clientId.slice(0, 8) + '...' + clientId.slice(-4) : clientId;
    document.getElementById('account-id-display').textContent = short;
  }
  refreshBalance();
  loadBundles();
  loadPricing();
  loadMe();
  loadCredentials();
  loadTransactions();
  loadCharacters();
  loadGallery();
}

async function doLogout() {
  if (!confirm('Log out? You will need your credentials to log back in.')) return;
  await fetch('/api/logout', { method: 'POST' });
  location.reload();
}

// ══════════ BALANCE ══════════
async function refreshBalance() {
  try {
    const res = await fetch('/api/balance');
    const data = await res.json();
    const bal = data.balance ?? data.credits ?? data.data?.balance ?? '—';
    document.getElementById('credit-balance').textContent = bal;
    const dBal = document.getElementById('dash-balance');
    if (dBal) dBal.textContent = bal;
    const cBal = document.getElementById('credits-balance');
    if (cBal) cBal.textContent = bal;
  } catch { /* silent */ }
}

// ══════════ ACCOUNT ══════════
async function loadMe() {
  try {
    const res = await fetch('/api/me');
    const data = await res.json();
    const me = data.data || data;
    const container = document.getElementById('account-details');
    let html = '<div class="stats-row">';
    if (me.client_id) html += `<div class="stat-box"><div class="stat-label">Client ID</div><div class="stat-value" style="font-size:0.75rem;word-break:break-all;">${esc(me.client_id)}</div></div>`;
    if (me.tier) {
      html += `<div class="stat-box"><div class="stat-label">Tier</div><div class="stat-value yellow">${esc(me.tier)}</div></div>`;
      const dt = document.getElementById('dash-tier');
      if (dt) dt.textContent = me.tier;
    }
    if (me.balance !== undefined) html += `<div class="stat-box"><div class="stat-label">Balance</div><div class="stat-value red">${me.balance}</div></div>`;
    html += '</div>';
    container.innerHTML = html;
  } catch {
    document.getElementById('account-details').innerHTML = '<p class="text-dim">Could not load account info.</p>';
  }
}

async function loadCredentials() {
  try {
    const res = await fetch('/api/export-credentials');
    const data = await res.json();
    if (data.client_id) document.getElementById('cred-client-id').textContent = data.client_id;
    if (data.client_secret) document.getElementById('cred-client-secret').textContent = data.client_secret;
    else document.getElementById('cred-client-secret').textContent = '••••••••';
  } catch { /* silent */ }
}

async function exportCredentials() {
  try {
    const res = await fetch('/api/export-credentials');
    const data = await res.json();
    const text = `Client ID: ${data.client_id}\nClient Secret: ${data.client_secret}`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cis-credentials.txt';
    a.click();
    URL.revokeObjectURL(url);
    toast('Credentials exported', 'success');
  } catch (e) {
    toast('Export failed: ' + e.message, 'error');
  }
}

async function rotateSecret() {
  toast('Secret rotation not yet supported', 'warning');
}

// ══════════ BUNDLES & PAYMENTS ══════════
async function loadBundles() {
  try {
    const res = await fetch('/api/bundles');
    const data = await res.json();
    const bundles = data.bundles || data.data?.bundles || [];
    const grid = document.getElementById('bundles-grid');
    if (!bundles.length) {
      grid.innerHTML = '<p class="text-dim">No bundles available.</p>';
      return;
    }
    grid.innerHTML = bundles.map((b) => {
      const price = b.price_in_usd !== undefined ? `$${Number(b.price_in_usd).toFixed(2)}` : '—';
      return `<div class="bundle-card" data-bundle-id="${b.id}" onclick="selectBundle(${b.id})">
        <div class="bundle-name">${esc(b.name || 'Bundle')}</div>
        <div class="bundle-price">${price}</div>
        <div class="bundle-credits">${b.credits || '—'} credits</div>
        ${b.description ? `<div class="bundle-desc">${esc(b.description)}</div>` : ''}
      </div>`;
    }).join('');
    renderDashPricing(bundles);
  } catch {
    document.getElementById('bundles-grid').innerHTML = '<p class="text-dim">Failed to load bundles.</p>';
  }
}

function renderDashPricing(bundles) {
  const el = document.getElementById('dash-pricing');
  if (!el) return;
  let html = '<table class="tx-table"><thead><tr><th>Bundle</th><th>Credits</th><th>Price</th></tr></thead><tbody>';
  bundles.forEach(b => {
    const price = b.price_in_usd !== undefined ? `$${Number(b.price_in_usd).toFixed(2)}` : '—';
    html += `<tr><td>${esc(b.name || 'Bundle')}</td><td>${b.credits || '—'}</td><td>${price}</td></tr>`;
  });
  html += '</tbody></table>';
  el.innerHTML = html;
}

function selectBundle(id) {
  selectedBundleId = id;
  document.querySelectorAll('.bundle-card').forEach(c => c.classList.remove('selected'));
  const card = document.querySelector(`.bundle-card[data-bundle-id="${id}"]`);
  if (card) card.classList.add('selected');
  document.getElementById('btn-buy').disabled = false;
}

async function buySelected() {
  if (!selectedBundleId) { toast('Select a bundle first', 'warning'); return; }
  const modal = document.getElementById('payment-modal');
  modal.classList.add('active');
  document.getElementById('payment-modal-content').innerHTML = '<p class="mb-16">Creating checkout...</p><div class="spinner"></div>';
  try {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bundle_id: selectedBundleId })
    });
    const data = await res.json();
    const checkout = data.data || data;
    const paymentUrl = checkout.payment_url || checkout.checkout_url || checkout.url;
    if (paymentUrl) {
      document.getElementById('payment-modal-content').innerHTML = `
        <p class="mb-16">Redirecting to Stripe checkout...</p>
        <p class="mb-16"><a href="${esc(paymentUrl)}" target="_blank" class="btn btn-primary btn-large">Open Payment Page</a></p>
        <p class="text-dim" style="font-size:0.75rem;">If the page didn't open, click the button above.</p>
      `;
      window.open(paymentUrl, '_blank');
    } else {
      document.getElementById('payment-modal-content').innerHTML = `<p class="text-red">No payment URL returned.</p>`;
    }
  } catch (e) {
    document.getElementById('payment-modal-content').innerHTML = `<p class="text-red">Error: ${esc(e.message)}</p>`;
  }
}

// ══════════ PRICING ══════════
async function loadPricing() {
  try {
    const res = await fetch('/api/pricing');
    const data = await res.json();
    const pricing = Array.isArray(data) ? data : (data.pricing || data.data || []);
    const el = document.getElementById('pricing-table');
    if (!Array.isArray(pricing) || pricing.length === 0) {
      el.innerHTML = '<p class="text-dim">No pricing data.</p>';
      return;
    }
    const labels = {
      create: 'Generate',
      turnaround: 'SetChar',
      random: 'Random'
    };
    let html = '<table class="tx-table"><thead><tr><th>Type</th><th>Credits per Image</th></tr></thead><tbody>';
    pricing.filter(p => p.endpoint !== 'seed').forEach(p => {
      const name = labels[p.endpoint] || p.endpoint || '—';
      const cost = p.credits_per_image ?? p.credits_per_call ?? '—';
      const note = p.endpoint === 'turnaround' ? ` <span style="color:var(--text-3);font-size:0.72rem;">(×20 refs = ~200)</span>` : '';
      html += `<tr><td>${esc(name)}${note}</td><td>${cost}</td></tr>`;
    });
    html += '</tbody></table>';
    el.innerHTML = html;
  } catch {
    document.getElementById('pricing-table').innerHTML = '<p class="text-dim">Could not load pricing.</p>';
  }
}

// ══════════ TRANSACTIONS ══════════
async function loadTransactions() {
  try {
    const res = await fetch('/api/transactions');
    const data = await res.json();
    const txs = data.transactions || data.data?.transactions || [];
    const el = document.getElementById('tx-history');
    if (!txs.length) { el.innerHTML = '<p class="text-dim">No transactions yet.</p>'; return; }
    let html = '<table class="tx-table"><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Balance</th></tr></thead><tbody>';
    txs.forEach(tx => {
      const date = tx.created_at ? new Date(tx.created_at).toLocaleDateString() : '—';
      const amount = tx.amount || tx.credits || 0;
      const cls = amount >= 0 ? 'tx-positive' : 'tx-negative';
      const sign = amount >= 0 ? '+' : '';
      html += `<tr><td>${date}</td><td>${esc(tx.type || tx.description || '—')}</td><td class="${cls}">${sign}${amount}</td><td>${tx.balance_after ?? tx.balance ?? '—'}</td></tr>`;
    });
    html += '</tbody></table>';
    el.innerHTML = html;
  } catch {
    document.getElementById('tx-history').innerHTML = '<p class="text-dim">Could not load transactions.</p>';
  }
}

// ══════════ CHARACTERS ══════════
async function loadCharacters() {
  try {
    const res = await fetch('/api/characters');
    const data = await res.json();
    cachedCharacters = data.characters || [];
    populateCharacterSelects();
    renderMyCharacters();
  } catch { cachedCharacters = []; }
}

function populateCharacterSelects() {
  const el = document.getElementById('generate-character-select');
  if (el) {
    const current = el.value;
    el.innerHTML = '<option value="">— Select a character —</option>';
    cachedCharacters.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.slug;
      opt.textContent = `${c.name} (${c.reference_count || 0} refs)`;
      el.appendChild(opt);
    });
    if (current) el.value = current;
  }
  const hasChars = cachedCharacters.length > 0;
  const noGen = document.getElementById('generate-no-chars');
  if (noGen) noGen.style.display = hasChars ? 'none' : 'block';
}

function renderMyCharacters() {
  const section = document.getElementById('my-characters-section');
  if (!section) return;
  if (cachedCharacters.length === 0) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  const grid = document.getElementById('my-characters-grid');
  grid.innerHTML = cachedCharacters.map(c => {
    // Use local image if available, fallback to remote URL
    const localFiles = c.local_files || [];
    const thumb = localFiles.length > 0
      ? `/api/characters/${encodeURIComponent(c.slug)}/images/${localFiles[0]}`
      : (c.reference_urls && c.reference_urls.length > 0 ? c.reference_urls[0] : (c.seed_url || ''));
    return `<div class="char-card">
      <div class="char-card-img-wrap">
        ${thumb ? `<img src="${esc(thumb)}" alt="${esc(c.name)}" class="char-card-img" loading="lazy">` : '<div style="width:130px;height:130px;display:flex;align-items:center;justify-content:center;color:var(--text-2);font-size:0.75rem;">No image</div>'}
        <div class="char-card-overlay">
          <button onclick="openCharFolder('${esc(c.slug)}')">📁 Folder</button>
          <button onclick="viewCharacterRefs('${esc(c.slug)}')">👁 Refs</button>
          <button onclick="deleteCharacterEntry('${esc(c.slug)}')" style="border-color:var(--accent);">✕</button>
        </div>
      </div>
      <div class="char-card-body">
        <div class="char-card-name" title="${esc(c.name)}">${esc(c.name)}</div>
        <div class="char-card-meta">${c.reference_count || 0} references</div>
      </div>
    </div>`;
  }).join('');
}

async function deleteCharacterEntry(slug) {
  if (!confirm('Delete this character and all its references?')) return;
  try {
    await fetch('/api/characters/' + encodeURIComponent(slug), { method: 'DELETE' });
    toast('Character deleted', 'success');
    loadCharacters();
  } catch (e) {
    toast('Delete failed: ' + e.message, 'error');
  }
}

async function openCharFolder(slug) {
  try {
    const res = await fetch('/api/characters/' + encodeURIComponent(slug) + '/open-folder', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      toast('Opened folder: ' + data.path, 'success');
    } else {
      toast('Folder: ' + (data.path || 'unknown'), 'warning');
    }
  } catch (e) {
    toast('Could not open folder: ' + e.message, 'error');
  }
}

function viewCharacterRefs(slug) {
  const char = cachedCharacters.find(c => c.slug === slug);
  if (!char) return;
  const localFiles = char.local_files || [];
  const urls = char.reference_urls || [];

  let html = `<div style="position:fixed;inset:0;z-index:6000;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px);display:flex;flex-direction:column;overflow-y:auto;padding:20px;">`;
  html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;position:sticky;top:0;z-index:1;">`;
  html += `<h3 style="color:var(--text-0);font-size:1rem;">${esc(char.name)} — ${urls.length} References</h3>`;
  html += `<button onclick="this.closest('div[style*=fixed]').remove()" style="background:var(--bg-3);border:1px solid var(--border);border-radius:8px;color:var(--text-1);padding:8px 16px;cursor:pointer;font-size:0.8rem;font-family:var(--font);">Close ✕</button></div>`;
  html += '<div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;">';
  urls.forEach((url, i) => {
    const src = localFiles[i]
      ? `/api/characters/${encodeURIComponent(slug)}/images/${localFiles[i]}`
      : url;
    html += `<div style="width:180px;">
      <a href="${esc(url)}" target="_blank"><img src="${esc(src)}" alt="Ref ${i + 1}" style="width:180px;height:180px;object-fit:cover;border-radius:10px;border:1px solid var(--border);display:block;" loading="lazy"></a>
      <div style="text-align:center;font-size:0.65rem;color:var(--text-3);margin-top:4px;">ref_${String(i+1).padStart(2,'0')}</div>
    </div>`;
  });
  html += '</div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

// ══════════ GENERATION ══════════

async function generateSetChar() {
  const name = document.getElementById('setchar-name').value.trim();
  if (!name) { toast('Enter a character name', 'warning'); return; }

  let seedImageUrl = uploadedFiles.setchar || '';
  if (!seedImageUrl) {
    seedImageUrl = document.getElementById('setchar-seed-url').value.trim();
  }
  if (!seedImageUrl) { toast('Upload a seed image or enter a URL', 'warning'); return; }

  if (!confirm(`Creating "${name}" will generate 20 reference images.\nThis costs ~200 credits and takes 2-3 minutes.\n\nProceed?`)) return;

  const btn = document.getElementById('btn-gen-setchar');
  btn.disabled = true;
  showGenProgress('Starting character creation — this takes 2-3 minutes...');

  try {
    const res = await fetch('/api/generate/turnaround', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seed_image_url: seedImageUrl,
        prompts: DEFAULT_TURNAROUND_PROMPTS,
        reference_image_urls: []
      })
    });
    const data = await res.json();
    if (data.error) { toast('Error: ' + data.error, 'error'); hideGenProgress(); btn.disabled = false; return; }

    const gen = data.data || data;
    const images = gen.images || [];
    if (images.length === 0) { toast('No images in turnaround response', 'error'); hideGenProgress(); btn.disabled = false; return; }

    const genIds = images.map(img => img.generation_id || img.id).filter(Boolean);
    if (genIds.length === 0) { toast('No generation IDs returned', 'error'); hideGenProgress(); btn.disabled = false; return; }

    // Poll all 20 images
    const referenceUrls = await pollSetCharBatch(genIds);

    if (referenceUrls.length === 0) {
      toast('No images completed successfully', 'error');
      hideGenProgress();
      btn.disabled = false;
      return;
    }

    // Save character to server
    const saveRes = await fetch('/api/characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name,
        seed_url: seedImageUrl.startsWith('data:') ? '' : seedImageUrl,
        reference_urls: referenceUrls
      })
    });
    const saveData = await saveRes.json();

    if (saveData.success) {
      toast(`Character "${name}" created with ${referenceUrls.length} reference images!`, 'success');
      loadCharacters();
      refreshBalance();
      showSetCharResult(name, referenceUrls);
    } else {
      toast('Save failed: ' + (saveData.error || 'unknown'), 'error');
    }
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  } finally {
    hideGenProgress();
    btn.disabled = false;
  }
}

async function generateWithCharacter() {
  const select = document.getElementById('generate-character-select');
  const slug = select.value;
  if (!slug) { toast('Select a character', 'warning'); return; }

  const prompt = document.getElementById('generate-prompt').value.trim();
  if (!prompt) { toast('Enter a scene prompt', 'warning'); return; }

  const char = cachedCharacters.find(c => c.slug === slug);
  if (!char || !char.reference_urls || char.reference_urls.length === 0) {
    toast('Character has no reference images', 'error');
    return;
  }

  const btn = document.getElementById('btn-gen-generate');
  btn.disabled = true;
  showGenProgress('Generating image with ' + char.name + '...');

  try {
    const res = await fetch('/api/generate/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt,
        reference_image_urls: char.reference_urls.slice(0, 15),
        input_image_url: null
      })
    });
    const data = await res.json();
    if (data.error) { toast('Error: ' + data.error, 'error'); hideGenProgress(); return; }
    const gen = data.data || data;
    const genId = gen.generation_id || gen.id;
    if (genId) {
      pollGeneration(genId);
    } else {
      toast('No generation ID returned', 'error');
      hideGenProgress();
    }
  } catch (e) {
    toast('Error: ' + e.message, 'error');
    hideGenProgress();
  } finally {
    btn.disabled = false;
  }
}

async function generateRandom() {
  const select = document.getElementById('generate-character-select');
  const slug = select.value;
  if (!slug) { toast('Select a character first', 'warning'); return; }

  const char = cachedCharacters.find(c => c.slug === slug);
  if (!char || !char.reference_urls || char.reference_urls.length === 0) {
    toast('Character has no reference images', 'error');
    return;
  }

  const btn = document.getElementById('btn-gen-random');
  btn.disabled = true;
  showGenProgress('Generating random scene with ' + char.name + '...');

  try {
    const res = await fetch('/api/generate/random', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reference_image_urls: char.reference_urls.slice(0, 15),
        character_description: char.name
      })
    });
    const data = await res.json();
    if (data.error) { toast('Error: ' + data.error, 'error'); hideGenProgress(); return; }
    const gen = data.data || data;
    const genId = gen.generation_id || gen.id;
    if (genId) {
      pollGeneration(genId);
    } else {
      toast('No generation ID returned', 'error');
      hideGenProgress();
    }
  } catch (e) {
    toast('Error: ' + e.message, 'error');
    hideGenProgress();
  } finally {
    btn.disabled = false;
  }
}

// ══════════ PROGRESS ══════════
function showGenProgress(text) {
  const result = document.getElementById('gen-result');
  result.classList.remove('hidden');
  document.getElementById('gen-progress-container').classList.remove('hidden');
  document.getElementById('gen-result-content').innerHTML = '';
  setProgress(5, text);
}

function hideGenProgress() {
  document.getElementById('gen-progress-container').classList.add('hidden');
}

function setProgress(pct, text) {
  document.getElementById('gen-progress-bar').style.width = pct + '%';
  document.getElementById('gen-progress-text').textContent = text || '';
}

// ══════════ POLLING ══════════
async function pollGeneration(generationId) {
  const maxAttempts = 120;
  const statusMessages = [
    'Warming up the AI...',
    'Composing your scene...',
    'Painting the details...',
    'Rendering final touches...',
    'Almost there...'
  ];

  for (let attempts = 1; attempts <= maxAttempts; attempts++) {
    const pct = Math.min(95, 5 + (attempts / maxAttempts) * 90);
    const msgIndex = Math.min(statusMessages.length - 1, Math.floor((pct / 100) * statusMessages.length));
    setProgress(pct, `${statusMessages[msgIndex]} ${Math.round(pct)}%`);

    try {
      const res = await fetch(`/api/asset/status/${generationId}`);
      const data = await res.json();
      const st = data.data || data;
      const status = st.status || 'pending';
      if (status === 'completed' || status === 'succeeded' || status === 'done') {
        setProgress(100, 'Done! Loading your image...');
        setTimeout(() => hideGenProgress(), 800);
        showResult(generationId);
        refreshBalance();
        return;
      } else if (status === 'failed' || status === 'error') {
        toast('Generation failed: ' + (st.error_message || st.error || 'unknown'), 'error');
        hideGenProgress();
        return;
      }
    } catch { /* retry next round */ }

    await new Promise(r => setTimeout(r, 2500));
  }

  toast('Generation timed out — try again', 'warning');
  hideGenProgress();
}

function pollSetCharBatch(genIds) {
  return new Promise(async (resolve) => {
    const maxAttempts = 90; // 90 rounds × 10s pause = 15 minutes max
    const completed = {};
    const failed = new Set();

    for (let attempts = 1; attempts <= maxAttempts; attempts++) {
      const doneCount = Object.keys(completed).length + failed.size;
      const pct = Math.min(95, 5 + (doneCount / genIds.length) * 90);
      const readyCount = Object.keys(completed).length;
      const phaseText = readyCount === 0 ? 'Generating reference images...' :
                        readyCount < 10 ? 'Building character profile...' :
                        readyCount < 18 ? 'Finishing up references...' : 'Almost done...';
      setProgress(pct, `${phaseText} ${readyCount}/${genIds.length} ready`);

      // Poll each pending ID sequentially (rate-limit safe)
      for (const gid of genIds) {
        if (completed[gid] || failed.has(gid)) continue;
        try {
          const res = await fetch(`/api/asset/status/${gid}`);
          const data = await res.json();
          const st = data.data || data;
          const status = st.status || 'pending';
          console.log(`[POLL] ${gid.slice(0,8)} → status: ${status}`);

          if (['completed', 'succeeded', 'done'].includes(status)) {
            console.log(`[POLL] ${gid.slice(0,8)} → COMPLETED, fetching download...`);
            try {
              const dlRes = await fetch(`/api/asset/download/${gid}`);
              const dlData = await dlRes.json();
              const dd = dlData.data || dlData;
              const url = dd.download_url || dd.url;
              console.log(`[POLL] ${gid.slice(0,8)} download url: ${url}`);
              if (url) completed[gid] = url;
              else failed.add(gid);
            } catch { failed.add(gid); }
          } else if (['failed', 'error'].includes(status)) {
            failed.add(gid);
          }
        } catch { /* skip, retry next round */ }
      }

      const totalDone = Object.keys(completed).length + failed.size;
      console.log(`[POLL] Round ${attempts}: ${Object.keys(completed).length} completed, ${failed.size} failed, ${genIds.length - totalDone} pending`);

      if (totalDone >= genIds.length) {
        break;
      }

      // Wait 10 seconds before next round
      await new Promise(r => setTimeout(r, 10000));
    }

    const totalDone = Object.keys(completed).length + failed.size;
    if (totalDone < genIds.length) {
      toast(`Timed out — ${Object.keys(completed).length} of ${genIds.length} images completed.`, 'warning');
    }
    setProgress(100, 'Character created!');
    setTimeout(() => hideGenProgress(), 800);
    resolve(Object.values(completed));
  });
}

// ══════════ RESULTS ══════════
async function showResult(generationId) {
  const container = document.getElementById('gen-result-content');
  try {
    const res = await fetch(`/api/asset/download/${generationId}`);
    const data = await res.json();
    const downloadData = data.data || data;
    const downloadUrl = downloadData.download_url || downloadData.url;
    if (!downloadUrl) {
      container.innerHTML = `<p class="text-red">No download URL returned.</p>`;
      return;
    }
    // Auto-save to gallery
    addToGallery(generationId, downloadUrl);

    let html = `<div class="gen-image-wrap"><img src="${esc(downloadUrl)}" alt="Generated image"></div>`;
    html += `<div class="mt-16">
      <div class="cred-box" style="display:inline-block;max-width:500px;text-align:left;">
        <div class="cred-label">Generation ID</div>
        <div class="cred-value" id="result-gen-id">${esc(generationId)}</div>
        <button class="copy-btn" onclick="copyText('result-gen-id')">Copy</button>
      </div>
    </div>`;
    html += `<div class="mt-10">
      <div class="cred-box" style="display:inline-block;max-width:500px;text-align:left;">
        <div class="cred-label">Image URL (use in SetChar or share)</div>
        <div class="cred-value" id="result-dl-url" style="font-size:0.7rem;word-break:break-all;">${esc(downloadUrl)}</div>
        <button class="copy-btn" onclick="copyText('result-dl-url')">Copy</button>
      </div>
    </div>`;
    html += `<div class="mt-16" style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
      <a href="${esc(downloadUrl)}" download="character-${generationId}.png" class="btn btn-primary btn-small" target="_blank">Download Image</a>
      <button class="btn btn-outline-yellow btn-small" onclick="useInSetChar('${esc(downloadUrl)}')">→ Use in SetChar</button>
    </div>`;
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = `<p class="text-red">Failed to download: ${esc(e.message)}</p>`;
  }
}

function useInSetChar(url) {
  selectGenType('setchar');
  document.getElementById('setchar-seed-url').value = url;
  toast('URL set as SetChar seed image', 'success');
}

function showSetCharResult(name, urls) {
  const container = document.getElementById('gen-result-content');
  const result = document.getElementById('gen-result');
  result.classList.remove('hidden');
  let html = `<div class="mt-16 text-center">
    <h3 style="color:var(--accent);">✓ Character "${esc(name)}" Created!</h3>
    <p style="color:var(--text-2);">${urls.length} reference images saved locally in <code>characters/${esc(name.toLowerCase().replace(/ /g,'-'))}/</code></p>
    <p style="color:var(--text-3);font-size:0.75rem;margin-top:4px;">You can view, replace, or add reference images in that folder. Use the \ud83d\udcc1 Folder button on the character card.</p>
  </div>`;
  html += '<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:16px;">';
  urls.forEach((url, i) => {
    html += `<div style="width:120px;">
      <img src="${esc(url)}" alt="Ref ${i + 1}" style="width:120px;height:120px;object-fit:cover;border-radius:8px;border:1px solid var(--border);" loading="lazy">
    </div>`;
  });
  html += '</div>';
  container.innerHTML = html;
}

// ══════════ NAV ══════════
function switchPanel(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  const panel = document.getElementById('panel-' + name);
  if (panel) panel.classList.add('active');
  const tab = document.querySelector(`.nav-tab[data-panel="${name}"]`);
  if (tab) tab.classList.add('active');
}

function selectGenType(type) {
  document.querySelectorAll('.gen-tab').forEach(b => b.classList.remove('active'));
  document.querySelector(`.gen-tab[data-type="${type}"]`)?.classList.add('active');
  document.querySelectorAll('.gen-form').forEach(f => f.classList.remove('active'));
  const form = document.getElementById('gen-form-' + type);
  if (form) form.classList.add('active');
  // Hide previous generation result when switching tabs
  const result = document.getElementById('gen-result');
  if (result) {
    result.classList.add('hidden');
    document.getElementById('gen-progress-container')?.classList.add('hidden');
    document.getElementById('gen-result-content').innerHTML = '';
  }
}

// ══════════ MODALS ══════════
function closeCredsModal() {
  document.getElementById('creds-modal').classList.remove('active');
}

function closePaymentModal() {
  document.getElementById('payment-modal').classList.remove('active');
}

// ══════════ UTILITIES ══════════
function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s';
    setTimeout(() => el.remove(), 300);
  }, 4500);
}

function copyText(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const text = el.textContent;
  navigator.clipboard.writeText(text)
    .then(() => toast('Copied!', 'success'))
    .catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      toast('Copied!', 'success');
    });
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

// ══════════ GALLERY ══════════
const GALLERY_KEY = 'cis_gallery';

function getGalleryItems() {
  try {
    return JSON.parse(localStorage.getItem(GALLERY_KEY) || '[]');
  } catch { return []; }
}

function addToGallery(generationId, imageUrl) {
  const items = getGalleryItems();
  // Avoid duplicates
  if (items.some(item => item.id === generationId)) return;
  items.unshift({ id: generationId, url: imageUrl, date: new Date().toISOString() });
  // Keep last 200
  if (items.length > 200) items.length = 200;
  localStorage.setItem(GALLERY_KEY, JSON.stringify(items));
  renderGallery(items);
}

function loadGallery() {
  renderGallery(getGalleryItems());
}

function renderGallery(items) {
  const el = document.getElementById('gallery-content');
  if (!el) return;
  if (!items || items.length === 0) {
    el.innerHTML = '<p class="text-dim" style="text-align:center;padding:40px 0;">Your generated images will appear here. Generate something first!</p>';
    return;
  }
  let html = `<div class="gallery-header">
    <span class="gallery-count">${items.length} image${items.length !== 1 ? 's' : ''}</span>
    <button class="btn btn-outline btn-small" onclick="clearGallery()">Clear All</button>
  </div>`;
  html += '<div class="gallery-grid">';
  items.forEach(item => {
    const date = item.date ? new Date(item.date).toLocaleDateString() : '';
    html += `<div class="gallery-item">
      <img src="${esc(item.url)}" alt="Generated" loading="lazy">
      <div class="gallery-item-actions">
        <a href="${esc(item.url)}" download="gen-${esc(item.id)}.png" target="_blank">Download</a>
        <button onclick="useInSetChar('${esc(item.url)}')">Use in SetChar</button>
      </div>
      <div class="gallery-item-date">${date}</div>
    </div>`;
  });
  html += '</div>';
  el.innerHTML = html;
}

function clearGallery() {
  if (!confirm('Clear all gallery images?')) return;
  localStorage.removeItem(GALLERY_KEY);
  renderGallery([]);
  toast('Gallery cleared', 'success');
}

// Expose for inline onclick handlers
window.switchPanel = switchPanel;
window.selectBundle = selectBundle;
window.closeCredsModal = closeCredsModal;
window.closePaymentModal = closePaymentModal;
window.copyText = copyText;
window.removeUpload = removeUpload;
window.deleteCharacterEntry = deleteCharacterEntry;
window.openCharFolder = openCharFolder;
window.viewCharacterRefs = viewCharacterRefs;
window.useInSetChar = useInSetChar;
window.clearGallery = clearGallery;
