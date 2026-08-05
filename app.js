const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const escapeHtml=value=>String(value).replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
let toastTimer;
function showToast(message){const toast=$('#appToast');if(!toast)return;toast.textContent=message;toast.classList.add('is-visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('is-visible'),2200)}
function formatSavedMoment(value){if(!value)return '';const date=new Date(value);if(Number.isNaN(date.getTime()))return '';const sameDay=dateKey(date)===dateKey(new Date());return `${sameDay?'今天':`${date.getMonth()+1}月${date.getDate()}日`} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`}

const defaultTransactions=[
  {id:'demo-coffee',icon:'☕',name:'早餐咖啡',category:'餐饮',amount:26,time:'今天 08:35'},
  {id:'demo-metro',icon:'🚇',name:'地铁通勤',category:'交通',amount:6,time:'今天 08:10'},
  {id:'demo-paper',icon:'📚',name:'论文资料',category:'学习',amount:68,time:'昨天 20:16'}
];
const defaultReviewPosts=[
  {id:101,platform:'xhs',date:'2026-07-20',title:'职场小白一定要学会工作留痕',impressions:18600,views:6420,completion:42,hook5:0,likes:384,comments:72,saves:516,shares:91,follows:68,avgWatch:27},
  {id:102,platform:'xhs',date:'2026-07-17',title:'领导说你自己看着办，到底在考验什么',impressions:12800,views:3980,completion:35,hook5:0,likes:205,comments:89,saves:274,shares:66,follows:41,avgWatch:23},
  {id:103,platform:'xhs',date:'2026-07-14',title:'下班前做完这3件事，第二天少焦虑一半',impressions:9200,views:2710,completion:31,hook5:0,likes:148,comments:35,saves:226,shares:38,follows:19,avgWatch:21},
  {id:104,platform:'douyin',date:'2026-07-19',title:'不加班的人，到底做对了什么',impressions:38200,views:36500,completion:34,hook5:58,likes:1420,comments:203,saves:520,shares:366,follows:218,avgWatch:22},
  {id:105,platform:'douyin',date:'2026-07-15',title:'30岁后才懂：稳定是可迁移能力',impressions:24700,views:23100,completion:24,hook5:42,likes:760,comments:158,saves:281,shares:205,follows:96,avgWatch:17}
];
let trendData={schemaVersion:2,updatedAt:null,window:'等待首次平台热点更新',brief:{},qualityPolicy:{},hotTopics:{xiaohongshu:[],douyin:[]},items:[],appReviewCandidates:[],observations:[]};
const SETTINGS_KEY='wmq_settings';
let appSettings={fontSize:'comfortable',trendReminder:true,reminderTime:'10:00',showBenchmarkLinks:true,...JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')};

const storedTransactions=localStorage.getItem('wmq_transactions');
let transactions;
try{const parsed=storedTransactions===null?defaultTransactions:JSON.parse(storedTransactions);transactions=Array.isArray(parsed)?parsed:defaultTransactions}catch(error){transactions=defaultTransactions}
transactions=transactions.map((item,index)=>({...item,id:item.id??`legacy-transaction-${index}-${item.time||''}-${item.amount||0}`}));
let usingDemoReview=!localStorage.getItem('wmq_review_posts');
let reviewPosts=JSON.parse(localStorage.getItem('wmq_review_posts')||'null')||defaultReviewPosts;
if(!usingDemoReview)reviewPosts=reviewPosts.map((post,index)=>({...post,id:post.id??`legacy-review-${index}-${post.date||''}`}));
let activeReviewFilter='all';

// 所有删除操作共用同一个确认窗口，避免手机端误触。
let pendingConfirmResolve=null;
function settleConfirm(result){if(!pendingConfirmResolve)return;const resolve=pendingConfirmResolve;pendingConfirmResolve=null;if($('#confirmDialog').open)$('#confirmDialog').close();resolve(result)}
function askConfirm({title='确认删除？',message='删除后无法恢复。',confirmText='确认删除'}={}){
  if(pendingConfirmResolve)settleConfirm(false);
  $('#confirmTitle').textContent=title;$('#confirmMessage').textContent=message;$('#confirmAccept').textContent=confirmText;$('#confirmDialog').showModal();
  return new Promise(resolve=>{pendingConfirmResolve=resolve});
}
$('#confirmCancel').addEventListener('click',()=>settleConfirm(false));
$('#confirmAccept').addEventListener('click',()=>settleConfirm(true));
$('#confirmDialog').addEventListener('cancel',event=>{event.preventDefault();settleConfirm(false)});
$('#confirmDialog').addEventListener('click',event=>{if(event.target===$('#confirmDialog'))settleConfirm(false)});

// 日常 List：按日期保存论文、餐食和健身的简要记录。
const DAILY_KEY='wmq_daily_records';
let dailyRecords=JSON.parse(localStorage.getItem(DAILY_KEY)||'{}');
const today=new Date();
let selectedDate=new Date(today.getFullYear(),today.getMonth(),today.getDate());
let calendarDate=new Date(today.getFullYear(),today.getMonth(),1);
const weekNames=['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
const monthNames=['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
const dateKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const recordHasPaper=record=>Boolean(record?.paper?.done||record?.paper?.note?.trim());
const recordHasMeal=record=>Boolean(record?.meal?.done||record?.meal?.breakfast?.trim()||record?.meal?.lunch?.trim()||record?.meal?.dinner?.trim());
const recordHasFitness=record=>Boolean(record?.fitness?.done||record?.fitness?.note?.trim()||Number(record?.fitness?.minutes));

function currentDailyDraft(){
  return {
    paper:{done:$('#dailyPaperDone').checked,note:$('#dailyPaperNote').value.trim()},
    meal:{done:$('#dailyMealDone').checked,breakfast:$('#dailyBreakfast').value.trim(),lunch:$('#dailyLunch').value.trim(),dinner:$('#dailyDinner').value.trim()},
    fitness:{done:$('#dailyFitnessDone').checked,note:$('#dailyFitnessNote').value.trim(),minutes:Number($('#dailyFitnessMinutes').value)||0}
  };
}
function updateDailyCompletion(record=currentDailyDraft()){
  const completed=[record.paper.done,record.meal.done,record.fitness.done].filter(Boolean).length;
  $('#dailyCompletion').textContent=`${completed}/3`;
}
function loadDailyRecord(){
  const key=dateKey(selectedDate),record=dailyRecords[key]||{};
  $('#selectedDayTitle').textContent=`${selectedDate.getMonth()+1}月${selectedDate.getDate()}日 · ${weekNames[selectedDate.getDay()]}`;
  $('#dailyPaperDone').checked=Boolean(record.paper?.done);$('#dailyPaperNote').value=record.paper?.note||'';
  $('#dailyMealDone').checked=Boolean(record.meal?.done);$('#dailyBreakfast').value=record.meal?.breakfast||'';$('#dailyLunch').value=record.meal?.lunch||'';$('#dailyDinner').value=record.meal?.dinner||'';
  $('#dailyFitnessDone').checked=Boolean(record.fitness?.done);$('#dailyFitnessNote').value=record.fitness?.note||'';$('#dailyFitnessMinutes').value=record.fitness?.minutes||'';
  const hasStored=Boolean(dailyRecords[key]);
  $('#saveDailyRecord').textContent=hasStored?'✓ 已保存':'保存这一天';$('#saveDailyRecord').classList.toggle('is-saved',hasStored);
  $('#clearDailyRecord').disabled=!hasStored&&!fitnessEntry(key).checks.length;
  $('#dailySaveStatus').textContent=hasStored?`✓ 已保存在本机${record.savedAt?` · ${formatSavedMoment(record.savedAt)}`:''} · 已留在日历`:'';
  updateDailyCompletion();
}
function renderCalendar(){
  $('#calendarYear').textContent=calendarDate.getFullYear();
  $('#calendarMonth').textContent=monthNames[calendarDate.getMonth()];
  const first=new Date(calendarDate.getFullYear(),calendarDate.getMonth(),1);
  const mondayOffset=(first.getDay()+6)%7;
  const gridStart=new Date(first);gridStart.setDate(first.getDate()-mondayOffset);
  const selectedKey=dateKey(selectedDate),todayKey=dateKey(today);
  $('#dailyCalendar').innerHTML=Array.from({length:42},(_,index)=>{
    const day=new Date(gridStart);day.setDate(gridStart.getDate()+index);
    const key=dateKey(day),record=dailyRecords[key],hasRecord=recordHasPaper(record)||recordHasMeal(record)||recordHasFitness(record);
    const dots=`${recordHasPaper(record)?'<i class="paper-dot"></i>':''}${recordHasMeal(record)?'<i class="meal-dot"></i>':''}${recordHasFitness(record)?'<i class="fitness-dot"></i>':''}`;
    const classes=['calendar-day'];
    if(day.getMonth()!==calendarDate.getMonth())classes.push('is-other');
    if(key===todayKey)classes.push('is-today');
    if(key===selectedKey)classes.push('is-selected');
    if(hasRecord)classes.push('has-record');
    return `<button class="${classes.join(' ')}" data-date="${key}" aria-label="选择${day.getMonth()+1}月${day.getDate()}日"><span>${day.getDate()}</span><span class="calendar-dots">${dots}</span></button>`;
  }).join('');
  $$('.calendar-day').forEach(button=>button.addEventListener('click',()=>{
    const [year,month,day]=button.dataset.date.split('-').map(Number);
    selectedDate=new Date(year,month-1,day);
    if(selectedDate.getMonth()!==calendarDate.getMonth()||selectedDate.getFullYear()!==calendarDate.getFullYear())calendarDate=new Date(year,month-1,1);
    renderCalendar();loadDailyRecord();
  }));
}
$('#calendarPrev').addEventListener('click',()=>{calendarDate=new Date(calendarDate.getFullYear(),calendarDate.getMonth()-1,1);renderCalendar()});
$('#calendarNext').addEventListener('click',()=>{calendarDate=new Date(calendarDate.getFullYear(),calendarDate.getMonth()+1,1);renderCalendar()});
function markDailyDirty(){const button=$('#saveDailyRecord');button.textContent='保存这一天';button.classList.remove('is-saved');$('#dailySaveStatus').textContent='有新的修改，保存后会留在日历里'}
['#dailyPaperDone','#dailyMealDone','#dailyFitnessDone','#dailyPaperNote','#dailyBreakfast','#dailyLunch','#dailyDinner','#dailyFitnessNote','#dailyFitnessMinutes'].forEach(id=>$(id).addEventListener('input',()=>{updateDailyCompletion();markDailyDirty()}));
$('#saveDailyRecord').addEventListener('click',()=>{
  dailyRecords[dateKey(selectedDate)]={...currentDailyDraft(),savedAt:new Date().toISOString()};localStorage.setItem(DAILY_KEY,JSON.stringify(dailyRecords));
  renderCalendar();renderOverview();renderFitnessHistory();loadDailyRecord();showToast('这一天已保存，并在日历留下记录');
});
$('#clearDailyRecord').addEventListener('click',async()=>{
  const key=dateKey(selectedDate),confirmed=await askConfirm({title:'清除这一天？',message:`${selectedDate.getMonth()+1}月${selectedDate.getDate()}日的论文、餐食和训练记录都会被清除。`,confirmText:'清除记录'});if(!confirmed)return;
  delete dailyRecords[key];delete fitnessChecks[key];localStorage.setItem(DAILY_KEY,JSON.stringify(dailyRecords));localStorage.setItem(FITNESS_KEY,JSON.stringify(fitnessChecks));
  renderCalendar();renderOverview();renderWorkoutProgress();renderFitnessHistory();loadDailyRecord();showToast('这一天的记录已清除');
});

// 健身独立页：保留今天的训练勾选，作为日常记录之外的第二层。
const FITNESS_KEY='wmq_fitness_checks';
let fitnessChecks=JSON.parse(localStorage.getItem(FITNESS_KEY)||'{}');
function fitnessEntry(key){const entry=fitnessChecks[key];return Array.isArray(entry)?{checks:entry,savedAt:''}:{checks:Array.isArray(entry?.checks)?entry.checks:[],savedAt:entry?.savedAt||''}}
function fitnessDateLabel(key){const [year,month,day]=key.split('-').map(Number),date=new Date(year,month-1,day);return `${month}月${day}日 · ${weekNames[date.getDay()]}`}
function renderWorkoutProgress(){
  const checks=fitnessEntry(dateKey(today)).checks;
  $$('#fitnessWorkoutList [data-workout]').forEach(input=>input.checked=checks.includes(input.dataset.workout));
  $('#fitnessWorkoutProgress').textContent=`今天完成 ${checks.length} / 6`;
}
function renderFitnessHistory(){
  const keys=[...new Set([...Object.keys(fitnessChecks),...Object.keys(dailyRecords).filter(key=>recordHasFitness(dailyRecords[key]))])].filter(key=>fitnessEntry(key).checks.length||recordHasFitness(dailyRecords[key])).sort((a,b)=>b.localeCompare(a));
  $('#fitnessHistoryCount').textContent=`${keys.length} 次`;
  $('#fitnessHistoryList').innerHTML=keys.length?keys.map(key=>{const entry=fitnessEntry(key),record=dailyRecords[key]?.fitness||{},parts=[];if(entry.checks.length)parts.push(`训练动作 ${entry.checks.length}/6`);if(Number(record.minutes))parts.push(`${Number(record.minutes)} 分钟`);const note=record.note?.trim();return `<article class="history-card fitness-history-card"><div><span>练</span><section><b>${escapeHtml(fitnessDateLabel(key))}</b><small>${escapeHtml(parts.join(' · ')||'已完成训练记录')}</small>${note?`<p>${escapeHtml(note)}</p>`:''}</section><button class="item-delete-button" data-delete-fitness="${key}" aria-label="删除${escapeHtml(fitnessDateLabel(key))}的训练记录">删</button></div></article>`}).join(''):'<div class="history-empty"><span>练</span><p>完成训练清单或在日常 List 保存健身记录后，会按日期出现在这里。</p></div>';
  $$('#fitnessHistoryList [data-delete-fitness]').forEach(button=>button.addEventListener('click',async()=>{const key=button.dataset.deleteFitness,confirmed=await askConfirm({title:'删除训练记录？',message:`${fitnessDateLabel(key)}的训练清单和健身记录会被删除，论文与餐食仍会保留。`});if(!confirmed)return;delete fitnessChecks[key];if(dailyRecords[key]){delete dailyRecords[key].fitness;if(!recordHasPaper(dailyRecords[key])&&!recordHasMeal(dailyRecords[key]))delete dailyRecords[key]}localStorage.setItem(FITNESS_KEY,JSON.stringify(fitnessChecks));localStorage.setItem(DAILY_KEY,JSON.stringify(dailyRecords));renderWorkoutProgress();renderFitnessHistory();renderCalendar();renderOverview();loadDailyRecord();showToast('训练记录已删除')}));
}
function renderOverview(){
  const record=dailyRecords[dateKey(today)]||{},checks=fitnessEntry(dateKey(today)).checks;
  const paperDone=Boolean(record.paper?.done),mealDone=Boolean(record.meal?.done),fitnessDone=Boolean(record.fitness?.done);
  const completed=[paperDone,mealDone,fitnessDone].filter(Boolean).length,percent=Math.round(completed/3*100);
  $('#overviewDate').textContent=`${today.getMonth()+1}月${today.getDate()}日 · ${weekNames[today.getDay()]}`;
  $('#overviewDone').textContent=`${completed} / 3`;$('#overviewPercent').textContent=`${percent}%`;$('#overviewProgressBar').style.width=`${percent}%`;
  $('#overviewHeadline').textContent=completed===3?'今天的日常已经完成':completed===0?'先完成一件最重要的事':`很好，还剩 ${3-completed} 项日常记录`;
  $('#overviewHeadline').classList.toggle('overview-headline-done',completed===3);
  [["#overviewPaperState",paperDone],["#overviewMealState",mealDone],["#overviewFitnessState",fitnessDone]].forEach(([selector,done])=>{$(selector).textContent=done?'✓ 已完成':'待记录';$(selector).classList.toggle('is-done',done)});
  $('#overviewFitnessProgress').textContent=`训练清单 ${checks.length} / 6`;
  const currentTopics=getCurrentTopics(),hasLiveTrends=trendData.items.length>0;
  $('#overviewIdeaTitle').textContent=currentTopics[0]?.title||'等待今日平台热点更新';
  $('#overviewTrendStatus').textContent=hasLiveTrends?`严格定位筛选 · ${trendData.items.length} 条入选`:'平台热点 · 暂无已核验数据';
  if(reviewPosts.length){const diagnosis=reviewDiagnosis(reviewPosts,'all');$('#overviewReviewTitle').textContent=usingDemoReview?'录入真实数据，开始你的第一次复盘':diagnosis.experiment}else $('#overviewReviewTitle').textContent='录入数据后生成优化建议';
}
$$('#fitnessWorkoutList [data-workout]').forEach(input=>input.addEventListener('change',()=>{
  const key=dateKey(today),checks=$$('#fitnessWorkoutList [data-workout]:checked').map(item=>item.dataset.workout);
  if(checks.length)fitnessChecks[key]={checks,savedAt:new Date().toISOString()};else delete fitnessChecks[key];
  localStorage.setItem(FITNESS_KEY,JSON.stringify(fitnessChecks));renderWorkoutProgress();renderFitnessHistory();renderOverview();
}));

// 选题灵感：真实热点从 data/trends.json 读取；没有数据时明确显示账号定位示例。
function safeSourceUrl(value){
  try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)?url.href:''}catch(error){return ''}
}
function platformKey(value){const text=String(value||'').toLowerCase(),hasXhs=text.includes('小红书')||text.includes('xhs'),hasDouyin=text.includes('抖音')||text.includes('douyin');if(text.includes('跨平台')||text.includes('cross')||(hasXhs&&hasDouyin))return 'cross';if(hasXhs)return 'xhs';if(hasDouyin)return 'douyin';return 'other'}
function getCurrentTopics(){
  if(!trendData.items.length)return [];
  return trendData.items.map((item,index)=>({
    id:item.id||`trend-${index+1}`,rank:Number(item.rank)||index+1,kind:item.kind||'all',tag:item.tag||item.platform||'职场热点',title:item.title||'未命名热点',signalTopic:item.signalTopic||item.topic||'',
    why:item.relevance||item.why||'等待补充与账号定位的关联说明。',judgment:item.angle||item.judgment||'等待补充适合李老师的口播判断。',
    keywords:Array.isArray(item.keywords)?item.keywords:[],platform:item.platform||'',platformKey:platformKey(item.platform),crossPlatform:Boolean(item.crossPlatform),publishedAt:item.publishedAt||'',heatEvidence:item.heatEvidence||'',
    sourceUrl:safeSourceUrl(item.sourceUrl),sourceType:item.sourceType||'平台原始内容',sourceValid:item.sourceValid===true,publishable:item.publishable===true,confidence:item.confidence||'',audience:item.audience||'',scene:item.scene||'',action:item.action||'',conclusion:item.conclusion||'',hook:item.hook||'',whyNow:item.whyNow||'',topPick:Boolean(item.topPick),selectedForProduction:Boolean(item.selectedForProduction),productionStatus:item.productionStatus||'',
    coverDescription:typeof item.cover==='string'?item.cover:item.cover?.description||item.coverDescription||'未获取',originalTitle:item.originalTitle||item.caption||item.title||'未显示',author:item.author||'未显示',metrics:item.metrics&&typeof item.metrics==='object'?item.metrics:{},visibleData:item.visibleData||item.data||'',commentInsights:Array.isArray(item.commentInsights)?item.commentInsights:item.commentInsights?[item.commentInsights]:[],topicTags:Array.isArray(item.topicTags)?item.topicTags:Array.isArray(item.tags)?item.tags:[],contentFramework:item.contentFramework&&typeof item.contentFramework==='object'?item.contentFramework:{},coverTitle:item.coverTitle||'',publishTitle:item.publishTitle||'',
    benchmarkLinks:(Array.isArray(item.benchmarkLinks)?item.benchmarkLinks:Array.isArray(item.referenceLinks)?item.referenceLinks:[]).map(link=>({label:link?.label||link?.title||link?.platform||'对标内容',platform:link?.platform||'',url:safeSourceUrl(link?.url)})).filter(link=>link.url)
  }));
}
const textList=value=>Array.isArray(value)?value.filter(Boolean):value?[value]:[];
const metricLabel={likes:'点赞',collects:'收藏',comments:'评论',shares:'转发',interaction:'互动',views:'播放/阅读'};
function renderMetricItems(metrics={},visibleData=''){
  const rows=Object.entries(metricLabel).filter(([key])=>metrics[key]!==undefined&&metrics[key]!==null&&metrics[key]!=='').map(([key,label])=>`<span>${label}<b>${escapeHtml(metrics[key])}</b></span>`);
  if(visibleData)rows.push(`<span class="metric-wide">平台可见数据<b>${escapeHtml(visibleData)}</b></span>`);return rows.join('');
}
function renderContentFramework(framework={}){
  const body=textList(framework.body||framework.threePartBody),rows=[['开场',framework.hook],['冲突',framework.conflict],['判断',framework.judgment],['三段正文',body.join(' → ')],['例证',framework.evidence],['收尾动作',framework.closingAction||framework.action]].filter(([,value])=>value);
  return rows.length?`<details class="content-framework"><summary>查看可复用口播框架</summary>${rows.map(([label,value])=>`<div><span>${label}</span><p>${escapeHtml(value)}</p></div>`).join('')}</details>`:'';
}
function formatTrendUpdate(value){
  if(!value)return '';
  if(/^\d{4}-\d{2}-\d{2}$/.test(String(value))){const [,month,day]=String(value).split('-');return `${Number(month)}月${Number(day)}日`}
  const date=new Date(value);if(Number.isNaN(date.getTime()))return String(value);
  return `${date.getMonth()+1}月${date.getDate()}日 ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
}
function renderTrendBrief(){
  const brief=trendData.brief||{},hasBrief=Boolean(brief.conclusion||brief.selectionNote||brief.platformDifferences||brief.rejected?.length||brief.risks?.length),topCount=trendData.items.filter(item=>item.topPick).length,queueCount=trendData.items.filter(item=>item.selectedForProduction).length;
  $('#trendBrief').hidden=!hasBrief;$('#trendDebrief').hidden=!hasBrief;if(!hasBrief)return;
  $('#trendConclusion').textContent=Array.isArray(brief.conclusion)?brief.conclusion.join(' '):brief.conclusion||'';
  $('#trendBriefCounts').textContent=`${trendData.items.length} 条可推 · ${topCount} 条首选`;
  $('#trendSelectionNote').textContent=brief.selectionNote||`${queueCount} 条已进入生产队列；只有原稿链接和热度数据均通过的内容才会推送。`;
  $('#xhsDifference').textContent=brief.platformDifferences?.xiaohongshu||'暂无足够的已核验信号。';$('#douyinDifference').textContent=brief.platformDifferences?.douyin||'暂无足够的已核验信号。';
  $('#trendRejectedList').innerHTML=(brief.rejected||[]).map(item=>`<li>${escapeHtml(item)}</li>`).join('')||'<li>今日没有额外淘汰说明。</li>';
  $('#trendRiskList').innerHTML=(brief.risks||[]).map(item=>`<li>${escapeHtml(item)}</li>`).join('')||'<li>今日没有额外风险提示。</li>';
}
function renderHotTopicRadar(){
  const groups=[['小红书',trendData.hotTopics.xiaohongshu||[]],['抖音',trendData.hotTopics.douyin||[]]],count=groups.reduce((sum,[,items])=>sum+items.length,0);$('#hotTopicRadar').hidden=!count;if(!count)return;
  $('#hotTopicColumns').innerHTML=groups.map(([platform,items])=>`<article><div class="hot-topic-platform"><b>${platform}</b><span>${items.length} 个信号</span></div>${items.length?`<div class="hot-topic-list">${items.map(item=>{const url=safeSourceUrl(item.sourceUrl),meta=[item.targetAudience||item.audience,item.timeWindow].filter(Boolean).join(' · ');return `<div><h4>${escapeHtml(item.topic||item.tag||'未命名话题')}</h4>${meta?`<small>${escapeHtml(meta)}</small>`:''}${item.evidence?`<p>${escapeHtml(item.evidence)}</p>`:''}${url?`<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">查看平台话题 ↗</a>`:''}</div>`}).join('')}</div>`:'<p class="platform-topic-empty">暂无达到数据门的话题。</p>'}</article>`).join('');
}
function renderAppReviewCandidates(){
  const rows=trendData.appReviewCandidates;$('#appReviewSection').hidden=!rows.length;if(!rows.length)return;
  $('#appReviewList').innerHTML=rows.map(item=>{const url=safeSourceUrl(item.sourceUrl);return `<article><div><span>${escapeHtml(item.platform||'小红书')}</span><b>需 App 复核</b></div><h3>${escapeHtml(item.title||item.originalTitle||'未命名候选')}</h3>${item.coverDescription||item.cover?`<p><strong>封面：</strong>${escapeHtml(typeof item.cover==='string'?item.cover:item.cover?.description||item.coverDescription)}</p>`:''}${item.visibleData||item.heatEvidence?`<p><strong>卡片数据：</strong>${escapeHtml(item.visibleData||item.heatEvidence)}</p>`:''}<small>${escapeHtml(item.reason||'网页端无法打开原始笔记，不进入手机推送。')}</small>${url?`<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">查看候选证据 ↗</a>`:''}</article>`}).join('');
}
function renderTrendObservations(){
  const rows=trendData.observations;$('#trendObservationSection').hidden=!rows.length;if(!rows.length)return;
  $('#trendObservationCount').textContent=`${rows.length} 条未推送`;
  $('#trendObservationList').innerHTML=rows.map(item=>{const url=safeSourceUrl(item.sourceUrl);return `<li><b>${escapeHtml(item.title||item.topic||'备选观察')}</b><span>${escapeHtml(item.reason||'未通过新版热度或原稿链接门槛。')}</span>${item.evidence?`<small>${escapeHtml(item.evidence)}</small>`:''}${url?`<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">仅查看证据 ↗</a>`:''}</li>`}).join('');
}
function renderLiveViralBreakdowns(){
  const topics=getCurrentTopics();$('#liveViralSection').hidden=!topics.length;if(!topics.length)return;
  $('#liveViralList').innerHTML=topics.map(topic=>{const metrics=renderMetricItems(topic.metrics,topic.visibleData),comments=topic.commentInsights.join('；');return `<article class="live-viral-card"><div class="live-viral-top"><span>${escapeHtml(topic.platform)}</span><b>原稿已核验</b></div><h3>${escapeHtml(topic.originalTitle)}</h3><p><strong>封面/首帧：</strong>${escapeHtml(topic.coverDescription)}</p>${metrics?`<div class="hotpost-metrics">${metrics}</div>`:''}<div class="live-viral-insight"><span>评论区在讨论</span><p>${escapeHtml(comments||'评论区未开放/未抓取')}</p></div>${renderContentFramework(topic.contentFramework)}<a href="${escapeHtml(topic.sourceUrl)}" target="_blank" rel="noopener noreferrer">打开原始热稿 ↗</a></article>`}).join('');
}
function updateTrendStatus(message=''){
  const hasLiveTrends=trendData.items.length>0,updated=formatTrendUpdate(trendData.updatedAt);
  $('#trendStatusDot').classList.toggle('is-sample',!hasLiveTrends);
  $('#trendStatusTitle').textContent=hasLiveTrends?`今日可推送 ${trendData.items.length} 条热稿`:'今日暂无通过强校验的热稿';
  $('#trendStatusDetail').textContent=message||(hasLiveTrends?`${updated||'今日'}更新 · 原稿链接、热度数据、评论与框架已核验`:`${updated||'今日'}检查完成 · 只有搜索页或低互动的内容不会推送`);
}
function trendMatchesFilter(topic,filter){if(filter==='all')return true;if(filter==='xhs'||filter==='douyin')return topic.platformKey===filter;if(filter==='cross')return topic.platformKey==='cross'||topic.crossPlatform;return topic.kind===filter}
function renderTrends(filter='all'){
  const topics=getCurrentTopics(),rows=topics.filter(topic=>trendMatchesFilter(topic,filter));
  if(!rows.length){$('#trendList').innerHTML=`<article class="trend-empty"><span>⌁</span><h3>${topics.length?'这个分类暂时没有合格热稿':'今天没有内容通过推送门槛'}</h3><p>${topics.length?'可以切换“全部入选”查看已核验的原始热稿。':'必须同时具备可打开的原始笔记/视频、达标热度数据和可复用框架；备选信号会保留在下方观察区。'}</p><button type="button" id="emptyTrendRefresh">检查平台更新</button></article>`;$('#emptyTrendRefresh').addEventListener('click',()=>loadTrendData(true));return}
  $('#trendList').innerHTML=rows.map((topic,index)=>{
    const meta=[topic.platform,topic.publishedAt,topic.confidence?`可信度：${topic.confidence}`:''].filter(Boolean).join(' · '),badges=`<span class="source-valid-badge">原稿已核验</span>${topic.topPick?'<span class="trend-pick-badge">今日首选</span>':''}${topic.selectedForProduction?`<span class="trend-queue-badge">${escapeHtml(topic.productionStatus||'已进生产队列')}</span>`:''}`;
    const sourceLink=topic.sourceUrl?`<a href="${escapeHtml(topic.sourceUrl)}" target="_blank" rel="noopener noreferrer">打开原始笔记/视频 ↗</a>`:'';
    const benchmarkLinks=(topic.benchmarkLinks||[]).map(link=>`<a class="benchmark-link" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">对标：${escapeHtml(link.label)} ↗</a>`).join('');
    const linkRow=sourceLink||benchmarkLinks?`<div class="trend-link-row">${sourceLink}${benchmarkLinks}</div>`:'';
    const fitRows=[['适合谁',topic.audience],['具体场景',topic.scene],['可执行动作',topic.action]].filter(([,value])=>value).map(([label,value])=>`<div><span>${label}</span><p>${escapeHtml(value)}</p></div>`).join('');
    const metrics=renderMetricItems(topic.metrics,topic.visibleData),comments=topic.commentInsights.join('；'),tags=[...new Set([...topic.topicTags,...topic.keywords])],proof=`<div class="hotpost-proof"><div><span>封面/首帧</span><p>${escapeHtml(topic.coverDescription)}</p></div><div><span>平台原题</span><p>${escapeHtml(topic.originalTitle)}</p></div><div><span>作者</span><p>${escapeHtml(topic.author)}</p></div></div>`;
    const publishing=[topic.coverTitle?`<div><span>封面标题</span><p>${escapeHtml(topic.coverTitle)}</p></div>`:'',topic.publishTitle?`<div><span>发布标题</span><p>${escapeHtml(topic.publishTitle)}</p></div>`:''].join('');
    return `<article class="inspiration-card ${topic.topPick?'is-top-pick':''}"><div class="inspiration-card-top"><span class="inspiration-index">${String(topic.rank).padStart(2,'0')}</span><div class="trend-card-badges">${badges}<span class="inspiration-tag">${escapeHtml(topic.tag)}</span></div></div>${meta?`<p class="trend-evidence">${escapeHtml(meta)}</p>`:''}${topic.sourceType?`<p class="trend-source-type">${escapeHtml(topic.sourceType)}</p>`:''}${topic.signalTopic?`<p class="trend-signal-topic">平台话题 · ${escapeHtml(topic.signalTopic)}</p>`:''}${proof}${metrics?`<div class="hotpost-metrics">${metrics}</div>`:''}<div class="comment-insight"><span>评论区热点</span><p>${escapeHtml(comments||'评论区未开放/未抓取')}</p></div><h3>${escapeHtml(topic.title)}</h3><p>${escapeHtml(topic.why)}</p>${topic.heatEvidence?`<p class="trend-evidence"><b>热度依据：</b>${escapeHtml(topic.heatEvidence)}</p>`:''}${fitRows?`<div class="trend-fit-gate">${fitRows}</div>`:''}<div class="inspiration-judgment"><span>李老师式判断</span><p>${escapeHtml(topic.conclusion||topic.judgment)}</p></div>${topic.hook?`<div class="trend-hook"><span>口播钩子</span><p>${escapeHtml(topic.hook)}</p></div>`:''}${publishing?`<div class="publishing-copy">${publishing}</div>`:''}${topic.whyNow?`<p class="trend-why-now"><b>为什么现在做：</b>${escapeHtml(topic.whyNow)}</p>`:''}<div class="inspiration-keywords">${tags.map(keyword=>`<span>${escapeHtml(keyword)}</span>`).join('')}</div>${renderContentFramework(topic.contentFramework)}${linkRow}<div class="inspiration-actions"><button data-add-idea="${escapeHtml(topic.title)}">＋ 加入选题</button><button data-save-idea="${escapeHtml(topic.id)}">☆ 保存灵感</button></div></article>`
  }).join('');
  bindIdeaActions($('#trendList'));
}
async function loadTrendData(showFeedback=false){
  const button=$('#refreshTrends');
  if(showFeedback){button.textContent='检查中…';button.disabled=true}
  try{
    const stamp=Date.now(),sources=[
      `https://raw.githubusercontent.com/q651458843-star/wmq-workbench-app/main/data/trends.json?t=${stamp}`,
      `data/trends.json?v=20&t=${stamp}`
    ];
    const results=await Promise.allSettled(sources.map(async url=>{const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error('trend data unavailable');return response.json()}));
    const available=results.filter(result=>result.status==='fulfilled').map(result=>result.value).filter(data=>data&&typeof data==='object');
    if(!available.length)throw new Error('trend data unavailable');
    const data=available.sort((a,b)=>(Date.parse(b.updatedAt)||0)-(Date.parse(a.updatedAt)||0))[0],hotTopics=data.hotTopics&&typeof data.hotTopics==='object'?data.hotTopics:{};trendData={schemaVersion:Number(data.schemaVersion)||2,updatedAt:data.updatedAt||null,window:data.window||'',brief:data.brief&&typeof data.brief==='object'?data.brief:{},qualityPolicy:data.qualityPolicy&&typeof data.qualityPolicy==='object'?data.qualityPolicy:{},hotTopics:{xiaohongshu:Array.isArray(hotTopics.xiaohongshu)?hotTopics.xiaohongshu:[],douyin:Array.isArray(hotTopics.douyin)?hotTopics.douyin:[]},items:Array.isArray(data.items)?data.items.filter(item=>item&&item.title&&item.publishable===true&&item.sourceValid===true&&safeSourceUrl(item.sourceUrl)):[],appReviewCandidates:Array.isArray(data.appReviewCandidates)?data.appReviewCandidates:[],observations:Array.isArray(data.observations)?data.observations:[]};
    renderTrendBrief();renderHotTopicRadar();renderTrends($('#trendFilters .is-active')?.dataset.filter||'all');renderAppReviewCandidates();renderTrendObservations();renderLiveViralBreakdowns();renderCreationLibrary();renderOverview();updateTrendStatus(showFeedback?(trendData.items.length?'已读取通过原稿、热度、数据和评论门的热稿':'已是最新版；当前没有内容通过强原稿与热度门'):'');
  }catch(error){updateTrendStatus('暂时无法读取平台热点，请稍后再检查')}
  finally{if(showFeedback){button.textContent='检查更新';button.disabled=false}}
}
function readCollection(key){try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value:[]}catch(error){return []}}
function toggleCollection(key,value){const list=readCollection(key),exists=list.includes(value),next=exists?list.filter(item=>item!==value):[value,...list];localStorage.setItem(key,JSON.stringify(next));return !exists}
function setCollectionButtonState(button,isSaved){
  if(!button.dataset.idleLabel)button.dataset.idleLabel=button.textContent.trim();
  const savedLabel=button.hasAttribute('data-add-idea')?'✓ 已加入 · 可取消':'★ 已收藏 · 可取消';button.textContent=isSaved?savedLabel:button.dataset.idleLabel;button.classList.toggle('is-saved',isSaved);button.setAttribute('aria-pressed',String(isSaved));button.disabled=false;
}
function syncCollectionButtons(root=document){
  root.querySelectorAll('[data-add-idea]').forEach(button=>setCollectionButtonState(button,readCollection('wmq_idea_bank').includes(button.dataset.addIdea)));
  root.querySelectorAll('[data-save-idea]').forEach(button=>{const key=button.closest('#viralBreakdownList')?'wmq_saved_breakdowns':'wmq_saved_inspiration';setCollectionButtonState(button,readCollection(key).includes(button.dataset.saveIdea))});
}
function renderCreationLibrary(){
  const ideas=readCollection('wmq_idea_bank'),saved=readCollection('wmq_saved_inspiration'),breakdowns=readCollection('wmq_saved_breakdowns');
  $('#ideaBankCount').textContent=ideas.length;$('#savedInspirationCount').textContent=saved.length+breakdowns.length;
  $('#ideaBankRecent').innerHTML=ideas.length?`最近加入：<b>${escapeHtml(ideas[0])}</b>`:'还没有加入选题，点击下方“加入选题”即可留在这里。';
  const topicMap=new Map(getCurrentTopics().map(topic=>[String(topic.id),topic.title]));
  const group=(title,key,values,labeler,kind)=>`<section data-library-group="${kind}"><h4>${title}<span>${values.length}</span></h4>${values.length?`<div>${values.map(value=>`<article><p>${escapeHtml(labeler(value))}</p><button data-remove-collection="${key}" data-collection-value="${escapeHtml(value)}" aria-label="删除这条记录">×</button></article>`).join('')}</div>`:'<small>还没有记录</small>'}</section>`;
  $('#creationLibraryGroups').innerHTML=group('待创作选题','wmq_idea_bank',ideas,value=>value,'ideas')+group('收藏灵感','wmq_saved_inspiration',saved,value=>topicMap.get(String(value))||`热点记录：${value}`,'saved-inspiration')+group('收藏拆解','wmq_saved_breakdowns',breakdowns,value=>value,'saved-breakdowns');
  $$('#creationLibraryGroups [data-remove-collection]').forEach(button=>button.addEventListener('click',async()=>{const key=button.dataset.removeCollection,value=button.dataset.collectionValue,confirmed=await askConfirm({title:'从创作库移除？',message:'这条内容会从当前设备的创作库中删除。',confirmText:'确认移除'});if(!confirmed)return;const next=readCollection(key).filter(item=>String(item)!==value);localStorage.setItem(key,JSON.stringify(next));renderCreationLibrary();showToast('已从创作库移除')}));
  syncCollectionButtons();
}
function openCreationLibrary(target){
  const history=$('#creationLibraryHistory'),groups=$$('#creationLibraryGroups [data-library-group]');
  history.open=true;
  const savedGroups=groups.filter(section=>section.dataset.libraryGroup.startsWith('saved-'));
  const section=target==='ideas'?groups.find(item=>item.dataset.libraryGroup==='ideas'):(savedGroups.find(item=>item.querySelector('article'))||savedGroups[0]);
  groups.forEach(item=>item.classList.toggle('is-selected',item===section));
  $$('.creation-library-stat').forEach(button=>{const active=button.dataset.libraryTarget===target;button.classList.toggle('is-active',active);button.setAttribute('aria-expanded',String(active))});
  requestAnimationFrame(()=>section?.scrollIntoView({behavior:'smooth',block:'center'}));
}
$$('.creation-library-stat').forEach(button=>button.addEventListener('click',()=>openCreationLibrary(button.dataset.libraryTarget)));
function bindIdeaActions(root=document){
  root.querySelectorAll('[data-add-idea]').forEach(button=>{setCollectionButtonState(button,readCollection('wmq_idea_bank').includes(button.dataset.addIdea));button.addEventListener('click',()=>{const saved=toggleCollection('wmq_idea_bank',button.dataset.addIdea);setCollectionButtonState(button,saved);renderCreationLibrary();showToast(saved?'已加入“我的创作库”':'已取消加入选题')})});
  root.querySelectorAll('[data-save-idea]').forEach(button=>{const key=root.id==='viralBreakdownList'?'wmq_saved_breakdowns':'wmq_saved_inspiration';setCollectionButtonState(button,readCollection(key).includes(button.dataset.saveIdea));button.addEventListener('click',()=>{const saved=toggleCollection(key,button.dataset.saveIdea);setCollectionButtonState(button,saved);renderCreationLibrary();showToast(saved?'灵感已收藏并保存在本机':'已取消收藏')})});
}
$('#trendFilters').addEventListener('click',event=>{if(!event.target.matches('[data-filter]'))return;$$('#trendFilters button').forEach(button=>button.classList.remove('is-active'));event.target.classList.add('is-active');renderTrends(event.target.dataset.filter)});
$('#refreshTrends').addEventListener('click',()=>loadTrendData(true));
bindIdeaActions($('#viralBreakdownList'));
$('#viralFilters').addEventListener('click',event=>{if(!event.target.matches('[data-viral-filter]'))return;$$('#viralFilters button').forEach(button=>button.classList.remove('is-active'));event.target.classList.add('is-active');const filter=event.target.dataset.viralFilter;$$('#viralBreakdownList [data-viral-tags]').forEach(card=>card.hidden=filter!=='all'&&!card.dataset.viralTags.split(' ').includes(filter))});
$('#viralModeTabs').addEventListener('click',event=>{if(!event.target.matches('[data-viral-mode]'))return;$$('#viralModeTabs button').forEach(button=>button.classList.remove('is-active'));event.target.classList.add('is-active');$('#viralBreakdownList').classList.toggle('is-rewrite',event.target.dataset.viralMode==='rewrite')});

