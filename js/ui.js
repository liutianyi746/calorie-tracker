// js/ui.js
import { addRecord, deleteRecord, getDayTotal, generateId } from './storage.js';

export function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast toast-${type}`;
  toast.style.display = 'block';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.display = 'none'; }, 3000);
}

export function showLoading() { document.getElementById('loading').style.display = 'flex'; }
export function hideLoading() { document.getElementById('loading').style.display = 'none'; }

export function renderResult(data) {
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
    { val: record.protein_g || 0, color: '#f59e0b' },
    { val: record.fat_g || 0, color: '#ef4444' },
    { val: record.carbs_g || 0, color: '#3b82f6' }
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

export function renderHistory(records, dateStr) {
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

export function renderAdvice(data) {
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
  const items = [
    { label: '日均热量', avg: agg.daily_averages.calories, target: agg.targets.calories, unit: 'kcal' },
    { label: '蛋白质', avg: agg.daily_averages.protein_g, target: agg.targets.protein_g, unit: 'g' },
    { label: '脂肪', avg: agg.daily_averages.fat_g, target: agg.targets.fat_g, unit: 'g' },
    { label: '碳水', avg: agg.daily_averages.carbs_g, target: agg.targets.carbs_g, unit: 'g' }
  ];

  const rows = items.map(item => {
    const pct = Math.min(100, Math.round((item.avg / item.target) * 100));
    const color = pct <= 95 ? '#f59e0b' : pct <= 110 ? '#22c55e' : '#ef4444';
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
