/* ============================================================
 * 短剧全链条大师 · 应用逻辑
 * 一键流水线 / 进度可视化 / 图形化成果
 * ============================================================ */
(function () {
  const KB = window.KB, GEN = window.GEN;

  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));

  const LS_PROJECTS = "sdm_projects_v2", LS_CURRENT = "sdm_current_v1";

  const state = {
    tab: "create",
    view: "input",            // input | running | result
    projectId: null, project: null,
    run: { stage: -1, pct: 0, logs: [] },
    resultTab: "overview",    // overview | script | board | prompt
    curEp: 1
  };

  /* ---------- 工具 ---------- */
  function uid() { return "p_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function pick(arr, n) { return arr[((n % arr.length) + arr.length) % arr.length]; }
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 1800);
  }

  /* ---------- 存储 ---------- */
  function loadProjects() { try { return JSON.parse(localStorage.getItem(LS_PROJECTS)) || []; } catch (e) { return []; } }
  function saveProjects(list) { try { localStorage.setItem(LS_PROJECTS, JSON.stringify(list)); } catch (e) { toast("存储空间不足，请减少集数"); } }
  function persist() {
    if (!state.project) return;
    state.project.updatedAt = Date.now();
    const list = loadProjects();
    const i = list.findIndex(p => p.id === state.project.id);
    if (i >= 0) list[i] = state.project; else list.unshift(state.project);
    saveProjects(list);
  }

  function newProject(premise) {
    const p = {
      id: uid(), name: "未命名短剧", updatedAt: Date.now(),
      meta: {
        premise: premise || "", genre: "逆袭打脸", style: "S07", model: "seedance",
        ratio: "9:16", episodes: 12, shotsPerEpisode: 8
      },
      episodes: [], characters: [], scripts: [], storyboard: [], parsed: null
    };
    if (premise) p.name = (GEN.parsePremise(premise).name || "我的") + "的短剧";
    const list = loadProjects(); list.unshift(p); saveProjects(list);
    state.projectId = p.id; state.project = p;
    localStorage.setItem(LS_CURRENT, p.id);
    return p;
  }
  function openProject(id) {
    const p = loadProjects().find(x => x.id === id);
    if (!p) return;
    state.projectId = id; state.project = p;
    localStorage.setItem(LS_CURRENT, id);
    state.view = p.storyboard && p.storyboard.length ? "result" : "input";
    state.curEp = 1; state.resultTab = "overview";
  }
  function ensureProject() {
    if (state.project) return true;
    const cid = localStorage.getItem(LS_CURRENT);
    const list = loadProjects();
    const p = (cid && list.find(x => x.id === cid)) || list[0];
    if (p) { state.projectId = p.id; state.project = p; state.view = p.storyboard && p.storyboard.length ? "result" : "input"; return true; }
    return false;
  }

  /* ---------- 复制 / 导出 ---------- */
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); toast("已复制 ✓"); }
    catch (e) {
      const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); toast("已复制 ✓"); } catch (e2) { toast("复制失败，请长按手动复制"); }
      document.body.removeChild(ta);
    }
  }
  function downloadText(filename, text) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ============================================================
   * 渲染入口
   * ============================================================ */
  function render() {
    $$("#tabbar .tab").forEach(x => x.classList.toggle("active", x.dataset.tab === state.tab));
    const main = $("#main");
    if (state.tab === "create") main.innerHTML = renderCreate();
    else if (state.tab === "projects") main.innerHTML = renderProjects();
    else if (state.tab === "knowledge") main.innerHTML = renderKnowledge();
    else main.innerHTML = renderAbout();
    $("#stepper").classList.add("hidden");
    bindView();
    window.scrollTo(0, 0);
  }

  function renderCreate() {
    if (!state.project) return renderInput();
    if (state.view === "running") return renderRunning();
    if (state.view === "result") return renderResult();
    return renderInput();
  }

  /* ============================================================
   * ① 输入页
   * ============================================================ */
  const SAMPLES = [
    { text: "2024年私募操盘手林凡穿越回1996年的香港，成为负债三千万的落魄富二代，靠未来记忆在股市绝地翻身。", genre: "逆袭打脸" },
    { text: "苏晚重生回结婚前一天，手撕渣男与白莲继妹，转身投入暗恋自己十年的陆氏总裁怀抱。", genre: "甜宠情感" },
    { text: "末世降临第三年，幸存者陈默在废墟中觉醒异能，带领伙伴求生并揭开灾变真相。", genre: "末世科幻" }
  ];

  function renderInput() {
    const m = state.project ? state.project.meta : { premise: "", genre: "逆袭打脸", style: "S07", model: "seedance", ratio: "9:16", episodes: 12, shotsPerEpisode: 8 };
    const gOpt = KB.genres.map(g => `<option ${g.name === m.genre ? "selected" : ""}>${g.name}</option>`).join("");
    const sOpt = KB.styles.map(s => `<option value="${s.id}" ${s.id === m.style ? "selected" : ""}>${s.id} ${s.name}</option>`).join("");
    return `
    <div class="hero">
      <div class="hero-title">短剧全链条大师</div>
      <div class="hero-sub">一句话梗概 → 自动跑完全链条 → 输出可直投的 AI 视频提示词</div>
      <div class="hero-flow">
        ${["梗概", "分集", "角色", "剧本", "分镜", "提示词"].map((s, i) =>
          `<span class="flow-node">${s}</span>${i < 5 ? '<span class="flow-arrow">›</span>' : ""}`).join("")}
      </div>
    </div>

    <div class="card">
      <div class="card-title">✍️ 故事梗概 <span class="tag gray" id="premise-count">0 字</span></div>
      <textarea id="premise-box" class="big-input" data-edit="meta" data-field="premise"
        placeholder="用 1-3 句话说清：谁 + 遭遇什么 + 凭什么翻盘&#10;例：2024年私募操盘手林凡穿越回1996年的香港，成为负债三千万的落魄富二代，靠未来记忆在股市绝地翻身。">${esc(m.premise)}</textarea>
      <div class="samples">
        ${SAMPLES.map((s, i) => `<button class="chip-sample" data-act="sample" data-i="${i}">💡 示例${i + 1}</button>`).join("")}
      </div>
    </div>

    <div class="card">
      <div class="card-title">⚙️ 创作配置</div>
      <div class="grid-form">
        <div class="field"><label>题材</label><select data-edit="meta" data-field="genre">${gOpt}</select></div>
        <div class="field"><label>画面风格</label><select data-edit="meta" data-field="style">${sOpt}</select></div>
        <div class="field"><label>总集数</label><input type="number" min="1" max="60" data-edit="meta" data-field="episodes" value="${m.episodes}" /></div>
        <div class="field"><label>单集镜数 <span class="tag gray">3-30</span></label>
          <input type="number" min="3" max="30" data-edit="meta" data-field="shotsPerEpisode" value="${m.shotsPerEpisode}" />
        </div>
      </div>
      <div class="field"><label>目标模型</label>
        <div class="seg">
          <div class="seg-item ${m.model === "seedance" ? "active" : ""}" data-act="model" data-v="seedance">Seedance 2.5</div>
          <div class="seg-item ${m.model === "h3" ? "active" : ""}" data-act="model" data-v="h3">MiniMax H3</div>
        </div>
      </div>
      <div class="field"><label>画面比例</label>
        <div class="seg">
          <div class="seg-item ${m.ratio === "9:16" ? "active" : ""}" data-act="ratio" data-v="9:16">9:16 竖屏</div>
          <div class="seg-item ${m.ratio === "16:9" ? "active" : ""}" data-act="ratio" data-v="16:9">16:9 横屏</div>
        </div>
      </div>
    </div>

    <button class="btn big block" data-act="run">🚀 一键生成全链条</button>
    <div class="tip">将自动完成：梗概解析 → 分集规划 → 角色设定 → 剧本创作 → 分镜拆解 → 提示词生成</div>`;
  }

  /* ============================================================
   * ② 流水线运行页
   * ============================================================ */
  function renderRunning() {
    const r = state.run;
    const stages = KB.pipeline;
    const R = 52, C = 2 * Math.PI * R;
    const off = C * (1 - r.pct / 100);
    return `
    <div class="run-wrap">
      <div class="ring-box">
        <svg viewBox="0 0 120 120" class="ring">
          <circle cx="60" cy="60" r="${R}" class="ring-bg"></circle>
          <circle cx="60" cy="60" r="${R}" class="ring-fg" stroke-dasharray="${C}" stroke-dashoffset="${off}"></circle>
        </svg>
        <div class="ring-text"><b>${Math.round(r.pct)}</b><span>%</span></div>
      </div>
      <div class="run-now">${r.stage >= 0 && stages[r.stage] ? stages[r.stage].icon + " " + stages[r.stage].name : "准备中…"}</div>

      <div class="stage-list">
        ${stages.map((s, i) => {
          let cls = "st";
          if (i < r.stage) cls += " done"; else if (i === r.stage) cls += " now";
          return `<div class="${cls}">
            <span class="st-ico">${i < r.stage ? "✓" : s.icon}</span>
            <span class="st-main"><b>${s.name}</b><i>${s.desc}</i></span>
            ${i === r.stage ? '<span class="spinner"></span>' : ""}
          </div>`;
        }).join("")}
      </div>

      <div class="log-box">${r.logs.map(l => `<div class="log-line">${l}</div>`).join("")}</div>
    </div>`;
  }

  function pushLog(msg) {
    state.run.logs.push(msg);
    const box = $(".log-box");
    if (box) { box.innerHTML += `<div class="log-line">${msg}</div>`; box.scrollTop = box.scrollHeight; }
  }

  function runPipeline() {
    if (!state.project) newProject("");
    const p = state.project;
    if (!p || !p.meta.premise.trim()) { toast("请先填写故事梗概"); const b = $("#premise-box"); if (b) b.focus(); return; }

    state.view = "running";
    state.run = { stage: -1, pct: 0, logs: [] };
    p.episodes = []; p.scripts = []; p.storyboard = [];
    render();

    const jobs = [
      {
        key: "parse", run: () => {
          p.parsed = GEN.parsePremise(p.meta.premise);
          const i = p.parsed;
          return [
            `识别主角：<b>${esc(i.name || "主角")}</b>`,
            `时代背景：<b>${i.era ? i.era.v : "未识别（默认现代都市）"}</b>`,
            `金手指：<b>${i.finger ? i.finger.v : "未识别（默认过人本事）"}</b>`,
            `核心危机：<b>${i.stake ? i.stake.v : "未识别（默认处境艰难）"}</b>`
          ];
        }
      },
      {
        key: "outline", run: () => {
          p.episodes = GEN.genEpisodes(p);
          return [`按四幕结构（开局/发展/转折/高潮）生成 <b>${p.episodes.length}</b> 集大纲`,
          `每集含：主冲突 + 爽点 + 集尾卡点`];
        }
      },
      {
        key: "char", run: () => {
          p.characters = GEN.genCharacters(p);
          return [`建立 <b>${p.characters.length}</b> 个角色真值档案：${p.characters.map(c => esc(c.name)).join(" / ")}`,
          `外貌与服装将贯穿剧本与提示词，保证一致性`];
        }
      },
      {
        key: "script", run: () => {
          p.scripts = GEN.genScript(p);
          return [`生成 <b>${p.scripts.length}</b> 集画面化剧本，每集 4 场（钩子/推进/爆点/卡点）`,
          `写动作不写心理，写空间不写抽象`];
        }
      },
      {
        key: "board", run: () => {
          p.storyboard = GEN.genStoryboard(p);
          const n = p.storyboard.reduce((a, e) => a + e.shots.length, 0);
          return [`共拆解 <b>${n}</b> 个镜头`,
          `每镜自动配：景别 / 机位 / 运镜 / 打光 / 音效 / 时长 / 转场`,
          `遵循五阶段情绪曲线：激励事件 → 进展纠葛 → 危机 → 高潮 → 结尾`];
        }
      },
      {
        key: "prompt", run: () => {
          const isH3 = p.meta.model === "h3";
          return [`套用 <b>${isH3 ? "H3 英文六段式" : "Seedance 中文三段式"}</b> 内核模板`,
          `含素材声明 / 全局一致性约束 / 分镜时间码 / 音频层 / 负向提示词`];
        }
      }
    ];

    let i = 0;
    function step() {
      if (i >= jobs.length) {
        persist();
        pushLog("<b>✅ 全链条生成完毕</b>");
        setTimeout(() => { state.view = "result"; state.resultTab = "overview"; state.curEp = 1; render(); }, 500);
        return;
      }
      state.run.stage = i;
      state.run.pct = (i / jobs.length) * 100;
      pushLog(`<span class="log-tag">${KB.pipeline[i].icon} ${KB.pipeline[i].name}</span>`);
      const box = $(".log-box"); const cur = i;
      setTimeout(() => {
        try {
          const msgs = jobs[cur].run();
          msgs.forEach(m => pushLog("&nbsp;&nbsp;" + m));
        } catch (e) {
          pushLog('<span class="log-err">✗ 出错：' + esc(e.message) + "</span>");
        }
        state.run.pct = ((cur + 1) / jobs.length) * 100;
        const ring = $(".ring-fg");
        if (ring) { const C = 2 * Math.PI * 52; ring.setAttribute("stroke-dashoffset", C * (1 - state.run.pct / 100)); }
        const pct = $(".ring-text"); if (pct) pct.innerHTML = `<b>${Math.round(state.run.pct)}</b><span>%</span>`;
        const now = $(".run-now"); if (now && KB.pipeline[cur + 1]) now.textContent = KB.pipeline[cur + 1].icon + " " + KB.pipeline[cur + 1].name;
        const list = $(".stage-list");
        if (list) list.innerHTML = KB.pipeline.map((s, k) => {
          let cls = "st"; if (k < cur + 1) cls += " done"; else if (k === cur + 1) cls += " now";
          return `<div class="${cls}"><span class="st-ico">${k < cur + 1 ? "✓" : s.icon}</span><span class="st-main"><b>${s.name}</b><i>${s.desc}</i></span>${k === cur + 1 ? '<span class="spinner"></span>' : ""}</div>`;
        }).join("");
        i++;
        setTimeout(step, 420);
      }, 260);
    }
    step();
  }

  /* ============================================================
   * ③ 成果页
   * ============================================================ */
  function renderResult() {
    const p = state.project, st = GEN.stats(p);
    const isH3 = p.meta.model === "h3";
    return `
    <div class="result-head">
      <div>
        <div class="rh-title">${esc(p.name)}</div>
        <div class="rh-sub">${esc(p.meta.genre)} · ${p.meta.episodes}集 · ${isH3 ? "H3" : "Seedance"} · ${fmtDur(st.seconds)}</div>
      </div>
      <button class="btn sm line" data-act="rerun">🔄 重跑</button>
    </div>

    <div class="subtabs">
      <div class="subtab ${state.resultTab === "overview" ? "active" : ""}" data-act="rtab" data-v="overview">总览</div>
      <div class="subtab ${state.resultTab === "script" ? "active" : ""}" data-act="rtab" data-v="script">剧本</div>
      <div class="subtab ${state.resultTab === "board" ? "active" : ""}" data-act="rtab" data-v="board">分镜</div>
      <div class="subtab ${state.resultTab === "prompt" ? "active" : ""}" data-act="rtab" data-v="prompt">提示词</div>
    </div>

    ${state.resultTab === "overview" ? renderOverview(st) : ""}
    ${state.resultTab === "script" ? renderScript() : ""}
    ${state.resultTab === "board" ? renderBoard() : ""}
    ${state.resultTab === "prompt" ? renderPrompt() : ""}`;
  }

  function fmtDur(sec) {
    if (sec < 60) return sec + " 秒";
    const m = Math.floor(sec / 60), s = sec % 60;
    return m + " 分 " + (s ? s + " 秒" : "");
  }

  /* ---------- 总览：统计 + 图表 ---------- */
  function renderOverview(st) {
    const p = state.project;
    const sb = p.storyboard || [];
    const first = sb[0];
    return `
    <div class="stat-grid">
      <div class="stat"><b>${st.episodes}</b><span>集</span></div>
      <div class="stat"><b>${st.shots}</b><span>镜头</span></div>
      <div class="stat"><b>${fmtDur(st.seconds)}</b><span>总时长</span></div>
      <div class="stat"><b>${st.characters}</b><span>角色</span></div>
    </div>

    <div class="card">
      <div class="card-title">📈 情绪曲线 <span class="tag gray">单集 ${p.meta.shotsPerEpisode} 镜</span></div>
      <div class="card-sub">钩子起跳 → 推进压抑 → 危机触底 → 爆点冲顶 → 卡点收束</div>
      ${first ? svgEmotion(first.shots) : ""}
    </div>

    <div class="card">
      <div class="card-title">📊 景别配比 <span class="tag gray">全剧 ${st.shots} 镜</span></div>
      ${svgSizeBars(st.sizeCount, st.shots)}
    </div>

    <div class="card">
      <div class="card-title">🎭 五阶段结构</div>
      ${KB.emotionArc.map((e, i) => `
        <div class="arc-row">
          <div class="arc-dot" style="background:${KB.palette.emoArc[i]}"></div>
          <div class="arc-main"><b>${e.stage}</b><i>${e.shot}</i></div>
          <div class="arc-desc">${e.desc}</div>
        </div>`).join("")}
    </div>

    <div class="card">
      <div class="card-title">👥 角色真值</div>
      ${(p.characters || []).map(c => `
        <div class="char-row">
          <div class="char-ava" style="background:${c.tag === "villain" ? "#ff5a5f22" : "#7c5cff22"};color:${c.tag === "villain" ? "#ff5a5f" : "#7c5cff"}">${esc(c.name.slice(0, 1))}</div>
          <div class="char-main"><b>${esc(c.name)}</b> <span class="tag ${c.tag === "villain" ? "orange" : "green"}">${esc(c.role)}</span>
            <div class="char-look">${esc(c.look)}</div>
            <div class="char-goal">目标：${esc(c.goal)}</div>
          </div>
        </div>`).join("")}
    </div>

    <div class="card">
      <div class="card-title">📦 导出</div>
      <button class="btn line block" style="margin-bottom:10px" data-act="export-prompt">导出全部提示词（TXT）</button>
      <button class="btn line block" style="margin-bottom:10px" data-act="export-board">导出分镜表（TXT）</button>
      <button class="btn line block" data-act="export-json">导出项目（JSON）</button>
    </div>`;
  }

  /* 情绪曲线 SVG */
  function svgEmotion(shots) {
    const W = 320, H = 120, pad = 16;
    const n = shots.length;
    // 推进段要「先压后放」：从起势一路压到谷底，再在爆点冲顶
    const pushTotal = shots.filter(s => s.stage === "push").length;
    let pushSeen = 0;
    const vals = shots.map((s) => {
      if (s.stage === "push") {
        const t = pushTotal > 1 ? pushSeen++ / (pushTotal - 1) : 0;
        return Math.round(52 - 30 * t);
      }
      return { hook: 62, boom: 95, cliff: 68 }[s.stage] || 40;
    });
    const max = 100;
    const pts = vals.map((v, i) => {
      const x = pad + (W - pad * 2) * (n === 1 ? 0.5 : i / (n - 1));
      const y = H - pad - (H - pad * 2) * (v / max);
      return [x, y];
    });
    const line = pts.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
    const area = `M${pts[0][0]},${H - pad} L` + pts.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" L") + ` L${pts[n - 1][0]},${H - pad} Z`;
    const gid = "g" + Math.random().toString(36).slice(2, 7);
    return `
    <svg viewBox="0 0 ${W} ${H}" class="chart">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#7c5cff" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#7c5cff" stop-opacity="0"/>
      </linearGradient></defs>
      <path d="${area}" fill="url(#${gid})"/>
      <polyline points="${line}" fill="none" stroke="#7c5cff" stroke-width="2.5" stroke-linejoin="round"/>
      ${pts.map((p, i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4" fill="#fff" stroke="#7c5cff" stroke-width="2"/>`).join("")}
      ${shots.map((s, i) => `<text x="${pts[i][0].toFixed(1)}" y="${H - 3}" font-size="9" fill="#8a8f9c" text-anchor="middle">${s.no}</text>`).join("")}
    </svg>`;
  }

  /* 景别配比条形图 */
  function svgSizeBars(count, total) {
    const items = Object.keys(count).map(k => ({ name: k, v: count[k] })).sort((a, b) => b.v - a.v);
    return `<div class="bars">
      ${items.map(it => {
        const pct = total ? Math.round(it.v / total * 100) : 0;
        const color = KB.palette.size[it.name] || "#7c5cff";
        return `<div class="bar-row">
          <div class="bar-name">${esc(it.name)}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>
          <div class="bar-val">${it.v}镜 ${pct}%</div>
        </div>`;
      }).join("")}
    </div>`;
  }

  /* ---------- 分镜子页 ---------- */
  function renderBoard() {
    const p = state.project, sb = p.storyboard || [];
    if (!sb.length) return emptyView("还没有分镜", "回到总览点「重跑」生成", "重跑");
    const cur = sb.find(e => e.ep === state.curEp) || sb[0];
    state.curEp = cur.ep;

    return `
    <div class="ep-scroll">
      ${sb.map(e => `<div class="ep-chip ${e.ep === cur.ep ? "active" : ""}" data-act="ep" data-v="${e.ep}">${e.ep}</div>`).join("")}
    </div>

    <div class="card">
      <div class="card-title">🎬 第${cur.ep}集 · 镜头时间轴 <span class="tag gray">${cur.shots.length}镜 / ${cur.shots.reduce((a, s) => a + (s.duration || 10), 0)}秒</span></div>
      <div class="timeline">
        ${cur.shots.map(s => {
          const w = (s.duration || 10) / cur.shots.reduce((a, x) => a + (x.duration || 10), 0) * 100;
          const c = KB.palette.size[s.shotSize] || "#7c5cff";
          return `<div class="tl-seg" style="width:${w}%;background:${c}" title="${esc(s.fn)} · ${esc(s.shotSize)} · ${s.duration}s">
            <span class="tl-no">${s.no}</span></div>`;
        }).join("")}
      </div>
      <div class="tl-legend">${Object.keys(KB.palette.size).map(k =>
        `<span class="lg"><i style="background:${KB.palette.size[k]}"></i>${k}</span>`).join("")}</div>
    </div>

    ${cur.shots.map((s, i) => `
      <div class="card shot">
        <div class="shot-head">
          <span class="shot-no">镜 ${s.no}</span>
          <span class="shot-fn">${esc(s.fn)}</span>
          <span class="tag gray">${esc(s.emo)}</span>
          <span class="shot-dur">${s.duration}s</span>
        </div>
        <div class="shot-params">
          <span class="sp">${esc(s.shotSize)}</span>
          <span class="sp">${esc(s.camera)}</span>
          <span class="sp">${esc(s.movement)}</span>
          <span class="sp">${esc(s.lighting)}</span>
          <span class="sp snd">🔊 ${esc(s.sound)}</span>
        </div>
        <div class="field"><label>画面描述</label><textarea data-edit="shot" data-ep="${cur.ep}" data-shot="${i}" data-field="desc" rows="2">${esc(s.desc)}</textarea></div>
        <div class="field"><label>台词</label><input type="text" data-edit="shot" data-ep="${cur.ep}" data-shot="${i}" data-field="dialogue" value="${esc(s.dialogue)}" /></div>
        <div class="grid-2">
          <div class="field"><label>景别</label><select data-edit="shot" data-ep="${cur.ep}" data-shot="${i}" data-field="shotSize">${KB.shotSizes.map(x => `<option ${x.name === s.shotSize ? "selected" : ""}>${x.name}</option>`).join("")}</select></div>
          <div class="field"><label>运镜</label><select data-edit="shot" data-ep="${cur.ep}" data-shot="${i}" data-field="movement">${KB.movements.map(x => `<option ${x === s.movement ? "selected" : ""}>${x}</option>`).join("")}</select></div>
        </div>
      </div>`).join("")}`;
  }

  /* ---------- 剧本子页 ---------- */
  function renderScript() {
    const p = state.project, sc = p.scripts || [];
    if (!sc.length) return emptyView("还没有剧本", "回到总览点「重跑」生成", "重跑");
    const cur = sc.find(s => s.ep === state.curEp) || sc[0];
    state.curEp = cur.ep;
    return `
    <div class="ep-scroll">
      ${sc.map(s => `<div class="ep-chip ${s.ep === cur.ep ? "active" : ""}" data-act="ep" data-v="${s.ep}">${s.ep}</div>`).join("")}
    </div>
    ${cur.scenes.map((s, i) => `
      <div class="card shot">
        <div class="shot-head">
          <span class="shot-no">${esc(s.name)}</span>
          <span class="tag gray">${esc(s.emo)}</span>
        </div>
        <div class="field"><label>画面描述</label><textarea data-edit="script" data-ep="${cur.ep}" data-scene="${i}" data-field="desc" rows="3">${esc(s.desc)}</textarea></div>
        <div class="grid-2">
          <div class="field"><label>说话人</label><input type="text" data-edit="script" data-ep="${cur.ep}" data-scene="${i}" data-field="speaker" value="${esc(s.speaker || "")}" /></div>
          <div class="field"><label>台词 <span class="tag gray">只写要说的话</span></label><input type="text" data-edit="script" data-ep="${cur.ep}" data-scene="${i}" data-field="dialogue" value="${esc(s.dialogue)}" /></div>
        </div>
      </div>`).join("")}`;
  }

  /* ---------- 提示词子页 ---------- */
  function renderPrompt() {
    const p = state.project, sb = p.storyboard || [];
    if (!sb.length) return emptyView("还没有提示词", "回到总览点「重跑」生成", "重跑");
    const cur = sb.find(e => e.ep === state.curEp) || sb[0];
    state.curEp = cur.ep;
    const isH3 = p.meta.model === "h3";
    const text = isH3 ? GEN.genPromptH3(p, cur.ep) : GEN.genPromptSeedance(p, cur.ep);

    return `
    <div class="ep-scroll">
      ${sb.map(e => `<div class="ep-chip ${e.ep === cur.ep ? "active" : ""}" data-act="ep" data-v="${e.ep}">${e.ep}</div>`).join("")}
    </div>

    <div class="card">
      <div class="card-title">✨ 第${cur.ep}集提示词
        <span class="tag">${isH3 ? "H3 六段式" : "Seedance 三段式"}</span>
        <button class="btn sm line" style="margin-left:auto" data-act="copy-ep">复制本集</button>
      </div>
      <div class="card-sub">复制到剪贴板后，粘贴到对应视频生成工具即可。</div>
      <pre class="prompt-block">${hl(text)}</pre>
    </div>

    <div class="btn-row">
      <button class="btn line" data-act="export-prompt">导出全部（TXT）</button>
      <button class="btn" data-act="copy-ep">复制本集</button>
    </div>`;
  }

  /* 提示词语法高亮 */
  function hl(t) {
    return esc(t)
      .replace(/(@图片\d+)/g, '<span class="hl-ref">$1</span>')
      .replace(/(镜头\d+｜[^：\n]*：)/g, '<span class="hl-shot">$1</span>')
      .replace(/(\{[^}]*\})/g, '<span class="hl-line">$1</span>')
      .replace(/(<[^>\n]*>)/g, '<span class="hl-snd">$1</span>')
      .replace(/(\[Shot \d+\][^\n]*)/g, '<span class="hl-shot">$1</span>')
      .replace(/^(Style:|Reference image \d+ =.*|Negative prompt:|overall_soundscape:|non_diegetic_music:|Continuity:.*)$/gm, '<span class="hl-key">$1</span>');
  }

  /* ============================================================
   * 项目 / 知识库 / 我的
   * ============================================================ */
  function renderProjects() {
    const list = loadProjects();
    if (!list.length) return emptyView("暂无项目", "新建一个短剧项目，开始你的创作", "新建项目");
    return `<div class="view">
      <button class="btn block" style="margin-bottom:14px" data-act="new">＋ 新建项目</button>
      <div class="card">${list.map(p => {
        const st = GEN.stats(p);
        return `<div class="item">
          <div class="item-main" data-act="open" data-id="${p.id}">
            <div class="item-title">${esc(p.name)}</div>
            <div class="item-sub">${esc(p.meta.genre)} · ${p.episodes.length ? p.episodes.length + "集/" + st.shots + "镜" : "未生成"} · ${new Date(p.updatedAt).toLocaleDateString()}</div>
          </div>
          <div class="item-actions">
            <button class="icon-btn" data-act="rename" data-id="${p.id}">✏️</button>
            <button class="icon-btn" data-act="del" data-id="${p.id}">🗑</button>
          </div>
        </div>`;
      }).join("")}</div>
    </div>`;
  }

  function renderKnowledge() {
    const sec = (title, arr, fn) => `
      <div class="kb-section">
        <div class="kb-section-title">${title}</div>
        <div class="kb-grid">${arr.map(fn).join("")}</div>
      </div>`;
    return `<div class="view">
      ${sec("🎭 题材（17）", KB.genres, g => `<div class="kb-chip" data-kb="genre" data-name="${g.name}"><div class="kb-name">${g.name}</div><div class="kb-sub">${g.core.slice(0, 14)}…</div></div>`)}
      ${sec("🎨 风格（20）", KB.styles, s => `<div class="kb-chip" data-kb="style" data-id="${s.id}"><div class="kb-name">${s.id} ${s.name}</div><div class="kb-sub">${s.suit}</div></div>`)}
      ${sec("📐 景别（12）", KB.shotSizes, s => `<div class="kb-chip" data-kb="size" data-name="${s.name}"><div class="kb-name">${s.name}</div><div class="kb-sub">${s.fn}</div></div>`)}
      ${sec("🎥 机位（14）", KB.cameraAngles, a => `<div class="kb-chip" data-kb="angle" data-name="${a.name}"><div class="kb-name">${a.name}</div><div class="kb-sub">${a.feel}</div></div>`)}
      ${sec("💡 打光（10）", KB.lightings, l => `<div class="kb-chip" data-kb="light" data-name="${l.name}"><div class="kb-name">${l.name}</div><div class="kb-sub">${l.emo}</div></div>`)}
      ${sec("🔗 付费卡点（5）", KB.cliffhangers, c => `<div class="kb-chip" data-kb="cliff" data-name="${c.name}"><div class="kb-name">${c.name}</div><div class="kb-sub">${c.use}</div></div>`)}
      ${sec("🎧 音效 BGM（8类）", KB.soundCats, c => `<div class="kb-chip" data-kb="sound" data-name="${c.name}"><div class="kb-name">${c.name}</div><div class="kb-sub">${c.items.length} 种</div></div>`)}
    </div>`;
  }

  function renderAbout() {
    const list = loadProjects();
    const total = list.reduce((a, p) => a + (p.storyboard || []).reduce((x, e) => x + e.shots.length, 0), 0);
    return `<div class="view">
      <div class="card">
        <div class="card-title">⚙️ 关于</div>
        <div class="card-sub">短剧全链条大师 · 基于 short-drama-master 技能方法论封装</div>
        <p style="font-size:13px;color:var(--text-2);line-height:1.8">
          一句话梗概 → 自动跑完 分集 / 角色 / 剧本 / 分镜 / 提示词 全链条，
          输出可直投 Seedance 或 MiniMax H3 的结构化提示词。
        </p>
      </div>
      <div class="stat-grid">
        <div class="stat"><b>${list.length}</b><span>项目</span></div>
        <div class="stat"><b>${total}</b><span>累计镜头</span></div>
      </div>
      <div class="card">
        <div class="card-title">💾 数据</div>
        <button class="btn line block" style="margin-bottom:10px" data-act="backup">导出全部数据</button>
        <button class="btn danger block" data-act="clear">清空所有数据</button>
      </div>
    </div>`;
  }

  function emptyView(title, sub, btnText) {
    return `<div class="view"><div class="empty"><div class="empty-ico">🎬</div><h3>${title}</h3><p>${sub}</p>
      <button class="btn" style="margin-top:16px" data-act="${btnText === "重跑" ? "rerun" : "new"}">${btnText}</button></div></div>`;
  }

  /* ============================================================
   * 事件
   * ============================================================ */
  function bindView() {
    $$("[data-edit]").forEach(el => {
      el.addEventListener("input", onEdit);
      el.addEventListener("change", onEdit);
    });
    const pb = $("#premise-box");
    if (pb) {
      const upd = () => { const c = $("#premise-count"); if (c) c.textContent = pb.value.length + " 字"; };
      pb.addEventListener("input", upd); upd();
    }
  }

  function onEdit(e) {
    const el = e.target, d = el.dataset, v = el.value;
    if (!state.project) {
      // 输入页还没有项目：先建一个
      if (d.edit === "meta" && d.field === "premise") { newProject(""); onEdit(e); return; }
      return;
    }
    if (d.edit === "meta") {
      if (d.field === "episodes") state.project.meta.episodes = Math.max(1, Math.min(60, parseInt(v) || 12));
      else if (d.field === "shotsPerEpisode") state.project.meta.shotsPerEpisode = Math.max(3, Math.min(30, parseInt(v) || 8));
      else state.project.meta[d.field] = v;
      if (d.field === "premise" && !state.project.storyboard.length) {
        state.project.name = (GEN.parsePremise(v).name || "我的") + "的短剧";
      }
    }
    else if (d.edit === "shot") {
      const ep = state.project.storyboard.find(s => s.ep === +d.ep);
      if (ep) ep.shots[+d.shot][d.field] = v;
    }
    else if (d.edit === "script") {
      const sc = state.project.scripts.find(s => s.ep === +d.ep);
      if (sc) sc.scenes[+d.scene][d.field] = v;
    }
    persist();
  }

  document.addEventListener("click", function (e) {
    const kbEl = e.target.closest("[data-kb]");
    if (kbEl) { showKbDetail(kbEl.dataset); return; }

    const t = e.target.closest("[data-act]");
    if (!t) return;
    const act = t.dataset.act, v = t.dataset.v || t.dataset.val;

    if (["create", "projects", "knowledge", "about"].includes(act)) { state.tab = act; render(); return; }

    if (act === "new") { newProject(""); state.view = "input"; state.tab = "create"; render(); return; }
    if (act === "open") { openProject(t.dataset.id); state.tab = "create"; render(); return; }
    if (act === "sample") {
      const s = SAMPLES[+t.dataset.i];
      const box = $("#premise-box");
      if (box) { box.value = s.text; box.dispatchEvent(new Event("input", { bubbles: true })); }
      if (state.project) {
        state.project.meta.premise = s.text;
        state.project.meta.genre = s.genre;
        state.project.name = (GEN.parsePremise(s.text).name || "我的") + "的短剧";
        persist(); render();
      } else { newProject(s.text); state.project.meta.genre = s.genre; persist(); render(); }
      return;
    }
    if (act === "run") { runPipeline(); return; }
    if (act === "rerun") { state.view = "input"; render(); toast("修改配置后再次生成"); return; }
    if (act === "rtab") { state.resultTab = v; render(); return; }
    if (act === "ep") { state.curEp = +v; render(); return; }

    if (act === "model") { state.project.meta.model = v; persist(); render(); return; }
    if (act === "ratio") { state.project.meta.ratio = v; persist(); render(); return; }
    if (act === "shots") { state.project.meta.shotsPerEpisode = +v; state.project.storyboard = []; persist(); render(); return; }

    if (act === "copy-ep") {
      const isH3 = state.project.meta.model === "h3";
      copyText(isH3 ? GEN.genPromptH3(state.project, state.curEp) : GEN.genPromptSeedance(state.project, state.curEp));
      return;
    }

    if (act === "rename") {
      const list = loadProjects(); const p = list.find(x => x.id === t.dataset.id);
      const n = prompt("新名称", p.name);
      if (n) { p.name = n; saveProjects(list); if (state.project && state.project.id === p.id) state.project.name = n; render(); }
      return;
    }
    if (act === "del") {
      if (!confirm("确定删除该项目？不可恢复")) return;
      saveProjects(loadProjects().filter(x => x.id !== t.dataset.id));
      if (state.projectId === t.dataset.id) { state.project = null; state.projectId = null; state.view = "input"; }
      render(); return;
    }

    if (act === "export-json") { downloadText(state.project.name + ".json", JSON.stringify(state.project, null, 2)); toast("已导出 JSON"); return; }
    if (act === "export-prompt") {
      const isH3 = state.project.meta.model === "h3";
      const txt = (state.project.storyboard || []).map(ep =>
        `【第${ep.ep}集】\n\n${isH3 ? GEN.genPromptH3(state.project, ep.ep) : GEN.genPromptSeedance(state.project, ep.ep)}\n`).join("\n" + "=".repeat(30) + "\n");
      downloadText(state.project.name + "-提示词.txt", txt); toast("已导出提示词"); return;
    }
    if (act === "export-board") {
      let txt = `分镜表 · ${state.project.name}\n\n`;
      (state.project.storyboard || []).forEach(ep => {
        txt += `第${ep.ep}集\n`;
        ep.shots.forEach(s => txt += `镜${s.no} ${s.fn} | ${s.shotSize} | ${s.camera} | ${s.movement} | ${s.lighting} | ${s.duration}s | 🔊${s.sound}\n  画面：${s.desc}\n  台词：${s.dialogue}\n`);
        txt += "\n";
      });
      downloadText(state.project.name + "-分镜表.txt", txt); toast("已导出分镜表"); return;
    }
    if (act === "backup") { downloadText("短剧大师-备份-" + Date.now() + ".json", JSON.stringify(loadProjects(), null, 2)); return; }
    if (act === "clear") {
      if (confirm("清空所有项目数据？不可恢复")) { localStorage.removeItem(LS_PROJECTS); state.project = null; state.projectId = null; state.view = "input"; render(); }
      return;
    }
  });

  /* 知识库抽屉 */
  function showKbDetail(d) {
    let html = "";
    if (d.kb === "genre") { const g = KB.genres.find(x => x.name === d.name); html = `<h3>${g.name}</h3><div class="kv"><b>覆盖：</b>${g.covers}</div><div class="kv"><b>爽点：</b>${g.core}</div><div class="kv"><b>卡点：</b>${g.cliff}</div><div class="kv"><b>景别配比：</b>特写${g.shots.cu}% / 近景${g.shots.mcu}% / 中景${g.shots.ms}% / 全景${g.shots.ls}%</div>`; }
    else if (d.kb === "style") { const s = KB.styles.find(x => x.id === d.id); html = `<h3>${s.id} ${s.name}</h3><div class="kv"><b>适用：</b>${s.suit}</div><div class="kv"><b>提示词前缀：</b>${s.prefix}</div>`; }
    else if (d.kb === "size") { const s = KB.shotSizes.find(x => x.name === d.name); html = `<h3>${s.name}（${s.abbr}）</h3><div class="kv"><b>功能：</b>${s.fn}</div><div class="kv"><b>适用：</b>${s.use}</div><div class="kv"><b>禁忌：</b>${s.avoid}</div>`; }
    else if (d.kb === "angle") { const a = KB.cameraAngles.find(x => x.name === d.name); html = `<h3>${a.name}</h3><div class="kv"><b>感受：</b>${a.feel}</div><div class="kv"><b>适用：</b>${a.use}</div><div class="kv"><b>情绪：</b>${a.emo}</div>`; }
    else if (d.kb === "light") { const l = KB.lightings.find(x => x.name === d.name); html = `<h3>${l.name}（${l.en}）</h3><div class="kv"><b>光源：</b>${l.light}</div><div class="kv"><b>阴影：</b>${l.shadow}</div><div class="kv"><b>适用：</b>${l.use}</div><div class="kv"><b>情绪：</b>${l.emo}</div>`; }
    else if (d.kb === "cliff") { const c = KB.cliffhangers.find(x => x.name === d.name); html = `<h3>${c.name}</h3><div class="kv"><b>画面：</b>${c.visual}</div><div class="kv"><b>音效：</b>${c.sound}</div><div class="kv"><b>适用：</b>${c.use}</div>`; }
    else if (d.kb === "sound") { const c = KB.soundCats.find(x => x.name === d.name); html = `<h3>${c.name}</h3><div class="kv">${c.items.map(i => `<span class="tag" style="margin:3px">${i}</span>`).join("")}</div>`; }

    const mask = document.createElement("div"); mask.className = "drawer-mask";
    const drawer = document.createElement("div"); drawer.className = "drawer";
    drawer.innerHTML = `<div class="drawer-handle"></div>${html}<button class="btn block" style="margin-top:14px" data-act="close-drawer">关闭</button>`;
    document.body.appendChild(mask); document.body.appendChild(drawer);
    mask.onclick = close;
    drawer.querySelector("[data-act=close-drawer]").onclick = close;
    function close() { drawer.remove(); mask.remove(); }
  }

  /* ---------- 初始化 ---------- */
  function init() {
    $$("#tabbar .tab").forEach(tab => tab.addEventListener("click", () => { state.tab = tab.dataset.tab; render(); }));
    ensureProject();
    render();
  }
  init();
})();
