/* ============================================================
 * 短剧全链条大师 · 生成引擎
 * 把技能方法论编码为规则引擎：梗概解析 → 分集 → 角色 → 剧本 → 分镜 → 提示词
 * 核心原则：内容必须是「画面语言」，可直投 AI 视频模型
 * ============================================================ */
window.GEN = (function () {
  const KB = window.KB;

  /* ---------- 基础取值 ---------- */
  function getGenre(name) { return KB.genres.find(g => g.name === name) || KB.genres[0]; }
  function getStyle(id) { return KB.styles.find(s => s.id === id) || KB.styles[0]; }
  function getTemplate(id) { return KB.templates.find(t => t.id === id) || null; }

  function rng(seed) { let s = seed % 233280; return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
  function pick(arr, n) { return arr[((n % arr.length) + arr.length) % arr.length]; }

  /* ---------- 姓名识别（常见姓氏 + 1~2 字名） ---------- */
  const SURNAMES = "赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章苏潘葛范彭郎鲁韦昌马苗凤花方俞任袁柳鲍史唐费岑薛雷贺倪汤滕殷罗毕安常乐于时傅皮齐康伍余元卜顾孟平黄和穆萧尹姚邵汪祁毛禹狄米贝明臧计成戴谈宋茅庞熊纪舒屈项祝董梁杜阮蓝闵席季麻强贾路娄江童颜郭梅盛林刁钟徐邱骆高夏蔡田樊胡凌霍虞万柯管卢莫房裘缪解应宗丁宣邓郁单杭洪包诸左石崔吉钮龚程嵇邢裴陆荣翁荀羊惠甄曲家封芮储靳汲松井段富巫焦巴弓牧山谷车侯全班仰秋仲伊宫宁仇栾甘厉戎祖武符刘景詹束龙叶幸司郜黎薄印宿白怀蒲从鄂索咸籍赖卓蔺屠蒙池乔阴胥能苍双闻莘党翟贡劳姬申扶堵冉宰郦雍桑桂濮牛寿通边燕冀浦尚农温别庄晏柴瞿阎充慕连茹习宦艾鱼容向古易慎戈廖庾终居衡步都耿满弘匡国文寇广禄阙东欧沃利蔚越隆师巩聂晁冷辛阚简饶曾毋沙养鞠须丰巢关相查后荆红游权盖益桓公上官欧阳司马诸葛";

  // 名字后不能紧跟这些字（"林凡穿越"→取"林凡"，而非"林凡穿"）
  const NAME_STOP = "穿越重生回成为是在有和与就被把让带来去说想得知到过的了上下里外对着向将于从给让向让带靠替靠替当为让";

  function pickName(text) {
    const t = String(text || "");
    // 1. 显式「名叫X」「主角X」
    let m = t.match(/(?:名叫|名为|主角|男主|女主)\s*([一-龥]{2,4})/);
    if (m) return m[1];
    // 2. 姓氏 + 1~2 字（遇到停用字则只取 1 字）
    for (let i = 0; i < t.length - 1; i++) {
      const c = t[i];
      if (SURNAMES.indexOf(c) >= 0) {
        const rest = t.slice(i + 1, i + 3);
        const m2 = rest.match(/^([一-龥])([一-龥])/);
        if (m2 && NAME_STOP.indexOf(m2[2]) < 0) return c + m2[1] + m2[2];
        const m1 = rest.match(/^([一-龥])/);
        if (m1) return c + m1[1];
      }
    }
    return "";
  }

  /* ---------- 0. 梗概解析 ---------- */
  function parsePremise(text) {
    const t = String(text || "");
    const hit = (dict) => { for (const d of dict) { if (d.k.some(k => t.indexOf(k) >= 0)) return d; } return null; };
    return {
      raw: t,
      era: hit(KB.parseDict.era),
      finger: hit(KB.parseDict.finger),
      stake: hit(KB.parseDict.stake),
      name: pickName(t)
    };
  }

  /* ---------- 角色姓名生成（避免占位名 反派/女主/配角 直出） ---------- */
  const GIVEN_M = ["然", "逸", "辰", "宇", "泽", "昊", "睿", "轩", "霖", "珩", "舟", "骁", "峥", "珏", "澈", "曜", "屿", "砚", "璟", "骁"];
  const GIVEN_F = ["晚", "清", "瑶", "婉", "萱", "汐", "宁", "昭", "棠", "芷", "璃", "筠", "珞", "冉", "婳", "绾", "晗", "笙", "薇", "妍"];

  /* 女频题材：这些题材主角默认是女性，梗概里没写性别时不能再默认成男 */
  const FEMALE_GENRES = ["甜宠情感", "虐恋情深", "萌宝天降", "家庭伦理", "都市言情", "古风言情"];
  const MALE_GENRES = ["战神归来", "赘婿逆袭", "末世科幻"];

  // 推断主角性别：梗概关键词优先 → 题材兜底 → 默认男
  function detectGender(raw, genre) {
    if (/她|女主|女王|女帝|皇后|公主|妃|妻|夫人|姐妹|母|少女|姑娘|女神|女扮|女配|女强|白莲|妹|妇/.test(raw)) return "女";
    if (/男主|王爷|皇帝|少东家|少爷|公子|夫君|陛下|兄长|父|总裁|少东/.test(raw)) return "男";
    if (genre && FEMALE_GENRES.indexOf(genre) >= 0) return "女";
    if (genre && MALE_GENRES.indexOf(genre) >= 0) return "男";
    return "男";
  }
  function genName(surname, isFemale, seedInt) {
    const pool = isFemale ? GIVEN_F : GIVEN_M;
    const r = rng(seedInt);
    const len = r() < 0.5 ? 1 : 2;
    let g = "";
    for (let k = 0; k < len; k++) g += pool[Math.floor(r() * pool.length)];
    return surname + g;
  }
  function genCharName(isFemale, seedInt, heroSurname) {
    const r = rng(seedInt);
    let sur, guard = 0;
    do { sur = SURNAMES[Math.floor(r() * SURNAMES.length)]; guard++; } while (sur === heroSurname && guard < 20);
    return genName(sur, isFemale, seedInt + 7);
  }

  /* ---------- 1. 角色设定 ---------- */
  function genCharacters(project) {
    const m = project.meta;
    const info = parsePremise(m.premise);
    const heroName = info.name || "主角";
    const heroSurname = heroName.length > 1 ? heroName[0] : "";
    const heroGender = detectGender(info.raw, m.genre);
    const eraLook = info.era ? info.era.v : "现代都市";
    const fingerTag = info.finger ? info.finger.v : "隐藏大佬";
    const loveGender = heroGender === "女" ? "男" : "女";
    const seedBase = (project.meta.premise || "").length * 131 + (info.name ? info.name.length : 3);
    const villName = genCharName(false, seedBase + 11, heroSurname);
    const loveName = genCharName(loveGender === "女", seedBase + 23, heroSurname);
    const helperName = genCharName(false, seedBase + 37, heroSurname);
    return [
      { name: heroName, identity: fingerTag || "隐藏大佬", role: "主角", goal: "逆袭翻身，让所有人刮目相看", weakness: "身份尚未暴露，底牌有限", look: `青年${heroGender === "女" ? "女性" : "男性"}，${eraLook}装束，眼神坚定隐忍`, tag: "hero" },
      { name: villName, identity: "打压者", role: "反派", goal: "压制主角，维持既有格局", weakness: "轻敌自负，信息落后", look: `中年男性，${eraLook}正装，笑容虚伪`, tag: "villain" },
      { name: loveName, identity: "关键关系人", role: "女主", goal: "在立场与情感间抉择", weakness: "受制于家族", look: `青年${loveGender === "女" ? "女性" : "男性"}，${eraLook}服饰，气质清冷`, tag: "love" },
      { name: helperName, identity: "助力", role: "配角", goal: "辅助主角，提供关键信息", weakness: "能力有限", look: `朴实可靠，${eraLook}打扮`, tag: "helper" }
    ];
  }

  /* ---------- 2. 分集大纲（四幕结构） ---------- */
  const ACTS = [
    { name: "开局", to: 0.15, goal: "立住困境与金手指，第一次小胜" },
    { name: "发展", to: 0.55, goal: "连续打脸，阻碍逐级升级" },
    { name: "转折", to: 0.82, goal: "危机爆发，跌入谷底" },
    { name: "高潮", to: 1.01, goal: "全面反击，真相大白" }
  ];
  function actOf(i, total) {
    const p = i / total;
    for (const a of ACTS) if (p < a.to) return a;
    return ACTS[ACTS.length - 1];
  }

  function genEpisodes(project) {
    const m = project.meta, g = getGenre(m.genre);
    const info = parsePremise(m.premise);
    const total = Math.max(1, m.episodes || 20);
    const hero = info.name || "主角";
    const env = info.era ? info.era.scene : "核心场景";
    const power = info.finger ? info.finger.power : "过人本事";
    const stake = info.stake ? info.stake.v : "处境艰难";
    const cliffNames = KB.cliffhangers.map(c => c.name);
    const eps = [];

    for (let i = 1; i <= total; i++) {
      const a = actOf(i, total);
      const rand = rng(i * 977 + (info.name ? info.name.length : 3));
      const cliff = pick(cliffNames, i + Math.floor(rand() * 3));
      let conflict, highlight;
      if (a.name === "开局") {
        conflict = `${hero}因${stake}被逼到墙角，在${env}遭遇第一轮正面打压。`;
        highlight = `${hero}第一次动用「${power}」，当众小胜一局，让嘲笑者闭嘴。`;
      } else if (a.name === "发展") {
        conflict = `对手加码施压，${hero}的每一步都被提前算死，${env}里的局面越收越紧。`;
        highlight = `${hero}用${power}反将一军，打脸来得又快又狠，围观者倒吸一口凉气。`;
      } else if (a.name === "转折") {
        conflict = `底牌被人识破，${hero}失去所有依仗，跌落谷底，连身边人也开始动摇。`;
        highlight = `绝境中${hero}硬扛住最后一击，保住翻身的火种，眼神反而更亮了。`;
      } else {
        conflict = `最终对决在${env}展开，对方亮出全部底牌，胜负只在一线之间。`;
        highlight = `${hero}全面反击，${power}全开，真相当众揭开，格局彻底改写。`;
      }
      eps.push({
        index: i, act: a.name,
        title: `${a.name}·${g.name.slice(0, 2)}第${i}击`,
        conflict, highlight,
        cliffhanger: `${cliff}——停在「开口/出手前一帧」，把结果留给下一集。`
      });
    }
    return eps;
  }

  /* ---------- 3. 剧本（每集不同） ---------- */
  /* 题材动作 + 通用动作变体，保证同一集内镜头内容不重复 */
  function actionsOf(genreName, stage) {
    const a = KB.genreActions[genreName] || KB.fallbackActions;
    const g = KB.genericActions[stage] || [];
    return (a[stage] || KB.fallbackActions[stage] || []).concat(g);
  }

  /* 画面描述语法适配：动作以谓语开头则直接接主角名，否则独立成句 */
  const PRED_START = /^(被|把|将|抬|一拳|双膝|在|从|翻|举|拿|站|手|睁|低|握|攥|咬|冲|蹬|加班|反复|一字|对照|穿过|转|走|回|蹲|跪|背|侧|攥着|闭)/;
  function withHero(hero, act) {
    return PRED_START.test(act) ? hero + act : act + "，" + hero + "处在画面正中";
  }

  /* ---------- 方言层：对接 dialect-master 内核（换字 / 换音 / 加味 / 定调） ----------
     产出 DLC（Dialect-Line-Contract）简化版：正字 + 注音 + 普通话释义 + 加味点 + 字幕方案。
     内核红线：不硬造读音、俗语不堆砌（故俗语只作建议，不塞进台词）、
               关键信息须可被非方言受众接住（故 L3 强制字幕 + 对方复述）。
  */
  function getDialect(id) { return (KB.dialects || []).find(d => d.id === id) || null; }

  /* 语种英译（H3 英文提示词用） */
  const DIALECT_EN = { yue: "Cantonese", chuan: "Sichuan dialect", dongbei: "Northeast Mandarin", wu: "Shanghainese", minnan: "Hokkien", hakka: "Hakka" };
  function dialectEn(id) { return DIALECT_EN[id] || "Mandarin"; }

  /* 句尾加语气词：插在标点之前、闭合引号之内
     「…算一算。」 → 「…算一算呀。」，而不是追加到引号外面 */
  function withParticle(text, p) {
    if (!p) return text;
    const tail = text.match(/[」』”）)]+$/);
    const close = tail ? tail[0] : "";
    let core = close ? text.slice(0, -close.length) : text;
    const pm = core.match(/[。！？!?…]+$/);
    core = pm ? core.slice(0, pm.index) + p + pm[0] : core + p;
    return core + close;
  }

  /* 普通话台词 → 方言 DLC */
  function applyDialect(text, dialectId, level, seed) {
    const d = getDialect(dialectId);
    if (!d || !text) return null;
    const lv = level || "L2";

    // 换字：长词优先，避免「为什么」被「什么」先替掉
    const sorted = d.swaps.slice().sort((a, b) => b[0].length - a[0].length);
    const hits = sorted.filter(s => text.indexOf(s[0]) >= 0);
    // 定调：L1 只加味不换字；L2 换一半（半方言）；L3 全换（重方言）
    const n = lv === "L1" ? 0 : (lv === "L2" ? Math.max(1, Math.ceil(hits.length * 0.5)) : hits.length);

    // 保护重叠式（"好好""看看"这类 AA 词）：逐字替换会把"好好"变成"巴適巴適"，语义错乱
    const reps = [];
    let out = text.replace(/([\u4e00-\u9fa5])\1/g, (mm) => {
      reps.push(mm);
      return "\u0000" + (reps.length - 1) + "\u0000";
    });

    const used = [];
    for (let i = 0; i < hits.length && used.length < n; i++) {
      const [cn, dia, roman] = hits[i];
      if (out.indexOf(cn) < 0) continue;
      out = out.split(cn).join(dia);
      used.push({ cn, dia, roman });
    }
    out = out.replace(/\u0000(\d+)\u0000/g, (mm, i) => reps[+i]);

    // 加味①：语气词（性价比最高的加味，三档都加）
    const particle = pick(d.particles, seed);
    out = withParticle(out, particle);

    // 加味②：招牌感叹词（仅在危机/完蛋语境前置，L2 起，避免句句带"大鑊"）
    let exclaim = "";
    if (lv !== "L1" && /(完蛋|糟|坏|惨|死|输|崩|塌|没了|来不及|完了)/.test(text)) {
      exclaim = pick(d.exclaims, seed + 3);
      out = exclaim + "，" + out;
    }

    // 换音：命中词的注音拼接；官话区（川渝/东北）与普通话音近，按谐音汉字处理
    const withRoman = used.filter(u => u.roman);
    const reading = withRoman.length
      ? withRoman.map(u => `${u.dia} ${u.roman}`).join("／")
      : d.readingNote;

    // 加味③：俗语只给建议不塞进台词——内核要求「每角色俗语≤1/集」，由编剧择用
    const flavor = [];
    if (particle) flavor.push("语气词：" + particle);
    if (exclaim) flavor.push("感叹词：" + exclaim);
    if (lv !== "L1") flavor.push("可用俗语：" + pick(d.proverbs, seed + 7));

    // 字幕方案：字幕是后期烧录，片内不生成文字（故只在契约里给方案）
    const subtitle = lv === "L1" ? "可不挂方言字幕"
      : lv === "L2" ? "方言整句挂正字字幕；空耳处挂小字"
        : "全程正字字幕，关键信息另配对方普通话复述";

    return {
      text: out, reading, gloss: text, flavor, subtitle,
      cue: d.cue, level: lv, dialect: d.name, region: d.region,
      roman: d.roman
    };
  }

  function genScript(project) {
    const m = project.meta;
    const chars = project.characters || [];
    const info = parsePremise(m.premise);
    const hero = heroName(chars);
    const villain = villainName(chars);
    const env = info.era ? info.era.scene.split("·")[0] : "核心场景";
    const scripts = [];

    for (const ep of (project.episodes || [])) {
      // 种子错开：原来 ep*31 与长度 4/5 的动作库取模，会导致每 4~5 集整轮重复
      const seed = ep.index * 37;
      const hookAct = pick(actionsOf(m.genre, "hook"), seed);
      const pushAct = pick(actionsOf(m.genre, "push"), seed + 11);
      const boomAct = pick(actionsOf(m.genre, "boom"), seed + 23);
      const cliffAct = pick(actionsOf(m.genre, "cliff"), seed + 29);
      const line1 = pick(KB.goldenLines.hook, seed);
      const line2 = pick(KB.goldenLines.push, seed + 11);
      const line3 = pick(KB.goldenLines.boom, seed + 23);
      const line4 = pick(KB.goldenLines.cliff, seed + 29);

      // speaker 与 dialogue 分开存：提示词的朗读区只能放纯台词，
      // 角色名要放在朗读区外面，否则 TTS 会把名字一起念出来（Seedance 铁律5/51）
      // 方言只作用于主角：同一角色只允许一个主导语系，避免"南北混杂假方言"（dialect-master 红线）
      const dId = (m.dialect && m.dialect !== "none") ? m.dialect : null;
      const dLv = m.dialectLevel || "L2";
      const mk = (name, emo, desc, speaker, line, sd) => {
        const dlc = (dId && speaker === hero) ? applyDialect(line, dId, dLv, sd) : null;
        const sc = { name, emo, desc, speaker, dialogue: dlc ? dlc.text : line };
        if (dlc) sc.dialect = dlc;   // DLC 契约：正字/注音/释义/加味点/字幕方案
        return sc;
      };

      scripts.push({
        ep: ep.index,
        scenes: [
          mk("钩子场", "冲突爆发", `${env}内，${withHero(hero, hookAct)}。${ep.conflict}`, hero, line1, seed),
          mk("推进场", "事与愿违", `${withHero(hero, pushAct)}。${ep.conflict}`, villain, line2, seed + 11),
          mk("爆点场", "情绪峰值", `${withHero(hero, boomAct)}。${ep.highlight}`, hero, line3, seed + 23),
          mk("卡点场", "悬念收尾", `${withHero(hero, cliffAct)}。${ep.cliffhanger}`, villain, line4, seed + 29)
        ]
      });
    }
    return scripts;
  }

  /* ---------- 4. 分镜拆解 ---------- */
  /* 注意：运镜里不得出现「定格」——Seedance 铁律27 / H3 铁律7 要求片内不 freeze。
     音效必须是可听到的具体声源，不能是「金色闪耀」「BGM燃向」这类特效/配乐词。 */
  const SHOT_REC = {
    hook: { sizes: ["特写", "近景"], angles: ["低机位仰拍", "正面机位"], moves: ["快速切换", "快速推镜"], lights: ["冷暖对比", "侧光"], sounds: ["低频嗡鸣", "心跳声"], emo: "激励事件·打破平静", stage: "hook" },
    push1: { sizes: ["近景", "中景"], angles: ["平拍眼平", "3/4侧面"], moves: ["跟拍", "平移"], lights: ["柔光", "侧光"], sounds: ["城市车流", "雨声"], emo: "进展纠葛·事与愿违", stage: "push" },
    push2: { sizes: ["中景", "近景"], angles: ["平拍眼平", "过肩机位"], moves: ["平移", "缓慢推镜"], lights: ["侧光", "柔光"], sounds: ["蝉鸣", "纸张翻页"], emo: "进展纠葛·阻碍升级", stage: "push" },
    push3: { sizes: ["近景", "特写"], angles: ["高机位俯拍", "正面机位"], moves: ["缓慢推镜", "缓慢拉镜"], lights: ["侧光", "顶光"], sounds: ["心跳声", "水滴声"], emo: "危机·情绪最低点", stage: "push" },
    boom1: { sizes: ["特写"], angles: ["低机位仰拍", "手持肩扛"], moves: ["快速切换", "手持晃动"], lights: ["硬光", "侧光"], sounds: ["啪！清脆打脸", "拳头破空"], emo: "高潮·第一个爆点", stage: "boom" },
    boom2: { sizes: ["中景", "近景"], angles: ["手持肩扛", "低机位仰拍"], moves: ["慢动作", "跟拍"], lights: ["硬光", "逆光"], sounds: ["击打闷响", "骨骼碎裂"], emo: "高潮·动作爆点", stage: "boom" },
    boom3: { sizes: ["特写", "大特写"], angles: ["低机位仰拍", "正面机位"], moves: ["缓慢推镜", "固定镜头"], lights: ["逆光", "聚光"], sounds: ["呼吸声", "钟摆滴答"], emo: "高潮·金句输出", stage: "boom" },
    cliff: { sizes: ["特写", "大特写"], angles: ["平拍眼平", "低机位仰拍"], moves: ["缓慢推镜", "固定镜头"], lights: ["逆光", "聚光"], sounds: ["低频嗡鸣渐强", "心跳声由弱渐强"], emo: "结尾·卡点+余韵", stage: "cliff" }
  };

  /* 阶段中文名 / 功能镜名（自定义镜数时不再依赖写死的 7/8 镜公式） */
  const STAGE_CN = { hook: "钩子场", push: "推进场", boom: "爆点场", cliff: "结尾" };
  function fnNameOf(stage, kIn) {
    if (stage === "hook") return "钩子镜";
    if (stage === "cliff") return "卡点镜";
    return (stage === "push" ? "推进镜" : "爆点镜") + ["A", "B", "C"][kIn % 3];
  }

  function fnKey(fn) {
    if (fn.indexOf("钩子") >= 0) return "hook";
    if (fn.indexOf("推进") >= 0) { const n = fn.match(/[ABC]/); return n ? "push" + (n[0].charCodeAt(0) - 64) : "push1"; }
    if (fn.indexOf("爆点") >= 0) { const n = fn.match(/[ABC]/); return n ? "boom" + (n[0].charCodeAt(0) - 64) : "boom1"; }
    if (fn.indexOf("卡点") >= 0) return "cliff";
    return "push1";
  }

  function heroName(chars) { const h = (chars || []).find(c => c.tag === "hero"); return h ? h.name : ((chars || [])[0] ? chars[0].name : "主角"); }
  function villainName(chars) { const v = (chars || []).find(c => c.tag === "villain"); return v ? v.name : ((chars || [])[1] ? chars[1].name : "对手"); }

  /* 阶段序列：7/8 镜沿用官方公式；其余任意镜数按「钩子1 + 推进≈45% + 爆点 + 卡点1」比例生成，
     保证自定义镜数时不会退化成写死的 8 镜。 */
  function stageSeq(n) {
    if (KB.shotFormula[n]) return KB.shotFormula[n].map(f => fnKey(f.fn));
    if (n <= 1) return ["hook"];
    if (n === 2) return ["hook", "cliff"];
    const mid = n - 2;                       // 扣掉钩子镜和卡点镜后的中间镜数
    let nPush = Math.round(mid * 0.45);
    if (nPush < 1) nPush = 1;                // 至少 1 镜推进
    if (mid >= 2 && nPush > mid - 1) nPush = mid - 1;  // 给爆点至少留 1 镜
    let nBoom = mid - nPush;
    if (nBoom < 1) { nBoom = 1; nPush = Math.max(0, mid - 1); }
    const seq = ["hook"];
    for (let i = 0; i < nPush; i++) seq.push("push" + (i % 3 + 1));
    for (let i = 0; i < nBoom; i++) seq.push("boom" + (i % 3 + 1));
    seq.push("cliff");
    return seq;
  }

  /* 时长表：官方只定义了 7/8 镜，自定义镜数时按「首镜5秒 / 末镜8秒 / 中间10秒」生成 */
  function durationsFor(n) {
    if (KB.shotDurations[n]) return KB.shotDurations[n];
    const d = [];
    for (let i = 0; i < n; i++) d.push(i === 0 ? 5 : (i === n - 1 ? 8 : 10));
    return d;
  }

  function genStoryboard(project) {
    const m = project.meta, chars = project.characters || [];
    const info = parsePremise(m.premise);
    const hero = heroName(chars);
    const villain = villainName(chars);
    const env = info.era ? info.era.scene.split("·")[0] : "核心场景";
    // 自定义镜数：允许 3~30 镜
    const n = Math.max(3, Math.min(30, m.shotsPerEpisode || 8));
    const keys = stageSeq(n);
    const durs = durationsFor(n);
    const scriptMap = {};
    (project.scripts || []).forEach(s => scriptMap[s.ep] = s);
    const sceneOf = { hook: 0, push: 1, boom: 2, cliff: 3 };
    const out = [];

    for (const ep of (project.episodes || [])) {
      const sc = scriptMap[ep.index];
      const cliffCfg = pick(KB.cliffhangers, ep.index * 7 + 3);
      const counter = {};   // 同阶段内第几镜 —— 用来轮转参数，避免连续几镜完全一样

      const shots = keys.map((k, i) => {
        const rec = SHOT_REC[k], stage = rec.stage;
        const kIn = counter[stage] || 0; counter[stage] = kIn + 1;
        const seed = ep.index * 131 + i * 17 + kIn * 7;

        const pool = actionsOf(m.genre, stage);
        const act = pool.length ? pick(pool, seed + kIn * 5) : "";
        const scene = sc ? sc.scenes[Math.min(sceneOf[stage], sc.scenes.length - 1)] : null;
        const who = stage === "cliff" ? villain : (stage === "push" && kIn % 2 === 1 ? villain : hero);

        // 画面描述 = 剧本叙事 + 本镜具体动作。不用「悬念拉满」这类抽象情绪词（Seedance 铁律13 / H3 铁律33）
        let desc = scene ? scene.desc.replace(/[。！？]+$/, "") : `${env}里，${withHero(who, act)}`;
        if (scene && act) desc += `，${withHero(who, act)}`;
        if (stage === "cliff") desc += `。${cliffCfg.visual}`;

        const speaker = scene ? scene.speaker : who;
        const dialogue = scene ? scene.dialogue : pick(KB.goldenLines[stage] || KB.goldenLines.push, seed);

        const shot = {
          no: i + 1, fn: fnNameOf(stage, kIn), scene: STAGE_CN[stage], emo: rec.emo, stage,
          shotSize: rec.sizes[kIn % rec.sizes.length],
          camera: rec.angles[kIn % rec.angles.length],
          movement: rec.moves[kIn % rec.moves.length],
          lighting: rec.lights[kIn % rec.lights.length],
          sound: stage === "cliff" ? cliffCfg.sound : pick(rec.sounds, seed),
          duration: durs[i] || 10,
          transition: i === 0 ? "开场" : pick(KB.transitions, seed),
          desc, dialogue, speaker
        };
        // 方言 DLC 随镜头下传，供提示词生成「用粤语说道{…}」
        if (scene && scene.dialect) shot.dialect = scene.dialect;
        return shot;
      });
      out.push({ ep: ep.index, shots });
    }
    return out;
  }

  /* 运镜英译（H3 英文提示词用） */
  const MOV_EN = {
    "固定镜头": "static shot", "缓慢推镜": "slow push-in", "缓慢拉镜": "slow pull-out",
    "摇镜": "pan", "平移": "tracking", "跟拍": "follow", "环绕": "orbit",
    "快速切换": "rapid cut", "手持晃动": "handheld shake", "定格": "freeze frame",
    "慢动作": "slow motion", "希区柯克变焦": "dolly zoom"
  };
  function mvEn(m) { return MOV_EN[m] || "static"; }
  function enOf(list, name, key) { const it = list.find(x => x.name === name); return it ? it[key] : name; }

  /* ---------- 5a. Seedance 三段式提示词 ---------- */
  function genPromptSeedance(project, epIndex) {
    const m = project.meta, chars = project.characters || [];
    const style = getStyle(m.style);
    const sb = (project.storyboard || []).find(s => s.ep === epIndex) || { shots: [] };
    const ratio = m.ratio === "16:9" ? "16:9横屏" : "9:16竖屏";
    const hero = heroName(chars);

    // ① 素材声明（首行必须是 EPxx《集名》，Seedance 铁律29）
    const ep = (project.episodes || []).find(e => e.index === epIndex);
    const head = `EP${String(epIndex).padStart(2, "0")}《${ep ? ep.title : "第" + epIndex + "集"}》`;
    let mat = "";
    chars.slice(0, 3).forEach((c, i) => {
      mat += (i === 0 ? "" : "；") + `将@图片${i + 1}中${c.look || "角色"}定义为${c.name}`;
    });
    mat += `；@图片${Math.min(chars.length, 3) + 1}作为场景参考。`;

    // ② 全局设定
    const global = `${style.name}，${ratio}，高清，细节丰富，电影质感，${style.prefix}；`
      + `人物面部与服装全程稳定不变形，动作自然流畅，无卡顿无闪烁无穿模；`
      + `保持无字幕，避免生成任何文字或字幕，不要生成 Logo 或水印；`
      + `视频全程禁止出现外形、着装、配饰完全一致的人物，同一画面中每个角色仅出现一次，不出现人物重复复刻或分身。`;

    // ③ 分镜（带时间码/时长/转场）
    let seg = "", t = 0;
    sb.shots.forEach((s, i) => {
      const start = t, end = t + (s.duration || 10); t = end;
      // 角色名必须放在 {} 朗读区之外，否则 TTS 会把名字念出来
      // 方言镜头用「用X语说道{…}」标注语种（dialect-master → seedance 对接约定）
      const dlc = s.dialect;
      const dialogue = s.dialogue
        ? `镜头切至${s.speaker || hero}，${dlc ? dlc.cue : "用普通话说道"}{${s.dialogue}}`
        : "";
      const sound = s.sound ? `<${s.sound}>` : "";
      const trans = i === 0 ? "" : `（${s.transition}）`;
      const bgm = i === 0 ? "（BGM起）" : "";
      seg += `镜头${i + 1}｜${start}-${end}秒${trans}：${s.shotSize}，${s.camera}，${s.movement}；${s.desc}${s.lighting}打光。${dialogue}${sound}${bgm}\n`;
    });
    seg += `\n画面自然收住在${hero}的关键瞬间。`;

    return `${head}\n\n${mat}\n\n${global}\n\n${seg}`;
  }

  /* ---------- 5b. MiniMax H3 六段式提示词 ---------- */
  function genPromptH3(project, epIndex) {
    const m = project.meta, chars = project.characters || [];
    const style = getStyle(m.style);
    const sb = (project.storyboard || []).find(s => s.ep === epIndex) || { shots: [] };
    const hero = heroName(chars);

    const ep = (project.episodes || []).find(e => e.index === epIndex);
    const ratio = m.ratio === "16:9" ? "16:9" : "9:16";
    const head = `EP${String(epIndex).padStart(2, "0")}《${ep ? ep.title : "第" + epIndex + "集"}》`;

    // ① Style
    const styleLine = `Style: ${style.prefix}, ${ratio}, cinematic, high detail, film grain.`;

    // ② Subject definitions（必须用 <Subject N> is … in <Picture N> 写法，H3 铁律43）
    let subj = "";
    chars.slice(0, 3).forEach((c, i) => {
      subj += `<Subject ${i + 1}> is ${c.name} in <Picture ${i + 1}>: ${c.look || "character"}, identity lock.\n`;
    });
    subj += `<Scene> is the environment in <Picture ${Math.min(chars.length, 3) + 1}>: environment lock.`;

    // ③ Summary
    const summary = `Summary: episode ${epIndex} of ${m.episodes} — a ${m.genre} short drama led by ${hero}. `
      + `The episode opens on a hook, escalates through confrontation, delivers a climax payoff, and closes on a cliffhanger.`;

    // ④ Retention analysis
    const retention = `Retention analysis: grab attention within the first second; escalate obstacles through the middle; `
      + `pay off at the climax with a signature line; end unresolved on the cliffhanger to drive the next episode.`;

    // ⑤ Detailed description（累计时间码 mm:ss.000，H3 时间码铁律）
    let shots = "", t = 0;
    sb.shots.forEach((s, i) => {
      const mm = String(Math.floor(t / 60)).padStart(2, "0");
      const ss = String(Math.floor(t) % 60).padStart(2, "0");
      const dur = s.duration || 10;
      t += dur;
      const sizeEn = enOf(KB.shotSizes, s.shotSize, "abbr");
      const angEn = enOf(KB.cameraAngles, s.camera, "en");
      const litEn = enOf(KB.lightings, s.lighting, "en");
      // 台词用 <d>[Chinese]…</d> 包裹，说话人放在标签外（H3 铁律21/44）
      // 方言镜头在说话人后标注语种，正文仍走 [Chinese]（方言正字属中文字符）
      const dlcH3 = s.dialect;
      const lang = dlcH3 ? dialectEn(m.dialect) : "Chinese";
      const speak = s.dialogue ? ` ${s.speaker || hero} speaks in ${lang} <d>[Chinese]${s.dialogue}</d>` : "";
      shots += `[Shot ${i + 1}] at ${mm}:${ss}.000 (${dur}s) — ${sizeEn} shot, ${angEn}. ${s.desc} `
        + `Camera: ${mvEn(s.movement)}; lighting: ${litEn}.${speak}\n`;
    });

    // ⑥ Audio + Negative
    const sound = sb.shots[0] ? sb.shots[0].sound : "ambient";
    const audio = `overall_soundscape: ${sound}, ambient room tone.\nnon_diegetic_music: N/A`;
    const negative = "distorted face, deformed hands, extra fingers, cloned character, duplicate person, "
      + "text overlay, subtitle, logo, watermark, flickering, morphing, jump cut, freeze frame";

    return [
      head, "",
      styleLine, "",
      "Subject definitions:", subj, "",
      summary, "",
      retention, "",
      "Continuity: consistent lighting across shots, stable character identity and wardrobe, seamless transitions, no duplicate figures.", "",
      "Detailed description:", shots,
      audio, "",
      `Negative prompt: ${negative}`
    ].join("\n");
  }

  /* ---------- 6. 一键全链路 ---------- */
  function genAll(project) {
    project.characters = genCharacters(project);
    project.episodes = genEpisodes(project);
    project.scripts = genScript(project);
    project.storyboard = genStoryboard(project);
    return project;
  }

  /* ---------- 统计 ---------- */
  function stats(project) {
    const sb = project.storyboard || [];
    const totalShots = sb.reduce((n, e) => n + e.shots.length, 0);
    const secs = sb.reduce((n, e) => n + e.shots.reduce((x, s) => x + (s.duration || 10), 0), 0);
    const sizeCount = {};
    sb.forEach(e => e.shots.forEach(s => { sizeCount[s.shotSize] = (sizeCount[s.shotSize] || 0) + 1; }));
    return {
      episodes: (project.episodes || []).length,
      shots: totalShots,
      seconds: secs,
      characters: (project.characters || []).length,
      sizeCount
    };
  }

  return {
    getGenre, getStyle, getTemplate, parsePremise, pickName,
    genCharacters, genEpisodes, genScript, genStoryboard,
    genPromptH3, genPromptSeedance, genAll, stats, heroName, villainName,
    getDialect, applyDialect, dialectEn
  };
})();
