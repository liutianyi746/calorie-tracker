
const KEYS = { RECORDS: 'food_records', SETTINGS: 'settings' };

const DEFAULT_SETTINGS = {
  api_key: '',
  daily_calorie_target: 1800,
  protein_target: 60,
  fat_target: 65,
  carbs_target: 180
};

function getRecords() {
  try { return JSON.parse(localStorage.getItem(KEYS.RECORDS)) || []; }
  catch { return []; }
}

function saveRecords(records) {
  try { localStorage.setItem(KEYS.RECORDS, JSON.stringify(records)); }
  catch (e) { throw new Error('存储空间不足，请导出数据后清理旧记录'); }
}

function addRecord(record) {
  const records = getRecords();
  records.unshift(record);
  saveRecords(records);
}

function deleteRecord(id) {
  if (id == null) return;
  saveRecords(getRecords().filter(r => r.id !== id));
}

function getRecordsByDate(dateStr) {
  return getRecords().filter(r => r.date === dateStr);
}

function getRecordsLastNDays(n) {
  const dates = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return getRecords().filter(r => dates.includes(r.date));
}

function getDatesWithRecords() {
  return [...new Set(getRecords().map(r => r.date))].sort().reverse();
}

function getDayTotal(dateStr) {
  return getRecordsByDate(dateStr).reduce((sum, r) => sum + (r.calories || 0), 0);
}

function exportJSON() {
  const data = { records: getRecords(), settings: getSettings(), exported_at: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `calorie-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data.records || !Array.isArray(data.records)) throw new Error('格式无效');
        const existing = getRecords();
        const existingIds = new Set(existing.map(r => r.id));
        const newRecords = data.records.filter(r => !existingIds.has(r.id));
        saveRecords([...newRecords, ...existing]);
        if (data.settings) saveSettings({ ...getSettings(), ...data.settings });
        resolve(newRecords.length);
      } catch (e) { reject(new Error(e.message || '文件解析失败')); }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
}

function getSettings() {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEYS.SETTINGS)) }; }
  catch { return { ...DEFAULT_SETTINGS }; }
}

function saveSettings(settings) {
  try { localStorage.setItem(KEYS.SETTINGS, JSON.stringify({ ...DEFAULT_SETTINGS, ...settings })); }
  catch (e) { throw new Error('存储空间不足，无法保存设置'); }
}

function getApiKey() {
  return getSettings().api_key || '';
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}



const API_BASE = 'https://api.deepseek.com';
const MODEL = 'deepseek-chat';
const TIMEOUT_MS = 20000;

async function callDeepSeek(prompt, apiKey) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: '你是一个专业营养师。始终只返回要求的 JSON 格式，不返回任何额外内容。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 2048
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      let detail = '';
      try { const errBody = await res.json(); detail = errBody?.error?.message || ''; } catch {}
      if (res.status === 401) throw new Error('API Key 无效，请在设置中更新');
      if (res.status === 429) throw new Error('请求太频繁，请稍后再试');
      if (res.status === 402) throw new Error('API 余额不足，请充值');
      throw new Error(detail || `API 错误 (${res.status})`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim() || '';
    return extractJSON(content);
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('请求超时，请检查网络后重试');
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function extractJSON(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI 返回格式异常，请重试');
  try { return JSON.parse(match[0]); }
  catch { throw new Error('AI 返回数据解析失败，请重试'); }
}

async function analyzeFood(foodDesc, apiKey) {
  const sanitized = String(foodDesc).replace(/`/g, "'").slice(0, 500);
  const prompt = `你是一个专业营养师。请分析以下食物的营养成分。
食物描述：
\`\`\`
${sanitized}
\`\`\`

请只返回纯 JSON 对象，不包含任何其他文字，格式如下：
{
  "calories": 数字(千卡),
  "protein_g": 数字(克),
  "fat_g": 数字(克),
  "carbs_g": 数字(克),
  "fiber_g": 数字(克),
  "sugar_g": 数字(克),
  "sodium_mg": 数字(毫克),
  "cholesterol_mg": 数字(毫克),
  "saturated_fat_g": 数字(克),
  "unsaturated_fat_g": 数字(克),
  "food_name": "食物名称",
  "serving_size": "份量描述",
  "notes": "简短营养点评(1-2句)"
}`;
  return callDeepSeek(prompt, apiKey);
}

