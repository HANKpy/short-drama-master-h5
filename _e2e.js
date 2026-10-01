/* 端到端（DOM 桩）验证：
 * 真实走一遍「新建项目 → 填梗概 → 一键流水线 → 剧本子页 → 剧本编辑 → 持久化 → 分镜/提示词子页」，
 * 用来覆盖 app.js 的渲染与编辑链路（_validate.js 只覆盖生成引擎逻辑）。
 * 用法：node _e2e.js
 */
const fs = require("fs");
const path = require("path");

const HTML = path.join(__dirname, "dist", "short-drama-master-h5.html");
const html = fs.readFileSync(HTML, "utf8");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
if (scripts.length !== 3) {
  console.error("[错误] 期望 3 段内联 script，实际 " + scripts.length + " 段");
  process.exit(1);
}

/* ---------------- DOM 桩 ---------------- */
function makeEl(sel) {
  const el = {
    _sel: sel || "", _html: "", textContent: "", value: "", _handlers: {}, dataset: {}, style: {},
    classList: {
      _s: new Set(),
      add(c) { el.classList._s.add(c); },
      remove(c) { el.classList._s.delete(c); },
      toggle() {},
      contains(c) { return el.classList._s.has(c); }
    },
    addEventListener(t, fn) {
      if (!el._handlers[t]) el._handlers[t] = [];
      if (!el._handlers[t].includes(fn)) el._handlers[t].push(fn);
    },
    appendChild() {}, removeChild() {}, focus() {}, select() {}, click() {},
    setAttribute() {}, getAttribute() { return null; },
    querySelector: (s) => q(s || "#"),
    closest: () => null
  };
  Object.defineProperty(el, "innerHTML", { get() { return el._html; }, set(v) { el._html = String(v); } });
  return el;
}

const cache = new Map();
const q = (sel) => {
  if (!cache.has(sel)) cache.set(sel, makeEl(sel));
  return cache.get(sel);
};

// 模拟页面上被渲染出来的可编辑元素（bindView 会给它们挂 onEdit）
const metaEl = makeEl("[data-edit=meta]");
metaEl.dataset.edit = "meta"; metaEl.dataset.field = "premise";
const dialectEl = makeEl("[data-edit=meta][data-field=dialect]");
dialectEl.dataset.edit = "meta"; dialectEl.dataset.field = "dialect";
const scriptEls = [];
for (let i = 0; i < 4; i++) {
  const e = makeEl("[data-edit=script]");
  e.dataset.edit = "script"; e.dataset.ep = "1"; e.dataset.scene = String(i);
  e.dataset.field = i % 2 ? "dialogue" : "desc";
  scriptEls.push(e);
}

let clickHandler = null;
const doc = {
  querySelector: q,
  querySelectorAll(sel) {
    if (sel === "[data-edit]") return [metaEl, dialectEl, ...scriptEls];
    if (sel === "#tabbar .tab") return [];
    return [];
  },
  createElement: () => makeEl(),
  addEventListener(t, fn) { if (t === "click") clickHandler = fn; },
  body: makeEl("body")
};

const store = new Map();
global.window = { scrollTo() {} };
global.document = doc;
global.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k)
};
global.navigator = {};

/* ---------------- 加载内联脚本（真实产物） ---------------- */
for (const s of scripts) eval(s);
const GEN = global.window.GEN;
if (!GEN) { console.error("[错误] 产物里没有 window.GEN"); process.exit(1); }
console.log("[OK] 单文件产物加载成功，KB=" + !!global.window.KB + " GEN=" + !!GEN);

/* ---------------- 驱动交互 ---------------- */
const fire = (el) => (el._handlers.input || []).concat(el._handlers.change || []).forEach((fn) => fn({ target: el }));
// 只让 "[data-act]" 命中，避免被当成知识库抽屉的 "[data-kb]"
const click = (dataset) => clickHandler({ target: { closest: (sel) => (sel === "[data-act]" ? { dataset } : null) } });
const main = () => q("#main").innerHTML;
const PREMISE = "2024年私募操盘手林凡穿越回1996年的香港，成为负债三千万的落魄富二代，靠未来记忆在股市绝地翻身。";

let fail = 0;
const ok = (cond, msg) => { console.log((cond ? "[OK] " : "[✗] ") + msg); if (!cond) fail++; };

click({ act: "new" });
ok(main().includes("梗概"), "新建项目 → 渲染出输入页");

metaEl.value = PREMISE;
fire(metaEl);
ok(main().length > 0, "梗概输入事件无异常");

