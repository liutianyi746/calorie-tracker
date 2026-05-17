// js/storage.js

const KEYS = { RECORDS: 'food_records', SETTINGS: 'settings' };

const DEFAULT_SETTINGS = {
  api_key: '',
  daily_calorie_target: 1800,
  protein_target: 60,
  fat_target: 65,
  carbs_target: 180
};

export function getRecords() {
  try { return JSON.parse(localStorage.getItem(KEYS.RECORDS)) || []; }
  catch { return []; }
}

export function saveRecords(records) {
  try { localStorage.setItem(KEYS.RECORDS, JSON.stringify(records)); }
  catch (e) { throw new Error('存储空间不足，请导出数据后清理旧记录'); }
}

export function addRecord(record) {
  const records = getRecords();
  records.unshift(record);
  saveRecords(records);
}

export function deleteRecord(id) {
  saveRecords(getRecords().filter(r => r.id !== id));
}

export function getRecordsByDate(dateStr) {
  return getRecords().filter(r => r.date === dateStr);
}

export function getRecordsLastNDays(n) {
  const dates = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return getRecords().filter(r => dates.includes(r.date));
}

export function getDatesWithRecords() {
  return [...new Set(getRecords().map(r => r.date))].sort().reverse();
}

export function getDayTotal(dateStr) {
  return getRecordsByDate(dateStr).reduce((sum, r) => sum + (r.calories || 0), 0);
}

export function exportJSON() {
  const data = { records: getRecords(), settings: getSettings(), exported_at: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `calorie-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importJSON(file) {
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

export function getSettings() {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEYS.SETTINGS)) }; }
  catch { return { ...DEFAULT_SETTINGS }; }
}

export function saveSettings(settings) {
  localStorage.setItem(KEYS.SETTINGS, JSON.stringify({ ...DEFAULT_SETTINGS, ...settings }));
}

export function getApiKey() {
  return getSettings().api_key || '';
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}
