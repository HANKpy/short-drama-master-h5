# 短剧全链条大师 H5 · 项目交接记忆文档

> 本文档用于「换一个 agent / 换一台电脑」继续开发本项目时快速上手。
> 由 Auto 在 2026-09-30 基于完整对话历史整理。
> 配套文件：`short-drama-master-h5.zip`（全部源码 + 单文件成品 + 本记忆文档）。

---

## 1. 项目一句话说明

一个**纯前端、零依赖、离线可用**的短剧创作工作台 H5 应用。把短剧生产方法论（题材/风格/景别/机位/打光/卡点/音效/分镜公式/提示词模板）编码为内置规则引擎，用户输入**一段梗概**后**一键跑完全链条**（解析梗概→分集→角色→剧本→分镜→双模型提示词），并配**进度可视化 + 图形化成果页**。

- 无后端、无 API Key、无联网、无第三方库（原生 HTML/CSS/JS，ES5+ 兼容写法）。
- 数据存浏览器 `localStorage`（key: `sdm_projects_v2`，当前项目 id 用 `sdm_current_v1`），不上传任何服务器。
  - ⚠️ 键名曾写作 `sdm_projects_v1`，实际代码是 `v2`；已更正文档。**不要**再把键写回 `v1`，否则会读到旧数据。

---

## 2. 完整对话时间线（按用户消息）

| # | 用户原话（意图） | 做了什么 |
|---|---|---|
| 1 | 「安装技能。」+ 4 个技能 zip | 安全审计后安装 `dialect-master`、`seedance-video-prompt`、`h3-video-prompt`、`short-drama-master` 到 `~/.codebuddy/skills/` |
| 2 | 「更新这几个技能」+ 4 个新 zip | 审计后发现 `short-drama-master` 包有 **GBK 编码文件名乱码 + 反斜杠路径**问题，用 Python（`cp437`→`gbk` 解码、反斜杠转正斜杠）修复后覆盖安装 |
| 3 | 「根据我的技能，帮我开发一个 H5 的『短剧全链条大师』应用。要求操作简单，界面美观简洁。」 | 读技能文档 → 规划 → 开发纯前端应用（index.html + css + 3 个 js + build.py），初版是 **7 步向导**工作台 |
| 4 | 「完全无法使用」 | 根因：①localhost 沙箱地址设备不可达；②多文件结构导致白屏。改为**单文件自包含 HTML**（CSS/JS 全内联，`file://` 直接打开），并用设备分享工具分发 |
| 5 | 「帮我把开发的代码上传到 GitHub…你新建一个代码仓库」 | 受阻：GitHub MCP 无建仓权限；沙箱网络 `github.com` 被 DNS 劫持到 `198.18.0.17`；PAT 也因网络层阻断无法使用。改为请用户**网页自建空仓库** |
| 6 | 「继续执行」（多次） | 因 429 额度用尽，多次重试推进 |
| 7 | 「你再帮我检查一下，还有哪些方面可以优化的？我需要用户输入一段梗概以后，它可以自动执行。可以看到当前的进度，最终输出优秀的视频生成提示词。而且页面要美观、好看、多图形化展示。」 | **推倒重写**：一键流水线（4.8 秒跑完 20 集/160 镜）、环形进度 + 阶段状态 + 滚动日志、SVG 情绪曲线 + 景别条形图 + 彩色时间轴、提示词引擎重写。提交 `dba06f0` |
| 8 | 「这是 GitHub 的 token，你试试：ghp_**（已脱敏）**」 | 经排查为**网络层阻断**，PAT 本身无效也无法到达 GitHub。给出「建议立即吊销该 token」的结论 |
| 9 | 「我在根据我上传的短剧技能开发一个应用，这是之前开发的文件和资料，你看一下，并且分析一下有什么问题。然后接着继续开发。」 | 从 WorkBuddy 空间拉回 6 个节点（源码真值在 `short-drama-master-h5-full` 的 git bundle 里），还原工作副本，**做代码审查并修复发现的逻辑缺陷**（见第 6 节新增行） |
| 10 | 「继续，读取你需要更新的文档并完成更新」 | 跑 `_validate.js` 无头验证 → 更正文档（`localStorage` 键名、README 过时描述）→ 重建单文件 `dist` |
| 11 | 「1、单集镜头数改为自定义可填 2、UI优化，支持移动端和PC端 3、结合4个短剧技能检查BUG 4、在GitHub新建项目同步代码」 | ①镜数改 3–30 可填（并修了底层「填 12 仍出 8 镜」的退化 bug）②UI 重做为移动端底部 Tab / PC 左侧栏+居中限宽 ③派子 agent 全量对照 4 个技能，修掉 7 个 P0 规范违规 ④建 GitHub 仓库并同步（MCP 无建仓权限→用 PAT+API；又撞上密钥扫描拦历史里的 token→重建历史后才推上去） |

