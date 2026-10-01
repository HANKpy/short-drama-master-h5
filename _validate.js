// 生成引擎回归验证（Node 直跑，不需要浏览器）
// 覆盖：角色真名/性别、剧本→分镜链路、自定义镜数、Seedance/H3 提示词规范
global.window = {};
require("./js/data.js");
require("./js/templates.js");
const KB = global.window.KB;
const GEN = global.window.GEN;

let fail = 0;
const ok = (cond, msg, extra) => {
  console.log((cond ? "  [OK] " : "  [✗] ") + msg + (!cond && extra ? "  →  " + extra : ""));
  if (!cond) fail++;
};

function build(premise, genre, model, shots, episodes, dialect, level) {
  const p = {
    meta: {
      premise, genre, style: "S07", model, ratio: "9:16",
      episodes: episodes || 4, shotsPerEpisode: shots || 8,
      dialect: dialect || "none", dialectLevel: level || "L2"
    },
    episodes: [], characters: [], scripts: [], storyboard: [], parsed: null
  };
  GEN.genAll(p);
  return p;
}

const P = "2024年私募操盘手林凡穿越回1996年的香港，成为负债三千万的落魄富二代，靠未来记忆在股市绝地翻身。";

/* ================= 1. 角色真名与性别 ================= */
console.log("\n[1] 角色真名 / 性别推断");
{
  const p = build(P, "逆袭打脸", "seedance");
  const names = p.characters.map(c => c.name);
  ok(!names.some(n => /^(反派|女主|配角)$/.test(n)), "无占位名：" + names.join("/"));
  ok(p.characters[0].look.includes("青年男性"), "男主样本 → 青年男性：" + p.characters[0].look);

  const f = build("苏晚重生回结婚前一天，手撕渣男与白莲继妹，转身投入暗恋自己十年的陆氏总裁怀抱。", "甜宠情感", "h3");
  ok(f.characters[0].look.includes("青年女性"), "女主样本 → 青年女性：" + f.characters[0].look);

  // 梗概里没有性别线索时，女频题材不能默认判成男
  const g = build("一场意外让两个人重新相遇，旧账新债一起算清，最终走到一起。", "甜宠情感", "seedance");
  ok(g.characters[0].look.includes("青年女性"), "女频题材 + 无性别线索 → 青年女性：" + g.characters[0].look);
}

/* ================= 2. 自定义镜数 ================= */
console.log("\n[2] 自定义单集镜数（3 / 5 / 12 / 8 / 30）");
for (const n of [3, 5, 12, 8, 30]) {
  const p = build(P, "逆袭打脸", "seedance", n, 2);
  const got = p.storyboard[0].shots.length;
  ok(got === n, `${n} 镜 → 实出 ${got} 镜`);
  const stages = p.storyboard[0].shots.map(s => s.stage);
  ok(stages[0] === "hook" && stages[stages.length - 1] === "cliff", `${n} 镜首镜=钩子、末镜=卡点`);
}

/* ================= 3. 同集内不重复 ================= */
console.log("\n[3] 同一集内各镜描述不重复");
{
  const p = build(P, "逆袭打脸", "seedance", 8, 2);
  const descs = p.storyboard[0].shots.map(s => s.desc);
  const uniq = new Set(descs);
  ok(uniq.size === descs.length, `8 镜描述去重后 ${uniq.size}/8` + (uniq.size < 8 ? " 重复：" + descs[1] : ""));
  const params = p.storyboard[0].shots.map(s => s.shotSize + s.camera + s.movement);
  ok(new Set(params).size >= 4, "景别/机位/运镜有轮转变化");
}

