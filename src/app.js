// Tab navigation
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + tab).classList.add('active');
  });
});

// Editor examples
document.getElementById('btn-broken').addEventListener('click', () => {
  document.getElementById('sql-input').value = BROKEN_EXAMPLE;
  document.getElementById('results-wrap').classList.add('hidden');
});
document.getElementById('btn-fixed').addEventListener('click', () => {
  document.getElementById('sql-input').value = FIXED_EXAMPLE;
  document.getElementById('results-wrap').classList.add('hidden');
});
document.getElementById('btn-clear').addEventListener('click', () => {
  document.getElementById('sql-input').value = '';
  document.getElementById('results-wrap').classList.add('hidden');
});

// Analyse
document.getElementById('btn-analyse').addEventListener('click', runValidation);
document.getElementById('sql-input').addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') runValidation();
});

// ── Config (table / column) ──────────────────────────────────────────────────
const cfgTable = document.getElementById('cfg-table');
const cfgColumn = document.getElementById('cfg-column');
cfgTable.value = localStorage.getItem('jsonbguard_table') || 'QuoteRequests';
cfgColumn.value = localStorage.getItem('jsonbguard_column') || 'schema';
cfgTable.addEventListener('input', () => localStorage.setItem('jsonbguard_table', cfgTable.value));
cfgColumn.addEventListener('input', () => localStorage.setItem('jsonbguard_column', cfgColumn.value));

function normalizeSqlForChecks(sql) {
  const table = (cfgTable.value || '').trim();
  const col   = (cfgColumn.value || '').trim();
  let s = sql;
  if (table && !/^(QuoteRequests|TrTemplates)$/i.test(table)) {
    const t = table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    s = s.replace(new RegExp('"' + t + '"', 'gi'), '"QuoteRequests"');
    s = s.replace(new RegExp('\\b' + t + '\\b', 'gi'), 'QuoteRequests');
  }
  if (col && !/^schema$/i.test(col)) {
    const c = col.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    s = s.replace(new RegExp('\\b' + c + '\\b', 'gi'), 'schema');
  }
  return s;
}

function runValidation() {
  const sql = document.getElementById('sql-input').value.trim();
  const wrap = document.getElementById('results-wrap');
  if (!sql) { wrap.classList.add('hidden'); return; }

  const found = CHECKS.filter(c => c.detect(normalizeSqlForChecks(sql)));
  const errors = found.filter(c => c.level === 'error');
  const warnings = found.filter(c => c.level === 'warning');
  const infos = found.filter(c => c.level === 'info');

  let html = `<div class="score-grid">
    <div class="score-card">
      <div class="sc-label">Errors</div>
      <div class="sc-val err">${errors.length}</div>
    </div>
    <div class="score-card">
      <div class="sc-label">Warnings</div>
      <div class="sc-val warn">${warnings.length}</div>
    </div>
    <div class="score-card">
      <div class="sc-label">Suggestions</div>
      <div class="sc-val ok">${infos.length}</div>
    </div>
  </div>`;

  if (found.length === 0) {
    html += `<div class="all-clear">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="8" stroke="#48c98e" stroke-width="1.5"/>
        <path d="M5.5 9l2.5 2.5 4.5-4.5" stroke="#48c98e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      No issues detected. Still run a SELECT dry-run before executing on production.
    </div>`;
  } else {
    html += `<div class="results-title">Issues found — ${found.length} total</div>`;
    const iconMap = { error: '✕', warning: '!', info: 'i' };
    [...errors, ...warnings, ...infos].forEach(c => {
      html += `<div class="issue-card ${c.level}">
        <div class="issue-icon">${iconMap[c.level]}</div>
        <div class="issue-body">
          <div class="issue-title">${escHtml(c.title)}</div>
          <div class="issue-desc">${escHtml(c.desc)}</div>
          <pre class="issue-fix">${escHtml(c.fix)}</pre>
        </div>
      </div>`;
    });
  }

  wrap.innerHTML = html;
  wrap.classList.remove('hidden');
  wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Checklist
const checklistGrid = document.getElementById('checklist-grid');
CHECKLIST_ITEMS.forEach((item, i) => {
  const div = document.createElement('div');
  div.className = 'checklist-item';
  div.innerHTML = `
    <div class="check-box">
      <svg class="check-tick" width="10" height="8" viewBox="0 0 10 8" fill="none">
        <path d="M1 4l3 3 5-6" stroke="#0f0f10" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <div class="check-content">
      <div class="check-title">${escHtml(item.title)}</div>
      <div class="check-desc">${escHtml(item.desc)}</div>
    </div>
    <span class="badge ${item.badge}">${item.badge.replace('-', ' ')}</span>
  `;
  div.addEventListener('click', () => {
    div.classList.toggle('checked');
    updateProgress();
  });
  checklistGrid.appendChild(div);
});

function updateProgress() {
  const total = CHECKLIST_ITEMS.length;
  const done = document.querySelectorAll('.checklist-item.checked').length;
  document.getElementById('progress-bar').style.width = (done / total * 100) + '%';
  document.getElementById('progress-label').textContent =
    done === total ? `${done} / ${total} — ready to run!` : `${done} / ${total} completed`;
}

// Patterns
const patternsList = document.getElementById('patterns-list');
PATTERNS.forEach((p, i) => {
  const div = document.createElement('div');
  div.className = 'pattern-card';
  div.innerHTML = `
    <div class="pattern-header">
      <div class="pattern-title">${escHtml(p.title)}</div>
      <button class="btn-copy" data-idx="${i}">Copy</button>
    </div>
    <pre class="pattern-code">${escHtml(p.code)}</pre>
  `;
  patternsList.appendChild(div);
});

patternsList.addEventListener('click', e => {
  const btn = e.target.closest('.btn-copy');
  if (!btn) return;
  const idx = parseInt(btn.dataset.idx, 10);
  navigator.clipboard.writeText(PATTERNS[idx].code).then(() => {
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
  });
});

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── AI Analysis ──────────────────────────────────────────────────────────────
const AI_KEY_STORE = 'jsonbguard_api_key';
const aiKeyInput = document.getElementById('ai-api-key');
aiKeyInput.value = localStorage.getItem(AI_KEY_STORE) || '';
aiKeyInput.addEventListener('input', () => localStorage.setItem(AI_KEY_STORE, aiKeyInput.value));

document.getElementById('btn-ai-analyse').addEventListener('click', runAiAnalysis);

async function runAiAnalysis() {
  const apiKey     = document.getElementById('ai-api-key').value.trim();
  const sql        = document.getElementById('ai-sql-input').value.trim();
  const sampleJson = document.getElementById('ai-json-input').value.trim();
  const loadingEl  = document.getElementById('ai-loading');
  const responseEl = document.getElementById('ai-response');
  const btnEl      = document.getElementById('btn-ai-analyse');

  if (!apiKey) {
    responseEl.innerHTML = '<div class="ai-error"><strong>API key required.</strong> Enter your Google AI Studio API key at the top of this tab. <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">Get a free key ↗</a></div>';
    responseEl.classList.remove('hidden');
    return;
  }
  if (!sql) {
    responseEl.innerHTML = '<div class="ai-error"><strong>SQL required.</strong> Paste a query in the SQL field above.</div>';
    responseEl.classList.remove('hidden');
    return;
  }

  loadingEl.classList.remove('hidden');
  responseEl.classList.add('hidden');
  btnEl.disabled = true;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildAiPrompt(sql, sampleJson) }] }],
          generationConfig: { maxOutputTokens: 2048 }
        })
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    responseEl.innerHTML = formatAiResponse(text);
    responseEl.classList.remove('hidden');
    responseEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (err) {
    responseEl.innerHTML = `<div class="ai-error"><strong>Error:</strong> ${escHtml(err.message)}</div>`;
    responseEl.classList.remove('hidden');
  } finally {
    loadingEl.classList.add('hidden');
    btnEl.disabled = false;
  }
}