> ⚠️ **安全提醒（务必处理）**：第 8 条提到的那个 GitHub PAT 曾在对话里明文出现。**请立刻到 GitHub → Settings → Developer settings → Personal access tokens 吊销它**，并视作已泄露。
> 即便当时未成功联网，也应按「已泄露」处理。
>
> 🚫 **本文档已脱敏**：原文里写着的 `ghp_…` 明文token 已在本轮移除，避免随仓库公开。后续任何交接文档**不得**再写明文 token，只写「已脱敏」即可。

---

## 3. 当前状态与待办

### ✅ 本轮（审查 + 修复）已完成

- ✅ **代码审查**：定位到 3 个此前未发现的**输出逻辑缺陷**（角色占位名、主角性别硬编码、剧本未流入分镜/提示词），详见第 6 节。
- ✅ **3 个缺陷全部修复**，并用新增的无头验证脚本 `_validate.js` 跑通（男主/女主/末世 3 个样本全绿）。
- ✅ **新增「剧本」成果子页**（成果页标签变为：总览 / 剧本 / 分镜 / 提示词），可直接编辑每场画面描述与台词。
- ✅ 文档更正：`localStorage` 键名 `v1`→`v2`、README 的「7 步向导」过时描述已同步。
- ✅ 单文件 `dist/short-drama-master-h5.html` 已重建（源码改动后必须重跑 `build.py`，否则线上仍是旧产物）。

### ✅ 第二轮（自定义镜数 + 双端 UI + 技能对齐 + 上 GitHub）

- ✅ **单集镜数 3–30 自定义**：原来只有 7/8 镜两个按钮。⚠️ 改造时发现底层还有个坑——`KB.shotFormula[n] || KB.shotFormula[8]`，**填 12 实际还是出 8 镜**。现已改为按比例生成阶段序列（钩子1 + 推进≈45% + 爆点 + 卡点1），见第 5 节。
- ✅ **UI 双端适配**：移动端底部 Tab / **PC 左侧栏 + 居中限宽**（`index.html` 新增 `.shell` 容器，PC 用 flex 布局把 `#tabbar` 变成 216px 侧栏）。
- ✅ **对齐 4 个技能规范**（详见第 6 节新增行）：修了 7 个 P0 级违规 + 若干 P1。
- ✅ **GitHub 仓库已建并同步**：<https://github.com/HANKpy/short-drama-master-h5>（public）。
- ✅ **端到端已覆盖**：`_e2e.js` 用 DOM 桩跑真实产物，不再只靠 Playwright。

### ✅ 第三轮（复验上传问题 + 补齐 dist）

- ✅ **上传失败原因已查明**：不是权限问题。PAT 权限完整（建仓/写文件/git push 全部实测 201/通过），真正原因是「代理掐断 git 大 POST」+「API 上传造成的历史分叉」。详见第 7 节排查结论表。
- ✅ **`dist/` 单文件成品纳入版本库**：原来被 `.gitignore` 排除，导致仓库里只有源码、拿不到可双击即用的成品。已取消忽略并补传（130KB）。
- ✅ **本地与远端历史已接上**：`git rebase FETCH_HEAD` 后 fast-forward 推送成功，两端零差异。
- ✅ **`sync_github.sh` 升级**：优先 git push（内置 rebase 步骤），失败自动回退 Contents API；文件清单补上 `dist/`。

