/**
 * 外部コミュニケーション記録 — app.js (Supabase版)
 * PHPバックエンドをSupabase REST APIに置き換え
 * PDF出力: ブラウザ印刷  /  Excel出力: SheetJS (クライアント生成)
 */

// ============================================================
//  ★★★ ここを自分のSupabase情報に書き換えてください ★★★
// ============================================================
const SUPABASE_URL     = 'https://eqpbaffvslpxawltrbpc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGJhZmZ2c2xweGF3bHRyYnBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NjgyMDgsImV4cCI6MjA5NTU0NDIwOH0.47kauTC5Ybot15RRvsKc0cBZcNWfYEc5rYxUbUBo8_8';
// ============================================================

// ─── Supabase REST ヘルパー ───
const SB_H = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};
async function sbGet(table, params = '') {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { headers: SB_H });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function sbPost(table, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST', headers: SB_H, body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function sbPatch(table, filter, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH', headers: SB_H, body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function sbDelete(table, filter) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'DELETE', headers: { ...SB_H, 'Prefer': '' }
  });
  if (!r.ok) throw new Error(await r.text());
}
async function sbUpsert(table, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...SB_H, 'Prefer': 'return=representation,resolution=merge-duplicates' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// ════════════════════════════════
//  State
// ════════════════════════════════
const S = {
  members:      [],  // [{name, as_respondent, as_creator}]
  selected:     [],  // 選択済み対応者
  extCount:     0,
  allRecords:   [],
  deleteTarget: null,
};

const respondents = () => S.members.filter(m => m.as_respondent).map(m => m.name);
const creators    = () => S.members.filter(m => m.as_creator).map(m => m.name);

// ════════════════════════════════
//  起動
// ════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  bindAll();
  await loadSettings();
  setDefaults();
  renderRespondentSel();
  renderCreatorSel();
  addExtEntry();
});

function setDefaults() {
  const today = isoToday();
  get('impl-date').value    = today;
  get('created-date').value = today;
}