async function generateAdvice(records, settings, apiKey) {
  if (!records || records.length === 0) {
    return {
      summary: '暂无饮食记录，记录更多餐食后可获取个性化建议。',
      warnings: [],
      trends: {},
      aggregated: { total_records: 0, analyzed_days: 0, daily_averages: {}, targets: {} }
    };
  }

  const days = [...new Set(records.map(r => r.date))];
  const count = days.length || 1;
  const sum = (f) => records.reduce((s, r) => s + (r[f] || 0), 0);

  const aggregated = {
    total_records: records.length,
    analyzed_days: count,
    daily_averages: {
      calories: Math.round(sum('calories') / count),
      protein_g: Math.round(sum('protein_g') / count),
      fat_g: Math.round(sum('fat_g') / count),
      carbs_g: Math.round(sum('carbs_g') / count),
      fiber_g: Math.round(sum('fiber_g') / count),
      sugar_g: Math.round(sum('sugar_g') / count),
      sodium_mg: Math.round(sum('sodium_mg') / count)
    },
    targets: {
      calories: settings.daily_calorie_target,
      protein_g: settings.protein_target,
      fat_g: settings.fat_target,
      carbs_g: settings.carbs_target
    }
  };

  const prompt = `你是一个营养顾问。请根据以下用户近期饮食记录给出个性化建议。
记录数据：${JSON.stringify(aggregated)}

请只返回纯 JSON 对象，不包含任何其他文字，格式如下：
{
  "summary": "总体评价(1句)",
  "warnings": [{ "title": "标题", "detail": "详细建议", "level": "warning|info|good" }],
  "trends": {
    "calories": { "avg": 数字, "target": 数字, "status": "good|warning|bad" },
    "protein": { "avg": 数字, "target": 数字, "status": "good|warning|bad" },
    "fat": { "avg": 数字, "target": 数字, "status": "good|warning|bad" },
    "carbs": { "avg": 数字, "target": 数字, "status": "good|warning|bad" }
  }
}`;

  const result = await callDeepSeek(prompt, apiKey);
  return { ...result, aggregated };
}