/* ================= 4. Seedance 提示词规范 ================= */
console.log("\n[4] Seedance 三段式提示词");
{
  const p = build(P, "逆袭打脸", "seedance", 8, 2);
  const t = GEN.genPromptSeedance(p, 1);
  ok(/^EP\d\d《/.test(t), "首行 EPxx《集名》：" + t.split("\n")[0]);
  ok(!/定格/.test(t), "无「定格」（Seedance 铁律27）");
  ok(!/\{[^}]*林凡[^}]*\}/.test(t), "角色名不在 {} 朗读区内（铁律5/51）");
  ok(/用普通话说道\{/.test(t), "台词格式「镜头切至X，用普通话说道{…}」");
  ok(!/悬念拉满|压抑感|情绪冲到最高点|空气凝固/.test(t), "无抽象情绪词（铁律13）");
  ok(!/<[^>]*BGM[^>]*>/.test(t), "音效位不是 BGM/特效词（铁律50）");
  ok(/@图片\d+/.test(t), "保留素材声明 @图片N");
}

/* ================= 5. H3 提示词规范 ================= */
console.log("\n[5] MiniMax H3 六段式提示词");
{
  const p = build(P, "逆袭打脸", "h3", 8, 2);
  const t = GEN.genPromptH3(p, 1);
  ok(/^EP\d\d《/.test(t), "首行 EPxx《集名》");
  ok(/^Style: /m.test(t), "① Style 段");
  ok(/<Subject 1> is .+ in <Picture 1>/.test(t), "② Subject 用 <Subject N> is … in <Picture N>（铁律43）");
  ok(!/Reference image \d+ =/.test(t), "不再使用非法的 Reference image N =");
  ok(/^Summary: /m.test(t), "③ Summary 段");
  ok(/^Retention analysis: /m.test(t), "④ Retention analysis 段");
  ok(/^Detailed description:/m.test(t), "⑤ Detailed description 段");
  ok(/^Negative prompt: /m.test(t), "⑥ Negative prompt 段");
  const tc = t.match(/at \d\d:\d\d\.\d\d\d/g) || [];
  ok(tc.length > 0 && /at 00:00\.000/.test(t), "时间码 mm:ss.000，首镜 00:00.000：" + tc.slice(0, 3).join(" "));
  ok(!/at \d\d:\d\d:\d\d\./.test(t), "不再出现三段式错误时间码");
  ok(/<d>\[Chinese\][^<]*<\/d>/.test(t), "台词用 <d>[Chinese]…</d>（铁律21/44）");
  ok(!/<d>[^<]*林凡/.test(t), "角色名不在 <d> 朗读标签内");
  ok(/^non_diegetic_music: N\/A$/m.test(t), "non_diegetic_music 默认 N/A（铁律20）");
}

/* ================= 6. 剧本 → 分镜 贯通 ================= */
console.log("\n[6] 剧本内容贯通到分镜");
{
  const p = build(P, "逆袭打脸", "seedance", 8, 3);
  ok(p.storyboard[0].shots[0].desc.includes(p.scripts[0].scenes[0].desc.slice(0, 8)), "第1集首镜包含剧本钩子场内容");
  ok(p.scripts[0].scenes[0].speaker && !p.scripts[0].scenes[0].dialogue.includes("："), "剧本 speaker 与 dialogue 已分离");
  const ep1 = p.storyboard[0].shots.map(s => s.desc).join("");
  const ep2 = p.storyboard[1].shots.map(s => s.desc).join("");
  ok(ep1 !== ep2, "第1集与第2集内容不同");
}