### ✅ 第四轮（接入方言技能 dialect-master）

- ✅ **6 语系方言库**：粤语（广州西关）/ 川渝 / 东北 / 上海 / 闽南 / 客家，各带换字表（普通话→方言正字＋注音）、语气词、俗语、金句、招牌感叹词；粤语另带 4 条韩语空耳映射。落在 `js/data.js` 的 `KB.dialects`。
- ✅ **四大能力全部落地**：换字（正字转写）、换音（注音，按各语系体系：粤拼/台罗/白话字，官话区标谐音汉字）、加味（语气词/感叹词/俗语建议）、定调（L1/L2/L3 三档）。核心函数 `applyDialect()`，产出 DLC 契约。
- ✅ **方言契约卡**：剧本页每句方言台词展开一张卡——方言正字 / 普通话释义 / 注音 / 加味点 / 字幕方案。`js/app.js` 的 `renderScript()`。
- ✅ **提示词对接**：Seedance 输出「用粤语说道{…}」，H3 输出 `speaks in Cantonese`（正文仍走 `<d>[Chinese]` 标签）。
- ✅ **换方言/换浓度自动失效旧剧本**：`onEdit` 与 `act=dlevel` 都会清空 `scripts`/`storyboard`，避免旧台词残留。

> **设计取舍（改动前先看这里）**
> - **方言只作用于主角**，其余角色保持普通话作对照 —— 内核要求「同一角色只允许一个主导语系」，全员方言会变成「南北混杂假方言」。
> - **俗语只给建议、不塞进台词** —— 内核要求「每角色俗语 ≤1/集」，塞进去就变段子拼盘。所以俗语进 `flavor` 字段由编剧择用。
> - **字幕是后期烧录**，片内不生成文字，所以方言只改 `subtitle_plan` 文案，不往提示词里加字幕指令。
> - **换字有长词优先 + 重叠词保护两道保险**：长词优先避免「为什么」被「什么」先替掉；重叠保护避免「好好」被逐字替换成「巴適巴適」（实测出现过，已修）。

### ⏸️ 仍待办

- ⏸️ **PAT 泄露**：建议吊销（见第 2 节提醒）。仓库里已无明文 token，但聊天记录里出现过。
- ⏸️ **`pickName` 待增强**：末世样本「幸存者陈默」只抽出「幸存者」——主角名识别对「身份词+姓名」结构（无明确主语）仍会退化成身份词。属可选增强。
- ⏸️ **空耳喜剧未接进流水线**：粤语库里已有 4 条韩语空耳映射（四要素齐全），但没有 UI 开关、也没有生成「背景外语欢呼 + 误听反应」的分镜。需要跨语言场景时才做。
- ⏸️ **无「分集」成果页**：四幕结构与每集卡点产出后目前不可见、不可导出，建议后续加一个 episodes 子页。

---

## 4. 文件结构与职责

