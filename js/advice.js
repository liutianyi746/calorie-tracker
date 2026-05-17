// js/advice.js
import { getRecordsLastNDays, getSettings, getApiKey } from './storage.js';
import { generateAdvice } from './api.js';
import { renderAdvice, showToast, showLoading, hideLoading } from './ui.js';

export function initAdvice() {
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
