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

function runValidation() {
  const sql = document.getElementById('sql-input').value.trim();
  const wrap = document.getElementById('results-wrap');
  if (!sql) { wrap.classList.add('hidden'); return; }

  const found = CHECKS.filter(c => c.detect(sql));
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