function renderTransactions(){
  $('#transactionList').innerHTML=transactions.length?transactions.map(item=>`<article class="transaction"><span>${item.icon}</span><div><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.category)} · ${escapeHtml(item.time)}</small></div><strong>− ¥${Number(item.amount).toFixed(2)}</strong><button class="item-delete-button" data-delete-transaction="${escapeHtml(item.id)}" aria-label="删除${escapeHtml(item.name)}">删</button></article>`).join(''):'<p class="list-empty-state">还没有记账记录，点击“＋ 记一笔”开始。</p>';
  $$('#transactionList [data-delete-transaction]').forEach(button=>button.addEventListener('click',async()=>{const item=transactions.find(row=>String(row.id)===button.dataset.deleteTransaction),confirmed=await askConfirm({title:'删除这笔记录？',message:item?`${item.name} · ¥${Number(item.amount).toFixed(2)} 将从当前设备删除。`:'这笔记录将从当前设备删除。'});if(!confirmed)return;transactions=transactions.filter(row=>String(row.id)!==button.dataset.deleteTransaction);localStorage.setItem('wmq_transactions',JSON.stringify(transactions));renderTransactions();showToast('记账记录已删除')}));
}
$('#openTransaction').addEventListener('click',()=>$('#transactionDialog').showModal());
$('#transactionForm').addEventListener('submit',event=>{event.preventDefault();const category=$('#transactionCategory').value;const icons={餐饮:'🍜',交通:'🚇',购物:'🛍',学习:'📚',其他:'◦'};transactions.unshift({id:Date.now(),icon:icons[category],name:$('#transactionNote').value.trim()||`${category}支出`,category,amount:Number($('#transactionAmount').value),time:'刚刚'});localStorage.setItem('wmq_transactions',JSON.stringify(transactions));renderTransactions();$('#transactionForm').reset();$('#transactionDialog').close();showToast('记账记录已保存')});

