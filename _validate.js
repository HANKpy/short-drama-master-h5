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

function build(premise, genre, model, shots, episodes) {
  const p = {
    meta: { premise, genre, style: "S07", model, ratio: "9:16", episodes: episodes || 4, shotsPerEpisode: shots || 8 },
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

console.log(fail ? `\n[✗] 失败 ${fail} 项` : "\n[OK] 生成引擎全部通过");
process.exit(fail ? 1 : 0);