```
short-drama-master-h5/
├── index.html                # H5 骨架：顶部栏 + 主内容区 #main + 底部 4 Tab（创作/项目/知识库/我的）+ 3 个 <script> 引用
├── css/
│   └── style.css             # 移动优先样式：主题色/卡片/表单/环形进度/SVG 图表/镜头时间轴/Tab 栏
├── js/
│   ├── data.js               # 知识库常量（最大文件之一）：
│   │                         #   genres/styles/templates/shotSizes/cameraAngles/lightings/
│   │                         #   cliffhangers/soundCats/shotFormula/movements/emotionArc/goldenEffects/
│   │                         #   parseDict（梗概词典）、genreActions（17 题材×136 条画面动作库）、
│   │                         #   fallbackActions、goldenLines（金句库）、shotDurations、transitions
│   ├── templates.js          # 生成引擎（核心算法）：
│   │                         #   pickName() 主角名识别（带停用字表防贪婪）
│   │                         #   detectGender() 主角性别推断（本轮新增）
│   │                         #   genName() / genCharName() 角色真名生成（本轮新增）
│   │                         #   parsePremise() 梗概解析（主角/时代/金手指/危机）
│   │                         #   actionsOf() / genEpisodes() 四幕结构分集
│   │                         #   genScript() / genStoryboard() 剧本与分镜
│   │                         #   genPromptSeedance() 中文三段式提示词
│   │                         #   genPromptH3() 英文六段式提示词（累计时间码 + Negative prompt）
│   └── app.js                # 应用逻辑：状态机 / runPipeline(6 阶段异步) / render / 事件绑定 /
│                             #   localStorage 读写 / 复制导出 / 分镜内联编辑
├── build.py                  # 构建脚本：把 css/js 内联进 index.html → dist/short-drama-master-h5.html
├── dist/
│   └── short-drama-master-h5.html   # 单文件成品（自包含，双击即用，不依赖外部文件）
├── _validate.js              # 无头验证脚本（Node 直跑），回归检查生成引擎逻辑
├── _e2e.js                   # DOM 桩端到端验证（Node 直跑），覆盖 app.js 渲染与编辑链路
├── sync_github.sh            # 同步源码到 GitHub（GH_TOKEN=xxx ./sync_github.sh）；git push 被代理掐断时的兜底
├── README.md                 # 使用与二次开发说明
├── HANDOFF.md                # 本文档（交接记忆）
└── .gitignore                # 忽略 dist/、__pycache__、.DS_Store 等
```

> 内联顺序固定：`data → templates → app`（依赖顺序），改 `build.py` 时勿乱序。

---

## 5. 核心逻辑说明（继续开发必读）

1. **梗概解析 `parsePremise`**：用正则 + 词典（`parseDict`）从一句话里抽取主角名、时代背景、金手指、核心危机，结果贯穿分集/剧本/分镜/提示词。
2. **主角名识别 `pickName`**：最初贪心匹配成「林凡穿」，已加**停用字表**（如「穿越/穿/带/携」等）防贪婪，改名字识别逻辑时务必保留该停用字表。
   - ⚠️ **已知局限（待增强）**：对「身份词 + 姓名」结构（如「幸存者陈默」）只能抽出身份词「幸存者」。修法方向：识别到身份词后在本句/前句里继续向后找 2 字人名。
3. **四幕分集 `genEpisodes`**：开局 / 发展 / 转折 / 高潮；每集含主冲突 + 爽点 + 集尾卡点。
4. **分镜公式 `genStoryboard`**：按 7/8 镜公式 + 五阶段情绪曲线（`emotionArc`）拆解；每镜自动配景别/机位/运镜/打光/音效/时长/转场。
   - 性能坑：20 集 640 镜下拉曾卡死 → 改为**按集渲染、每集 8 镜**。
   - 时间码坑：H3 累计时间码曾回绕 → 用 `i*10%60` 修正（注意每镜时长单位）。
5. **双模型提示词**：
   - **Seedance 中文三段式**：素材声明 + 全局一致性约束 + 带时间码/转场/BGM 的分镜序列。
   - **MiniMax H3 英文六段式**：Style + Reference lock + 累计时间码 Shot list + 音频层 + Negative prompt。
6. **进度可视化**：`runPipeline` 6 阶段异步；环形进度（SVG `stroke-dasharray`）、阶段状态徽标、滚动日志。
7. **图形化成果**：SVG 情绪曲线（折线）、景别配比（条形图）、五阶段结构卡片、分镜时间轴（按时长配色）、统计卡（集数/镜头数/总时长/角色数）。
8. **角色真名生成（本轮新增）**：主角用 `parsePremise` 抽出的真名；反派/女主/配角原本会直出「反派/女主/配角」这种占位名，现由 `genCharName()` 按姓氏库 + 男女名库拼出真名（如窦辰 / 仲婉薇 / 凤砚）。
   - 主角性别由 `detectGender()` 从原梗概推断（含「她/女主/女王」→女，「男主/王爷」→男），`look` 外观随之变成「青年男性 / 青年女性」——**此前硬编码成男性**，导致女主项目的角色外观全错。