const reviewRate=(numerator,denominator)=>denominator>0?numerator/denominator*100:0;
const reviewAverage=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;
const reviewPercent=value=>Number.isFinite(value)?value.toFixed(1):'0.0';
function reviewRowMetrics(post){return {engagement:reviewRate(post.likes+post.comments+post.saves+post.shares,post.views),save:reviewRate(post.saves,post.views),follow:reviewRate(post.follows,post.views),view:reviewRate(post.views,post.impressions),completion:Number(post.completion)||0,hook:Number(post.hook5)||0}}
function reviewDiagnosis(rows,platform){
  const metrics=rows.map(reviewRowMetrics),xhsMetrics=rows.filter(post=>post.platform==='xhs').map(reviewRowMetrics),douyinMetrics=rows.filter(post=>post.platform==='douyin').map(reviewRowMetrics),choices=[];
  const addChoice=(key,label,values)=>{const valid=values.filter(value=>value>0);if(valid.length>1){const max=Math.max(...valid);choices.push({key,label,consistency:max?reviewAverage(valid)/max:1})}};
  if(platform==='xhs')addChoice('cover','标题与封面',metrics.map(metric=>metric.view));
  if(platform==='douyin')addChoice('hook','前 5 秒留存',metrics.map(metric=>metric.hook));
  if(platform==='all'){
    addChoice('cover','小红书标题与封面',xhsMetrics.map(metric=>metric.view));addChoice('hook','抖音前 5 秒留存',douyinMetrics.map(metric=>metric.hook));
    addChoice('retention','小红书内容留存',xhsMetrics.map(metric=>metric.completion));addChoice('retention','抖音内容留存',douyinMetrics.map(metric=>metric.completion));addChoice('save','小红书收藏价值',xhsMetrics.map(metric=>metric.save));addChoice('save','抖音收藏价值',douyinMetrics.map(metric=>metric.save));addChoice('follow','小红书关注转化',xhsMetrics.map(metric=>metric.follow));addChoice('follow','抖音关注转化',douyinMetrics.map(metric=>metric.follow));
  }else{addChoice('retention','内容留存',metrics.map(metric=>metric.completion));addChoice('save','收藏价值',metrics.map(metric=>metric.save));addChoice('follow','关注转化',metrics.map(metric=>metric.follow))}
  const weak=choices.sort((a,b)=>a.consistency-b.consistency)[0]||{key:'sample',label:'数据样本'};
  const copy={
    cover:{verdict:'标题与封面是当前最值得优化的环节',reason:'不同内容的打开表现波动较大，先验证包装方式，再判断选题本身。',experiment:'下一条只测试“身份词 + 具体场景”的封面标题',detail:'正文、时长和发布时间保持不变，让封面明确告诉用户“这条内容与谁有关”。'},
    hook:{verdict:'前 5 秒留存是当前最值得优化的环节',reason:'开场表现差异较大，说明进入观点的速度还不稳定。',experiment:'下一条只测试“先说结果”的开场',detail:'选题、时长和剪辑风格保持不变，用核心结论替换原来的背景铺垫。'},
    retention:{verdict:'内容中段留存是当前最值得优化的环节',reason:'用户愿意开始看，但不同内容的完播表现差异明显。',experiment:'下一条只测试“删掉一个重复观点”',detail:'开场和结论保持不变，把中段压缩成三个连续动作，观察完播变化。'},
    save:{verdict:'可收藏价值是当前最值得强化的环节',reason:'不同内容带来的收藏意愿差异较大，需要把方法讲得更可执行。',experiment:'下一条只增加“一屏总结清单”',detail:'其他结构保持不变，在结尾增加可以截图保存的三步清单。'},
    follow:{verdict:'关注转化是当前最值得优化的环节',reason:'内容产生了互动，但用户是否继续关注仍不稳定。',experiment:'下一条只测试“系列身份”收尾',detail:'内容主体保持不变，结尾明确这是一个连续系列，并预告下一条具体问题。'},
    sample:{verdict:'先积累三条以上内容再判断趋势',reason:'当前数据不足以形成稳定比较，暂时不建议下结论。',experiment:'下一条保持现有结构继续发布',detail:'先补足同平台、同内容类型的数据，再选择需要优化的变量。'}
  };
  return {weak,...copy[weak.key]};
}
function renderReview(filter=activeReviewFilter){
  activeReviewFilter=filter;const rows=(filter==='all'?reviewPosts:reviewPosts.filter(post=>post.platform===filter)).slice().sort((a,b)=>b.date.localeCompare(a.date));const label=filter==='xhs'?'小红书':filter==='douyin'?'抖音':'全平台';
  $('#reviewDataMode').textContent=usingDemoReview?'当前展示演示样本；录入首条真实数据后会自动清空演示数据。':'正在使用你录入的真实数据，所有记录仅保存在当前设备。';$('#reviewPlatformLabel').textContent=label;$('#reviewSample').textContent=`基于 ${rows.length} 条内容`;$('#reviewCount').textContent=rows.length;$('#reviewConfidence').textContent=rows.length<3?'样本偏少':rows.length<8?'样本可用':'趋势较稳';
  if(!rows.length){$('#reviewVerdict').textContent='还没有可复盘的数据';$('#reviewReason').textContent='录入一条内容或导入 CSV 后，这里会自动生成总结。';$('#reviewEngagement').textContent='0.0';$('#reviewFollow').textContent='0.0';$('#funnelExposureValue').textContent='0%';$('#funnelViewValue').textContent='0%';$('#funnelEngageValue').textContent='0%';$('#funnelFollowValue').textContent='0%';['#funnelExposure','#funnelView','#funnelEngage','#funnelFollow'].forEach(selector=>$(selector).style.width='0%');$('#reviewBestTitle').textContent='等待真实数据';$('#reviewBestReason').textContent='录入后自动识别表现最好的内容。';$('#reviewWeakPoint').textContent='等待样本';$('#reviewWeakReason').textContent='至少积累三条同平台内容，结论会更可靠。';$('#reviewExperiment').textContent='先录入一条已经发布的内容';$('#reviewExperimentDetail').textContent='把平台后台的真实数据填入，系统会自动生成下一步建议。';$('#reviewPostList').innerHTML='<p class="list-empty-state">当前筛选下还没有真实内容数据。</p>';return}
  const rowMetrics=rows.map(reviewRowMetrics),total=rows.reduce((sum,post)=>({impressions:sum.impressions+Number(post.impressions||0),views:sum.views+Number(post.views||0),deep:sum.deep+Number(post.comments||0)+Number(post.saves||0)+Number(post.shares||0),follows:sum.follows+Number(post.follows||0)}),{impressions:0,views:0,deep:0,follows:0});
  const viewRate=reviewRate(total.views,total.impressions),deepRate=reviewRate(total.deep,total.views),followRate=reviewRate(total.follows,total.views);
  $('#reviewEngagement').textContent=reviewPercent(reviewAverage(rowMetrics.map(metric=>metric.engagement)));$('#reviewFollow').textContent=reviewPercent(reviewAverage(rowMetrics.map(metric=>metric.follow)));$('#funnelExposureValue').textContent='100%';$('#funnelViewValue').textContent=`${reviewPercent(viewRate)}%`;$('#funnelEngageValue').textContent=`${reviewPercent(deepRate)}%`;$('#funnelFollowValue').textContent=`${reviewPercent(followRate)}%`;$('#funnelView').style.width=`${Math.min(100,viewRate)}%`;$('#funnelEngage').style.width=`${Math.min(100,deepRate*7)}%`;$('#funnelFollow').style.width=`${Math.min(100,followRate*22)}%`;
  const best=rows.reduce((top,post)=>reviewRowMetrics(post).engagement>reviewRowMetrics(top).engagement?post:top,rows[0]),bestMetrics=reviewRowMetrics(best),diagnosis=reviewDiagnosis(rows,filter);
  $('#reviewVerdict').textContent=diagnosis.verdict;$('#reviewReason').textContent=`「${best.title}」的综合互动率最高（${reviewPercent(bestMetrics.engagement)}%）。${diagnosis.reason}`;$('#reviewBestTitle').textContent=best.title;$('#reviewBestReason').textContent=`综合互动率 ${reviewPercent(bestMetrics.engagement)}%，收藏率 ${reviewPercent(bestMetrics.save)}%。`;$('#reviewWeakPoint').textContent=diagnosis.weak.label;$('#reviewWeakReason').textContent=diagnosis.reason;$('#reviewExperiment').textContent=diagnosis.experiment;$('#reviewExperimentDetail').textContent=diagnosis.detail;
  $('#reviewPostList').innerHTML=rows.map(post=>{const metric=reviewRowMetrics(post);return `<article class="review-post"><div class="review-post-top"><span class="review-post-platform ${post.platform}">${post.platform==='xhs'?'小红书':'抖音'}</span><div class="review-post-actions"><span class="review-post-date">${escapeHtml(post.date)}</span>${usingDemoReview?'':`<button class="item-delete-button" data-delete-review="${escapeHtml(post.id)}" aria-label="删除${escapeHtml(post.title)}">删</button>`}</div></div><h3>${escapeHtml(post.title)}</h3><div class="review-post-metrics"><span>阅读/播放<b>${Number(post.views).toLocaleString()}</b></span><span>互动率<b>${reviewPercent(metric.engagement)}%</b></span><span>收藏率<b>${reviewPercent(metric.save)}%</b></span><span>涨粉率<b>${reviewPercent(metric.follow)}%</b></span></div></article>`}).join('');
  $$('#reviewPostList [data-delete-review]').forEach(button=>button.addEventListener('click',async()=>{const post=reviewPosts.find(row=>String(row.id)===button.dataset.deleteReview),confirmed=await askConfirm({title:'删除这条复盘数据？',message:post?`“${post.title}”及其指标会被删除，复盘结论将重新计算。`:'删除后复盘结论会重新计算。'});if(!confirmed)return;reviewPosts=reviewPosts.filter(row=>String(row.id)!==button.dataset.deleteReview);saveReviewPosts();renderReview();renderOverview();showToast('复盘数据已删除，结论已更新')}));
}
const saveReviewPosts=()=>localStorage.setItem('wmq_review_posts',JSON.stringify(reviewPosts));
function selectReviewFilter(filter){$$('#reviewTabs button').forEach(button=>button.classList.toggle('is-active',button.dataset.reviewFilter===filter));renderReview(filter);renderOverview()}
$('#reviewTabs').addEventListener('click',event=>{if(event.target.matches('[data-review-filter]'))selectReviewFilter(event.target.dataset.reviewFilter)});
$('#openReviewEntry').addEventListener('click',()=>{$('#reviewDate').value=dateKey(today);$('#reviewDialog').showModal()});
$('#reviewForm').addEventListener('submit',event=>{event.preventDefault();const number=id=>Number($(id).value)||0,platform=$('#reviewPlatform').value;if(usingDemoReview){reviewPosts=[];usingDemoReview=false}reviewPosts.unshift({id:Date.now(),platform,date:$('#reviewDate').value,title:$('#reviewTitle').value.trim(),impressions:number('#reviewImpressions')||number('#reviewViews'),views:number('#reviewViews'),completion:number('#reviewCompletion'),hook5:number('#reviewHook'),likes:number('#reviewLikes'),comments:number('#reviewComments'),saves:number('#reviewSaves'),shares:number('#reviewShares'),follows:number('#reviewFollows'),avgWatch:number('#reviewAvgWatch')});saveReviewPosts();$('#reviewForm').reset();$('#reviewDialog').close();selectReviewFilter(platform);$('#reviewImportStatus').textContent='✓ 已保存，并完成新一轮复盘';setTimeout(()=>$('#reviewImportStatus').textContent='',2600)});
function parseCsvRows(text){const rows=[];let row=[],cell='',quoted=false;for(let index=0;index<text.length;index++){const char=text[index],next=text[index+1];if(char==='"'&&quoted&&next==='"'){cell+='"';index++}else if(char==='"'){quoted=!quoted}else if(char===','&&!quoted){row.push(cell.trim());cell=''}else if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&next==='\n')index++;row.push(cell.trim());if(row.some(Boolean))rows.push(row);row=[];cell=''}else cell+=char}row.push(cell.trim());if(row.some(Boolean))rows.push(row);return rows}
$('#reviewCsv').addEventListener('change',event=>{const file=event.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const rows=parseCsvRows(String(reader.result||'')),headers=(rows.shift()||[]).map(header=>header.trim()),position=name=>headers.indexOf(name),value=(row,name)=>row[position(name)]??'';let added=0,imported=[];rows.forEach(row=>{let platform=value(row,'platform').toLowerCase();if(platform==='小红书')platform='xhs';if(platform==='抖音')platform='douyin';const title=value(row,'title');if(!['xhs','douyin'].includes(platform)||!title)return;const number=name=>Number(value(row,name))||0;imported.push({id:Date.now()+added,platform,date:value(row,'date')||dateKey(today),title,impressions:number('impressions')||number('views'),views:number('views'),completion:number('completion'),hook5:number('hook5'),likes:number('likes'),comments:number('comments'),saves:number('saves'),shares:number('shares'),follows:number('follows'),avgWatch:number('avgWatch')});added++});if(!added)throw new Error('no rows');if(usingDemoReview){reviewPosts=[];usingDemoReview=false}reviewPosts.push(...imported);saveReviewPosts();selectReviewFilter('all');$('#reviewImportStatus').textContent=`✓ 已导入 ${added} 条内容并完成复盘`}catch(error){$('#reviewImportStatus').textContent='未识别到有效数据，请使用页面提供的 CSV 模板'}event.target.value=''};reader.readAsText(file,'UTF-8')});