function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast toast-${type}`;
  toast.style.display = 'block';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.display = 'none'; }, 3000);
}

function showLoading() { document.getElementById('loading').style.display = 'flex'; }
function hideLoading() { document.getElementById('loading').style.display = 'none'; }

function renderResult(data) {
  const container = document.getElementById('result-container');
  const now = new Date();
  const record = {
    id: generateId(),
    food_name: data.food_name,
    serving_size: data.serving_size,
    date: now.toISOString().slice(0, 10),
    time: now.toTimeString().slice(0, 5),
    calories: data.calories,
    protein_g: data.protein_g,
    fat_g: data.fat_g,
    carbs_g: data.carbs_g,
    fiber_g: data.fiber_g,
    sugar_g: data.sugar_g,
    sodium_mg: data.sodium_mg,
    cholesterol_mg: data.cholesterol_mg,
    saturated_fat_g: data.saturated_fat_g,
    unsaturated_fat_g: data.unsaturated_fat_g,
    notes: data.notes
  };

  const total = (record.protein_g || 0) + (record.fat_g || 0) + (record.carbs_g || 0);
  const ringHTML = total > 0 ? buildRingSegments(record, total) : '';

  container.innerHTML = `
    <div class="result-card">
      <div class="result-header">
        <h2>${esc(record.food_name)}</h2>
        <p class="result-serving">${esc(record.serving_size)}</p>
      </div>
      <div class="result-dashboard">
        <div class="calorie-ring">
          <svg viewBox="0 0 120 120" class="ring-svg">
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" stroke-width="8"/>
            ${ringHTML}
            <circle cx="60" cy="60" r="44" fill="var(--card)"/>
          </svg>
          <div class="ring-center">
            <span class="calorie-value">${record.calories}</span>
            <span class="calorie-unit">kcal</span>
          </div>
        </div>
        <div class="result-macros">
          <div class="macro-item macro-protein"><span class="macro-label">蛋白质</span><span class="macro-value">${record.protein_g}g</span></div>
          <div class="macro-item macro-fat"><span class="macro-label">脂肪</span><span class="macro-value">${record.fat_g}g</span></div>
          <div class="macro-item macro-carbs"><span class="macro-label">碳水</span><span class="macro-value">${record.carbs_g}g</span></div>
          <div class="macro-item"><span class="macro-label">纤维</span><span class="macro-value">${record.fiber_g}g</span></div>
          <div class="macro-item"><span class="macro-label">钠</span><span class="macro-value">${record.sodium_mg}mg</span></div>
        </div>
      </div>
      <div class="result-details">
        <div class="detail-item"><span>糖</span><b>${record.sugar_g}g</b></div>
        <div class="detail-item"><span>胆固醇</span><b>${record.cholesterol_mg}mg</b></div>
        <div class="detail-item"><span>饱和脂肪</span><b>${record.saturated_fat_g}g</b></div>
        <div class="detail-item"><span>不饱和脂肪</span><b>${record.unsaturated_fat_g}g</b></div>
      </div>
      ${record.notes ? `<p class="result-notes">💬 ${esc(record.notes)}</p>` : ''}
      <button id="btn-save-record" class="btn-primary" style="margin-top:12px">💾 保存记录</button>
    </div>
  `;
  container.style.display = 'block';
  container.scrollIntoView({ behavior: 'smooth' });

  document.getElementById('btn-save-record').addEventListener('click', () => {
    addRecord({ ...record });
    showToast('记录已保存', 'success');
    const btn = document.getElementById('btn-save-record');
    btn.disabled = true;
    btn.textContent = '✓ 已保存';
    document.dispatchEvent(new CustomEvent('records-changed'));
  });
}

function buildRingSegments(record, total) {
  const circumference = 2 * Math.PI * 52;
  const segments = [
    { val: record.protein_g || 0, color: '#d49e3e' },
    { val: record.fat_g || 0, color: '#b8473a' },
    { val: record.carbs_g || 0, color: '#6b8fa3' }
  ];
  let offset = 0;
  return segments.map(s => {
    const len = (s.val / total) * circumference;
    const html = `<circle cx="60" cy="60" r="52" fill="none" stroke="${s.color}" stroke-width="8"
      stroke-dasharray="${len} ${circumference - len}" stroke-dashoffset="${-offset}" transform="rotate(-90 60 60)"/>`;
    offset += len;
    return html;
  }).join('');
}

function renderHistory(records, dateStr) {
  const container = document.getElementById('history-list');
  if (records.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🍽</div><p>暂无记录</p><p class="empty-hint">去「拍照」Tab 添加今日第一餐吧</p></div>`;
    return;
  }

  container.innerHTML = records.map(r => `
    <div class="history-item" data-id="${r.id}">
      <div class="history-item-header" onclick="this.parentElement.classList.toggle('expanded')">
        <div class="history-item-info">
          <div class="history-item-name">${esc(r.food_name)}</div>
          <div class="history-item-meta">${r.time} · ${r.meal_type || '正餐'}</div>
        </div>
        <div class="history-item-calories">
          <span>${r.calories} kcal</span>
          <span class="macro-summary">P:${r.protein_g}g F:${r.fat_g}g C:${r.carbs_g}g</span>
        </div>
      </div>
      <div class="history-item-detail">
        <div class="detail-grid">
          <div>纤维 <b>${r.fiber_g}g</b></div><div>糖 <b>${r.sugar_g}g</b></div>
          <div>钠 <b>${r.sodium_mg}mg</b></div><div>胆固醇 <b>${r.cholesterol_mg}mg</b></div>
          <div>饱脂 <b>${r.saturated_fat_g}g</b></div><div>不饱脂 <b>${r.unsaturated_fat_g}g</b></div>
        </div>
        ${r.notes ? `<p style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">💬 ${esc(r.notes)}</p>` : ''}
        <div class="detail-actions">
          <button class="btn-small btn-danger" onclick="globalThis.deleteRecordById('${r.id}')">🗑 删除</button>
        </div>
      </div>
    </div>
  `).join('');
}

function renderAdvice(data) {
  const container = document.getElementById('advice-container');
  container.style.display = 'block';

  const trendsHTML = data.aggregated && data.aggregated.total_records > 0 ? buildTrendsHTML(data.aggregated) : '';

  const warningsHTML = (data.warnings || []).map(w => `
    <div class="advice-card advice-${w.level || 'info'}">
      <div class="advice-card-title">${icon(w.level)} ${esc(w.title)}</div>
      <p>${esc(w.detail)}</p>
    </div>
  `).join('');

  container.innerHTML = `
    ${data.summary ? `<p class="advice-summary">📋 ${esc(data.summary)}</p>` : ''}
    ${trendsHTML}
    ${warningsHTML}
  `;
  container.scrollIntoView({ behavior: 'smooth' });
}

function buildTrendsHTML(agg) {
  if (!agg || !agg.daily_averages || !agg.targets) return '';

  const avg = agg.daily_averages;
  const tgt = agg.targets;
  const items = [
    { label: '日均热量', avg: avg.calories || 0, target: tgt.calories || 1, unit: 'kcal' },
    { label: '蛋白质', avg: avg.protein_g || 0, target: tgt.protein_g || 1, unit: 'g' },
    { label: '脂肪', avg: avg.fat_g || 0, target: tgt.fat_g || 1, unit: 'g' },
    { label: '碳水', avg: avg.carbs_g || 0, target: tgt.carbs_g || 1, unit: 'g' }
  ];

  const rows = items.map(item => {
    const pct = Math.min(100, Math.round((item.avg / item.target) * 100));
    const color = pct <= 95 ? '#d49e3e' : pct <= 110 ? '#7a9e7e' : '#b8473a';
    const emoji = pct <= 95 ? '⚠' : pct <= 110 ? '✅' : '❌';
    return `<div class="trend-row">
      <div class="trend-info"><span>${item.label}</span><b style="color:${color}">${item.avg} / ${item.target} ${item.unit} ${emoji}</b></div>
      <div class="trend-bar"><div class="trend-fill" style="width:${pct}%;background:${color}"></div></div>
    </div>`;
  }).join('');

  return `<div class="trends-card"><h3>📈 近7天趋势</h3>${rows}</div>`;
}

function icon(level) { return level === 'warning' ? '⚠' : level === 'good' ? '✅' : '📘'; }

function esc(s) {
  if (!s) return '';
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
}

globalThis.deleteRecordById = (id) => {
  if (confirm('确定要删除这条记录吗？')) {
    deleteRecord(id);
    showToast('记录已删除', 'info');
    document.dispatchEvent(new CustomEvent('records-changed'));
  }
};


function initCamera() {
  const cameraInput = document.getElementById('camera-input');
  const galleryInput = document.getElementById('gallery-input');
  const btnCamera = document.getElementById('btn-capture');
  const btnGallery = document.getElementById('btn-gallery');
  const preview = document.getElementById('photo-preview');
  const container = document.querySelector('.capture-buttons');

  function showFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.src = e.target.result;
      preview.style.display = 'block';
      container.style.display = 'none';
    };
    reader.readAsDataURL(file);
  }

  btnCamera.addEventListener('click', () => cameraInput.click());
  btnGallery.addEventListener('click', () => galleryInput.click());

  cameraInput.addEventListener('change', () => showFile(cameraInput.files[0]));
  galleryInput.addEventListener('change', () => showFile(galleryInput.files[0]));

  preview.addEventListener('click', () => {
    preview.style.display = 'none';
    container.style.display = 'flex';
    cameraInput.value = '';
    galleryInput.value = '';
  });
}



let selectedDate = new Date().toISOString().slice(0, 10);

function initHistory() {
  document.getElementById('btn-prev-day').addEventListener('click', () => navigate(-1));
  document.getElementById('btn-next-day').addEventListener('click', () => navigate(1));
  document.getElementById('btn-date-display').addEventListener('click', showPicker);
  document.getElementById('btn-export').addEventListener('click', () => { exportJSON(); showToast('数据已导出', 'success'); });
  document.getElementById('btn-import').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const count = await importJSON(file);
        showToast(`导入了 ${count} 条新记录`, 'success');
        document.dispatchEvent(new CustomEvent('records-changed'));
      } catch (e) { showToast(e.message, 'error'); }
    };
    input.click();
  });

  document.addEventListener('records-changed', refresh);
  updateDisplay();
  refresh();
}

function navigate(delta) {
  const d = new Date(selectedDate);
  d.setDate(d.getDate() + delta);
  selectedDate = d.toISOString().slice(0, 10);
  updateDisplay();
  refresh();
}

function updateDisplay() {
  const d = new Date(selectedDate);
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('btn-next-day').disabled = selectedDate >= today;
  const label = selectedDate === today ? '今天' : `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  document.getElementById('btn-date-display').textContent = label + ' ▼';
}