/* ================= 7. 方言层（dialect-master 内核） ================= */
console.log("\n[7] 方言层：换字 / 换音 / 加味 / 定调");
{
  // 关闭方言时不应产生任何 DLC
  const off = build(P, "逆袭打脸", "seedance", 8, 2, "none");
  ok(!off.scripts[0].scenes.some(s => s.dialect), "关闭方言 → 无 DLC 字段");

  // 6 语系逐一产出，且 DLC 字段齐全
  for (const d of KB.dialects) {
    const p = build(P, "逆袭打脸", "seedance", 8, 2, d.id, "L2");
    const dlc = p.scripts[0].scenes.find(s => s.dialect);
    ok(!!dlc, `${d.name}：主角台词带 DLC`);
    if (!dlc) continue;
    const v = dlc.dialect;
    ok(!!(v.text && v.reading && v.gloss && v.cue && v.subtitle), `${d.name}：DLC 字段齐全（正字/注音/释义/语种/字幕）`);
    ok(v.flavor && v.flavor.length > 0, `${d.name}：有加味点：${v.flavor[0]}`);
    ok(v.cue === d.cue && /^用.+说道$/.test(v.cue), `${d.name}：提示词语种指令「${v.cue}」`);

    // 换字灾难检测：同一方言词紧邻重复（如"巴適巴適"）
    const dup = d.swaps.map(s => s[1]).filter(w => w.length >= 2 && v.text.indexOf(w + w) >= 0);
    ok(dup.length === 0, `${d.name}：无紧邻重复换字` + (dup.length ? " → " + dup[0] + dup[0] : ""));

    // 语气词必须在闭合引号之内，不能挂在引号外面
    ok(!/[」』”）)][\u4e00-\u9fa5]/.test(v.text.replace(/[」』”）)]$/, "")),
      `${d.name}：语气词在引号内 → ${v.text}`);
  }

  // 定调：L1 不换字（只加味），L3 换字量 ≥ L2
  const l1 = build(P, "逆袭打脸", "seedance", 8, 2, "yue", "L1");
  const l2 = build(P, "逆袭打脸", "seedance", 8, 2, "yue", "L2");
  const l3 = build(P, "逆袭打脸", "seedance", 8, 2, "yue", "L3");
  const hero = (p) => p.scripts[0].scenes.find(s => s.dialect).dialect;
  ok(hero(l1).text === hero(l1).gloss.replace(/([。！？]?)$/, "") || /呀|啦|㗎|喎|咩|啫|啵|嘛/.test(hero(l1).text),
    "L1 只加味不换字：" + hero(l1).text);
  const cnt = (t) => KB.dialects[0].swaps.reduce((n, s) => n + (t.indexOf(s[1]) >= 0 ? 1 : 0), 0);
  ok(cnt(hero(l3).text) >= cnt(hero(l2).text), `L3 换字量(${cnt(hero(l3).text)}) ≥ L2(${cnt(hero(l2).text)})`);
  ok(hero(l3).subtitle.includes("全程正字字幕"), "L3 字幕方案：全程正字字幕");
  ok(hero(l1).subtitle.includes("可不挂"), "L1 字幕方案：可不挂方言字幕");

  // 方言只作用于主角，其他角色保持普通话作对照（避免"南北混杂假方言"）
  const p = build(P, "逆袭打脸", "seedance", 8, 2, "yue", "L2");
  const withD = p.scripts[0].scenes.filter(s => s.dialect).map(s => s.speaker);
  const noD = p.scripts[0].scenes.filter(s => !s.dialect).map(s => s.speaker);
  ok(new Set(withD).size === 1 && !noD.some(n => withD.includes(n)),
    `方言只给主角 ${withD[0]}，其余 ${[...new Set(noD)].join("/")} 保持普通话`);

  // 提示词：Seedance 用「用X语说道」，H3 用 speaks in <语种>
  const sd = GEN.genPromptSeedance(p, 1);
  ok(/用粤语说道\{/.test(sd), "Seedance：用粤语说道{…}");
  ok(/用普通话说道\{/.test(sd), "Seedance：对照角色仍用普通话说道{…}");
  const h3 = GEN.genPromptH3(build(P, "逆袭打脸", "h3", 8, 2, "yue", "L2"), 1);
  ok(/speaks in Cantonese/.test(h3), "H3：speaks in Cantonese");
  ok(/<d>\[Chinese\]/.test(h3), "H3：方言正字仍走 <d>[Chinese] 标签");

  // 空耳表（跨语言喜剧）只挂在粤语库上，四要素齐全
  const yue = KB.dialects.find(d => d.id === "yue");
  ok(yue.gags.length > 0 && yue.gags.every(g => g.src && g.srcMean && g.heard && g.heardMean && g.payoff),
    `粤语空耳表 ${yue.gags.length} 条，四要素齐全`);
}

console.log(fail ? `\n[✗] 失败 ${fail} 项` : "\n[OK] 生成引擎全部通过");
process.exit(fail ? 1 : 0);