9. **剧本 → 分镜 → 提示词内容链路（本轮修复）**：`genScript()` 产出的四场剧本**此前从未被下游消费**，`genStoryboard()` 只按题材动作库现造描述，导致每集的核心冲突/爽点/卡点在分镜层全部丢失、各集内容雷同。
   - 现修复为：分镜 `desc` 以 `scene.desc` 为基底、追加 `ep.conflict`/`ep.highlight`/`ep.cliffhanger`；提示词由分镜反推，叙事自动贯通。

---

## 6. 已修复 Bug 清单（含根因，避免重踩）

| 现象 | 根因 | 修复 |
|---|---|---|
| 技能包文件名乱码、路径打不开 | Windows 打包用 GBK + 反斜杠 | Python `cp437`→`gbk` 解码、反斜杠转 `/` |
| 应用白屏「完全无法使用」 | ①localhost 沙箱设备不可达 ②多文件结构加载失败 | 改为单文件自包含 HTML，`file://` 直接打开 |
| 主角名识别成「林凡穿」 | 正则贪心匹配 | 加停用字表限制边界 |
| H3 模型切换无效 | HTML 用 `data-val`，JS 读 `dataset.v` 不一致 | 统一为 `data-v` |
| 20 集 640 镜下拉卡死 | 一次性渲染全部镜头 DOM | 改为按集渲染、每集 8 镜 |
| H3 时间码回绕 | 取模公式错误 | 改为 `i*10%60` 累计修正 |
| 画面台词重复 | 动作库与金句库未去重 | 题材动作库 + 金句库去重 |
| GitHub 上传失败 | 网络层 DNS 劫持 + MCP 无权限 + PAT 无法达 | 转由用户网页自建空仓库（待办） |
| **角色名是占位名**：反派/女主/配角直接出现在提示词与成果页里 | `genCharacters()` 未给非主角生成姓名 | 新增 `genCharName()`（姓氏库+男女名库）生成真名 |
| **主角性别固定为男**：女主项目里主角外观写「青年男性」 | `look` 在 `genCharacters()` 里硬编码男性 | 新增 `detectGender()` 从原梗概推断性别，`look` 随之切换 |
| **每集内容雷同、剧本白写**：分镜与提示词里完全看不到该集冲突/爽点/卡点 | `genStoryboard()` 只消费题材动作库，未读 `genScript()` 产出；`genScript()` 结果无人消费 | 分镜 `desc` 以 `scene.desc` 为基底并追加 `ep.conflict`/`highlight`/`cliffhanger`；提示词由分镜反推 |
| **产物与源码不同步**：改了源码但 `dist/` 还是旧版 | 单文件是构建产物，不随源码自动更新 | **改完源码必须重跑 `python3 build.py`** |
| **自定义镜数无效**：填 12 镜仍只出 8 镜 | `KB.shotFormula[n] \|\| KB.shotFormula[8]` 直接回退到 8 | 新增 `stageSeq(n)` 按比例生成阶段序列；`durationsFor(n)` 生成时长 |
| **同一集内多镜描述完全相同** | 同阶段镜头共用 `scene.desc`，动作 `act` 被丢弃；`emoHint` 是固定抽象情绪词 | 按「阶段内第几镜」轮转动作与景别/机位/运镜/打光；去掉抽象情绪词 |
| **提示词里角色名混进朗读区** | `dialogue` 存成「林凡：台词」整体塞进 `{}` | `speaker` 与 `dialogue` 拆开，渲染成 `镜头切至X，用普通话说道{台词}` |
| **H3 提示词六段式整体写错** | 只有 Style/Reference/Continuity/Shot/music/Negative，且 `Reference image N =` 格式非法、时间码是三段式 `00:mm:ss.mms` | 重写六段式：`<Subject N> is … in <Picture N>`、时间码 `mm:ss.000`、台词 `<d>[Chinese]…</d>`、`non_diegetic_music: N/A` |
| **运镜写了「定格」** | `SHOT_REC` 的 hook/boom3/cliff 里都有「定格」 | 换成「快速推镜 / 缓慢推镜 / 固定镜头」（Seedance 铁律27 / H3 铁律7：片内不 freeze） |
| **「金色闪耀」「BGM燃向」被当音效** | `boom3.sounds` 存的是特效/BGM 词，却渲染成 `<音效>` | 换成可听到的具体声源（呼吸声、钟摆滴答） |
| **女频题材主角被判成男性** | `detectGender` 无性别线索时一律返回男 | 加 `FEMALE_GENRES`（甜宠/虐恋/萌宝/家庭伦理/言情）题材兜底 |
| **情绪曲线自相矛盾** | push 段 `v + i*6` 单调上升，与「危机触底」矛盾 | push 段改为从 52 递减到 22 的谷底，再在爆点冲顶 |