const JOURNAL_ENTRIES_KEY='wmq_journal_entries';
let journalEntries={};
try{const parsed=JSON.parse(localStorage.getItem(JOURNAL_ENTRIES_KEY)||'{}');if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))journalEntries=parsed}catch(error){}
const legacyJournal=JSON.parse(localStorage.getItem('wmq_journal')||'null');
if(legacyJournal?.date){const legacyKey=dateKey(new Date(legacyJournal.date));if(!journalEntries[legacyKey]){journalEntries[legacyKey]=legacyJournal;localStorage.setItem(JOURNAL_ENTRIES_KEY,JSON.stringify(journalEntries))}}
const moodIcons={'充满能量':'⚡','状态不错':'🙂','很平静':'🌿','有点疲惫':'🌧'};
let selectedMood='',activeJournalKey='';
$$('#moodRow button').forEach(button=>button.addEventListener('click',()=>{$$('#moodRow button').forEach(item=>item.classList.remove('is-active'));button.classList.add('is-active');selectedMood=button.dataset.mood;$('#saveJournal').textContent='保存今天的日记';$('#saveJournal').classList.remove('is-saved');$('#saveStatus').textContent='心情有新的修改，保存后会保留在本机'}));
function updateJournalStatus(saved){if(!saved)return;$('#saveJournal').textContent='✓ 已保存';$('#saveJournal').classList.add('is-saved');$('#saveStatus').textContent=`上次保存：${formatSavedMoment(saved.date)} · 已保存在本机`}
function journalDateLabel(key){const [year,month,day]=key.split('-').map(Number),date=new Date(year,month-1,day);return `${year}年${month}月${day}日 · ${weekNames[date.getDay()]}`}
function renderJournalHistory(){
  const keys=Object.keys(journalEntries).filter(key=>journalEntries[key]?.text?.trim()||journalEntries[key]?.mood).sort((a,b)=>b.localeCompare(a));
  $('#journalHistoryCount').textContent=`${keys.length} 篇`;
  $('#journalHistoryList').innerHTML=keys.length?keys.map(key=>{const entry=journalEntries[key],text=entry.text?.trim()||'只记录了心情';return `<button class="history-card journal-history-card" data-journal-entry="${key}"><span>${moodIcons[entry.mood]||'记'}</span><section><b>${escapeHtml(journalDateLabel(key))}</b><small>${escapeHtml(entry.mood||'日记')}</small><p>${escapeHtml(text)}</p></section><i>›</i></button>`}).join(''):'<div class="history-empty"><span>记</span><p>保存今天的日记后，会按日期收进这里，不会再被下一天覆盖。</p></div>';
  $$('#journalHistoryList [data-journal-entry]').forEach(button=>button.addEventListener('click',()=>{const key=button.dataset.journalEntry,entry=journalEntries[key];activeJournalKey=key;$('#journalHistoryTitle').textContent=journalDateLabel(key);$('#journalHistoryMood').textContent=`${moodIcons[entry.mood]||'记'} ${entry.mood||'未选择心情'}`;$('#journalHistoryText').textContent=entry.text||'这一天只记录了心情。';$('#journalHistorySavedAt').textContent=`保存于 ${formatSavedMoment(entry.date)}`;$('#journalHistoryDialog').showModal()}));
}
$('#saveJournal').addEventListener('click',()=>{const saved={text:$('#journalText').value.trim(),mood:selectedMood,date:new Date().toISOString()};journalEntries[dateKey(today)]=saved;localStorage.setItem(JOURNAL_ENTRIES_KEY,JSON.stringify(journalEntries));localStorage.setItem('wmq_journal',JSON.stringify(saved));updateJournalStatus(saved);renderJournalHistory();showToast('今天的日记已保存，并收进往日日记')});
const savedJournal=journalEntries[dateKey(today)];if(savedJournal){$('#journalText').value=savedJournal.text;selectedMood=savedJournal.mood;$$('#moodRow button').find(button=>button.dataset.mood===selectedMood)?.classList.add('is-active');updateJournalStatus(savedJournal)}
$('#journalText').addEventListener('input',()=>{$('#saveJournal').textContent='保存今天的日记';$('#saveJournal').classList.remove('is-saved');$('#saveStatus').textContent='有新的修改，保存后会保留在本机'});
$('#deleteJournalEntry').addEventListener('click',async()=>{if(!activeJournalKey)return;const key=activeJournalKey,confirmed=await askConfirm({title:'删除这篇日记？',message:`${journalDateLabel(key)}的文字和心情记录都会被删除。`});if(!confirmed)return;delete journalEntries[key];localStorage.setItem(JOURNAL_ENTRIES_KEY,JSON.stringify(journalEntries));let legacy=null;try{legacy=JSON.parse(localStorage.getItem('wmq_journal')||'null')}catch(error){}if(legacy?.date&&dateKey(new Date(legacy.date))===key)localStorage.removeItem('wmq_journal');if(key===dateKey(today)){$('#journalText').value='';selectedMood='';$$('#moodRow button').forEach(button=>button.classList.remove('is-active'));$('#saveJournal').textContent='保存今天的日记';$('#saveJournal').classList.remove('is-saved');$('#saveStatus').textContent='今天的日记已删除'}activeJournalKey='';$('#journalHistoryDialog').close();renderJournalHistory();showToast('日记已删除')});
const MEMO_KEY='wmq_memos',defaultMemos=[{id:1,text:'周末拍 3 条职场沟通系列',createdAt:'内容计划 · 09:40'},{id:2,text:'论文图 4 需要重做图例',createdAt:'论文 · 昨天'}];
let memos=localStorage.getItem(MEMO_KEY)?readCollection(MEMO_KEY):defaultMemos;
function saveMemos(){localStorage.setItem(MEMO_KEY,JSON.stringify(memos))}
function memoTime(value){if(!value)return '已保存在本机';const date=new Date(value);return Number.isNaN(date.getTime())?value:formatSavedMoment(value)}
function renderMemos(){$('#memoList').innerHTML=memos.length?memos.map(memo=>`<article><i></i><div><b>${escapeHtml(memo.text)}</b><span>${escapeHtml(memoTime(memo.createdAt))}</span></div><button class="item-delete-button" data-memo-id="${escapeHtml(memo.id)}" aria-label="删除备忘">删</button></article>`).join(''):'<p class="memo-empty">还没有备忘，点击“＋ 新建”记下一件事。</p>';$$('#memoList [data-memo-id]').forEach(button=>button.addEventListener('click',async()=>{const memo=memos.find(item=>String(item.id)===button.dataset.memoId),confirmed=await askConfirm({title:'删除这条备忘？',message:memo?`“${memo.text}”会从当前设备删除。`:'这条备忘会从当前设备删除。'});if(!confirmed)return;memos=memos.filter(memo=>String(memo.id)!==button.dataset.memoId);saveMemos();renderMemos();showToast('备忘已删除')}))}
$('#addMemo').addEventListener('click',()=>{$('#memoDialog').showModal();$('#memoText').focus()});
$('#memoForm').addEventListener('submit',event=>{event.preventDefault();const note=$('#memoText').value.trim();if(!note)return;memos.unshift({id:Date.now(),text:note,createdAt:new Date().toISOString()});saveMemos();renderMemos();$('#memoForm').reset();$('#memoDialog').close();showToast('备忘已保存，刷新后也会保留')});
renderMemos();