// ════════════════════════════════
//  ユーティリティ
// ════════════════════════════════
function get(id) { return document.getElementById(id); }
function isoToday() { return new Date().toLocaleDateString('sv-SE'); }
function esc(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/"/g,'&quot;')
    .replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function fmtDateJa(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${y}年${+m}月${+day}日`;
}
function toast(msg) {
  const el = get('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2400);
}
function setLoading(on, text = '処理中...') {
  get('loading-text').textContent = text;
  get('loading').classList.toggle('hidden', !on);
}

// ════════════════════════════════
//  設定（人物リスト）— Supabase app_settings
// ════════════════════════════════
async function loadSettings() {
  try {
    const rows = await sbGet('app_settings', 'key_name=eq.members&select=val');
    if (rows.length) {
      S.members = rows[0].val || defaultMembers();
    } else {
      S.members = defaultMembers();
    }
  } catch {
    S.members = defaultMembers();
  }
}

async function saveSettings() {
  await sbUpsert('app_settings', { key_name: 'members', val: S.members });
}

function defaultMembers() {
  return [{ name: '大久保 久寿', as_respondent: true, as_creator: true }];
}

// ════════════════════════════════
//  セレクトボックス描画
// ════════════════════════════════
function renderRespondentSel() {
  const sel = get('respondent-select');
  const cur = sel.value;
  sel.innerHTML = '<option value="">対応者を選択</option>';
  respondents().forEach(n =>
    sel.insertAdjacentHTML('beforeend', `<option value="${esc(n)}">${esc(n)}</option>`)
  );
  sel.value = cur;
}

function renderCreatorSel() {
  const sel = get('creator-select');
  const cur = sel.value;
  sel.innerHTML = '<option value="">選択してください</option>';
  creators().forEach(n =>
    sel.insertAdjacentHTML('beforeend', `<option value="${esc(n)}">${esc(n)}</option>`)
  );
  sel.value = (cur && creators().includes(cur)) ? cur
            : creators().length ? creators()[0] : '';
}

// ════════════════════════════════
//  外部コミュニケーション先
// ════════════════════════════════
function addExtEntry(org = '', name = '') {
  S.extCount++;
  const n = S.extCount;
  get('external-list').insertAdjacentHTML('beforeend', `
    <div class="external-entry" data-ext="${n}">
      <div class="ext-entry-hd">
        <span class="entry-label">コミュニケーション先 ${n}</span>
        <button type="button" class="remove-btn" data-rm-ext="${n}" aria-label="削除">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="ext-fields">
        <div class="ext-row">
          <span class="ext-lbl">所　属</span>
          <input type="text" class="field-input" data-ext-org="${n}" placeholder="例：株式会社Eco-Pork" value="${esc(org)}">
        </div>
        <div class="ext-row">
          <span class="ext-lbl">氏　名</span>
          <input type="text" class="field-input" data-ext-name="${n}" placeholder="例：横手様、福田様" value="${esc(name)}">
        </div>
      </div>
    </div>`);
}

function removeExtEntry(n) {
  document.querySelector(`[data-ext="${n}"]`)?.remove();
  document.querySelectorAll('.external-entry').forEach((el, i) => {
    const lbl = el.querySelector('.entry-label');
    if (lbl) lbl.textContent = `コミュニケーション先 ${i + 1}`;
  });
}

function clearExtEntries() {
  get('external-list').innerHTML = '';
  S.extCount = 0;
}

// ════════════════════════════════
//  対応者チップ
// ════════════════════════════════
function addChip(name) {
  if (!name || S.selected.includes(name)) return;
  S.selected.push(name);
  renderChips();
}
function removeChip(name) {
  S.selected = S.selected.filter(n => n !== name);
  renderChips();
}
function renderChips() {
  get('respondent-chips').innerHTML = S.selected.map(n => `
    <div class="chip">
      <span>${esc(n)}</span>
      <button type="button" class="chip-remove" data-chip="${esc(n)}" aria-label="削除">×</button>
    </div>`).join('');
}

// ════════════════════════════════
//  フォーム操作
// ════════════════════════════════
function collectForm() {
  const externals = [];
  document.querySelectorAll('.external-entry').forEach(el => {
    const n    = el.dataset.ext;
    const org  = el.querySelector(`[data-ext-org="${n}"]`)?.value.trim()  || '';
    const name = el.querySelector(`[data-ext-name="${n}"]`)?.value.trim() || '';
    if (org || name) externals.push({ org, name });
  });
  const rawId = get('edit-id').value;
  return {
    id:          rawId ? parseInt(rawId) : null,
    implDate:    get('impl-date').value,
    timeFrom:    get('time-from').value,
    timeTo:      get('time-to').value,
    implPlace:   get('impl-place').value,
    respondents: [...S.selected],
    externals,
    content:     get('content').value,
    remarks:     get('remarks').value,
    createdDate: get('created-date').value,
    creator:     get('creator-select').value,
    format:      document.querySelector('input[name="output-format"]:checked')?.value || 'pdf',
  };
}

function validateForm(d) {
  if (!d.implDate) return '実施年月日を入力してください';
  if (!d.creator)  return '作成者を選択してください';
  return null;
}

function resetForm() {
  get('edit-id').value      = '';
  get('impl-date').value    = isoToday();
  get('time-from').value    = '';
  get('time-to').value      = '';
  get('impl-place').value   = '';
  get('content').value      = '';
  get('remarks').value      = '';
  get('created-date').value = isoToday();
  S.selected = [];
  renderChips();
  clearExtEntries();
  addExtEntry();
  renderCreatorSel();
}

function populateForm(rec) {
  clearExtEntries();
  S.selected = [];
  get('edit-id').value      = rec.id;
  get('impl-date').value    = rec.impl_date    || '';
  get('time-from').value    = rec.time_from    ? rec.time_from.slice(0,5) : '';
  get('time-to').value      = rec.time_to      ? rec.time_to.slice(0,5)   : '';
  get('impl-place').value   = rec.impl_place   || '';
  get('content').value      = rec.content      || '';
  get('remarks').value      = rec.remarks      || '';
  get('created-date').value = rec.created_date || isoToday();
  const exts = rec.externals || [];
  exts.forEach(e => addExtEntry(e.org || '', e.name || ''));
  if (!exts.length) addExtEntry();
  S.selected = [...(rec.respondents || [])];
  renderChips();
  const sel = get('creator-select');
  sel.value = rec.creator || '';
  if (!sel.value && rec.creator) {
    sel.insertAdjacentHTML('beforeend',
      `<option value="${esc(rec.creator)}" selected>${esc(rec.creator)}</option>`);
  }
}

// ════════════════════════════════
//  DB保存 — Supabase
// ════════════════════════════════
async function saveRecord() {
  const d   = collectForm();
  const err = validateForm(d);
  if (err) { toast(err); return; }

  const body = {
    impl_date:    d.implDate,
    time_from:    d.timeFrom  || null,
    time_to:      d.timeTo    || null,
    impl_place:   d.implPlace || null,
    externals:    d.externals,
    respondents:  d.respondents,
    content:      d.content   || null,
    remarks:      d.remarks   || null,
    created_date: d.createdDate || isoToday(),
    creator:      d.creator,
  };

  setLoading(true, '保存中...');
  try {
    if (d.id) {
      await sbPatch('comm_records', `id=eq.${d.id}`, body);
      toast('更新しました ✓');
    } else {
      const rows = await sbPost('comm_records', body);
      get('edit-id').value = rows[0].id;
      toast('保存しました ✓');
    }
  } catch (e) {
    toast('保存に失敗しました: ' + e.message);
  } finally {
    setLoading(false);
  }
}

// ════════════════════════════════
//  出力（PDF / Excel）— クライアントサイド
// ════════════════════════════════
function buildFilename(d) {
  const ymd  = (d.implDate || '').replace(/-/g, '');
  const dest = (d.externals || [])
    .map(e => [e.org, e.name].filter(Boolean).join(' ')).join('、') || '外部';
  return `${ymd}外部コミュニケーション_${dest}`;
}

function buildTimeStr(d) {
  const f = d.timeFrom || d.time_from || '';
  const t = d.timeTo   || d.time_to   || '';
  if (f && t) return `${f} ～ ${t}`;
  if (f) return `${f} ～`;
  if (t) return `～ ${t}`;
  return '';
}

function buildExternalStr(d) {
  return (d.externals || [])
    .map(e => [e.org, e.name].filter(Boolean).join('　'))
    .join('\n');
}

// PDF: ブラウザ印刷で実現（export.phpと同等のHTML生成）
function outputPdf(d) {
  const fmtDate = s => {
    if (!s) return '';
    const t = new Date(s + 'T00:00:00');
    return `${t.getFullYear()}年${t.getMonth()+1}月${t.getDate()}日`;
  };
  const rows = [
    ['実施年月日',              fmtDate(d.implDate || d.impl_date)],
    ['実施時刻',                buildTimeStr(d)],
    ['実施場所',                (d.implPlace || d.impl_place || '').replace(/\n/g,'<br>')],
    ['外部コミュニケーション先', buildExternalStr(d).replace(/\n/g,'<br>')],
    ['対応者',                  (d.respondents || []).join('　')],
    ['内　容',                  (d.content || '').replace(/\n/g,'<br>'), 'tall'],
    ['特記事項',                (d.remarks  || '').replace(/\n/g,'<br>'), 'mid'],
    ['作成日',                  fmtDate(d.createdDate || d.created_date)],
    ['作成者',                  d.creator || ''],
  ];
  const rowsHtml = rows.map(r => {
    const cls = r[2] ? ` class="${r[2]}"` : '';
    return `<tr><th>${r[0]}</th><td${cls}>${r[1]}</td></tr>`;
  }).join('\n');
  const filename = (d.filename || buildFilename(d)) + '.pdf';
  const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">
<title>${filename}</title>
<style>
@page{size:A4 portrait;margin:14mm 18mm}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Hiragino Kaku Gothic ProN','Hiragino Sans','Meiryo',sans-serif;font-size:10pt;color:#1a1a18}
h1{font-size:13pt;font-weight:bold;text-align:center;padding-bottom:5px;margin-bottom:3px}
.sub{font-size:8pt;text-align:center;color:#666;margin-bottom:10px}
.rule{border:none;border-top:2px solid #4a7c59;margin-bottom:10px}
table{width:100%;border-collapse:collapse;page-break-inside:avoid}
th,td{border:1px solid #aaa;padding:6px 9px;vertical-align:top;font-size:9.5pt;text-align:left}
th{background:#eaf2ec;font-weight:bold;width:30%;white-space:nowrap}
td{background:#fff}
td.tall{height:72pt}
td.mid{height:36pt}
.print-btn{display:block;margin:16px auto 0;padding:10px 32px;background:#4a7c59;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer}
@media print{.print-btn{display:none}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<h1>外部コミュニケーション記録</h1>
<p class="sub">HACCPシステム記録</p>
<hr class="rule">
<table>${rowsHtml}</table>
<button class="print-btn" onclick="window.print()">印刷 / PDFとして保存</button>
<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),400));<\/script>
</body></html>`;
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
}

// Excel: SheetJSを使ってクライアント側で生成
function outputExcel(d) {
  if (typeof XLSX === 'undefined') {
    toast('SheetJSの読み込みに失敗しました。ページを再読み込みしてください。');
    return;
  }
  const fmtDate = s => {
    if (!s) return '';
    const t = new Date(s + 'T00:00:00');
    return `${t.getFullYear()}年${t.getMonth()+1}月${t.getDate()}日`;
  };
  const rows = [
    ['外部コミュニケーション記録（HACCPシステム記録）', ''],
    ['実施年月日',              fmtDate(d.implDate || d.impl_date)],
    ['実施時刻',                buildTimeStr(d)],
    ['実施場所',                d.implPlace || d.impl_place || ''],
    ['外部コミュニケーション先', buildExternalStr(d)],
    ['対応者',                  (d.respondents || []).join('　')],
    ['内　容',                  d.content || ''],
    ['特記事項',                d.remarks  || ''],
    ['作成日',                  fmtDate(d.createdDate || d.created_date)],
    ['作成者',                  d.creator || ''],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 26 }, { wch: 54 }];
  ws['!rows'] = rows.map((r, i) => ({ hpx: i === 0 ? 22 : (i === 6 ? 80 : i === 7 ? 48 : 22) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '外部コミュニケーション記録');
  const filename = (d.filename || buildFilename(d)) + '.xlsx';
  XLSX.writeFile(wb, filename);
}

async function outputRecord(d) {
  d.filename = buildFilename(d);
  setLoading(true, '出力中...');
  try {
    if (d.format === 'excel') {
      outputExcel(d);
    } else {
      outputPdf(d);
    }
    toast('出力が完了しました ✓');
  } catch (e) {
    toast('出力に失敗しました: ' + e.message);
  } finally {
    setLoading(false);
  }
}

// ════════════════════════════════
//  記録一覧 — Supabase
// ════════════════════════════════
async function loadList() {
  get('record-list').innerHTML = '<div class="list-empty">読み込み中...</div>';
  try {
    const rows = await sbGet(
      'comm_records',
      'order=impl_date.desc,created_at.desc&limit=200&select=id,impl_date,time_from,time_to,impl_place,externals,respondents,content,remarks,creator,created_date,created_at'
    );
    S.allRecords = rows;
    renderList(rows);
  } catch (e) {
    get('record-list').innerHTML =
      `<div class="list-empty">読み込みに失敗しました<br><small>${esc(e.message)}</small></div>`;
  }
}

function renderList(records) {
  if (!records.length) {
    get('record-list').innerHTML =
      '<div class="list-empty">記録がありません。<br>「新規入力」タブから記録を追加してください。</div>';
    return;
  }
  get('record-list').innerHTML = records.map(r => {
    const dest = (r.externals || [])
      .map(e => [e.org, e.name].filter(Boolean).join('　')).join('、') || '―';
    const rsp  = (r.respondents || []).join('　') || '―';
    const tFrom = r.time_from ? r.time_from.slice(0,5) : '';
    const tTo   = r.time_to   ? r.time_to.slice(0,5)   : '';
    const time  = [tFrom, tTo].filter(Boolean).join(' ～ ');
    return `
      <div class="record-card">
        <div class="card-date">${fmtDateJa(r.impl_date)}${time ? '　' + time : ''}</div>
        <div class="card-dest">${esc(dest)}</div>
        <div class="card-meta">
          <span>対応者：${esc(rsp)}</span>
          <span>作成者：${esc(r.creator)}</span>
        </div>
        <div class="card-actions">
          <button type="button" class="card-btn card-btn-edit" data-action="edit" data-id="${r.id}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>編集
          </button>
          <button type="button" class="card-btn card-btn-out" data-action="output" data-id="${r.id}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>出力
          </button>
          <button type="button" class="card-btn card-btn-del" data-action="delete" data-id="${r.id}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>削除
          </button>
        </div>
      </div>`;
  }).join('');
}

function filterList() {
  const kw   = get('search-box').value.toLowerCase().trim();
  const from = get('filter-date-from').value;
  const to   = get('filter-date-to').value;

  let filtered = S.allRecords;

  if (from || to) {
    filtered = filtered.filter(r => {
      if (from && r.impl_date < from) return false;
      if (to   && r.impl_date > to)   return false;
      return true;
    });
    const summary = get('filter-summary');
    summary.textContent = `${from || '―'}〜${to || '―'}　${filtered.length}件`;
    summary.classList.remove('hidden');
  } else {
    get('filter-summary').classList.add('hidden');
  }

  if (kw) {
    filtered = filtered.filter(r => {
      const dest = (r.externals || []).map(e => (e.org||'') + (e.name||'')).join('');
      return [r.impl_date, r.impl_place, r.content, r.remarks,
              r.creator, dest, ...(r.respondents||[])]
        .some(v => String(v||'').toLowerCase().includes(kw));
    });
  }

  renderList(filtered);
}

// ════════════════════════════════
//  タブ切替
// ════════════════════════════════
function switchTab(tab) {
  if (tab === 'form') resetForm();
  get('view-form').classList.toggle('hidden', tab !== 'form');
  get('view-list').classList.toggle('hidden', tab !== 'list');
  document.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab));
  if (tab === 'list') loadList();
}