function refresh() {
  renderHistory(getRecordsByDate(selectedDate), selectedDate);
}

function showPicker() {
  const dates = getDatesWithRecords();
  if (dates.length === 0) { showToast('暂无任何记录', 'info'); return; }

  const overlay = document.createElement('div');
  overlay.className = 'modal';
  overlay.style.display = 'flex';

  const dateItems = dates.map(date => {
    const d = new Date(date);
    const label = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    const cls = date === selectedDate ? 'selected' : '';
    return `<button class="date-option ${cls}" data-date="${date}">${label}<span class="date-total">${getDayTotal(date)} kcal</span></button>`;
  }).join('');

  overlay.innerHTML = `<div class="modal-content">
    <h3>选择日期</h3>
    <div class="date-list">${dateItems}</div>
    <button class="btn-outline" style="margin-top:8px">关闭</button>
  </div>`;

  document.body.appendChild(overlay);
  overlay.querySelectorAll('.date-option').forEach(btn => {
    btn.addEventListener('click', () => { selectedDate = btn.dataset.date; updateDisplay(); refresh(); overlay.remove(); });
  });
  overlay.querySelector('.btn-outline').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}



function initAdvice() {
  document.getElementById('btn-generate-advice').addEventListener('click', handleGenerate);
}

async function handleGenerate() {
  const records = getRecordsLastNDays(7);
  if (records.length === 0) { showToast('请先添加饮食记录', 'warning'); return; }

  const dates = [...new Set(records.map(r => r.date))];
  if (dates.length < 3) {
    showToast(`需要至少 3 天的记录（当前 ${dates.length} 天），请继续记录`, 'warning');
    return;
  }

  const apiKey = getApiKey();
  if (!apiKey) { showToast('请先在设置中输入 DeepSeek API Key', 'error'); globalThis.openSettings(); return; }

  showLoading();
  try {
    const settings = getSettings();
    const result = await generateAdvice(records, settings, apiKey);
    renderAdvice(result);
  } catch (err) {
    showToast(err.message || '建议生成失败', 'error');
  } finally {
    hideLoading();
  }
}



