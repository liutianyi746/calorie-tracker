// js/app.js
import { getRecords, getSettings, saveSettings, getApiKey } from './storage.js';
import { initCamera } from './camera.js';
import { analyzeFood } from './api.js';
import { renderResult, showToast, showLoading, hideLoading } from './ui.js';
import { initHistory } from './history.js';
import { initAdvice } from './advice.js';

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