// 弹窗关闭：关闭按钮不再触发表单提交，点击遮罩或按 Esc 也可退出。
$$('[data-close-dialog]').forEach(button=>button.addEventListener('click',()=>document.getElementById(button.dataset.closeDialog)?.close()));
$$('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()}));

// 设置：显示、热点提醒偏好和本机数据备份。
function saveSettings(){localStorage.setItem(SETTINGS_KEY,JSON.stringify(appSettings))}
function updateReminderStatus(){
  const status=$('#reminderStatus');
  if(!appSettings.trendReminder){status.textContent='热点提醒已关闭';return}
  const [hour,minute]=appSettings.reminderTime.split(':').map(Number),now=new Date(),isDue=now.getHours()*60+now.getMinutes()>=hour*60+minute;
  status.textContent=isDue?`今天 ${appSettings.reminderTime} 的平台热点检查时间已到`:`每天 ${appSettings.reminderTime} 打开工作台时提醒平台热点`;
}
function applySettings(){
  document.documentElement.dataset.fontSize=appSettings.fontSize;
  document.body.classList.toggle('hide-benchmark-links',!appSettings.showBenchmarkLinks);
  $$('#fontOptions [data-font-size]').forEach(button=>button.classList.toggle('is-active',button.dataset.fontSize===appSettings.fontSize));
  $('#trendReminderToggle').checked=appSettings.trendReminder;$('#trendReminderTime').value=appSettings.reminderTime;$('#showBenchmarkLinks').checked=appSettings.showBenchmarkLinks;
  updateReminderStatus();
}
$('#fontOptions').addEventListener('click',event=>{const button=event.target.closest('[data-font-size]');if(!button)return;appSettings.fontSize=button.dataset.fontSize;saveSettings();applySettings()});
$('#trendReminderToggle').addEventListener('change',event=>{appSettings.trendReminder=event.target.checked;saveSettings();applySettings()});
$('#trendReminderTime').addEventListener('change',event=>{appSettings.reminderTime=event.target.value||'10:00';saveSettings();updateReminderStatus()});
$('#showBenchmarkLinks').addEventListener('change',event=>{appSettings.showBenchmarkLinks=event.target.checked;saveSettings();applySettings()});
$('#exportBackup').addEventListener('click',()=>{
  const backup={exportedAt:new Date().toISOString(),version:19,data:{}};
  for(let index=0;index<localStorage.length;index++){const key=localStorage.key(index);if(key?.startsWith('wmq_'))backup.data[key]=localStorage.getItem(key)}
  const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=`wmq工作台备份-${dateKey(new Date())}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),500);$('#backupStatus').textContent='✓ 备份已下载';setTimeout(()=>$('#backupStatus').textContent='',2200)
});

// 手机后台推送：订阅由当前设备创建，云端每天北京时间 10:00 发送热点通知。
const VAPID_PUBLIC_KEY='BHU1CzSXHUxJwd0sL1C7zsfV0qKACycgIQafv6G0X4G2AwO5o8L52Be9mqNHrbMAggJ6Q_Aijz0_G3aRr8uzts0';
const PUSH_API_URL='https://fantastic-blini-8edfbd.netlify.app/.netlify/functions/push-subscription';
const pushSupported=()=>('serviceWorker' in navigator)&&('PushManager' in window)&&('Notification' in window);
const isIosDevice=()=>/iPhone|iPad|iPod/i.test(navigator.userAgent);
const isStandaloneApp=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
function base64UrlBytes(value){const padding='='.repeat((4-value.length%4)%4),base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/'),raw=atob(base64);return Uint8Array.from([...raw].map(char=>char.charCodeAt(0)))}
async function pushRequest(action,subscription){
  await fetch(PUSH_API_URL,{method:'POST',mode:'no-cors',headers:{'content-type':'text/plain;charset=UTF-8'},body:JSON.stringify({action,subscription})});
  return {ok:true};
}
async function currentPushSubscription(){if(!pushSupported())return null;const registration=await navigator.serviceWorker.ready;return registration.pushManager.getSubscription()}
function showPushState(enabled,message=''){
  $('#enablePushNotifications').hidden=enabled;$('#sendTestPush').hidden=!enabled;$('#disablePushNotifications').hidden=!enabled;
  $('#pushStatus').textContent=message||(enabled?'✓ 手机推送已开启 · 每天 10:00':'手机推送尚未开启');
  $('#pushStatus').classList.toggle('is-enabled',enabled);
}
async function updatePushState(){
  if(!pushSupported()){showPushState(false,'当前浏览器不支持后台通知，请用 Safari 或 Chrome 打开');$('#enablePushNotifications').disabled=true;return}
  if(isIosDevice()&&!isStandaloneApp()){showPushState(false,'请先用 Safari“添加到主屏幕”，再从桌面图标打开并开启');return}
  try{showPushState(Boolean(await currentPushSubscription()))}catch(error){showPushState(false,'暂时无法读取通知状态，请稍后重试')}
}
$('#enablePushNotifications').addEventListener('click',async()=>{
  const button=$('#enablePushNotifications');button.disabled=true;$('#pushStatus').textContent='正在向手机申请通知权限…';
  try{
    if(isIosDevice()&&!isStandaloneApp())throw new Error('请先用 Safari 将工作台添加到主屏幕，再从桌面图标打开');
    const permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('没有获得通知权限；可在手机系统设置中重新允许');
    const registration=await navigator.serviceWorker.ready;
    const subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:base64UrlBytes(VAPID_PUBLIC_KEY)});
    await pushRequest('subscribe',subscription.toJSON());showPushState(true,'✓ 手机推送已开启 · 每天 10:00');showToast('手机推送已开启');
  }catch(error){showPushState(false,error.message||'开启失败，请稍后重试')}finally{button.disabled=false}
});
$('#sendTestPush').addEventListener('click',async()=>{
  const button=$('#sendTestPush');button.disabled=true;$('#pushStatus').textContent='正在发送测试通知…';
  try{const subscription=await currentPushSubscription();if(!subscription)throw new Error('当前设备还没有开启推送');await pushRequest('test',subscription.toJSON());showPushState(true,'✓ 测试通知已发送，请查看手机通知中心')}catch(error){showPushState(Boolean(await currentPushSubscription().catch(()=>null)),error.message||'测试通知发送失败')}finally{button.disabled=false}
});
$('#disablePushNotifications').addEventListener('click',async()=>{
  const button=$('#disablePushNotifications');button.disabled=true;
  try{const subscription=await currentPushSubscription();if(subscription){await pushRequest('unsubscribe',subscription.toJSON()).catch(()=>{});await subscription.unsubscribe()}showPushState(false,'手机推送已关闭');showToast('已关闭手机推送')}catch(error){$('#pushStatus').textContent='关闭失败，请稍后重试'}finally{button.disabled=false}
});

function navigate(name,updateUrl=true){
  $$('.page').forEach(page=>page.classList.toggle('is-active',page.dataset.page===name));
  $$('[data-nav]').forEach(button=>button.classList.toggle('is-active',button.dataset.nav===name));
  $$('.drawer-item').forEach(button=>button.classList.toggle('is-active',button.dataset.sidePage===name));
  if(updateUrl){const url=new URL(location.href);url.searchParams.set('page',name);history.replaceState({},'',url)}
  window.scrollTo({top:0,behavior:'smooth'});
}
function openDrawer(){$('#sideDrawer').classList.add('is-open');$('#drawerBackdrop').classList.add('is-open');$('#sideDrawer').setAttribute('aria-hidden','false');$('#drawerBackdrop').setAttribute('aria-hidden','false');$('#menuButton').setAttribute('aria-expanded','true');document.body.classList.add('drawer-open')}
function closeDrawer(returnFocus=false){$('#sideDrawer').classList.remove('is-open');$('#drawerBackdrop').classList.remove('is-open');$('#sideDrawer').setAttribute('aria-hidden','true');$('#drawerBackdrop').setAttribute('aria-hidden','true');$('#menuButton').setAttribute('aria-expanded','false');document.body.classList.remove('drawer-open');if(returnFocus)$('#menuButton').focus()}
$('#menuButton').addEventListener('click',openDrawer);$('#drawerClose').addEventListener('click',()=>closeDrawer(true));$('#drawerBackdrop').addEventListener('click',()=>closeDrawer(true));document.addEventListener('keydown',event=>{if(event.key==='Escape'&&$('#sideDrawer').classList.contains('is-open'))closeDrawer(true)});
$('#openSettings').addEventListener('click',()=>navigate('settings'));
$$('[data-side-page]').forEach(item=>item.addEventListener('click',()=>{navigate(item.dataset.sidePage);closeDrawer();requestAnimationFrame(()=>document.getElementById(item.dataset.sideTarget)?.scrollIntoView({behavior:'smooth',block:'start'}))}));
$$('[data-nav]').forEach(button=>button.addEventListener('click',()=>navigate(button.dataset.nav)));$$('[data-nav-target]').forEach(button=>button.addEventListener('click',()=>navigate(button.dataset.navTarget)));

$('#dateLabel').textContent=`${today.getMonth()+1}月${today.getDate()}日 · ${weekNames[today.getDay()]}`;$('#journalDay').textContent=today.getDate();$('#journalMonthWeek').innerHTML=`${monthNames[today.getMonth()]}<br>${weekNames[today.getDay()]}`;$('#greetingText').textContent=today.getHours()<11?'早上好':today.getHours()<18?'下午好':'晚上好';
document.body.classList.toggle('is-standalone',window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true);
document.addEventListener('gesturestart',event=>event.preventDefault(),{passive:false});document.addEventListener('gesturechange',event=>event.preventDefault(),{passive:false});
applySettings();renderCalendar();loadDailyRecord();renderWorkoutProgress();renderFitnessHistory();renderCreationLibrary();renderTrends();updateTrendStatus();loadTrendData();renderTransactions();renderReview();renderOverview();renderJournalHistory();
const requestedPage=new URLSearchParams(location.search).get('page');const allowedPages=['overview','today','fitness','inspiration','viral','review','finance','notes','settings'];navigate(allowedPages.includes(requestedPage)?requestedPage:'overview',false);
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').then(()=>updatePushState()).catch(()=>showPushState(false,'后台服务暂时无法启动，请刷新后重试'));else updatePushState();
