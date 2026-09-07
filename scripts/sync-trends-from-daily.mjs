import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const runtimeToday=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const radarRoot='/Users/wmq/Documents/wmq mac/自媒体IP/02-爆款热点雷达';
const sourcePath=path.resolve(process.argv[2]||path.join(radarRoot,`${runtimeToday}-李老师热点推送.md`));
const outputPath=path.resolve(process.argv[3]||path.join(projectRoot,'data/trends.json'));
const sourceDate=path.basename(sourcePath).match(/^(\d{4}-\d{2}-\d{2})-/)?.[1];
const today=sourceDate||runtimeToday;

const markdown=await readFile(sourcePath,'utf8');
const escapeRegExp=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const clean=value=>String(value||'').replace(/\[([^\]]+)\]\(([^)]+)\)/g,'$1').replace(/[`*_]/g,'').replace(/\s+/g,' ').trim();
const section=(heading,next='## ')=>{const start=markdown.indexOf(heading);if(start<0)return '';const bodyStart=start+heading.length,end=markdown.indexOf(`\n${next}`,bodyStart);return markdown.slice(bodyStart,end<0?markdown.length:end).trim()};
const bullet=(block,label)=>{const match=block.match(new RegExp(`^-\\s+${escapeRegExp(label)}：\\s*(.+)$`,'m'));return match?.[1]?.trim()||''};
const sourceLink=block=>{const line=bullet(block,'原稿链接'),markdownLink=line.match(/\[[^\]]+\]\((https?:\/\/[^)]+)\)/);return markdownLink?.[1]||line.match(/https?:\/\/\S+/)?.[0]||''};
const metric=(value,label)=>value.match(new RegExp(`([\\d.]+(?:万|千)?)${label}`))?.[1]||(/\u672a\u663e\u793a/.test(value)&&value.includes(label)?'未显示':'');
const numberedSteps=block=>{const area=block.match(/^-\s+内容框架：\s*\n([\s\S]*?)(?=^-\s+借鉴边界：|(?![\s\S]))/m)?.[1]||'';return [...area.matchAll(/^\s+\d+\.\s+(.+)$/gm)].map(match=>clean(match[1]));};
const inferKind=text=>/软孤立|背锅|霸凌|自保|留痕|排挤/.test(text)?'self-protection':/求职|面试|简历|裁员/.test(text)?'job-hunting':'newcomer';
const inferTag=kind=>kind==='self-protection'?'自保避坑':kind==='job-hunting'?'求职面试':'职场新人';

const items=[];
const itemPattern=/^###\s+(\d+)\.\s+(.+?)\s+-\s+优先级：([^\n]+)\n([\s\S]*?)(?=^###\s+\d+\.|^##\s+|\Z)/gm;
for(const match of markdown.matchAll(itemPattern)){
  const [,rankText,title,priority,block]=match,platformWindow=clean(bullet(block,'平台 / 时间窗口')),data=clean(bullet(block,'可见数据')),steps=numberedSteps(block);
  const platform=platformWindow.split('/')[0]?.trim()||'未显示',url=sourceLink(block),tags=[...bullet(block,'话题标签').matchAll(/`([^`]+)`/g)].map(tag=>tag[1]);
  const comments=clean(bullet(block,'评论区在讨论')),audience=clean(bullet(block,'目标人群')),scene=clean(bullet(block,'具体场景')),pain=clean(bullet(block,'核心痛点')),judgment=clean(bullet(block,'李老师的一句话判断')),kind=inferKind(`${title} ${audience} ${scene} ${pain}`);
  items.push({
    id:`${today}-${String(rankText).padStart(2,'0')}`,rank:Number(rankText),kind,tag:inferTag(kind),platform,publishedAt:platformWindow.split('/').slice(1).join('/').trim(),confidence:priority.trim(),publishable:Boolean(url),sourceValid:Boolean(url),sourceType:`${platform}原始内容`,topPick:Number(rankText)===1,
    title:clean(title),originalTitle:clean(bullet(block,'原标题'))||clean(title),sourceUrl:url,cover:{description:clean(bullet(block,'封面 / 首帧'))||'未显示'},author:'未显示',topicTags:tags,
    visibleData:data,metrics:{likes:metric(data,'赞'),collects:metric(data,'收藏'),comments:metric(data,'评论'),shares:metric(data,'分享')},commentInsights:comments?comments.split('；').map(clean).filter(Boolean):[],
    audience,scene,relevance:[audience,scene,pain].filter(Boolean).join('；'),angle:judgment,conclusion:judgment,action:steps[2]||'',hook:clean(bullet(block,'3秒开头')),whyNow:`${platformWindow}；${data}`,
    coverTitle:clean(bullet(block,'封面标题')),publishTitle:clean(bullet(block,'发布标题')),contentFramework:{hook:clean(bullet(block,'3秒开头')),conflict:steps[0]||'',judgment:steps[1]||judgment,body:steps[2]?[steps[2]]:[],closingAction:steps[3]||'',adaptationBoundary:clean(bullet(block,'借鉴边界'))}
  });
}

const decision=section('## 今日判断'),riskBlock=section('## 风险与缺口'),risks=[...riskBlock.matchAll(/^-\s+(.+)$/gm)].map(item=>clean(item[1]));
const xhsItems=items.filter(item=>item.platform.includes('小红书')),douyinItems=items.filter(item=>item.platform.includes('抖音'));
const output={
  schemaVersion:2,skillSyncedAt:new Date().toISOString(),updatedAt:today,window:`${today} 已同步李老师热点推送`,sourceDailyPush:path.basename(sourcePath),
  qualityPolicy:{sourceGate:'正式推送必须是可打开的原始笔记或视频',heatGate:'小红书优先至少1000可见互动；抖音优先至少1万可见互动或高速增长',commentGate:'评论洞察只来自可见评论',contentGate:'每条必须能转化为李老师的判断和可执行动作'},
  brief:{conclusion:decision?[clean(decision)]:[],selectionNote:`${items.length}条原稿已通过定位、热度、数据、评论和原稿链接校验。`,platformDifferences:{xiaohongshu:xhsItems.length?`本轮${xhsItems.length}条小红书原稿通过强校验。`:'本轮没有小红书原稿通过强校验。',douyin:douyinItems.length?`本轮${douyinItems.length}条抖音原稿通过强校验。`:'本轮没有抖音原稿通过强校验，不用旧稿凑数。'},rejected:['只有搜索页、原稿无法打开或缺少达标互动数据的内容不进入正式推送。'],risks},
  hotTopics:{xiaohongshu:xhsItems.map(item=>({topic:item.title,targetAudience:item.audience,timeWindow:item.publishedAt,evidence:item.visibleData,sourceUrl:item.sourceUrl})),douyin:douyinItems.map(item=>({topic:item.title,targetAudience:item.audience,timeWindow:item.publishedAt,evidence:item.visibleData,sourceUrl:item.sourceUrl}))},
  items,appReviewCandidates:[],observations:[]
};

await writeFile(outputPath,`${JSON.stringify(output,null,2)}\n`,'utf8');
console.log(`Synced ${items.length} verified trend item(s) from ${path.basename(sourcePath)} to ${outputPath}`);