click({ act: "run" });
const t0 = Date.now();
(async () => {
  while (Date.now() - t0 < 20000) {
    const list = JSON.parse(store.get("sdm_projects_v2") || "[]");
    if (list[0] && list[0].storyboard && list[0].storyboard.length) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  // 流水线收尾还有一格 setTimeout(500ms) 才会切到成果页视图，多等一会儿
  await new Promise((r) => setTimeout(r, 900));
  const list = JSON.parse(store.get("sdm_projects_v2") || "[]");
  const p = list[0] || {};
  ok((p.storyboard || []).length > 0, "流水线跑完：" + (p.meta ? p.meta.episodes : 0) + "集 / " + (p.storyboard || []).length + " 集分镜");
  ok((p.scripts || []).length > 0, "剧本已生成：" + (p.scripts || []).length + " 集 / " + ((p.scripts || [])[0] || {}).scenes?.length + " 场");

  // ① 剧本子页
  click({ act: "rtab", v: "script" });
  const shtml = main();
  ok(shtml.includes('data-edit="script"'), "剧本子页渲染出可编辑字段");
  ok(shtml.includes("林凡") && shtml.includes("画面描述"), "剧本子页出现主角真名「林凡」+ 描述/台词字段");
  ok(!/反派|\/女主|配角/.test(shtml), "剧本子页无占位名");

  // ② 编辑剧本 → 持久化
  const target = scriptEls[0];
  target.value = "【端到端改写测试】雨夜天台，林凡攥紧那张1996年的股票认购证。";
  fire(target);
  const after = JSON.parse(store.get("sdm_projects_v2") || "[]")[0];
  const sc = (after.scripts || []).find((x) => x.ep === 1);
  ok(sc && sc.scenes[0].desc.includes("端到端改写测试"), "剧本编辑已写入并持久化（onEdit → script 分支）");

  // ③ 分镜 / 提示词子页
  click({ act: "rtab", v: "board" });
  ok(main().includes("分镜") || main().includes("shot"), "分镜子页渲染正常");
  click({ act: "rtab", v: "prompt" });
  const ph = main();
  ok(ph.includes("prompt-block") || ph.includes("pre"), "提示词子页渲染正常");
  ok(!/将@图片\d+中[^；；]*(反派|女主|配角)/.test(ph), "提示词无占位名");

  // ④ 切集不炸
  click({ act: "rtab", v: "script" }); click({ act: "ep", v: "2" });
  ok(main().length > 0, "切到第 2 集剧本页正常");

  /* ---------- ⑤ 方言链路：选粤语 → 浓度 L3 → 重跑 → 剧本页出 DLC ---------- */
  const cur = () => JSON.parse(store.get("sdm_projects_v2") || "[]")[0] || {};
  dialectEl.value = "yue";
  fire(dialectEl);
  ok(cur().meta.dialect === "yue", "选粤语已写入 meta：" + cur().meta.dialect);
  ok(!(cur().scripts || []).length, "换方言后旧剧本失效（需重跑）");

  click({ act: "dlevel", v: "L3" });
  ok(cur().meta.dialectLevel === "L3", "浓度切到 L3");

  click({ act: "rerun" }); click({ act: "run" });
  const t1 = Date.now();
  while (Date.now() - t1 < 20000) {
    if ((cur().scripts || []).length && (cur().storyboard || []).length) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  await new Promise((r) => setTimeout(r, 900));
  const dlcScene = ((cur().scripts || [])[0] || { scenes: [] }).scenes.find((s) => s.dialect);
  ok(!!dlcScene, "重跑后主角台词带方言契约：" + (dlcScene ? dlcScene.dialogue : "无"));

  click({ act: "rtab", v: "script" });
  const dh = main();
  ok(dh.includes("方言契约"), "剧本页渲染出方言契约卡");
  ok(dh.includes("用粤语说道"), "契约卡显示提示词语种指令");
  ok(dh.includes("注音") && dh.includes("普通话"), "契约卡含注音与普通话释义行");
  ok(dh.includes("全程正字字幕"), "L3 字幕方案已下发");

  // 提示词子页应出现方言指令
  click({ act: "rtab", v: "prompt" });
  ok(main().includes("用粤语说道"), "提示词子页出现「用粤语说道{…}」");

  console.log(fail ? "\n[✗] 失败 " + fail + " 项" : "\n[OK] 端到端全绿");
  process.exit(fail ? 1 : 0);
})();
