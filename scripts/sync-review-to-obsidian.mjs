import fs from 'node:fs/promises';
import path from 'node:path';

const projectRoot=path.resolve(import.meta.dirname,'..');
const configPath=process.argv[2]||path.join(projectRoot,'review-cloud.local.json');
const config=JSON.parse(await fs.readFile(configPath,'utf8'));
const required=['supabaseUrl','supabaseAnonKey','workspaceId','workspaceKey','obsidianDir'];
for(const key of required)if(!String(config[key]||'').trim())throw new Error(`缺少配置：${key}`);

const base=String(config.supabaseUrl).replace(/\/+$/,''),workspace=encodeURIComponent(config.workspaceId);
const headers={apikey:config.supabaseAnonKey,Authorization:`Bearer ${config.supabaseAnonKey}`,'x-workspace-key':config.workspaceKey};
const verifyResponse=await fetch(`${base}/rest/v1/rpc/review_workspace_access`,{
  method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({target_workspace:config.workspaceId})
});
if(!verifyResponse.ok||await verifyResponse.json()!==true)throw new Error('团队工作区或团队密码不正确，已停止写入 Obsidian');
const response=await fetch(`${base}/rest/v1/review_posts?workspace_id=eq.${workspace}&select=*&order=published_at.desc,created_at.desc`,{
  headers
});
if(!response.ok)throw new Error(`云端复盘读取失败：${response.status} ${await response.text()}`);
const rows=await response.json();
const outputDir=path.join(config.obsidianDir,'发布复盘');
await fs.mkdir(outputDir,{recursive:true});

