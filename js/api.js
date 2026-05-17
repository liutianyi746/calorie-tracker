// js/api.js

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

export async function analyzeFood(foodDesc, apiKey) {
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

export async function generateAdvice(records, settings, apiKey) {
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
