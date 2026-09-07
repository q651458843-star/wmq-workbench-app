# wmq的工作台

手机优先的个人工作台原型，采用“总览首页 + 日常 List + 侧边功能导航”结构。

## 当前模块

- 总览：聚合当天完成度、日常状态、训练进度、自媒体选题和复盘下一步，并提供全部功能快捷入口。
- 日常 List：通过日历记录每天的论文、餐食和健身情况。
- 健身训练：日常简记之外的独立训练路线；当前按每周 3 次、每次约 60 分钟设计，并标注腰痛训练边界。训练清单与日常健身记录会合并显示在“训练历史”。
- 选题每日灵感：同步 `track-career-social-trends` Skill 的严格筛选结果。正式热稿必须通过定位、热度、数据、评论和原稿链接校验；只有搜索页或低互动证据的内容只进入备选观察，不参与手机推送。
- 爆款视频拆解：优先展示当日已核验原稿的封面/首帧、平台标题、作者、互动数据、评论区热点与可复用口播框架，同时保留静态结构库。
- 数据复盘：支持单条录入和 CSV 批量导入；可连接 Supabase 免费数据库进行团队共享，并根据最佳内容、最弱指标和评论区洞察自动生成 3 条后续内容建议。
- 记账与资产、日记与备忘。日记按日期存储并提供“往日日记”，旧版单条日记会自动迁移；备忘保留完整列表。
- 设置：支持舒适/更大字号、每天 10:00 的手机后台推送、测试通知、App 内提醒、对标链接显示开关和本机数据备份。
- App 体验：使用独立清单星光图标、固定底部导航、iPhone 主屏幕图标和独立运行模式，并关闭页面缩放与横向漂移。

## 使用

直接打开 `index.html` 即可体验。记录会保存在当前设备的浏览器中；用手机浏览器打开后，可通过“添加到主屏幕”作为独立应用使用。发布到 Netlify 时，上传 `wmq-workbench.zip` 即可。

## 内容数据说明

真实热点从 `data/trends.json` 读取，当前使用 `schemaVersion: 2`。采集顺序与 `track-career-social-trends` Skill 保持一致：“分别采集平台话题与原始热稿 → 定位门 → 热度门 → 数据门 → 评论门 → 原稿链接校验 → 口播改编”。顶层 `hotTopics` 保存两平台话题/标签，`items` 只保存允许推送的正式热稿，`appReviewCandidates` 保存网页端打不开原稿的小红书高互动候选，`observations` 保存只有搜索页或未过热度门的备选信号。正式条目除原有定位字段外，还应包含 `publishable: true`、`sourceValid: true`、`cover`、`originalTitle`、`author`、`metrics`、`commentInsights`、`topicTags`、`contentFramework`、`coverTitle` 和 `publishTitle`。没有通过强校验的数据时，主列表显示真实空状态，不用弱相关内容凑数。

每日 Obsidian 热点推送生成后，执行 `npm run sync:trends` 会读取当天 `YYYY-MM-DD-李老师热点推送.md`，把已核验原稿转换为工作台使用的 `data/trends.json`。也可在命令后传入指定日报路径。

工作台会同时读取公开发布仓库 `q651458843-star/wmq-workbench-app` 的 `main/data/trends.json` 与当前部署内置数据，并自动采用日期较新的版本。这样日常热点只需同步到 GitHub，不需要每天重新发布整个站点；GitHub 暂时不可用时仍会回退到部署内置数据。

免费手机安装版通过 GitHub Pages 发布。App 静态文件和热点数据进入公开发布仓库，个人日记、记账、训练等记录仍只保存在自己的手机浏览器中，不会上传到公开仓库。

Netlify 定时函数会在每天北京时间 10:00 将已发布的热点主动推送到订阅设备，即使工作台未打开也能收到。函数只读取 `publishable: true`、`sourceValid: true` 且带有效 HTTP(S) 原稿链接的条目；当天没有合格热稿时返回 `skipped` 并不发送通知。iPhone 需 iOS 16.4 以上，先用 Safari 将工作台添加到主屏幕，再进入“设置 → 开启手机推送”完成一次授权。热点内容本身仍来自 GitHub 中更新后的 `data/trends.json`；推送和热点采集是两个独立环节。

云端部署需要配置 `VAPID_PUBLIC_KEY`、`VAPID_PRIVATE_KEY` 和 `VAPID_SUBJECT` 三个环境变量。订阅信息通过 Netlify Blobs 保存，不进入 GitHub；VAPID 私钥也不能提交到代码仓库。

数据复盘中的 CSV 字段 `platform` 填 `xhs` 或 `douyin`。必填字段为发布日期、标题、曝光量和阅读/播放量；建议同时填写 `sourceTopic`、`contentFormat`、`experimentVariable` 和 `commentInsights`，后续建议会更准确。

## 团队复盘与 Obsidian

1. 创建一个 Supabase 免费项目，在 SQL Editor 执行 `supabase/review-cloud.sql`，执行前先把文件末尾的占位团队密码换成真实密码。
2. 正式版已预置 Project URL 和 publishable key；团队成员在“数据复盘 → 连接云端”中通常只需填写昵称和团队密码。不要填写或使用 service_role/secret key。
3. 每个团队成员在自己的手机上填写同一个团队密码。一人录入后，其他已打开工作台的成员会自动同步，也可以点“立即同步”。
4. 复制 `review-cloud.local.example.json` 为不提交到 GitHub 的 `review-cloud.local.json`，填入相同云端信息。执行 `npm run sync:review-obsidian` 后，内容会写入 `07-数据复盘库/发布复盘`，并更新索引和团队建议页。

只有数据复盘会进入团队云端；日记、记账、训练和日常记录继续只保存在当前设备。