---

## 7. 如何运行 / 构建 / 部署

### 直接用单文件成品（推荐，最简单）
下载 `dist/short-drama-master-h5.html`，**任意浏览器双击打开即用**，无需服务器、无需同目录其他文件。

### 本地多文件开发
```bash
cd short-drama-master-h5
python3 -m http.server 8899
# 浏览器打开 http://localhost:8899
# 或直接双击 index.html
```

### 改源码后重新生成单文件版
```bash
python3 build.py
# 产物 dist/short-drama-master-h5.html（含结束标签冲突检测，有 </style>/</script> 内联会报错）
```

### 同步到 GitHub

仓库：<https://github.com/HANKpy/short-drama-master-h5>（public，owner `HANKpy`）

```bash
# 一条命令搞定（脚本会先试 git push，失败自动回退 Contents API）
GH_TOKEN=你的PAT ./sync_github.sh

# 或者手动
git add -A && git commit -m "..." && git push
```

> ⚠️ **三个坑（都已踩过并解决）**
> 1. **GitHub MCP 没有建仓权限**（403 Resource not accessible by integration），建仓要用 PAT + API；MCP 适合读仓库/提 PR。
> 2. **GitHub 会扫描提交历史里的密钥**：只要历史中任一 commit 含明文 PAT，push 就会被拦（`push declined due to repository rule violations`）。
>    本次就踩了——我改了 `HANDOFF.md` 的当前版本，但**旧 commit 里仍有 token**，必须重建历史（`git update-ref -d refs/heads/main` 后重新提交）才推得上去。
>    👉 所以：**任何 token 都不要写进会被提交的文件**。
> 3. **push 被拒不一定是被 2 拦，也可能是历史分叉**：`Updates were rejected because the remote contains work that you do not have locally`。
>    本次成因：远端那批 commit 是早前用 **Contents API 逐个上传**产生的，与本地 commit 链分叉（两者有共同祖先但不是 fast-forward）。
>    解法：`git fetch origin main && git rebase FETCH_HEAD` 接上历史再推 —— **不要用 `--force`**，会丢远端内容。
>    `sync_github.sh` 已经内置了这个 rebase 步骤。

### 「上传失败」排查结论（2026-10-01 复验）

用一枚带完整 `repo` 权限的 PAT 做了端到端复验，结论是：**不是权限问题，代码其实早已上传成功**。

| 探测项 | 结果 |
|---|---|
| `GET /user` 认证 | 200，`X-OAuth-Scopes` 含 `repo` / `delete_repo` / `admin:repo_hook` / `workflow` 等完整权限 |
| 建仓 `POST /user/repos` | **201**（实测建了临时仓库再删掉，204） |
| 写文件 `PUT /contents/...` | **201** |
| `git push` over HTTPS | **可用**（临时仓库实测；失败信息是 fast-forward 拒绝，不是网络/鉴权错误） |

失败的真正原因有两个，都和网络/历史有关，与 token 权限无关：

1. **代理掐断了 git 的大 POST**（`RPC failed; curl 52 Empty reply from server`）—— 同一时刻 `curl` 调 API 却是通的，所以改走 Contents API 上传成功。
2. **历史分叉导致的 non-fast-forward**（见上文坑 3）—— 表现为 "Updates were rejected"，很容易被误读成"没权限"。

