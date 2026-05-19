import { addRecord, deleteRecord, generateId } from './storage.js';

export function showToast(msg, type) {
  type = type || 'info';
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast toast-' + type;
  t.style.display = 'block';
  clearTimeout(t._timer);
  t._timer = setTimeout(function(){ t.style.display = 'none'; }, 3000);
}

export function showLoading() { document.getElementById('loading').style.display = 'flex'; }
export function hideLoading() { document.getElementById('loading').style.display = 'none'; }

export function renderResult(data) {
  var c = document.getElementById('result-container');
  var now = new Date();
  var rec = {
    id: generateId(),
    food_name: data.food_name,
    serving_size: data.serving_size,
    date: now.toISOString().slice(0,10),
    time: now.toTimeString().slice(0,5),
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
  var total = (rec.protein_g||0)+(rec.fat_g||0)+(rec.carbs_g||0);
  var ring = total>0 ? rings(rec,total) : '';

  c.innerHTML = '<div class="result-card">'
    +'<div class="result-header">'
    +'<h2>'+esc(rec.food_name)+'</h2>'
    +'<p class="result-serving">'+esc(rec.serving_size)+'</p>'
    +'</div>'
    +'<div class="result-dashboard">'
    +'<div class="calorie-ring">'
    +'<svg viewBox="0 0 120 120" class="ring-svg">'
    +'<circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" stroke-width="8"/>'
    +ring
    +'<circle cx="60" cy="60" r="44" fill="var(--card)"/>'
    +'</svg>'
    +'<div class="ring-center"><span class="calorie-value">'+rec.calories+'</span><span class="calorie-unit">kcal</span></div>'
    +'</div>'
    +'<div class="result-macros">'
    +macroRow('p','蛋白质',rec.protein_g,'g')
    +macroRow('f','脂肪',rec.fat_g,'g')
    +macroRow('c','碳水',rec.carbs_g,'g')
    +'</div>'
    +'</div>'
    +'<div class="result-details">'
    +detailItem('纤维',rec.fiber_g,'g')+detailItem('糖',rec.sugar_g,'g')
    +detailItem('钠',rec.sodium_mg,'mg')+detailItem('胆固醇',rec.cholesterol_mg,'mg')
    +detailItem('饱和脂肪',rec.saturated_fat_g,'g')+detailItem('不饱和',rec.unsaturated_fat_g,'g')
    +'</div>'
    +(rec.notes?'<div class="result-notes">'+esc(rec.notes)+'</div>':'')
    +'<button id="btn-save-record" class="btn-primary">保存记录</button>'
    +'</div>';

  c.style.display = 'block';
  c.scrollIntoView({behavior:'smooth'});

  document.getElementById('btn-save-record').addEventListener('click',function(){
    addRecord({...rec});
    showToast('已保存','success');
    var b = document.getElementById('btn-save-record');
    b.disabled = true;
    b.textContent = '已保存';
    document.dispatchEvent(new CustomEvent('records-changed'));
  });
}

function macroRow(k,label,val,unit){
  return '<div class="macro-row macro-row-'+k+'">'
    +'<div class="macro-dot macro-dot-'+k+'"></div>'
    +'<div class="macro-info"><span class="macro-label">'+label+'</span><span class="macro-value">'+val+unit+'</span></div>'
    +'</div>';
}

function detailItem(label,val,unit){
  return '<div class="detail-item"><span>'+label+'</span><b>'+val+(unit||'')+'</b></div>';
}

function rings(rec,total){
  var circ = 2*Math.PI*52;
  var segs = [
    {v:rec.protein_g||0,c:'#f0a33b'},
    {v:rec.fat_g||0,c:'#ff5e5b'},
    {v:rec.carbs_g||0,c:'#5ac8fa'}
  ];
  var off=0, h='';
  for(var i=0;i<segs.length;i++){
    var s=segs[i], len=(s.v/total)*circ;
    h+='<circle cx="60" cy="60" r="52" fill="none" stroke="'+s.c+'" stroke-width="8" stroke-dasharray="'+len+' '+(circ-len)+'" stroke-dashoffset="'+(off==0?0:-off)+'" transform="rotate(-90 60 60)"/>';
    off+=len;
  }
  return h;
}

export function renderHistory(records, dateStr) {
  var c = document.getElementById('history-list');
  if(!records.length){
    c.innerHTML = '<div class="empty-state"><div class="empty-icon">🍽</div><p>暂无记录</p><p class="empty-hint">去「拍照」添加第一餐吧</p></div>';
    return;
  }
  var h = '';
  for(var i=0;i<records.length;i++){
    var r=records[i];
    h+='<div class="history-item" data-id="'+r.id+'">'
      +'<div class="history-item-header" onclick="this.parentElement.classList.toggle(\'expanded\')">'
      +'<div class="history-item-info"><div class="history-item-name">'+esc(r.food_name)+'</div><div class="history-item-meta">'+r.time+'</div></div>'
      +'<div class="history-item-calories"><span>'+r.calories+'</span><span class="macro-summary">P'+r.protein_g+' F'+r.fat_g+' C'+r.carbs_g+'</span></div>'
      +'</div>'
      +'<div class="history-item-detail"><div class="detail-grid">'
      +'<div>纤维 <b>'+r.fiber_g+'g</b></div><div>糖 <b>'+r.sugar_g+'g</b></div>'
      +'<div>钠 <b>'+r.sodium_mg+'mg</b></div><div>胆固醇 <b>'+r.cholesterol_mg+'mg</b></div>'
      +'<div>饱脂 <b>'+r.saturated_fat_g+'g</b></div><div>不饱脂 <b>'+r.unsaturated_fat_g+'g</b></div>'
      +'</div>'
      +(r.notes?'<p style="font-size:12px;color:var(--text2);margin-bottom:10px">'+esc(r.notes)+'</p>':'')
      +'<div class="detail-actions"><button class="btn-small btn-danger" onclick="globalThis.deleteRecordById(\''+r.id+'\')">删除</button></div>'
      +'</div></div>';
  }
  c.innerHTML = h;
}

export function renderAdvice(data) {
  var c = document.getElementById('advice-container');
  c.style.display = 'block';

  var trends = '';
  if(data.aggregated && data.aggregated.total_records>0) trends = buildTrends(data.aggregated);

  var warns = '';
  var ww = data.warnings||[];
  for(var i=0;i<ww.length;i++){
    var w=ww[i], lv=w.level||'info';
    warns+='<div class="advice-card advice-'+lv+'"><div class="advice-card-title">'+ico(lv)+' '+esc(w.title)+'</div><p>'+esc(w.detail)+'</p></div>';
  }

  c.innerHTML = (data.summary?'<p class="advice-summary">'+esc(data.summary)+'</p>':'')+trends+warns;
  c.scrollIntoView({behavior:'smooth'});
}

function buildTrends(agg){
  if(!agg||!agg.daily_averages||!agg.targets) return '';
  var a=agg.daily_averages, t=agg.targets;
  var items=[
    {label:'日均热量',avg:a.calories||0,target:t.calories||1,unit:'kcal'},
    {label:'蛋白质',avg:a.protein_g||0,target:t.protein_g||1,unit:'g'},
    {label:'脂肪',avg:a.fat_g||0,target:t.fat_g||1,unit:'g'},
    {label:'碳水',avg:a.carbs_g||0,target:t.carbs_g||1,unit:'g'}
  ];
  var rows='';
  for(var i=0;i<items.length;i++){
    var it=items[i], pct=Math.min(100,Math.round((it.avg/it.target)*100));
    var color = pct<=95?'#f0a33b':pct<=110?'#4cd964':'#ff5e5b';
    var em = pct<=95?'⚠':pct<=110?'✓':'✗';
    rows+='<div class="trend-row"><div class="trend-info"><span>'+it.label+'</span><b style="color:'+color+'">'+it.avg+' / '+it.target+' '+it.unit+' '+em+'</b></div>'
      +'<div class="trend-bar"><div class="trend-fill" style="width:'+pct+'%;background:'+color+'"></div></div></div>';
  }
  return '<div class="trends-card"><h3>近 7 天趋势</h3>'+rows+'</div>';
}

function ico(lv){ return lv==='warning'?'⚠':lv==='good'?'✓':'ℹ'; }

function esc(s){
  if(!s) return '';
  var d=document.createElement('div');
  d.textContent=String(s);
  return d.innerHTML;
}

globalThis.deleteRecordById = function(id){
  if(confirm('确定删除这条记录？')){
    deleteRecord(id);
    showToast('已删除','info');
    document.dispatchEvent(new CustomEvent('records-changed'));
  }
};