function showFormTab() {
  get('view-form').classList.remove('hidden');
  get('view-list').classList.add('hidden');
  document.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === 'form'));
}

// ════════════════════════════════
//  設定モーダル
// ════════════════════════════════
function openSettings() {
  renderMemberList();
  get('modal-settings').classList.remove('hidden');
}
function closeSettings() {
  get('modal-settings').classList.add('hidden');
}
function renderMemberList() {
  get('member-list').innerHTML = S.members.map((m, i) => `
    <div class="member-item">
      <span class="member-name">${esc(m.name)}</span>
      <div class="member-checks">
        <input type="checkbox" class="role-check rsp" id="rsp-${i}"
          data-mi="${i}" data-role="rsp" ${m.as_respondent ? 'checked' : ''}>
        <label class="role-check-label" for="rsp-${i}">対応者</label>
        <input type="checkbox" class="role-check crt" id="crt-${i}"
          data-mi="${i}" data-role="crt" ${m.as_creator ? 'checked' : ''}>
        <label class="role-check-label" for="crt-${i}">作成者</label>
      </div>
      <button type="button" class="remove-btn" data-rm-member="${i}" aria-label="削除">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>`).join('');
}

// ════════════════════════════════
//  削除確認
// ════════════════════════════════
function openConfirm(id) { S.deleteTarget = id; get('modal-confirm').classList.remove('hidden'); }
function closeConfirm()  { S.deleteTarget = null; get('modal-confirm').classList.add('hidden'); }