判断技巧：**看报错文本**。权限问题的信号是 `403` / `Permission denied` / `Resource not accessible`；
`curl 52` 是网络被掐；`Updates were rejected` 只是本地落后于远端，rebase 一下就好。

> 现在仓库已完整：源码 + `dist/` 单文件成品 + 文档，共 13 个文件，本地与远端零差异，Pages 状态 `built`。

### 部署到 GitHub Pages（手机访问）
仓库 Settings → Pages → Source 选 `main` 分支根目录，访问 `https://HANKpy.github.io/short-drama-master-h5/`。

---

## 8. 二次开发入口（改哪里）

| 想改什么 | 改哪个文件 |
|---|---|
| 知识库（题材/风格/景别/打光等常量） | `js/data.js`（纯常量对象，改完刷新） |
| **方言词库 / 新增语系** | `js/data.js` 的 `KB.dialects`（每项含 `swaps` 换字表 `[普通话, 方言正字, 注音]`、`particles` 语气词、`exclaims` 感叹词、`proverbs` 俗语、`golden` 金句、`cue` 提示词语种指令、`gags` 空耳）；`KB.dialectLevels` 是浓度三档 |
| **方言替换逻辑** | `js/templates.js` 的 `applyDialect()`（换字/换音/加味/定调）；`DIALECT_EN` 是 H3 用的语种英译 |
| 推荐逻辑（分镜怎么拆、参数怎么配） | `js/templates.js` 的 `SHOT_REC` 映射表 + 各 `gen*` 函数 |
| 界面/交互 | `js/app.js`（状态机与渲染）+ `css/style.css`（样式，方言契约卡样式在 `.dlc*`） |
| 单文件打包 | `build.py`（内联顺序勿乱） |

---

## 9. 给其他 Agent 的接力提示

- **不要重复安装技能**：`dialect-master`、`seedance-video-prompt`、`h3-video-prompt`、`short-drama-master` 已在 `~/.codebuddy/skills/` 就绪（如需微调短剧包，注意 GBK 编码问题）。
- **GitHub 推送前先确认网络**：若仍无法访问 github.com，应请用户网页建空仓库并（安全地）提供有 `repo` 权限的 PAT，或改用设备分享/打包下载方式交付。
- **PAT 安全**：任何明文 token 都应提醒用户吊销，不要再次写入文件或日志。
- **保持「零依赖、单文件可用」的架构原则**：新增功能尽量不引入第三方库；若必须改多文件结构，记得同步更新 `build.py` 的内联逻辑。
- **测试（三层，按改动类型选）**：
  1. **逻辑层 `_validate.js`**（几秒）：造假 `window` 加载 `data.js` + `templates.js`，对男主/女主/末世 3 个样本跑完整生成引擎，打印主角性别外观、角色真名、剧本、分镜 desc/dialogue、提示词首行，断言「提示词不含 反派/女主/配角 字面」；第 7 节另覆盖方言层（6 语系 DLC 字段齐全、无紧邻重复换字、语气词在引号内、L1/L2/L3 定调、方言只给主角、提示词语种指令）。
     👉 **改 `templates.js` / `data.js` 后必跑**。
  2. **端到端 `_e2e.js`**（约 6 秒，跑的是 `dist/` 里的真实单文件产物）：用 DOM 桩驱动真实交互链路——新建项目 → 填梗概 → 一键流水线 → 切剧本/分镜/提示词子页 → 编辑剧本字段 → 断言已持久化 → 切集不报错；第 ⑤ 段再走一遍方言链路（选粤语 → 浓度 L3 → 重跑 → 剧本页契约卡 → 提示词语种指令）。
     👉 **改 `app.js` 后必跑**（这层才是之前一直缺的）。
  3. **浏览器层 Playwright**：真实浏览器里确认无 JS 错误、长集数不卡顿、滚动/触摸正常。属于可选补强。
- **改完别忘重建**：`node _validate.js && node _e2e.js` 都通过后，再跑 `python3 build.py` 重新产出 `dist/` 单文件 —— 否则两处测试测的是**旧产物**，交付出去的还是旧行为。
```