function buildAiPrompt(sql, sampleJson) {
  const hasSample = !!sampleJson;
  return `You are a PostgreSQL JSONB expert specialising in null propagation bugs and safe schema column updates.

Analyse the SQL query below and respond with exactly these five sections using ## headers:

## 1. Plain English explanation
What does this query do in simple terms?

## 2. Before / After JSON diff
${hasSample
  ? 'Using the sample JSON record, simulate the exact state of the relevant fields AFTER this query runs. Show a clear before/after comparison using JSON code blocks.'
  : 'Describe which fields would change and how (no sample JSON was provided, so describe generally).'}

## 3. Null propagation risks
${hasSample
  ? 'Based on the actual JSON structure provided, identify specific null propagation risks — which paths could return NULL and under what conditions.'
  : 'Identify potential null propagation risks in this query.'}

## 4. Structural mismatches
${hasSample
  ? 'Compare key paths, array structures, and types referenced in the SQL against the actual JSON sample. Flag any wrong keys, wrong paths, or wrong types.'
  : 'Identify any structural assumptions the query makes about the data shape that could fail.'}

## 5. Corrected query
If you found issues, provide a complete corrected version with all safety guards applied. If the query is already safe, briefly confirm why.

---

SQL Query:
\`\`\`sql
${sql}
\`\`\`
${hasSample ? `\nSample JSON record:\n\`\`\`json\n${sampleJson}\n\`\`\`` : ''}`;
}

function formatAiResponse(text) {
  // Split out code fences before any escaping
  const segments = [];
  const fenceRe = /```[a-z]*\n?([\s\S]*?)```/g;
  let last = 0, m;
  while ((m = fenceRe.exec(text)) !== null) {
    if (m.index > last) segments.push({ type: 'text', raw: text.slice(last, m.index) });
    segments.push({ type: 'code', raw: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) segments.push({ type: 'text', raw: text.slice(last) });

  let html = '';
  for (const seg of segments) {
    if (seg.type === 'code') {
      html += `<pre class="ai-code">${escHtml(seg.raw.trimEnd())}</pre>`;
    } else {
      let t = escHtml(seg.raw);
      // Numbered section headers: ## 1. Title
      t = t.replace(/^## (\d+)\. (.+)$/gm,
        '<h3 class="ai-section-title"><span class="ai-num">$1</span>$2</h3>');
      // Plain ## headers
      t = t.replace(/^## (.+)$/gm, '<h3 class="ai-section-title">$1</h3>');
      t = t.replace(/^### (.+)$/gm, '<h4 class="ai-sub-title">$1</h4>');
      // Bold
      t = t.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
      // Inline code
      t = t.replace(/`([^`\n]+)`/g, '<code class="ai-inline-code">$1</code>');
      // Bullet points
      t = t.replace(/^[-*•] (.+)$/gm, '<li>$1</li>');
      t = t.replace(/(<li>[^\n]*\n?)+/g, s => '<ul>' + s + '</ul>');
      // Paragraphs
      t = t.replace(/\n\n+/g, '</p><p class="ai-para">');
      t = t.replace(/\n/g, '<br>');
      html += '<p class="ai-para">' + t + '</p>';
    }
  }
  return html;
}