async function executeDelete() {
  const id = S.deleteTarget;
  if (!id) return;
  closeConfirm();
  setLoading(true, '削除中...');
  try {
    await sbDelete('comm_records', `id=eq.${id}`);
    toast('削除しました');
    await loadList();
  } catch (e) {
    toast('削除に失敗しました: ' + e.message);
  } finally {
    setLoading(false);
  }
}

// ════════════════════════════════
//  イベント登録
// ════════════════════════════════
function bindAll() {
  // タブ
  document.querySelectorAll('.tab-btn').forEach(btn =>
    btn.addEventListener('click', () => switchTab(btn.dataset.tab))
  );

  // 設定
  get('btn-settings').addEventListener('click', openSettings);
  get('btn-close-settings').addEventListener('click', closeSettings);
  get('modal-settings').addEventListener('click', e => {
    if (e.target === get('modal-settings')) closeSettings();
  });

  // 人物追加
  get('btn-add-member').addEventListener('click', () => {
    const inp = get('new-member');
    const v   = inp.value.trim();
    if (!v) { toast('氏名を入力してください'); return; }
    if (S.members.some(m => m.name === v)) { toast('すでに登録されています'); return; }
    S.members.push({ name: v, as_respondent: true, as_creator: false });
    renderMemberList();
    inp.value = '';
  });
  get('new-member').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); get('btn-add-member').click(); }
  });

  // 設定保存
  get('btn-save-settings').addEventListener('click', async () => {
    setLoading(true, '保存中...');
    try {
      await saveSettings();
      renderRespondentSel();
      renderCreatorSel();
      closeSettings();
      toast('設定を保存しました');
    } catch (e) {
      toast('保存に失敗しました: ' + e.message);
    } finally {
      setLoading(false);
    }
  });

  // 外部先追加
  get('btn-add-ext').addEventListener('click', () => addExtEntry());

  // 対応者追加
  get('btn-add-respondent').addEventListener('click', () => {
    const sel = get('respondent-select');
    addChip(sel.value);
    sel.value = '';
  });

  // 保存
  get('btn-save').addEventListener('click', saveRecord);

  // 出力
  get('record-form').addEventListener('submit', async e => {
    e.preventDefault();
    const d   = collectForm();
    const err = validateForm(d);
    if (err) { toast(err); return; }
    await outputRecord(d);
  });

  // 削除確認
  get('btn-confirm-cancel').addEventListener('click', closeConfirm);
  get('btn-confirm-ok').addEventListener('click', executeDelete);
  get('modal-confirm').addEventListener('click', e => {
    if (e.target === get('modal-confirm')) closeConfirm();
  });

  // 検索・期間フィルター
  get('search-box').addEventListener('input', filterList);
  get('filter-date-from').addEventListener('change', filterList);
  get('filter-date-to').addEventListener('change', filterList);
  get('btn-filter-clear').addEventListener('click', () => {
    get('filter-date-from').value = '';
    get('filter-date-to').value   = '';
    get('filter-summary').classList.add('hidden');
    filterList();
  });

  // イベント委任
  document.addEventListener('change', e => {
    const cb = e.target.closest('.role-check');
    if (cb) {
      const i = parseInt(cb.dataset.mi);
      if (cb.dataset.role === 'rsp') S.members[i].as_respondent = cb.checked;
      if (cb.dataset.role === 'crt') S.members[i].as_creator    = cb.checked;
    }
  });

  document.addEventListener('click', async e => {
    const rmExt = e.target.closest('[data-rm-ext]');
    if (rmExt) { removeExtEntry(rmExt.dataset.rmExt); return; }

    const chip = e.target.closest('[data-chip]');
    if (chip) { removeChip(chip.dataset.chip); return; }

    const rmMember = e.target.closest('[data-rm-member]');
    if (rmMember) {
      S.members.splice(parseInt(rmMember.dataset.rmMember), 1);
      renderMemberList();
      return;
    }

    const cardBtn = e.target.closest('[data-action]');
    if (!cardBtn) return;
    const { action, id } = cardBtn.dataset;

    if (action === 'edit') {
      const rec = S.allRecords.find(r => String(r.id) === String(id));
      if (!rec) return;
      populateForm(rec);
      showFormTab();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      toast('読み込みました。編集後「保存する」を押してください。');
    }

    if (action === 'output') {
      const rec = S.allRecords.find(r => String(r.id) === String(id));
      if (!rec) return;
      const fmt = document.querySelector('input[name="output-format"]:checked')?.value || 'pdf';
      await outputRecord({ ...rec, implDate: rec.impl_date, implPlace: rec.impl_place,
        timeFrom: rec.time_from, timeTo: rec.time_to, createdDate: rec.created_date, format: fmt });
    }

    if (action === 'delete') openConfirm(+id);
  });
}