document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initCamera();
  initHistory();
  initAdvice();
  initAnalyzeButton();
  initSettings();
  initFoodDescInput();
});

function initTabs() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => switchTab(item.dataset.tab));
  });
}

function switchTab(tab) {
  document.querySelectorAll('.tab-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  document.querySelector(`.nav-item[data-tab="${tab}"]`).classList.add('active');
}

function initAnalyzeButton() {
  document.getElementById('btn-analyze').addEventListener('click', handleAnalyze);
}

function initFoodDescInput() {
  const input = document.getElementById('food-desc');
  const btn = document.getElementById('btn-analyze');
  input.addEventListener('input', () => { btn.disabled = !input.value.trim(); });
}

async function handleAnalyze() {
  const desc = document.getElementById('food-desc').value.trim();
  if (!desc) return;
  const apiKey = getApiKey();
  if (!apiKey) { showToast('请先在设置中输入 DeepSeek API Key', 'error'); openSettings(); return; }
  const btn = document.getElementById('btn-analyze');
  btn.disabled = true;
  showLoading();
  try {
    const result = await analyzeFood(desc, apiKey);
    renderResult(result);
  } catch (err) {
    showToast(err.message || '分析失败，请重试', 'error');
  } finally {
    hideLoading();
    const input = document.getElementById('food-desc');
    btn.disabled = !input.value.trim();
  }
}

function initSettings() {
  document.getElementById('btn-save-settings').addEventListener('click', () => {
    saveSettings({
      api_key: document.getElementById('api-key-input').value.trim(),
      daily_calorie_target: parseInt(document.getElementById('calorie-target').value) || 1800,
      protein_target: parseInt(document.getElementById('protein-target').value) || 60,
      fat_target: parseInt(document.getElementById('fat-target').value) || 65,
      carbs_target: parseInt(document.getElementById('carbs-target').value) || 180
    });
    closeSettings();
    showToast('设置已保存', 'success');
  });
  document.getElementById('btn-close-settings').addEventListener('click', closeSettings);
  loadSettingsToForm();
}

function loadSettingsToForm() {
  const s = getSettings();
  document.getElementById('api-key-input').value = s.api_key || '';
  document.getElementById('calorie-target').value = s.daily_calorie_target;
  document.getElementById('protein-target').value = s.protein_target;
  document.getElementById('fat-target').value = s.fat_target;
  document.getElementById('carbs-target').value = s.carbs_target;
}

function closeSettings() {
  document.getElementById('settings-modal').style.display = 'none';
}

globalThis.openSettings = () => {
  loadSettingsToForm();
  document.getElementById('settings-modal').style.display = 'flex';
};
globalThis.switchTab = switchTab;