const safeName=value=>String(value||'未命名').replace(/[\\/:*?"<>|#\[\]]/g,'-').replace(/\s+/g,' ').trim().slice(0,42);
const percent=value=>Number(value||0).toFixed(1).replace(/\.0$/,'');
const rate=(part,total)=>total?`${percent(Number(part||0)/Number(total)*100)}%`:'暂无足够依据';
const platformName=value=>value==='douyin'?'抖音':'小红书';
const metrics=row=>({
  engagement:Number(row.views)?(Number(row.likes)+Number(row.comments)+Number(row.saves)+Number(row.shares))/Number(row.views)*100:0,
  save:Number(row.views)?Number(row.saves)/Number(row.views)*100:0,
  follow:Number(row.views)?Number(row.follows)/Number(row.views)*100:0,
  view:Number(row.impressions)?Number(row.views)/Number(row.impressions)*100:0
});
const diagnosis=row=>{
  const viewRate=metrics(row).view;
  const completion=Number(row.completion||0),hook=Number(row.hook5||0);
  const saveRate=Number(row.views)?Number(row.saves||0)/Number(row.views)*100:0;
  const followRate=Number(row.views)?Number(row.follows||0)/Number(row.views)*100:0;
  if(row.platform==='douyin'&&hook>0&&hook<45)return ['开头需要加速','下一条开头先说结果，不铺背景'];
  if(completion>0&&completion<30)return ['中段结构需要压缩','下一条删掉一个重复观点，只保留三个连续动作'];
  if(viewRate>0&&viewRate<20)return ['封面和标题需要更具体','下一条只改成“身份词 + 场景 + 结果”的包装'];
  if(saveRate>=5)return ['方法价值被用户认可','延展同一主题的进阶版或模板版'];
  if(followRate<0.5)return ['人设与系列感需要强化','下一条结尾明确系列身份，并预告下一集问题'];
  return ['当前表现相对均衡','延续表现最好的结构，只测试一个新变量'];
};
const contentSuggestions=reviewRows=>{
  if(!reviewRows.length)return ['先录入一条已发布内容，并补充来源选题、呈现形式、实验变量与评论区洞察。'];
  const best=reviewRows.reduce((top,row)=>metrics(row).engagement>metrics(top).engagement?row:top,reviewRows[0]);
  const [,nextChange]=diagnosis(best),topic=best.source_topic||best.title;
  const commentRow=reviewRows.find(row=>String(row.comment_insights||'').trim());
  const commentClue=String(commentRow?.comment_insights||'').split(/[。！？\n；;]/).find(Boolean)?.trim();
  const crossPlatform=best.platform==='xhs'
    ?`把「${best.title}」改成 45—60 秒抖音口播：先给结论，再讲 3 个动作。`
    :`把「${best.title}」整理成小红书可收藏清单，保留同一人群与场景。`;
  return [
    `把「${topic}」做成第 2 集：补充最容易踩坑的 3 个细节或一个更具体的职场场景。`,
    `做一次单变量实验：${nextChange}。`,
    commentClue?`回应评论区：“${commentClue}”，把用户原话直接放在开头。`:crossPlatform
  ];
};

const indexRows=[];
for(const row of rows){
  const [judgment,nextChange]=diagnosis(row),fileName=`${row.published_at}-${platformName(row.platform)}-${safeName(row.title)}.md`;
  const content=`---
type: 发布数据复盘
status: active
platform: ${platformName(row.platform)}
published: ${row.published_at}
cloud_id: ${row.id}
updated: ${row.updated_at}
tags:
  - 自媒体IP
  - 数据复盘
---

# ${row.title}

## 基本信息

- 内容标题：${row.title}
- 发布平台：${platformName(row.platform)}
- 发布时间：${row.published_at}
- 来源选题：${row.source_topic||'未填写'}
- 呈现形式：${row.content_format||'未填写'}
- 本条实验变量：${row.experiment_variable||'未填写'}
- 录入人：${row.created_by||'团队成员'}

## 数据记录

- 曝光：${row.impressions}
- 阅读/播放：${row.views}
- 点击/播放率：${rate(row.views,row.impressions)}
- 完播率：${percent(row.completion)}%
- 5秒留存：${percent(row.hook5)}%
- 平均观看时长：${row.avg_watch} 秒
- 点赞：${row.likes}
- 收藏：${row.saves}
- 评论：${row.comments}
- 分享：${row.shares}
- 关注/转粉：${row.follows}
- 综合互动率：${rate(Number(row.likes)+Number(row.comments)+Number(row.saves)+Number(row.shares),row.views)}

## 评论区复盘

${row.comment_insights||'暂未填写评论区洞察。'}

## 自动判断

- 当前主要判断：${judgment}
- 是否值得做系列：${Number(row.saves||0)>Number(row.comments||0)?'收藏意图较强，建议继续验证':'结合后续样本再判断'}

## 下一条只改一个变量

- 保留：本条已经验证的选题核心与账号判断
- 改动：${nextChange}
- 下一条选题：围绕「${row.source_topic||row.title}」补充一个更具体的人群或场景问题

## 后续内容建议

${contentSuggestions([row]).map(item=>`- ${item}`).join('\n')}
`;
  await fs.writeFile(path.join(outputDir,fileName),content,'utf8');
  indexRows.push(`- [[发布复盘/${fileName.slice(0,-3)}|${row.published_at} · ${platformName(row.platform)} · ${row.title}]]`);
}

const teamSuggestions=contentSuggestions(rows);
const suggestionPath=path.join(config.obsidianDir,'01-团队复盘建议.md');
const suggestionContent=`---
type: 团队数据复盘建议
status: active
updated: ${new Date().toISOString()}
tags:
  - 自媒体IP
  - 数据复盘
  - 团队协作
---

# 团队复盘建议

> 数据来源：wmq 工作台团队云端，共 ${rows.length} 条内容。每次同步后自动更新。

## 下一批内容

${teamSuggestions.map((item,index)=>`${index+1}. ${item}`).join('\n')}

## 使用原则

- 优先延续已经被数据验证的用户问题。
- 下一条只改变一个变量，避免无法判断原因。
- 评论区真实提问优先回流为新选题。
`;
await fs.writeFile(suggestionPath,suggestionContent,'utf8');

const indexPath=path.join(config.obsidianDir,'00-数据复盘库索引.md');
let index=await fs.readFile(indexPath,'utf8');
const start='<!-- CLOUD_REVIEW_START -->',end='<!-- CLOUD_REVIEW_END -->';
const block=`${start}\n- [[01-团队复盘建议|团队复盘建议（自动更新）]]\n${indexRows.length?indexRows.join('\n'):'- 暂无云端复盘数据。'}\n${end}`;
if(index.includes(start)&&index.includes(end))index=index.replace(new RegExp(`${start}[\\s\\S]*?${end}`),block);
else index=index.replace('## 复盘列表',`## 复盘列表\n\n${block}`);
await fs.writeFile(indexPath,index,'utf8');
console.log(`已同步 ${rows.length} 条复盘到 ${outputDir}`);
