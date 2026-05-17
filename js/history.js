// js/history.js
import { getRecordsByDate, getDayTotal, getDatesWithRecords, exportJSON, importJSON } from './storage.js';
import { renderHistory, showToast } from './ui.js';

let selectedDate = new Date().toISOString().slice(0, 10);

export function initHistory() {
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
