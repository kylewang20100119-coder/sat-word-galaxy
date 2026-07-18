(() => {
  const bankWords = Array.isArray(window.WORDBANK_WORDS) ? window.WORDBANK_WORDS : [];
  const enriched = new Map((window.WORDS || []).map(word => [word.id, word]));
  const satWords = bankWords.map(word => ({ ...word, ...(enriched.get(word.id) || {}), group: word.group }));
  const wordMap = new Map(satWords.map(word => [word.id, word]));
  const allWordMap = new Map();
  [...bankWords, ...(window.WORDS || []), ...(window.GRE_WORDS || [])].forEach(word => {
    const previous = allWordMap.get(word.id) || {};
    allWordMap.set(word.id, { ...previous, ...word });
  });
  const relationRows = [...(window.WORDBANK_RELATIONS || []), ...(window.RELATIONS || []), ...(window.GRE_RELATIONS || [])];
  const relationIndex = new Map();
  relationRows.forEach(([source, target, type, strength]) => {
    if (!["synonym", "antonym", "etymology"].includes(type)) return;
    [source, target].forEach((id, index) => {
      if (!relationIndex.has(id)) relationIndex.set(id, []);
      relationIndex.get(id).push({ id: index === 0 ? target : source, type, strength: Number(strength) || 0 });
    });
  });

  const groupSelect = document.getElementById("study-group-select");
  const wordCard = document.getElementById("study-word-card");
  const wordStrip = document.getElementById("study-word-strip");
  const readingList = document.getElementById("group-reading-list");
  const statCards = document.getElementById("study-stat-cards");
  const groupProgressGrid = document.getElementById("group-progress-grid");
  const progressImportFile = document.getElementById("progress-import-file");
  const progressImportButton = document.getElementById("progress-import-button");
  const progressImportUndo = document.getElementById("progress-import-undo");
  const progressImportStatus = document.getElementById("progress-import-status");
  const readingHistoryBox = document.getElementById("group-reading-history");
  const readingStatCards = document.getElementById("group-reading-stat-cards");
  if (!groupSelect || !wordCard || !readingList) return;

  const groupNumbers = [...new Set(satWords.map(word => Number(String(word.group).replace("Group ", ""))))]
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const groups = new Map(groupNumbers.map(number => [number, satWords.filter(word => word.group === `Group ${number}`)]));
  const PASS_METHODS = {
    1: { id: "full-card", title: "完整认识", detail: "释义、例句、同反义词、词源与记忆法" },
    2: { id: "meaning-relations-family", title: "意思 + 语境关系网", detail: "中文意思、例句、同反义词与同源词一起对照" },
    3: { id: "structure-reading", title: "结构阅读", detail: "先抓骨架与转折，再用 3 / 3 / 4 目标词完成 DSAT 阅读" }
  };
  let state = { group: groupNumbers[0] || 1, index: 0, studyPass: null, passIndices: {}, passProgress: { 1: {}, 2: {}, 3: {} }, passHistory: [], passMethodVersion: 0, completed: {}, splits: {}, variants: {}, totalXp: 0, xpSpent: 0, xpAlertStep: 250, lastXpAlertMilestone: null, restRewards: [], activeRest: null, currentCombo: 0, comboDay: 0, bestCombo: 0, dailyRewards: {}, modeRewards: {}, readingHistory: [], readingRewarded: [], readingDrafts: {}, readingPass: 3, badges: {}, studyHistory: [], sprintProgress: 0, totalSprints: 0, starFragments: 0, constellations: [], recallBuffer: [], pendingRecall: null, recallStats: { attempts: 0, correct: 0, streak: 0, bestStreak: 0 }, rescueQueue: [], pendingRescue: null, rescueStep: 0, rescueNextEligibleStep: 0, rescueStats: { attempts: 0, cleared: 0, correct: 0 } };
  let levelStore = {};
  let sessionCombo = 0;
  let rewardMessage = "从今天的第一个词开始点亮星系。";
  let restTimerId = null;
  const defaultDocumentTitle = document.title;
  try {
    state = { ...state, ...(JSON.parse(localStorage.getItem("lexiverse-group-study-v1")) || {}) };
  } catch {}
  try { levelStore = JSON.parse(localStorage.getItem("lexiverse-levels")) || {}; } catch {}
  if (!Array.isArray(state.studyHistory)) state.studyHistory = [];
  if (!state.studyHistory.length) {
    state.studyHistory = Object.entries(state.completed || {})
      .filter(([, timestamp]) => Number(timestamp) > 1000000000000)
      .map(([id, timestamp]) => ({ id, source: "legacy-new", at: Number(timestamp) }));
  }
  if (!Array.isArray(state.constellations)) state.constellations = [];
  if (!Array.isArray(state.recallBuffer)) state.recallBuffer = [];
  if (!state.recallStats || typeof state.recallStats !== "object" || Array.isArray(state.recallStats)) state.recallStats = { attempts: 0, correct: 0, streak: 0, bestStreak: 0 };
  ["attempts", "correct", "streak", "bestStreak"].forEach(key => { state.recallStats[key] = Math.max(0, Number(state.recallStats[key]) || 0); });
  if (!state.pendingRecall || typeof state.pendingRecall !== "object" || Array.isArray(state.pendingRecall)) state.pendingRecall = null;
  if (!Array.isArray(state.rescueQueue)) state.rescueQueue = [];
  state.rescueQueue = state.rescueQueue.filter(entry => entry?.id && wordMap.has(entry.id)).slice(-80).map(entry => ({
    id: entry.id,
    dueStep: Math.max(0, Number(entry.dueStep) || 0),
    attempts: Math.max(0, Number(entry.attempts) || 0),
    source: entry.source || "weak-rating",
    addedAt: Number(entry.addedAt) || Date.now()
  }));
  if (!state.pendingRescue || typeof state.pendingRescue !== "object" || Array.isArray(state.pendingRescue) || !wordMap.has(state.pendingRescue.targetId)) state.pendingRescue = null;
  state.rescueStep = Math.max(0, Number(state.rescueStep) || 0);
  state.rescueNextEligibleStep = Math.max(0, Number(state.rescueNextEligibleStep) || 0);
  if (!state.rescueStats || typeof state.rescueStats !== "object" || Array.isArray(state.rescueStats)) state.rescueStats = { attempts: 0, cleared: 0, correct: 0 };
  ["attempts", "cleared", "correct"].forEach(key => { state.rescueStats[key] = Math.max(0, Number(state.rescueStats[key]) || 0); });
  if (!state.passIndices || typeof state.passIndices !== "object" || Array.isArray(state.passIndices)) state.passIndices = {};
  if (!state.passProgress || typeof state.passProgress !== "object" || Array.isArray(state.passProgress)) state.passProgress = { 1: {}, 2: {}, 3: {} };
  [1, 2, 3].forEach(pass => {
    if (!state.passProgress[pass] || typeof state.passProgress[pass] !== "object" || Array.isArray(state.passProgress[pass])) state.passProgress[pass] = {};
  });
  if (!Array.isArray(state.passHistory)) state.passHistory = [];
  if (!state.readingDrafts || typeof state.readingDrafts !== "object" || Array.isArray(state.readingDrafts)) state.readingDrafts = {};
  if (!Array.isArray(state.restRewards)) state.restRewards = [];
  if (![100, 250, 500, 1000].includes(Number(state.xpAlertStep))) state.xpAlertStep = 250;
  state.xpSpent = Math.max(0, Number(state.xpSpent) || 0);
  const currentComboDay = localDayStart(Date.now());
  if (Number(state.comboDay) === currentComboDay) {
    sessionCombo = Math.max(0, Number(state.currentCombo) || 0);
    if (sessionCombo) rewardMessage = `今日连击 ${sessionCombo}× 已恢复，刷新不会打断节奏。`;
  } else {
    state.currentCombo = 0;
    state.comboDay = currentComboDay;
  }
  if (!state.activeRest || typeof state.activeRest !== "object") state.activeRest = null;
  state.readingPass = 3;
  satWords.forEach(word => { word.level = Number(levelStore[word.id] || word.level || 1); });
  if (!groups.has(Number(state.group))) state.group = groupNumbers[0] || 1;
  let groupProgressFilter = "all";
  let readingHistoryFilter = "current";

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);

  function persist() {
    localStorage.setItem("lexiverse-group-study-v1", JSON.stringify(state));
  }

  function normalizeWordId(value) {
    return String(value || "").normalize("NFKC").replace(/[‘’]/g, "'").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function showImportStatus(message, isError = false) {
    if (!progressImportStatus) return;
    progressImportStatus.textContent = message;
    progressImportStatus.classList.toggle("error", isError);
  }

  function restoreImportSummary() {
    if (!progressImportStatus) return;
    try {
      const report = JSON.parse(localStorage.getItem("lexiverse-notion-import-report-v1"));
      if (report?.matched) {
        showImportStatus(`上次导入：匹配 ${report.matched} 词 · 熟悉度 2：${report.level2} · 熟悉度 4：${report.level4} · 已同步学习进度。`);
      }
    } catch {}
    if (progressImportUndo) progressImportUndo.hidden = !localStorage.getItem("lexiverse-notion-import-backup-v1");
  }

  async function importNotionProgress(file) {
    let payload;
    try {
      payload = JSON.parse(await file.text());
    } catch {
      throw new Error("无法读取这个文件，请选择 notion-progress-import.json。 ");
    }
    if (payload?.format !== "lexiverse-notion-progress-v1" || !Array.isArray(payload.records)) {
      throw new Error("文件格式不匹配，请选择为本网站生成的 Notion 迁移文件。");
    }
    const backup = {
      createdAt: new Date().toISOString(),
      levels: localStorage.getItem("lexiverse-levels"),
      groupStudy: localStorage.getItem("lexiverse-group-study-v1"),
      passes: localStorage.getItem(window.LexiversePasses?.key || "lexiverse-word-passes-v1")
    };
    const completed = { ...(state.completed || {}) };
    const seen = new Set();
    let matched = 0;
    let level2 = 0;
    let level4 = 0;
    let skipped = 0;
    payload.records.forEach(record => {
      const id = normalizeWordId(record?.id);
      const word = wordMap.get(id);
      const expectedGroup = Number(record?.group);
      const actualGroup = Number(String(word?.group || "").replace("Group ", ""));
      const level = Number(record?.level);
      if (!word || seen.has(id) || expectedGroup !== actualGroup || ![1, 2, 3, 4, 5].includes(level)) {
        skipped += 1;
        return;
      }
      seen.add(id);
      levelStore[id] = level;
      word.level = level;
      if (record.studied) completed[id] = 1;
      else delete completed[id];
      window.LexiversePasses?.ensure(id, record.studied ? 2 : 1, "notion-import");
      matched += 1;
      if (level === 2) level2 += 1;
      if (level === 4) level4 += 1;
    });
    if (!matched) throw new Error("没有找到能与当前 SAT WordBank 匹配的记录。");
    state.completed = completed;
    localStorage.setItem("lexiverse-notion-import-backup-v1", JSON.stringify(backup));
    localStorage.setItem("lexiverse-levels", JSON.stringify(levelStore));
    persist();
    localStorage.setItem("lexiverse-notion-import-report-v1", JSON.stringify({
      importedAt: new Date().toISOString(), matched, level2, level4, skipped
    }));
    showImportStatus(`导入成功：${matched} 个词已匹配，正在刷新仪表盘……`);
    if (progressImportButton) progressImportButton.disabled = true;
    setTimeout(() => window.location.reload(), 900);
  }

  function currentWords() {
    return groups.get(Number(state.group)) || [];
  }

  function passRecords(pass) {
    const normalized = [1, 2, 3].includes(Number(pass)) ? Number(pass) : 1;
    state.passProgress[normalized] = state.passProgress[normalized] || {};
    return state.passProgress[normalized];
  }

  function isPassComplete(id, pass) {
    return Boolean(passRecords(pass)[id]);
  }

  function groupPassCount(pass, words = currentWords()) {
    return words.filter(word => isPassComplete(word.id, pass)).length;
  }

  function storedPassIndex(group = state.group, pass = state.studyPass) {
    return Math.max(0, Number(state.passIndices?.[String(group)]?.[String(pass)]) || 0);
  }

  function savePassIndex(index = state.index, group = state.group, pass = state.studyPass) {
    const groupKey = String(group);
    state.passIndices[groupKey] = state.passIndices[groupKey] || {};
    state.passIndices[groupKey][String(pass)] = Math.max(0, Number(index) || 0);
  }

  function migratePassMethods() {
    if (Number(state.passMethodVersion) >= 1) return;
    satWords.forEach(word => {
      const count = Math.max(1, Number(window.LexiversePasses?.get(word.id)) || 1);
      if (count >= 1 && !passRecords(1)[word.id]) passRecords(1)[word.id] = 1;
      if (count >= 2 && !passRecords(2)[word.id]) passRecords(2)[word.id] = Number(state.completed?.[word.id]) || 1;
      if (count >= 3 && !passRecords(3)[word.id]) passRecords(3)[word.id] = 1;
    });
    state.passMethodVersion = 1;
  }

  migratePassMethods();
  if (![1, 2, 3].includes(Number(state.studyPass))) {
    const initialWords = currentWords();
    state.studyPass = initialWords.length && initialWords.every(word => isPassComplete(word.id, 2)) ? 2 : 1;
  }
  state.studyPass = Number(state.studyPass);
  state.index = storedPassIndex();
  persist();

  function markPassComplete(ids, pass, level, source) {
    const normalizedPass = [1, 2, 3].includes(Number(pass)) ? Number(pass) : 1;
    const records = passRecords(normalizedPass);
    const method = PASS_METHODS[normalizedPass];
    const at = Date.now();
    const clean = [...new Set((Array.isArray(ids) ? ids : [ids]).filter(id => wordMap.has(id)))];
    const newlyCompleted = clean.filter(id => !records[id]);
    newlyCompleted.forEach(id => {
      records[id] = at;
      state.passHistory.push({ id, pass: normalizedPass, method: method.id, level: Number(level) || null, source, at });
      window.LexiversePasses?.ensure(id, normalizedPass, "pass-method-sync");
    });
    if (state.passHistory.length > 12000) state.passHistory = state.passHistory.slice(-12000);
    if (newlyCompleted.length) recordStudyActivity(newlyCompleted, source);
    persist();
    return newlyCompleted;
  }

  function passArchiveHtml(word) {
    return `<section class="study-pass-archive"><div><strong>三遍学习档案</strong><span>每一遍的方法和完成时间都会单独保存</span></div><ol>${[1, 2, 3].map(pass => {
      const timestamp = Number(passRecords(pass)[word.id]);
      const method = PASS_METHODS[pass];
      const date = timestamp > 1000000000000 ? new Date(timestamp).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }) : "历史进度";
      return `<li class="${timestamp ? "complete" : "pending"}"><i>${pass === 1 ? "I" : pass === 2 ? "II" : "III"}</i><span><b>${escapeHtml(method.title)}</b><small>${escapeHtml(method.detail)}</small></span><em>${timestamp ? `✓ ${date}` : "待完成"}</em></li>`;
    }).join("")}</ol></section>`;
  }

  function relatedEntries(id, type, limit = 4) {
    const seen = new Set();
    return (relationIndex.get(id) || [])
      .filter(item => item.type === type && item.id !== id && !seen.has(item.id) && seen.add(item.id))
      .sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id, "en"))
      .slice(0, limit)
      .map(item => ({ ...item, word: allWordMap.get(item.id) || null }));
  }

  function relationLabel(type, strength) {
    if (type === "synonym") return strength >= .92 ? "几乎同义" : strength >= .84 ? "高度接近" : "语义相近";
    return strength >= .92 ? "强反义" : strength >= .84 ? "明显相反" : "语义对照";
  }

  function normalizeFamilyStem(value) {
    return String(value || "").toLowerCase().replace(/[^a-z]/g, "").replace(/(ingly|edly|ation|ition|ment|ness|ence|ance|able|ible|ious|ous|ive|ity|ally|al|ic|ate|ify|ize|ing|ed|ly|s)$/i, "");
  }

  function familyFor(word) {
    const curated = (window.LEXICAL_FAMILIES || []).find(family => family.members.some(([id]) => id === word.id));
    if (curated) {
      return {
        root: curated.root,
        members: curated.members.filter(([id]) => id !== word.id).slice(0, 6).map(([id, meaning]) => ({ id, meaning, word: allWordMap.get(id) || null }))
      };
    }
    const linked = relatedEntries(word.id, "etymology", 6).map(entry => ({
      id: entry.id,
      meaning: entry.word?.zh || entry.word?.definition || "同词源关联词",
      word: entry.word
    }));
    if (linked.length) return { root: "词库已核对的同源关系", members: linked };
    const stem = normalizeFamilyStem(word.id);
    const derived = stem.length >= 5 ? [...allWordMap.values()]
      .filter(candidate => candidate.id !== word.id && normalizeFamilyStem(candidate.id) === stem)
      .slice(0, 6)
      .map(candidate => ({ id: candidate.id, meaning: candidate.zh || candidate.definition, word: candidate })) : [];
    if (derived.length) return { root: `${stem} · 同一派生词干`, members: derived };
    const etymology = window.getLexicalEtymology ? window.getLexicalEtymology(word) : String(word.etymology || "");
    const origins = [];
    const originPattern = /(Old French|Old English|Middle English|Modern Latin|Middle Dutch|Latin|Greek|French|Scots|Spanish|Italian|Dutch|Germanic)\s+([a-zA-Z][a-zA-Z-]*)(?:\s*[,;:]?\s*[‘'“"]([^’'”"]+)[’'”"])?/g;
    for (const match of etymology.matchAll(originPattern)) {
      if (origins.some(item => item.id === match[2])) continue;
      origins.push({ id: match[2], meaning: `${match[1]}：${match[3] || "祖源形式，与当前词共享词源"}`, word: null });
      if (origins.length >= 4) break;
    }
    return { root: origins.length ? "祖源词 · 离线词源记录" : "祖源锚点", members: origins };
  }

  function localDayStart(timestamp) {
    const date = new Date(Number(timestamp));
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  }

  function learningStreak(completedTimestamps) {
    const days = [...new Set(completedTimestamps.filter(value => Number(value) > 1000000000000).map(localDayStart))].sort((a, b) => b - a);
    if (!days.length) return 0;
    const today = localDayStart(Date.now());
    const oneDay = 86400000;
    if (today - days[0] > oneDay) return 0;
    let streak = 1;
    for (let index = 1; index < days.length; index += 1) {
      if (Math.round((days[index - 1] - days[index]) / oneDay) !== 1) break;
      streak += 1;
    }
    return streak;
  }

  const STUDY_RANKS = [
    { xp: 0, title: "星尘学徒" },
    { xp: 50, title: "星轨探索者" },
    { xp: 150, title: "星座建造者" },
    { xp: 350, title: "星云领航员" },
    { xp: 700, title: "银河词匠" },
    { xp: 1200, title: "Lexiverse 守望者" },
    { xp: 2500, title: "词根航海家" },
    { xp: 5000, title: "深空阅读者" },
    { xp: 10000, title: "银河记忆大师" }
  ];
  const DAILY_MISSIONS = [
    { target: 20, bonus: 60, name: "热身任务" },
    { target: 50, bonus: 180, name: "巡航任务" },
    { target: 100, bonus: 500, name: "百词满额" }
  ];
  const MODE_QUESTS = [
    { id: "review-10", name: "语境回收舱", detail: "重新激活 10 个到期词的使用场景", target: 10, sources: ["context-review"], bonus: 80 },
    { id: "rescue-3", name: "记忆修复舱", detail: "救回 3 个薄弱词", target: 3, sources: ["memory-rescue"], bonus: 70 },
    { id: "confusable-3", name: "辨析舱", detail: "对比 3 组易混词", target: 3, sources: ["confusable-mastered", "confusable-review"], bonus: 90 },
    { id: "reading-1", name: "实战舱", detail: "完成 1 篇三刷原文阅读", target: 1, sources: ["pass-3-reading", "adaptive-reading"], bonus: 100 }
  ];
  const CONSTELLATIONS = ["猎户座", "天琴座", "天鹅座", "仙女座", "飞马座", "凤凰座", "北冕座", "天龙座", "船帆座", "天鹰座", "双子座", "鲸鱼座"];
  const XP_REST_REWARDS = [
    { id: "orbit-pause", minutes: 5, cost: 100, title: "轨道小憩", detail: "起身、喝水，让刚背的词先沉淀。" },
    { id: "nebula-break", minutes: 15, cost: 240, title: "星云补给", detail: "离开屏幕走一走，回来继续巡航。" },
    { id: "deep-space-rest", minutes: 30, cost: 420, title: "深空休整", detail: "完成一轮高强度学习后的正式奖励。" }
  ];

  const BADGES = [
    { id: "first-light", icon: "✦", title: "第一束星光", detail: "完成第 1 个单词", test: data => data.completed >= 1 },
    { id: "group-forger", icon: "◈", title: "星座铸造者", detail: "完整点亮 1 个 Group", test: data => data.completedGroups >= 1 },
    { id: "hundred-day", icon: "100", title: "百词燃料舱", detail: "一天学习 100 个不同单词", test: data => data.learnedToday >= 100 },
    { id: "streak-three", icon: "3", title: "三日引擎", detail: "连续学习 3 天", test: data => data.streak >= 3 },
    { id: "streak-seven", icon: "7", title: "一周不坠轨", detail: "连续学习 7 天", test: data => data.streak >= 7 },
    { id: "reader-three", icon: "R3", title: "原文点火", detail: "完成 3 篇 Group 阅读", test: data => data.readings >= 3 },
    { id: "reader-thirty", icon: "R30", title: "语境猎手", detail: "完成 30 篇 Group 阅读", test: data => data.readings >= 30 },
    { id: "accuracy-ten", icon: "✓", title: "精准反应", detail: "累计答对 10 篇 Group 阅读", test: data => data.correctReadings >= 10 },
    { id: "thousand", icon: "1K", title: "千词星云", detail: "累计完成 1000 个 SAT 单词", test: data => data.completed >= 1000 },
    { id: "sprint-one", icon: "10", title: "第一次跃迁", detail: "完成第 1 轮十词冲刺", test: data => data.sprints >= 1 },
    { id: "sprint-ten", icon: "10×", title: "稳定巡航", detail: "累计完成 10 轮十词冲刺", test: data => data.sprints >= 10 },
    { id: "constellation-one", icon: "★", title: "点亮星座", detail: "收集并点亮第 1 个星座", test: data => data.constellations >= 1 },
    { id: "rest-one", icon: "☕", title: "会休息的人走得更远", detail: "第一次用 XP 兑换休息", test: data => data.rests >= 1 },
    { id: "rest-five", icon: "5R", title: "节奏管理大师", detail: "累计兑换 5 次休息", test: data => data.rests >= 5 },
    { id: "confusable-five", icon: "VS", title: "边界猎手", detail: "分清 5 组易混词", test: data => data.confusable >= 5 },
    { id: "recall-five", icon: "5Q", title: "主动提取启动", detail: "完成 5 次二刷记忆检查", test: data => data.recallAttempts >= 5 },
    { id: "recall-streak-five", icon: "5✓", title: "记忆链锁定", detail: "记忆检查连续答对 5 次", test: data => data.recallBestStreak >= 5 },
    { id: "recall-fifty", icon: "50Q", title: "提取练习者", detail: "累计答对 50 次二刷记忆检查", test: data => data.recallCorrect >= 50 },
    { id: "rescue-five", icon: "救5", title: "第一次记忆修复", detail: "从救援队列中重新答对 5 个词", test: data => data.rescueCleared >= 5 },
    { id: "rescue-fifty", icon: "救50", title: "漏洞猎手", detail: "累计救回 50 个薄弱词", test: data => data.rescueCleared >= 50 },
    { id: "context-ten", icon: "C10", title: "语境重新点亮", detail: "答对 10 个到期词的语境义", test: data => data.contextCorrect >= 10 },
    { id: "context-streak-ten", icon: "10✓", title: "场景记忆链", detail: "连续 10 词能还原词义与使用场景", test: data => data.contextBestStreak >= 10 },
    { id: "third-pass-100", icon: "III", title: "三刷引擎", detail: "100 个词累计学习至少 3 遍", test: data => data.passThree >= 100 },
    { id: "mastery-fifty", icon: "IV", title: "瞬时反应区", detail: "50 个词累计学习至少 4 遍", test: data => data.passFour >= 50 },
    { id: "streak-thirty", icon: "30", title: "月度航线", detail: "连续学习 30 天", test: data => data.streak >= 30 },
    { id: "full-galaxy", icon: "∞", title: "全星系点亮", detail: "完成 SAT WordBank 全部单词", test: data => data.completed >= satWords.length },
    { id: "third-pass-all", icon: "III★", title: "三刷毕业航线", detail: "全部 SAT 单词累计学习至少 3 遍", test: data => data.passThree >= satWords.length }
  ];

  function localDateKey(timestamp = Date.now()) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function learnedTodayCount() {
    const today = localDayStart(Date.now());
    return new Set((state.studyHistory || []).filter(row => localDayStart(row.at) === today).map(row => row.id)).size;
  }

  function recordStudyActivity(ids, source) {
    const cleanIds = [...new Set((Array.isArray(ids) ? ids : [ids]).filter(id => wordMap.has(id)))];
    if (!cleanIds.length) return;
    const at = Date.now();
    state.studyHistory = Array.isArray(state.studyHistory) ? state.studyHistory : [];
    cleanIds.forEach(id => state.studyHistory.push({ id, source, at }));
    if (state.studyHistory.length > 12000) state.studyHistory = state.studyHistory.slice(-12000);
    persist();
  }

  function todayModeSessions(sources) {
    const today = localDayStart(Date.now());
    return new Set((state.studyHistory || [])
      .filter(row => localDayStart(row.at) === today && sources.includes(row.source))
      .map(row => `${row.source}|${row.at}`)).size;
  }

  function claimModeQuestRewards() {
    state.modeRewards = state.modeRewards || {};
    const key = localDateKey();
    const claimed = new Set(state.modeRewards[key] || []);
    const completed = MODE_QUESTS.filter(quest => todayModeSessions(quest.sources) >= quest.target && !claimed.has(quest.id));
    completed.forEach(quest => {
      claimed.add(quest.id);
      state.totalXp = (Number(state.totalXp) || 0) + quest.bonus;
    });
    state.modeRewards[key] = [...claimed];
    return completed;
  }

  function claimDailyMissionRewards(learnedToday) {
    state.dailyRewards = state.dailyRewards || {};
    const key = localDateKey();
    const claimed = new Set(state.dailyRewards[key] || []);
    const newlyClaimed = DAILY_MISSIONS.filter(mission => learnedToday >= mission.target && !claimed.has(mission.target));
    newlyClaimed.forEach(mission => {
      claimed.add(mission.target);
      state.totalXp = (Number(state.totalXp) || 0) + mission.bonus;
    });
    state.dailyRewards[key] = [...claimed];
    return newlyClaimed;
  }

  function triggerRewardBurst() {
    const card = document.querySelector(".sequence-study-card");
    if (!card) return;
    card.classList.remove("reward-burst");
    requestAnimationFrame(() => card.classList.add("reward-burst"));
    setTimeout(() => card.classList.remove("reward-burst"), 950);
  }

  function availableXp() {
    return Math.max(0, (Number(state.totalXp) || 0) - (Number(state.xpSpent) || 0));
  }

  function showXpGameAlert({ kicker = "MILESTONE REACHED", title, message, icon = "XP", confirm = "收下奖励，继续前进" }) {
    const alert = document.getElementById("xp-game-alert");
    if (!alert) return;
    document.getElementById("xp-game-alert-kicker").textContent = kicker;
    document.getElementById("xp-game-alert-title").textContent = title;
    document.getElementById("xp-game-alert-message").textContent = message;
    document.getElementById("xp-game-alert-icon").textContent = icon;
    document.getElementById("xp-game-alert-confirm").textContent = confirm;
    alert.hidden = false;
    requestAnimationFrame(() => alert.classList.add("visible"));
  }

  function closeXpGameAlert() {
    const alert = document.getElementById("xp-game-alert");
    if (!alert || alert.hidden) return;
    alert.classList.remove("visible");
    setTimeout(() => { alert.hidden = true; }, 220);
    document.title = defaultDocumentTitle;
  }

  function checkXpMilestone(totalXp) {
    const step = Number(state.xpAlertStep) || 250;
    const reached = Math.floor(Math.max(0, totalXp) / step) * step;
    if (state.lastXpAlertMilestone === null || state.lastXpAlertMilestone === undefined || !Number.isFinite(Number(state.lastXpAlertMilestone))) {
      state.lastXpAlertMilestone = reached;
      persist();
      return;
    }
    if (reached <= Number(state.lastXpAlertMilestone)) return;
    state.lastXpAlertMilestone = reached;
    persist();
    showXpGameAlert({
      title: `累计突破 ${reached} XP`,
      message: `你的学习能量又跨过了一个 ${step} XP 里程碑。现在有 ${availableXp()} XP 可以在奖励舱兑换休息时间。`,
      icon: `${reached}`
    });
  }

  function formatRestCountdown(milliseconds) {
    const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const minutes = Math.floor(seconds / 60);
    return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function finishRestSession(automatic = false) {
    const active = state.activeRest;
    if (!active) return;
    const record = state.restRewards.find(row => row.id === active.id);
    if (record) {
      record.status = automatic ? "completed" : "ended-early";
      record.finishedAt = Date.now();
    }
    state.activeRest = null;
    if (restTimerId) {
      clearInterval(restTimerId);
      restTimerId = null;
    }
    rewardMessage = automatic ? "休息结束，能量已恢复。选择下一颗单词继续巡航。" : "已提前结束休息，随时可以继续背词。";
    persist();
    renderRewardBar();
    renderStats();
    if (automatic) document.title = "⏰ 休息结束 · 回来背词";
    showXpGameAlert({
      kicker: automatic ? "TIME TO RETURN" : "BACK TO ORBIT",
      title: automatic ? "休息结束，回到学习轨道" : "提前返回学习轨道",
      message: automatic ? "倒计时已经归零。休息是奖励，现在该把恢复后的注意力重新放回单词上了。" : "本次休息已经记入兑换记录，XP 不会退回。",
      icon: automatic ? "✓" : "↗",
      confirm: automatic ? "我回来了，继续背词" : "继续背词"
    });
  }

  function redeemRestReward(reward) {
    if (!reward || state.activeRest || availableXp() < reward.cost) return;
    const now = Date.now();
    const entry = {
      id: `${reward.id}|${now}`,
      rewardId: reward.id,
      title: reward.title,
      minutes: reward.minutes,
      cost: reward.cost,
      startedAt: now,
      endsAt: now + reward.minutes * 60 * 1000,
      status: "active"
    };
    state.xpSpent = (Number(state.xpSpent) || 0) + reward.cost;
    state.restRewards.push(entry);
    if (state.restRewards.length > 120) state.restRewards = state.restRewards.slice(-120);
    state.activeRest = { ...entry };
    rewardMessage = `${reward.cost} XP 已兑换 ${reward.minutes} 分钟「${reward.title}」。这是完成学习后应得的休息。`;
    persist();
    renderRewardBar();
    renderStats();
  }

  function renderXpRewardShop() {
    const balance = document.getElementById("xp-available-balance");
    const spent = document.getElementById("xp-spent-summary");
    const options = document.getElementById("xp-reward-options");
    const session = document.getElementById("xp-rest-session");
    const history = document.getElementById("xp-reward-history");
    const stepSelect = document.getElementById("xp-alert-step");
    const restOverlay = document.getElementById("xp-rest-overlay");
    if (!balance || !spent || !options || !session) return;
    const available = availableXp();
    balance.textContent = `${available} XP`;
    spent.textContent = `累计消费 ${Number(state.xpSpent) || 0} XP`;
    if (stepSelect) stepSelect.value = String(state.xpAlertStep);
    options.innerHTML = XP_REST_REWARDS.map(reward => {
      const affordable = available >= reward.cost;
      const disabled = Boolean(state.activeRest) || !affordable;
      const buttonText = state.activeRest ? "休息进行中" : affordable ? "兑换并开始" : `还差 ${reward.cost - available} XP`;
      return `<article><div><i>${reward.minutes}</i><span>MIN</span></div><strong>${escapeHtml(reward.title)}</strong><p>${escapeHtml(reward.detail)}</p><small>${reward.cost} XP</small><button type="button" data-rest-reward="${escapeHtml(reward.id)}" ${disabled ? "disabled" : ""}>${buttonText}</button></article>`;
    }).join("");
    options.querySelectorAll("[data-rest-reward]").forEach(button => button.addEventListener("click", () => {
      redeemRestReward(XP_REST_REWARDS.find(reward => reward.id === button.dataset.restReward));
    }));
    const active = state.activeRest;
    if (active && Number(active.endsAt) <= Date.now()) {
      finishRestSession(true);
      return;
    }
    if (active) {
      const remaining = Math.max(0, Number(active.endsAt) - Date.now());
      const duration = Math.max(1, Number(active.endsAt) - Number(active.startedAt));
      const remainingPercent = Math.max(0, Math.min(100, remaining / duration * 100));
      session.hidden = false;
      session.innerHTML = `<div><span>REST SESSION · ${escapeHtml(active.title)}</span><strong>${formatRestCountdown(remaining)}</strong><small>${active.minutes} 分钟休息 · 已花费 ${active.cost} XP</small></div><button class="secondary-button" type="button" disabled>全屏休息中</button>`;
      if (restOverlay) {
        document.body.classList.add("rest-overlay-active");
        restOverlay.hidden = false;
        restOverlay.classList.add("visible");
        restOverlay.classList.toggle("urgent", remaining <= 60 * 1000);
        restOverlay.style.setProperty("--rest-remaining", `${remainingPercent}%`);
        document.getElementById("xp-rest-countdown-value").textContent = formatRestCountdown(remaining);
        document.getElementById("xp-rest-overlay-title").textContent = `${active.title} · ${active.minutes} 分钟`;
        document.getElementById("xp-rest-overlay-reward").textContent = `已兑换 ${active.cost} XP`;
        document.getElementById("xp-rest-overlay-end-time").textContent = `${new Date(active.endsAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })} 返回学习`;
        document.getElementById("xp-rest-overlay-progress-fill").style.width = `${remainingPercent}%`;
      }
      if (!restTimerId) restTimerId = setInterval(renderXpRewardShop, 1000);
    } else {
      session.hidden = true;
      session.innerHTML = "";
      if (restTimerId) {
        clearInterval(restTimerId);
        restTimerId = null;
      }
      if (restOverlay) {
        document.body.classList.remove("rest-overlay-active");
        restOverlay.classList.remove("visible", "urgent");
        restOverlay.hidden = true;
      }
    }
    const recent = state.restRewards.slice().reverse().slice(0, 3);
    if (history) history.innerHTML = recent.length
      ? `最近兑换：${recent.map(row => `<span>${escapeHtml(row.title)} · ${row.minutes} 分钟 · ${new Date(row.startedAt).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}</span>`).join("")}`
      : "还没有兑换记录。完成背词任务后，让休息也变成值得期待的奖励。";
  }

  function renderRewardBar() {
    const learnedToday = learnedTodayCount();
    const pendingRewards = claimDailyMissionRewards(learnedToday);
    const pendingModeRewards = claimModeQuestRewards();
    if (pendingRewards.length || pendingModeRewards.length) {
      const allRewards = [...pendingRewards, ...pendingModeRewards];
      rewardMessage = `✦ ${allRewards.map(item => item.name).join("、")}完成，共获得 ${allRewards.reduce((sum, item) => sum + item.bonus, 0)} XP。`;
      persist();
      setTimeout(triggerRewardBurst, 0);
    }
    const goal = 100;
    const combo = document.getElementById("study-combo");
    const xp = document.getElementById("study-xp");
    const dailyGoal = document.getElementById("study-daily-goal");
    const dailyFill = document.getElementById("study-daily-fill");
    const message = document.getElementById("study-reward-message");
    const totalXp = Number(state.totalXp) || 0;
    const currentRankIndex = STUDY_RANKS.reduce((result, rank, index) => totalXp >= rank.xp ? index : result, 0);
    const currentRank = STUDY_RANKS[currentRankIndex];
    const nextRank = STUDY_RANKS[currentRankIndex + 1];
    const rankProgress = nextRank ? Math.max(0, Math.min(100, (totalXp - currentRank.xp) / (nextRank.xp - currentRank.xp) * 100)) : 100;
    if (combo) combo.textContent = sessionCombo ? `${sessionCombo}×` : "0";
    if (xp) xp.textContent = `${totalXp} / ${availableXp()} XP`;
    if (dailyGoal) dailyGoal.textContent = `${learnedToday} / ${goal}`;
    if (dailyFill) dailyFill.style.width = `${Math.min(100, learnedToday / goal * 100)}%`;
    if (message) message.textContent = rewardMessage;
    const rankTitle = document.getElementById("study-rank-title");
    const nextRankText = document.getElementById("study-next-rank");
    const rankFill = document.getElementById("study-rank-fill");
    if (rankTitle) rankTitle.textContent = currentRank.title;
    if (nextRankText) nextRankText.textContent = nextRank
      ? `距离 ${nextRank.title} 还差 ${nextRank.xp - totalXp} XP`
      : "最高段位已解锁";
    if (rankFill) rankFill.style.width = `${rankProgress}%`;
    document.querySelectorAll("[data-mission]").forEach(mission => {
      mission.classList.toggle("complete", learnedToday >= Number(mission.dataset.mission));
    });
    const questBox = document.getElementById("study-mode-quests");
    if (questBox) questBox.innerHTML = MODE_QUESTS.map(quest => {
      const progress = todayModeSessions(quest.sources);
      const complete = progress >= quest.target;
      return `<span class="${complete ? "complete" : ""}"><i>${complete ? "✓" : "◇"}</i><b>${escapeHtml(quest.name)}</b><small>${Math.min(progress, quest.target)}/${quest.target} · ${escapeHtml(quest.detail)} · +${quest.bonus} XP</small></span>`;
    }).join("");
    state.constellations = Array.isArray(state.constellations) ? state.constellations : [];
    const unlockTarget = Math.min(CONSTELLATIONS.length, Math.floor((Number(state.starFragments) || 0) / 5));
    let constellationChanged = false;
    while (state.constellations.length < unlockTarget) {
      state.constellations.push(CONSTELLATIONS[state.constellations.length]);
      constellationChanged = true;
    }
    if (constellationChanged) persist();
    const constellationBox = document.getElementById("study-constellation-collection");
    if (constellationBox) {
      const fragmentProgress = (Number(state.starFragments) || 0) % 5;
      const nextConstellation = CONSTELLATIONS[state.constellations.length];
      constellationBox.innerHTML = `<div><span>星图收藏</span><strong>${state.constellations.length} / ${CONSTELLATIONS.length} 已点亮</strong><small>${nextConstellation ? `再收集 ${5 - fragmentProgress} 枚碎片点亮 ${nextConstellation}` : "全部星座已点亮"}</small></div><div class="constellation-fragments" aria-label="星图碎片 ${fragmentProgress} / 5">${Array.from({ length: 5 }, (_, index) => `<i class="${index < fragmentProgress ? "lit" : ""}">✦</i>`).join("")}</div>${state.constellations.length ? `<p>最新收藏 · <b>${escapeHtml(state.constellations[state.constellations.length - 1])}</b></p>` : `<p>每完成一轮 10 词冲刺，获得 1 枚星图碎片。</p>`}`;
    }
    renderXpRewardShop();
    checkXpMilestone(totalXp);
  }

  function renderBadges(metrics) {
    const box = document.getElementById("study-badges");
    if (!box) return;
    state.badges = state.badges || {};
    let changed = false;
    BADGES.forEach(badge => {
      if (!state.badges[badge.id] && badge.test(metrics)) {
        state.badges[badge.id] = Date.now();
        changed = true;
      }
    });
    if (changed) persist();
    const unlocked = BADGES.filter(badge => state.badges[badge.id]).length;
    const progress = document.getElementById("badge-progress");
    if (progress) progress.textContent = `${unlocked} / ${BADGES.length} 已解锁`;
    box.innerHTML = BADGES.map(badge => {
      const unlockedAt = Number(state.badges[badge.id]);
      return `<article class="study-badge ${unlockedAt ? "unlocked" : "locked"}" title="${escapeHtml(badge.detail)}">
        <i>${badge.icon}</i><div><strong>${escapeHtml(badge.title)}</strong><span>${escapeHtml(badge.detail)}</span>${unlockedAt ? `<small>${new Date(unlockedAt).toLocaleDateString("zh-CN")} 解锁</small>` : `<small>尚未解锁</small>`}</div>
      </article>`;
    }).join("");
  }

  function renderStats() {
    if (!statCards || !groupProgressGrid) return;
    const completedIds = new Set(Object.keys(state.completed || {}).filter(id => state.completed[id]));
    const timestamps = (state.studyHistory || []).map(row => Number(row.at)).filter(Number.isFinite);
    const learnedToday = learnedTodayCount();
    const progressRows = groupNumbers.map(number => {
      const words = groups.get(number) || [];
      const learned = words.filter(word => completedIds.has(word.id)).length;
      const passOne = words.filter(word => isPassComplete(word.id, 1)).length;
      const passTwo = words.filter(word => isPassComplete(word.id, 2)).length;
      const passThree = words.filter(word => isPassComplete(word.id, 3)).length;
      const levels = [1, 2, 3, 4, 5].map(level => words.filter(word => Number(levelStore[word.id] || word.level || 1) === level).length);
      const averageLevel = words.length
        ? levels.reduce((sum, count, index) => sum + count * (index + 1), 0) / words.length
        : 0;
      const averagePasses = words.length
        ? words.reduce((sum, word) => sum + (window.LexiversePasses?.get(word.id) || 0), 0) / words.length
        : 0;
      return {
        number,
        total: words.length,
        learned,
        passOne,
        passTwo,
        passThree,
        levels,
        averageLevel,
        averagePasses,
        anyPass: passOne + passTwo + passThree,
        passOnePercent: words.length ? Math.round(passOne / words.length * 100) : 0,
        passTwoPercent: words.length ? Math.round(passTwo / words.length * 100) : 0,
        passThreePercent: words.length ? Math.round(passThree / words.length * 100) : 0
      };
    });
    const passOneGroups = progressRows.filter(row => row.total && row.passOne === row.total).length;
    const passTwoGroups = progressRows.filter(row => row.total && row.passTwo === row.total).length;
    const passThreeGroups = progressRows.filter(row => row.total && row.passThree === row.total).length;
    const completedGroups = passOneGroups;
    const strongerWords = satWords.filter(word => Number(levelStore[word.id] || word.level || 1) >= 3).length;
    const streak = learningStreak(timestamps);
    const overallPercent = satWords.length ? Math.round(completedIds.size / satWords.length * 100) : 0;
    const totalPasses = satWords.reduce((sum, word) => sum + (window.LexiversePasses?.get(word.id) || 0), 0);
    const passCounts = satWords.map(word => window.LexiversePasses?.get(word.id) || 0);
    const passOne = satWords.filter(word => isPassComplete(word.id, 1)).length;
    const passTwo = satWords.filter(word => isPassComplete(word.id, 2)).length;
    const passThree = satWords.filter(word => isPassComplete(word.id, 3)).length;
    const passFour = passCounts.filter(count => count >= 4).length;
    let confusableMastered = 0;
    try { confusableMastered = Object.keys(JSON.parse(localStorage.getItem("lexiverse-confusable-study-v1"))?.mastered || {}).length; } catch {}
    let contextReviewStats = {};
    try { contextReviewStats = JSON.parse(localStorage.getItem("lexiverse-context-review-v1")) || {}; } catch {}
    const readingHistory = Array.isArray(state.readingHistory) ? state.readingHistory : [];
    statCards.innerHTML = `
      <article><span>已背单词</span><strong>${completedIds.size}<small> / ${satWords.length}</small></strong><p>累计学习 ${totalPasses} 遍 · ${overallPercent}% complete</p></article>
      <article><span>一刷完成 Group</span><strong>${passOneGroups}<small> / ${groupNumbers.length}</small></strong><p>二刷 ${passTwoGroups} 组 · 三刷 ${passThreeGroups} 组</p></article>
      <article><span>今日学习</span><strong>${learnedToday}<small> 词</small></strong><p>${learnedToday >= 100 ? "100 词目标已达成" : `再学习 ${Math.max(0, 100 - learnedToday)} 个不同单词完成目标`}</p></article>
      <article><span>连续学习</span><strong>${streak}<small> 天</small></strong><p>熟悉度 ≥ 3：${strongerWords} 词</p></article>`;
    const passJourney = document.getElementById("study-pass-journey");
    if (passJourney) passJourney.innerHTML = `<div class="pass-journey-heading"><div><strong>三遍方法已分开记忆</strong><span>第一遍完整认识 → 第二遍例句与关系网 → 第三遍原文阅读</span></div><small>三刷覆盖 ${Math.round(passThree / Math.max(1, satWords.length) * 100)}%</small></div><div class="pass-journey-grid">${[
      ["I", "完整认识", passOne, "完整词卡建立记忆"], ["II", "关系稳固", passTwo, "例句 + 同反义词 + 同源词"], ["III", "原文实战", passThree, "DSAT 阅读直接反应"], ["IV", "秒反应", passFour, "额外复习达到 4 遍以上"]
    ].map(([roman, title, count, detail]) => `<article><i>${roman}</i><div><strong>${title}</strong><span>${detail}</span></div><b>${count}<small> / ${satWords.length}</small></b><em><u style="--journey-progress:${count / Math.max(1, satWords.length) * 100}%"></u></em></article>`).join("")}</div>`;
    document.getElementById("study-overall-label").textContent = `${completedIds.size} / ${satWords.length} · ${overallPercent}%`;
    document.getElementById("study-progress-fill").style.width = `${overallPercent}%`;
    const currentRow = progressRows.find(row => row.number === Number(state.group));
    const currentPassCount = currentRow ? [0, currentRow.passOne, currentRow.passTwo, currentRow.passThree][Number(state.studyPass)] || 0 : 0;
    const motivation = document.getElementById("study-motivation");
    motivation.textContent = completedIds.size === satWords.length
      ? "整个 SAT WordBank 已完成。你已经把一片星系走成了自己的路。"
      : learnedToday >= 100
        ? `今天已经拿下 ${learnedToday} 个词，百词目标完成。`
        : currentRow?.anyPass
          ? `Group ${state.group} 当前第 ${state.studyPass} 遍已完成 ${currentPassCount}/${currentRow.total}。`
          : "从今天的第一个词开始，进度会在这里一点点亮起来。";
    renderBadges({
      completed: completedIds.size,
      completedGroups,
      learnedToday,
      streak,
      readings: readingHistory.length,
      correctReadings: readingHistory.filter(record => record.correct).length,
      sprints: Number(state.totalSprints) || 0,
      constellations: state.constellations.length,
      confusable: confusableMastered,
      rests: state.restRewards.length,
      passThree,
      passFour,
      recallAttempts: Number(state.recallStats?.attempts) || 0,
      recallCorrect: Number(state.recallStats?.correct) || 0,
      recallBestStreak: Number(state.recallStats?.bestStreak) || 0,
      rescueCleared: Number(state.rescueStats?.cleared) || 0,
      contextCorrect: Number(contextReviewStats.correct) || 0,
      contextBestStreak: Number(contextReviewStats.bestStreak) || 0
    });
    const visibleRows = progressRows.filter(row => {
      if (groupProgressFilter === "active") return [row.passOne, row.passTwo, row.passThree].some(count => count > 0 && count < row.total);
      if (groupProgressFilter === "pass1") return row.total > 0 && row.passOne === row.total && row.passTwo === 0 && row.passThree === 0;
      if (groupProgressFilter === "pass2") return row.total > 0 && row.passTwo === row.total && row.passThree === 0;
      if (groupProgressFilter === "pass3") return row.total > 0 && row.passThree === row.total;
      return true;
    });
    groupProgressGrid.innerHTML = visibleRows.length ? visibleRows.map(row => {
      const stageLabel = row.passThree === row.total
        ? "三刷完成"
        : row.passThree > 0
          ? `三刷 ${row.passThree}/${row.total}`
          : row.passTwo === row.total
            ? "二刷完成"
            : row.passTwo > 0
              ? `二刷 ${row.passTwo}/${row.total}`
              : row.passOne === row.total
                ? "一刷完成"
                : row.passOne > 0
                  ? `一刷 ${row.passOne}/${row.total}`
                  : "尚未开始";
      const stageClass = row.passThree === row.total
        ? "pass-three-complete"
        : row.passThree > 0
          ? "pass-three-active"
          : row.passTwo === row.total
            ? "pass-two-complete"
            : row.passTwo > 0
              ? "pass-two-active"
              : row.passOne === row.total
                ? "pass-one-complete"
                : row.passOne > 0
                  ? "pass-one-active"
                  : "";
      return `
      <button type="button" data-progress-group="${row.number}" class="${row.anyPass ? "active" : ""} ${stageClass} ${row.number === Number(state.group) ? "current" : ""}" aria-label="Group ${row.number}，第一遍 ${row.passOne} / ${row.total}，第二遍 ${row.passTwo} / ${row.total}，第三遍 ${row.passThree} / ${row.total}，平均熟悉度 ${row.averageLevel.toFixed(1)}，L1 到 L5 分别为 ${row.levels.join("、")}">
        <div class="group-progress-top"><span>G${row.number}</span><strong class="group-progress-stage">${stageLabel}</strong></div>
        <span class="group-level-average">熟悉度 ${row.averageLevel.toFixed(1)} · 平均 ${row.averagePasses.toFixed(1)} 遍</span>
        <div class="group-pass-tracks" aria-hidden="true">
          <div class="group-pass-track pass-one"><span><i>I</i>完整认识</span><strong>${row.passOne}/${row.total}</strong><em><u style="--pass-progress:${row.passOnePercent}%"></u></em></div>
          <div class="group-pass-track pass-two"><span><i>II</i>词义关系</span><strong>${row.passTwo}/${row.total}</strong><em><u style="--pass-progress:${row.passTwoPercent}%"></u></em></div>
          <div class="group-pass-track pass-three"><span><i>III</i>语境阅读</span><strong>${row.passThree}/${row.total}</strong><em><u style="--pass-progress:${row.passThreePercent}%"></u></em></div>
        </div>
        <div class="group-level-bar" aria-hidden="true">${row.levels.map((count, index) => `<i class="level-${index + 1}" style="--level-width:${row.total ? count / row.total * 100 : 0}%"></i>`).join("")}</div>
        <div class="group-level-counts" aria-hidden="true">${row.levels.map((count, index) => `<span class="level-${index + 1}">L${index + 1} <b>${count}</b></span>`).join("")}</div>
      </button>`;
    }).join("") : `<p class="group-progress-empty">这个筛选下暂时没有 Group。</p>`;
    groupProgressGrid.querySelectorAll("[data-progress-group]").forEach(button => button.addEventListener("click", () => {
      state.group = Number(button.dataset.progressGroup);
      const words = currentWords();
      const firstUnfinished = words.findIndex(word => !isPassComplete(word.id, Number(state.studyPass)));
      state.index = firstUnfinished >= 0 ? firstUnfinished : 0;
      savePassIndex();
      persist();
      renderGroup();
      document.getElementById("group-study")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }));
  }

  function splitSizes(length) {
    if (length === 10) return [3, 3, 4];
    const first = Math.floor(length / 3);
    const second = Math.floor((length - first) / 2);
    return [first, second, length - first - second];
  }

  const READING_SPLIT_VERSION = 4;
  const SEMANTIC_STOP_WORDS = new Set("a an the of to and or in on for with from by as at be is are was were been being this that these those someone something person people thing things act action state way especially more most very having have has had into about one another reference used use make made become cause causing relating according given full not".split(" "));
  const SEMANTIC_THEMES = {
    emotion: "mood gloomy sad depressed despair confidence self esteem happiness calm angry fear anxious disposition enthusiasm spirit dejected emotional contempt mocking".split(" "),
    conflict: "conflict collision clash confrontation strike violent crime murder danger opposition dispute war attack divided apart".split(" "),
    boundary: "boundary border limit division divide divided apart separation line maritime region place latitude".split(" "),
    reasoning: "claim argument evidence reason explain relevant appropriate suitable important description principle rule meaning distinction conclusion".split(" "),
    quantity: "amount excessive large many much enough adequate excess scarcity numerous quantity produce provide yield".split(" "),
    method: "plan purpose irregular twisting network method process order random sporadic follow conform course structure".split(" "),
    society: "court judge judicial law policy public committee society money wealthy crime organization activity financially".split(" "),
    science: "study scientific natural reaction catalyst enzyme telescope astronomical solid liquid solution equipment phenomenon".split(" "),
    language: "word language prose poetic style diction remark tone speaking writing author sentence description".split(" "),
    agency: "help ask support encourage discourage ability aware deliberate choose attempt decision responsibility".split(" ")
  };
  const semanticTokenCache = new Map();
  const semanticThemeCache = new Map();
  const semanticPairCache = new Map();

  function semanticTokens(word) {
    if (semanticTokenCache.has(word?.id)) return semanticTokenCache.get(word.id);
    const tokens = new Set(`${word?.id || ""} ${word?.definition || ""}`.toLowerCase().replace(/[^a-z'-]+/g, " ").split(/\s+/).filter(token => token.length > 2 && !SEMANTIC_STOP_WORDS.has(token)));
    semanticTokenCache.set(word?.id, tokens);
    return tokens;
  }

  function semanticThemeScores(word) {
    if (semanticThemeCache.has(word?.id)) return semanticThemeCache.get(word.id);
    const tokens = semanticTokens(word);
    const scores = Object.fromEntries(Object.entries(SEMANTIC_THEMES).map(([theme, markers]) => [theme, markers.reduce((score, marker) => score + Number(tokens.has(marker)), 0)]));
    semanticThemeCache.set(word?.id, scores);
    return scores;
  }

  function directRelationScore(first, second) {
    const row = (relationIndex.get(first.id) || []).find(entry => entry.id === second.id);
    if (!row) return 0;
    if (row.type === "synonym") return 8 * row.strength;
    if (row.type === "antonym") return 6.4 * row.strength;
    return 2.2 * row.strength;
  }

  function semanticCompatibility(first, second) {
    const pairKey = [first.id, second.id].sort().join("|");
    if (semanticPairCache.has(pairKey)) return semanticPairCache.get(pairKey);
    const firstTokens = semanticTokens(first);
    const secondTokens = semanticTokens(second);
    const overlap = [...firstTokens].filter(token => secondTokens.has(token)).length;
    const union = new Set([...firstTokens, ...secondTokens]).size || 1;
    const firstThemes = semanticThemeScores(first);
    const secondThemes = semanticThemeScores(second);
    const sharedTheme = Object.keys(SEMANTIC_THEMES).reduce((score, theme) => score + Math.min(firstThemes[theme], secondThemes[theme]), 0);
    const contrastingParts = String(first.pos || "") !== String(second.pos || "") ? 0.35 : 0;
    const score = directRelationScore(first, second) + (overlap / union) * 7 + Math.min(4.5, sharedTheme * 1.25) + contrastingParts;
    semanticPairCache.set(pairKey, score);
    return score;
  }

  function combinations(items, size) {
    const result = [];
    const visit = (start, selected) => {
      if (selected.length === size) {
        result.push(selected);
        return;
      }
      for (let index = start; index <= items.length - (size - selected.length); index += 1) visit(index + 1, [...selected, items[index]]);
    };
    visit(0, []);
    return result;
  }

  function scoreSemanticSplit(parts, byId) {
    return parts.reduce((total, part) => {
      const words = part.map(id => byId.get(id)).filter(Boolean);
      let partScore = 0;
      words.forEach((word, index) => words.slice(index + 1).forEach(other => { partScore += semanticCompatibility(word, other); }));
      const posVariety = new Set(words.map(word => String(word.pos || "").split(/[;,/]/)[0])).size;
      return total + partScore / Math.max(1, words.length - 1) + posVariety * 0.45;
    }, 0);
  }

  function semanticReadingSplit(words) {
    const ids = words.map(word => word.id);
    const sizes = splitSizes(ids.length);
    const byId = new Map(words.map(word => [word.id, word]));
    if (sizes.some(size => size <= 0)) {
      const nonEmpty = ids.map(id => [id]);
      while (nonEmpty.length < 3) nonEmpty.push([]);
      return nonEmpty.slice(0, 3);
    }
    let best = null;
    combinations(ids, sizes[0]).forEach(first => {
      const firstSet = new Set(first);
      const remaining = ids.filter(id => !firstSet.has(id));
      combinations(remaining, sizes[1]).forEach(second => {
        const secondSet = new Set(second);
        const third = remaining.filter(id => !secondSet.has(id));
        const parts = [first, second, third];
        const signature = parts.map(part => [...part].sort().join("|")).sort().join("::");
        const score = scoreSemanticSplit(parts, byId);
        if (!best || score > best.score || (score === best.score && signature < best.signature)) best = { parts, score, signature };
      });
    });
    return best?.parts || [ids.slice(0, sizes[0]), ids.slice(sizes[0], sizes[0] + sizes[1]), ids.slice(sizes[0] + sizes[1])];
  }

  function readingFingerprint(group, variantId, ids) {
    return `${Number(group)}|${Number(variantId)}|${[...(ids || [])].sort((a, b) => a.localeCompare(b)).join(",")}`;
  }

  function readingRecordFingerprint(record) {
    if (record?.fingerprint) return record.fingerprint;
    const keyParts = String(record?.key || "").split("|");
    const variantId = Number.isFinite(Number(record?.variantId)) ? Number(record.variantId) : Number(keyParts[2]);
    return readingFingerprint(record?.group, variantId, record?.words || String(keyParts[3] || "").split(",").filter(Boolean));
  }

  function novelReadingPlan(words) {
    const curated = architectReadingsForGroup(Number(state.group));
    const split = curated
      ? curated.map(reading => [...reading.wordIds])
      : semanticReadingSplit(words);
    return { split, variants: [0, 1, 2], unseen: 3, score: scoreSemanticSplit(split, new Map(words.map(word => [word.id, word]))) };
  }

  function buildSplit(force = false) {
    const key = String(state.group);
    const words = currentWords();
    const savedIds = Array.isArray(state.splits[key]) ? state.splits[key].flat() : [];
    const validSaved = savedIds.length === words.length && savedIds.every(id => words.some(word => word.id === id));
    const validVariants = Array.isArray(state.variants?.[key]) && state.variants[key].length === 3;
    const currentVersion = Number(state.splitVersions?.[key]) || 0;
    const curated = architectReadingsForGroup(Number(state.group));
    const curatedSplitMatches = !curated || (Array.isArray(state.splits[key]) && curated.every((reading, index) => {
      const savedPart = [...(state.splits[key][index] || [])].sort().join("|");
      return savedPart === [...reading.wordIds].sort().join("|");
    }));
    if (force || !validSaved || !validVariants || currentVersion !== READING_SPLIT_VERSION || !curatedSplitMatches) {
      const plan = novelReadingPlan(words);
      state.splits[key] = plan.split;
      state.variants = state.variants || {};
      state.variants[key] = plan.variants;
      state.splitVersions = state.splitVersions || {};
      state.splitVersions[key] = READING_SPLIT_VERSION;
      state.lastReadingShuffle = { group: Number(state.group), unseen: 3, generatedAt: Date.now(), fixedSet: true };
      if (force) {
        Object.keys(state.readingDrafts || {}).filter(draftKey => draftKey.startsWith(`${state.group}|3|`)).forEach(draftKey => delete state.readingDrafts[draftKey]);
        rewardMessage = "已恢复这个 Group 固定的三篇精读；词组按语义关系排列，不再随机制造更多题目。";
      }
    }
    persist();
    return state.splits[key];
  }

  function relationCards(entries, type) {
    if (!entries.length) return `<p class="study-relation-empty">暂无足够明确的${type === "synonym" ? "同义" : "反义"}关系，不为凑数量强行连线。</p>`;
    return entries.map(entry => {
      const percent = Math.round(entry.strength * 100);
      const meaning = entry.word?.zh || entry.word?.definition || "点击后在上方星系查看";
      return `<button type="button" class="study-relation-card" data-study-related="${escapeHtml(entry.id)}" style="--relation-strength:${percent}%">
        <div><strong>${escapeHtml(entry.id)}</strong><small>${escapeHtml(entry.word && window.getLexicalPosLabel ? window.getLexicalPosLabel(entry.word) : (entry.word?.pos || "related word"))}</small><b>${percent}%</b></div>
        <p>${escapeHtml(meaning)}</p>
        <i><span></span></i><em>${relationLabel(type, entry.strength)}</em>
      </button>`;
    }).join("");
  }

  function renderStudyFlow() {
    const words = currentWords();
    const sprintValue = Math.max(0, Math.min(9, Number(state.sprintProgress) || 0));
    const count = document.getElementById("study-sprint-count");
    const fill = document.getElementById("study-sprint-fill");
    const preview = document.getElementById("study-next-preview");
    const recallSummary = document.getElementById("study-recall-summary");
    const rescueSummary = document.getElementById("study-rescue-summary");
    if (count) count.textContent = `${sprintValue} / 10 · 已完成 ${Number(state.totalSprints) || 0} 轮`;
    if (fill) fill.style.width = `${sprintValue * 10}%`;
    if (recallSummary) {
      const attempts = Number(state.recallStats?.attempts) || 0;
      const correct = Number(state.recallStats?.correct) || 0;
      const accuracy = attempts ? Math.round(correct / attempts * 100) : 0;
      recallSummary.textContent = attempts
        ? `主动回忆 ${correct}/${attempts} · ${accuracy}% · 当前连续命中 ${Number(state.recallStats?.streak) || 0}`
        : "二刷每 5 词触发一次主动回忆检查";
    }
    if (rescueSummary) {
      const queueSize = state.rescueQueue.length;
      const nextDue = queueSize ? Math.min(...state.rescueQueue.map(entry => Math.max(0, Number(entry.dueStep) - state.rescueStep))) : 0;
      rescueSummary.classList.toggle("has-queue", queueSize > 0);
      rescueSummary.textContent = queueSize
        ? `记忆救援 ${queueSize} 词 · ${nextDue > 0 ? `再过 ${nextDue} 词重现` : "即将穿插重现"} · 已救回 ${state.rescueStats.cleared}`
        : `记忆救援队列为空 · 已累计救回 ${state.rescueStats.cleared} 词`;
    }
    const next = words[state.index + 1];
    const groupPosition = groupNumbers.indexOf(Number(state.group));
    const nextGroup = groupNumbers[groupPosition + 1];
    const method = PASS_METHODS[Number(state.studyPass)] || PASS_METHODS[1];
    if (preview) preview.textContent = next
      ? `第 ${state.studyPass} 遍 · ${method.title} · 评级后进入 ${next.id}`
      : nextGroup
        ? `本组第 ${state.studyPass} 遍最后一词 · 完成后进入 Group ${nextGroup}`
        : "已经到达最后一颗单词";
  }

  function renderPassSelector() {
    const words = currentWords();
    [1, 2, 3].forEach(pass => {
      const count = groupPassCount(pass, words);
      const label = document.getElementById(pass === 1 ? "study-pass-one-progress" : pass === 2 ? "study-pass-two-progress" : "study-pass-three-progress");
      if (label) label.textContent = `${count} / ${words.length}`;
    });
    document.querySelectorAll("[data-study-pass]").forEach(button => {
      button.setAttribute("aria-pressed", String(Number(button.dataset.studyPass) === Number(state.studyPass)));
    });
    const grid = document.getElementById("group-study-grid");
    if (grid) grid.dataset.activePass = String(state.studyPass);
    const heading = document.getElementById("study-pass-heading");
    if (heading) heading.textContent = state.studyPass === 1 ? "第一遍 · 完整认识" : state.studyPass === 2 ? "第二遍 · 例句与语义关系网" : "第三遍 · 原文阅读";
    const resume = document.getElementById("study-pass-resume");
    const count = groupPassCount(state.studyPass, words);
    if (resume) resume.innerHTML = `<strong>正在继续：第 ${state.studyPass} 遍 · ${escapeHtml(PASS_METHODS[state.studyPass].title)}</strong><span>Group ${state.group} 已完成 ${count}/${words.length}；切换遍数不会覆盖其他遍的进度。</span>`;
  }

  function familyGridHtml(word, family) {
    return family.members.length ? family.members.map(member => member.word
      ? `<button type="button" data-study-family="${escapeHtml(member.id)}"><strong>${escapeHtml(member.id)}</strong><small>${escapeHtml(window.getLexicalPosLabel ? window.getLexicalPosLabel(member.word) : (member.word.pos || "word"))}</small><span>${escapeHtml(member.meaning)}</span></button>`
      : `<div><strong>${escapeHtml(member.id)}</strong><small>词库外同源词</small><span>${escapeHtml(member.meaning)}</span></div>`).join("")
      : `<div class="study-family-anchor"><strong>${escapeHtml(word.id)} 的祖源</strong><span>${escapeHtml(window.getLexicalEtymology ? window.getLexicalEtymology(word) : word.etymology || "尚待核对")}</span></div>`;
  }

  function compactMeaning(word) {
    const source = String(word?.zh || word?.definition || "暂无释义");
    const compact = source.split("；").filter(Boolean).slice(0, 2).join("；");
    return compact.length > 92 ? `${compact.slice(0, 89)}…` : compact;
  }

  function studySensesHtml(word, compact = false) {
    const senses = window.getLexicalSenses ? window.getLexicalSenses(word) : [{ pos: word.pos, definition: word.definition, zh: word.zh }];
    return `<div class="study-senses ${senses.length > 1 ? "is-polysemous" : ""}">${senses.map(sense => `<article><span>${escapeHtml(sense.pos || "word")}</span><div>${!compact && sense.definition ? `<p>${escapeHtml(sense.definition)}</p>` : ""}<strong>${escapeHtml(sense.zh || sense.definition || "暂无释义")}</strong></div></article>`).join("")}</div>`;
  }

  function secondPassRelationCards(word, entries, type) {
    if (!entries.length) return `<p class="second-pass-relation-empty">暂无足够明确的${type === "synonym" ? "同义" : "反义"}关系，不为凑数量强行加入。</p>`;
    return entries.map(entry => {
      const related = entry.word || { id: entry.id, pos: "related word", definition: "点击后在星系中查看" };
      const percent = Math.round(entry.strength * 100);
      const samePos = String(word.pos || "").toLowerCase() === String(related.pos || "").toLowerCase();
      const strengthNote = type === "synonym"
        ? entry.strength >= .92 ? "核心语义高度重合，但搭配和语气仍可能不同。" : entry.strength >= .84 ? "核心方向相同，使用范围或强度有所区别。" : "只在部分语境中相近，不能直接处处替换。"
        : entry.strength >= .92 ? "核心意义形成直接对立，可作为正反联想记忆。" : entry.strength >= .84 ? "语义方向明显相反，但不一定适用于所有语境。" : "在特定维度上形成对照，需要结合句子判断。";
      const posNote = samePos ? `词性同为 ${word.pos || "word"}` : `词性不同：${word.pos || "word"} / ${related.pos || "word"}`;
      return `<button type="button" class="second-pass-relation-card ${type}" data-study-related="${escapeHtml(entry.id)}">
        <div class="second-pass-relation-top"><span>${escapeHtml(relationLabel(type, entry.strength))}</span><b>${percent}%</b></div>
        <div class="second-pass-meaning-compare"><span><small>${escapeHtml(word.id)}</small><strong>${escapeHtml(compactMeaning(word))}</strong></span><i>${type === "synonym" ? "≈" : "↔"}</i><span><small>${escapeHtml(entry.id)}</small><strong>${escapeHtml(compactMeaning(related))}</strong></span></div>
        <p><b>${type === "synonym" ? "共同点" : "对立点"}</b>${escapeHtml(strengthNote)}<em>${escapeHtml(posNote)}</em></p>
        <blockquote><small>${escapeHtml(entry.id)} in context</small>${escapeHtml(related.example || related.definition || compactMeaning(related))}</blockquote>
      </button>`;
    }).join("");
  }

  function queueRecallCheckpoint() {
    if (state.pendingRecall || Number(state.studyPass) !== 2 || state.recallBuffer.length < 5) return false;
    const recentIds = [...new Set(state.recallBuffer.slice(-5))].filter(id => wordMap.has(id));
    if (recentIds.length < 4) return false;
    const target = recentIds.map(id => wordMap.get(id)).sort((a, b) => Number(a.level || 1) - Number(b.level || 1) || hashForRecall(a.id) - hashForRecall(b.id))[0];
    const seenMeanings = new Set([compactMeaning(target)]);
    const distractors = currentWords()
      .filter(word => word.id !== target.id)
      .sort((a, b) => hashForRecall(`${target.id}|${a.id}`) - hashForRecall(`${target.id}|${b.id}`))
      .filter(word => {
        const meaning = compactMeaning(word);
        if (!meaning || seenMeanings.has(meaning)) return false;
        seenMeanings.add(meaning);
        return true;
      })
      .slice(0, 3);
    if (distractors.length < 3) return false;
    const optionIds = [target, ...distractors]
      .sort((a, b) => hashForRecall(`${target.id}|option|${a.id}`) - hashForRecall(`${target.id}|option|${b.id}`))
      .map(word => word.id);
    state.pendingRecall = {
      id: `recall|${target.id}|${Date.now()}`,
      targetId: target.id,
      optionIds,
      sourceIds: recentIds,
      group: Number(state.group),
      createdAt: Date.now(),
      answeredAt: null,
      selectedId: null,
      correct: null,
      xp: 0
    };
    state.recallBuffer = [];
    persist();
    return true;
  }

  function hashForRecall(value) {
    let hash = 2166136261;
    const text = String(value || "");
    for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
    return (hash >>> 0) / 4294967295;
  }

  function enqueueRescue(id, delay = 4, source = "weak-rating", reschedule = false) {
    if (!wordMap.has(id)) return;
    const dueStep = state.rescueStep + Math.max(2, Number(delay) || 4);
    const existing = state.rescueQueue.find(entry => entry.id === id);
    if (existing) {
      existing.dueStep = reschedule ? dueStep : Math.min(Number(existing.dueStep) || dueStep, dueStep);
      existing.source = source || existing.source;
    } else {
      state.rescueQueue.push({ id, dueStep, attempts: 0, source, addedAt: Date.now() });
      if (state.rescueQueue.length > 80) state.rescueQueue = state.rescueQueue.slice(-80);
    }
  }

  function rescueOptions(target) {
    const seenIds = new Set([target.id]);
    const seenMeanings = new Set([compactMeaning(target)]);
    const sameGroup = satWords.filter(word => word.group === target.group);
    const samePos = satWords.filter(word => word.pos === target.pos);
    const pool = [...currentWords(), ...sameGroup, ...samePos, ...satWords];
    const unique = pool.filter(word => {
      if (!word || seenIds.has(word.id)) return false;
      seenIds.add(word.id);
      return true;
    }).sort((a, b) => hashForRecall(`${target.id}|rescue|${a.id}`) - hashForRecall(`${target.id}|rescue|${b.id}`));
    const distractors = unique.filter(word => {
      const meaning = compactMeaning(word);
      if (!meaning || seenMeanings.has(meaning)) return false;
      seenMeanings.add(meaning);
      return true;
    }).slice(0, 3);
    if (distractors.length < 3) return [];
    return [target, ...distractors]
      .sort((a, b) => hashForRecall(`${target.id}|rescue-option|${a.id}`) - hashForRecall(`${target.id}|rescue-option|${b.id}`));
  }

  function activateRescueIfDue() {
    if (state.pendingRescue || state.pendingRecall || ![1, 2].includes(Number(state.studyPass))) return false;
    if (state.rescueStep < state.rescueNextEligibleStep) return false;
    const due = state.rescueQueue
      .filter(entry => Number(entry.dueStep) <= state.rescueStep && wordMap.has(entry.id))
      .sort((a, b) => Number(a.dueStep) - Number(b.dueStep) || Number(a.addedAt) - Number(b.addedAt));
    const entry = due[0];
    if (!entry) return false;
    const target = wordMap.get(entry.id);
    const options = rescueOptions(target);
    if (options.length < 4) return false;
    state.pendingRescue = {
      id: `rescue|${target.id}|${Date.now()}`,
      targetId: target.id,
      optionIds: options.map(word => word.id),
      createdAt: Date.now(),
      answeredAt: null,
      selectedId: null,
      correct: null,
      xp: 0,
      promotedFrom: null,
      promotedTo: null
    };
    persist();
    return true;
  }

  function answerRescueCheckpoint(selectedId) {
    const checkpoint = state.pendingRescue;
    if (!checkpoint || checkpoint.answeredAt || !checkpoint.optionIds.includes(selectedId)) return;
    const target = wordMap.get(checkpoint.targetId);
    const queueEntry = state.rescueQueue.find(entry => entry.id === checkpoint.targetId);
    if (!target || !queueEntry) return;
    const correct = selectedId === target.id;
    state.rescueStep += 1;
    state.rescueStats.attempts += 1;
    let xp = 4;
    if (correct) {
      const oldLevel = Math.max(1, Number(target.level) || 1);
      const newLevel = oldLevel >= 3 ? oldLevel : oldLevel + 1;
      target.level = newLevel;
      levelStore[target.id] = newLevel;
      state.rescueQueue = state.rescueQueue.filter(entry => entry.id !== target.id);
      state.rescueStats.correct += 1;
      state.rescueStats.cleared += 1;
      const clearBonus = state.rescueQueue.length === 0 ? 8 : 0;
      xp = 22 + clearBonus;
      checkpoint.promotedFrom = oldLevel;
      checkpoint.promotedTo = newLevel;
      localStorage.setItem("lexiverse-levels", JSON.stringify(levelStore));
      window.LexiversePasses?.increment(target.id, "memory-rescue");
      window.dispatchEvent(new CustomEvent("lexiverse-level-change", { detail: { id: target.id, level: newLevel, source: "memory-rescue" } }));
      rewardMessage = `✓ ${target.id} 延迟提取成功 · L${oldLevel} → L${newLevel} · +${xp} XP${clearBonus ? "，救援队列已清空" : ""}。`;
    } else {
      target.level = Math.min(Number(target.level) || 1, 2);
      levelStore[target.id] = target.level;
      queueEntry.attempts = Number(queueEntry.attempts || 0) + 1;
      queueEntry.dueStep = state.rescueStep + 4;
      localStorage.setItem("lexiverse-levels", JSON.stringify(levelStore));
      scheduleUrgentReview(target);
      window.dispatchEvent(new CustomEvent("lexiverse-level-change", { detail: { id: target.id, level: target.level, source: "memory-rescue" } }));
      rewardMessage = `${target.id} 仍需加固，隔开 4 词后再来 · +${xp} XP，不扣连击。`;
    }
    state.totalXp = (Number(state.totalXp) || 0) + xp;
    state.rescueNextEligibleStep = state.rescueStep + 3;
    checkpoint.answeredAt = Date.now();
    checkpoint.selectedId = selectedId;
    checkpoint.correct = correct;
    checkpoint.xp = xp;
    persist();
    renderRescueCheckpoint();
    renderStats();
    renderRewardBar();
  }

  function renderRescueCheckpoint() {
    const checkpoint = state.pendingRescue;
    const target = checkpoint && wordMap.get(checkpoint.targetId);
    const queueEntry = target && state.rescueQueue.find(entry => entry.id === target.id);
    if (!checkpoint || !target || (!queueEntry && !checkpoint.correct)) {
      state.pendingRescue = null;
      persist();
      renderWord();
      return;
    }
    const options = checkpoint.optionIds.map(id => wordMap.get(id)).filter(Boolean);
    const queueSize = state.rescueQueue.length;
    const successRate = state.rescueStats.attempts ? Math.round(state.rescueStats.correct / state.rescueStats.attempts * 100) : 0;
    const card = document.querySelector(".sequence-study-card");
    card?.classList.add("recall-checkpoint-active", "memory-rescue-active");
    document.getElementById("study-word-position").textContent = "记忆救援";
    document.getElementById("study-group-progress").textContent = `延迟再现 · 队列 ${queueSize} 词`;
    wordCard.innerHTML = `<section class="recall-checkpoint memory-rescue-checkpoint ${checkpoint.answeredAt ? "answered" : ""}">
      <div class="recall-checkpoint-top"><span><i></i> MEMORY RESCUE</span><div><b>隔开若干词后重现</b><strong>救回 ${state.rescueStats.cleared} · ${successRate}%</strong></div></div>
      <div class="recall-checkpoint-prompt"><small>不要回看卡片，先主动提取</small><h3>${escapeHtml(target.id)}</h3><span>${escapeHtml(window.getLexicalPosLabel ? window.getLexicalPosLabel(target) : target.pos || "word")}</span><p>这个薄弱词最准确的核心意思是什么？</p></div>
      <div class="recall-checkpoint-options">${options.map((word, index) => {
        const isCorrect = word.id === target.id;
        const isSelected = word.id === checkpoint.selectedId;
        const resultClass = checkpoint.answeredAt ? isCorrect ? "correct" : isSelected ? "incorrect" : "dimmed" : "";
        return `<button type="button" data-rescue-choice="${escapeHtml(word.id)}" class="${resultClass}" ${checkpoint.answeredAt ? "disabled" : ""}><kbd>${String.fromCharCode(65 + index)}</kbd><span>${escapeHtml(compactMeaning(word))}</span></button>`;
      }).join("")}</div>
      <div class="recall-checkpoint-result ${checkpoint.answeredAt ? checkpoint.correct ? "correct" : "incorrect" : ""}" ${checkpoint.answeredAt ? "" : "hidden"}>
        <strong>${checkpoint.correct ? `✓ 救援成功 · 熟悉度 L${checkpoint.promotedFrom} → L${checkpoint.promotedTo} · +${checkpoint.xp} XP` : `暂未提取成功 · 正确答案是 ${escapeHtml(target.id)}`}</strong>
        <p>${escapeHtml(compactMeaning(target))}</p>
        <blockquote>${escapeHtml(target.example || target.definition || "")}</blockquote>
        <button type="button" class="primary-button" data-rescue-continue>回到主线 <kbd>Enter</kbd></button>
      </div>
      ${checkpoint.answeredAt ? "" : `<button type="button" class="recall-checkpoint-skip" data-rescue-skip>先回到主线，稍后再出现</button>`}
      <p class="recall-checkpoint-note">L1–L2 词不会被连续轰炸；系统会穿插 3–5 个其他词后再让它出现。</p>
    </section>`;
    wordCard.querySelectorAll("[data-rescue-choice]").forEach(button => button.addEventListener("click", () => answerRescueCheckpoint(button.dataset.rescueChoice)));
    wordCard.querySelector("[data-rescue-continue]")?.addEventListener("click", () => {
      state.pendingRescue = null;
      persist();
      card?.classList.remove("recall-checkpoint-active", "memory-rescue-active");
      renderWord();
    });
    wordCard.querySelector("[data-rescue-skip]")?.addEventListener("click", () => {
      if (queueEntry) queueEntry.dueStep = Math.max(Number(queueEntry.dueStep) || 0, state.rescueStep + 2);
      state.rescueNextEligibleStep = state.rescueStep + 3;
      state.pendingRescue = null;
      rewardMessage = `${target.id} 保留在救援队列，稍后再出现；主线继续。`;
      persist();
      card?.classList.remove("recall-checkpoint-active", "memory-rescue-active");
      renderWord();
    });
    wordStrip.innerHTML = `<span class="recall-strip-label rescue-strip-label"><i></i> 薄弱词延迟重现：答对后自动升一级并清出队列</span>`;
    renderStudyFlow();
    const preview = document.getElementById("study-next-preview");
    if (preview) preview.textContent = checkpoint.answeredAt ? "查看反馈后按 Enter 回到主线" : "选择 A–D；答错会隔开 4 词后再来";
    renderRewardBar();
    window.dispatchEvent(new CustomEvent("lexiverse-select-word", { detail: { id: target.id, source: "memory-rescue" } }));
  }

  function scheduleUrgentReview(word) {
    let store = {};
    try { store = JSON.parse(localStorage.getItem("lexiverse-review-v1")) || {}; } catch {}
    const now = Date.now();
    store[word.id] = { ...(store[word.id] || {}), streak: 0, lastReviewed: now, nextReview: now + 10 * 60 * 1000 };
    localStorage.setItem("lexiverse-review-v1", JSON.stringify(store));
  }

  function answerRecallCheckpoint(selectedId) {
    const checkpoint = state.pendingRecall;
    if (!checkpoint || checkpoint.answeredAt || !checkpoint.optionIds.includes(selectedId)) return;
    const target = wordMap.get(checkpoint.targetId);
    if (!target) return;
    const correct = selectedId === target.id;
    state.recallStats.attempts += 1;
    if (correct) {
      state.recallStats.correct += 1;
      state.recallStats.streak += 1;
      state.recallStats.bestStreak = Math.max(state.recallStats.bestStreak, state.recallStats.streak);
    } else {
      state.recallStats.streak = 0;
      target.level = Math.min(Number(target.level) || 1, 2);
      levelStore[target.id] = target.level;
      enqueueRescue(target.id, 3, "recall-miss", true);
      localStorage.setItem("lexiverse-levels", JSON.stringify(levelStore));
      scheduleUrgentReview(target);
      window.dispatchEvent(new CustomEvent("lexiverse-level-change", { detail: { id: target.id, level: target.level, source: "recall-checkpoint" } }));
    }
    const streakBonus = correct && state.recallStats.streak > 0 && state.recallStats.streak % 3 === 0 ? 12 : 0;
    const xp = correct ? 18 + streakBonus : 4;
    state.totalXp = (Number(state.totalXp) || 0) + xp;
    state.rescueNextEligibleStep = Math.max(state.rescueNextEligibleStep, state.rescueStep + 2);
    checkpoint.answeredAt = Date.now();
    checkpoint.selectedId = selectedId;
    checkpoint.correct = correct;
    checkpoint.xp = xp;
    rewardMessage = correct
      ? `主动回忆正确 · +${xp} XP${streakBonus ? "（连续命中加成）" : ""}。这次记忆比单纯重看更牢。`
      : `${target.id} 已放入 10 分钟紧急复习轨道 · +${xp} XP，不扣连击。`;
    persist();
    renderRecallCheckpoint();
    renderStats();
    renderRewardBar();
  }

  function renderRecallCheckpoint() {
    const checkpoint = state.pendingRecall;
    const target = checkpoint && wordMap.get(checkpoint.targetId);
    if (!checkpoint || !target) {
      state.pendingRecall = null;
      persist();
      renderWord();
      return;
    }
    const options = checkpoint.optionIds.map(id => wordMap.get(id)).filter(Boolean);
    const stats = state.recallStats;
    const accuracy = stats.attempts ? Math.round(stats.correct / stats.attempts * 100) : 0;
    document.querySelector(".sequence-study-card")?.classList.add("recall-checkpoint-active");
    document.getElementById("study-word-position").textContent = "记忆检查";
    document.getElementById("study-group-progress").textContent = `Group ${checkpoint.group} · 二刷主动提取检查`;
    wordCard.innerHTML = `<section class="recall-checkpoint ${checkpoint.answeredAt ? "answered" : ""}">
      <div class="recall-checkpoint-top"><span><i></i> RETRIEVAL CHECKPOINT</span><div><b>每 5 词一次</b><strong>${stats.correct}/${stats.attempts} · ${accuracy}%</strong></div></div>
      <div class="recall-checkpoint-prompt"><small>不要回看，先从记忆中提取</small><h3>${escapeHtml(target.id)}</h3><span>${escapeHtml(window.getLexicalPosLabel ? window.getLexicalPosLabel(target) : target.pos || "word")}</span><p>哪个选项最准确地表达这个词的核心意思？</p></div>
      <div class="recall-checkpoint-options">${options.map((word, index) => {
        const isCorrect = word.id === target.id;
        const isSelected = word.id === checkpoint.selectedId;
        const resultClass = checkpoint.answeredAt ? isCorrect ? "correct" : isSelected ? "incorrect" : "dimmed" : "";
        return `<button type="button" data-recall-choice="${escapeHtml(word.id)}" class="${resultClass}" ${checkpoint.answeredAt ? "disabled" : ""}><kbd>${String.fromCharCode(65 + index)}</kbd><span>${escapeHtml(compactMeaning(word))}</span></button>`;
      }).join("")}</div>
      <div class="recall-checkpoint-result ${checkpoint.answeredAt ? checkpoint.correct ? "correct" : "incorrect" : ""}" ${checkpoint.answeredAt ? "" : "hidden"}>
        <strong>${checkpoint.correct ? `✓ 提取成功 · +${checkpoint.xp} XP` : `需要加固 · 正确答案是 ${escapeHtml(target.id)}`}</strong>
        <p>${escapeHtml(compactMeaning(target))}</p>
        <blockquote>${escapeHtml(target.example || target.definition || "")}</blockquote>
        <button type="button" class="primary-button" data-recall-continue>继续下一词 <kbd>Enter</kbd></button>
      </div>
      ${checkpoint.answeredAt ? "" : `<button type="button" class="recall-checkpoint-skip" data-recall-skip>暂时跳过，继续学习</button>`}
      <p class="recall-checkpoint-note">主动提取比重复阅读更能暴露记忆漏洞；答错不会扣 XP 或中断今日连击。</p>
    </section>`;
    wordCard.querySelectorAll("[data-recall-choice]").forEach(button => button.addEventListener("click", () => answerRecallCheckpoint(button.dataset.recallChoice)));
    wordCard.querySelector("[data-recall-continue]")?.addEventListener("click", () => {
      state.pendingRecall = null;
      persist();
      document.querySelector(".sequence-study-card")?.classList.remove("recall-checkpoint-active");
      renderWord();
    });
    wordCard.querySelector("[data-recall-skip]")?.addEventListener("click", () => {
      scheduleUrgentReview(target);
      enqueueRescue(target.id, 4, "recall-skip");
      state.rescueNextEligibleStep = Math.max(state.rescueNextEligibleStep, state.rescueStep + 2);
      state.pendingRecall = null;
      rewardMessage = `${target.id} 已加入稍后复习；继续保持当前学习节奏。`;
      persist();
      document.querySelector(".sequence-study-card")?.classList.remove("recall-checkpoint-active");
      renderWord();
    });
    wordStrip.innerHTML = `<span class="recall-strip-label"><i></i> 已完成 5 个词，现在用一次主动回忆把记忆锁住</span>`;
    renderStudyFlow();
    const preview = document.getElementById("study-next-preview");
    if (preview) preview.textContent = checkpoint.answeredAt ? "查看反馈后按 Enter 继续" : "选择 A–D；答错会自动进入紧急复习";
    renderRewardBar();
    window.dispatchEvent(new CustomEvent("lexiverse-select-word", { detail: { id: target.id, source: "recall-checkpoint" } }));
  }

  function renderWord() {
    const words = currentWords();
    if (!words.length) return;
    if (state.pendingRecall && Number(state.studyPass) === 2) {
      renderRecallCheckpoint();
      return;
    }
    if (state.pendingRescue && [1, 2].includes(Number(state.studyPass))) {
      renderRescueCheckpoint();
      return;
    }
    if (activateRescueIfDue()) {
      renderRescueCheckpoint();
      return;
    }
    document.querySelector(".sequence-study-card")?.classList.remove("recall-checkpoint-active", "memory-rescue-active");
    state.index = Math.max(0, Math.min(Number(state.index) || 0, words.length - 1));
    const word = words[state.index];
    const synonyms = relatedEntries(word.id, "synonym", 4);
    const antonyms = relatedEntries(word.id, "antonym", 4);
    const family = familyFor(word);
    const completed = Boolean(state.completed[word.id]);
    const currentPass = Number(state.studyPass) === 2 ? 2 : 1;
    const currentPassComplete = isPassComplete(word.id, currentPass);
    const passCount = Math.max(currentPass, window.LexiversePasses?.get(word.id) || (completed ? 2 : 1));
    document.getElementById("study-word-position").textContent = `${state.index + 1} / ${words.length}`;
    const rating = `<div class="study-inline-flow" role="group" aria-label="熟悉度评级并进入下一词">
        <span><b>我的熟悉度 · 评级后记录第 ${currentPass} 遍并自动前进</b><small>直接按 1–5；← → 浏览</small></span>
        ${[[1, "陌生"], [2, "模糊"], [3, "想起"], [4, "掌握"], [5, "秒反应"]].map(([level, label]) => `<button type="button" data-inline-flow-level="${level}" class="level-${level} ${Number(word.level) === level ? "active" : ""}" aria-label="熟悉度 ${level}，${label}，保存并进入下一词"><kbd>${level}</kbd>${label}</button>`).join("")}
      </div>`;
    const posLabel = window.getLexicalPosLabel ? window.getLexicalPosLabel(word) : word.pos;
    const meta = `<div class="study-word-meta"><span>词性 · ${escapeHtml(posLabel)}</span><span>${escapeHtml(word.group)}</span><span class="${currentPassComplete ? "is-complete" : ""}">${currentPassComplete ? `第 ${currentPass} 遍已记录` : `待完成第 ${currentPass} 遍`}</span><span class="study-pass-count">累计 ${passCount} 遍</span></div>`;
    if (currentPass === 2) {
      wordCard.innerHTML = `${meta}
        <div class="second-pass-focus"><span>PASS II · EXAMPLE + RELATION NETWORK</span><h3>${escapeHtml(word.id)}</h3><small>${escapeHtml(posLabel)}</small>
          ${studySensesHtml(word, true)}
          <p class="second-pass-rule">这一遍用“意思 + 例句 + 同义词 + 反义词 + 同源词”建立关系网；仍然不刷阅读，阅读只属于第三遍。</p>
        </div>
        <section class="second-pass-example"><span>CURRENT WORD IN CONTEXT</span><blockquote>${escapeHtml(word.example || word.definition)}</blockquote></section>
        ${rating}
        <section class="second-pass-relations">
          <div class="second-pass-relations-heading"><div><strong>同义与反义 · 看清为什么相同</strong><span>先比较中文核心义，再看强度、词性和对比例句</span></div><b>${escapeHtml(word.id)}</b></div>
          <div class="second-pass-relation-columns"><article class="synonym"><header><i></i><strong>同义词 · 共同方向</strong></header>${secondPassRelationCards(word, synonyms, "synonym")}</article><article class="antonym"><header><i></i><strong>反义词 · 对立方向</strong></header>${secondPassRelationCards(word, antonyms, "antonym")}</article></div>
        </section>
        <section class="study-word-family second-pass-family">
          <div class="study-family-heading"><div><strong>同源词族 · 看清从哪里相同</strong><span>共享历史词根，但经过不同前后缀后，现代意义可能分化</span></div><b>${escapeHtml(family.root)}</b></div>
          <p class="second-pass-family-logic"><strong>共同点：</strong>来自同一词根或历史来源。<b>重要边界：</b>同源不等于同义，必须逐个对照下面的现代意思。</p>
          <div class="study-family-grid">${familyGridHtml(word, family)}</div>
        </section>
        ${passArchiveHtml(word)}`;
    } else {
      wordCard.innerHTML = `${meta}
      <h3>${escapeHtml(word.id)}</h3>
      <p class="study-phonetic">${escapeHtml(word.phonetic)}</p>
      ${studySensesHtml(word)}
      ${rating}
      <blockquote>${escapeHtml(word.example)}</blockquote>
      <section class="study-semantic-map">
        <div class="study-semantic-heading"><div><strong>语义关系图</strong><span>百分比越高，语义关系越强</span></div><b>${escapeHtml(word.id)}</b></div>
        <div class="study-semantic-columns">
          <article class="synonym"><header><i></i><strong>同义词 · 靠近</strong></header>${relationCards(synonyms, "synonym")}</article>
          <article class="antonym"><header><i></i><strong>反义词 · 相反</strong></header>${relationCards(antonyms, "antonym")}</article>
        </div>
        <small class="study-semantic-tip">点击关联词只会展开上方星系，当前背词卡不会跳走。</small>
      </section>
      <section class="study-word-family">
        <div class="study-family-heading"><div><strong>同源词族</strong><span>从一个词根扩展一串词</span></div><b>${escapeHtml(family.root)}</b></div>
        <div class="study-family-grid">${familyGridHtml(word, family)}</div>
      </section>
      <div class="study-origin"><strong>词源 · 拉丁语优先</strong><p>${escapeHtml(window.getLexicalEtymology ? window.getLexicalEtymology(word) : (word.etymology || "暂未找到可靠词源记录。"))}</p><strong>词源记忆</strong><p>${escapeHtml(word.memory || `把 ${word.id} 与例句语境绑定记忆。`)}</p></div>
      ${passArchiveHtml(word)}
      <button class="study-open-galaxy" type="button">在单词星系中查看关系</button>`;
    }
    wordCard.querySelector(".study-open-galaxy")?.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("lexiverse-select-word", { detail: { id: word.id } }));
      document.getElementById("word-detail")?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    wordCard.querySelectorAll("[data-inline-flow-level]").forEach(button => button.addEventListener("click", () => {
      rateAndAdvance(Number(button.dataset.inlineFlowLevel));
    }));
    wordCard.querySelectorAll("[data-study-related], [data-study-family]").forEach(button => button.addEventListener("click", () => {
      const id = button.dataset.studyRelated || button.dataset.studyFamily;
      window.dispatchEvent(new CustomEvent("lexiverse-select-word", { detail: { id, source: "group-study-relation" } }));
      button.classList.add("opened");
      setTimeout(() => button.classList.remove("opened"), 700);
    }));
    wordStrip.innerHTML = words.map((item, index) => `<button type="button" data-study-index="${index}" class="${index === state.index ? "active" : ""} ${isPassComplete(item.id, currentPass) ? "complete" : ""}" aria-label="${escapeHtml(item.id)}，第 ${currentPass} 遍${isPassComplete(item.id, currentPass) ? "已完成" : "待完成"}">${index + 1}</button>`).join("");
    wordStrip.querySelectorAll("[data-study-index]").forEach(button => button.addEventListener("click", () => {
      state.index = Number(button.dataset.studyIndex);
      savePassIndex();
      persist();
      renderWord();
    }));
    const completedCount = groupPassCount(currentPass, words);
    document.getElementById("study-group-progress").textContent = `Group ${state.group} · 第 ${currentPass} 遍：${completedCount} / ${words.length}`;
    savePassIndex();
    persist();
    renderPassSelector();
    renderStats();
    renderRewardBar();
    renderStudyFlow();
    window.dispatchEvent(new CustomEvent("lexiverse-select-word", { detail: { id: word.id, source: "group-study" } }));
  }

  const READING_BLUEPRINTS = [
    {
      domain: "Information and Ideas", skill: "Central Ideas and Details",
      opening: "A scholar studying precise diction compared several short excerpts drawn from contemporary research and criticism.",
      closing: "The scholar argues that replacing each highlighted term with a broad familiar phrase would make the excerpts easier but less exact.",
      question: "Which choice best states the main idea of the text?",
      choices: ["Precise vocabulary can preserve distinctions that broad paraphrases may erase.", "Every unfamiliar word necessarily makes a claim more accurate.", "Writers should never revise specialized language.", "The excerpts all address the same academic subject."],
      explanation: "The text values the target words because of the distinctions they preserve, not merely because they are difficult."
    },
    {
      domain: "Information and Ideas", skill: "Inferences",
      opening: "An editor examined how specialized vocabulary can change a reader's interpretation even when a passage's general subject remains constant.",
      closing: "According to the editor, accessibility matters, but a revision is unsuccessful when it erases the distinction carried by the original term.",
      question: "Which choice most logically follows from the text?",
      choices: ["A simpler replacement may be less effective when it removes an important distinction.", "Accessible prose is always less accurate than difficult prose.", "No reader can understand specialized vocabulary.", "Every highlighted term can be replaced without changing meaning."],
      explanation: "The editor supports accessibility only when the simpler wording preserves the original distinction."
    },
    {
      domain: "Craft and Structure", skill: "Text Structure and Purpose",
      opening: "A rhetoric researcher assembled a small archive to test whether difficult words merely decorate prose or preserve meaningful distinctions.",
      closing: "The researcher concludes that difficulty alone does not establish value; the relevant question is whether each term contributes precision that a simpler substitute would lose.",
      question: "What is the main function of the quoted excerpts in the text as a whole?",
      choices: ["They provide concrete cases for evaluating the claim about lexical precision.", "They prove that all contemporary research uses identical terminology.", "They introduce evidence that contradicts the researcher's question.", "They shift the discussion from language to biography."],
      explanation: "The excerpts serve as the evidence on which the researcher's conclusion about precision is based."
    },
    {
      domain: "Information and Ideas", skill: "Command of Evidence",
      opening: "A literary historian argues that the highlighted wording in several archival excerpts resulted from deliberate revision rather than accident.",
      closing: "The historian notes that the surviving drafts show careful attention to meaning, but acknowledges that the drafts alone do not reveal every reason for each choice.",
      question: "Which finding, if true, would most directly strengthen the historian's claim?",
      choices: ["Draft notes show the writers restoring the highlighted terms after testing broader alternatives.", "The excerpts were printed using several different typefaces.", "One archive contains more pages than the others.", "Modern readers disagree about which excerpt is most interesting."],
      explanation: "Restoring the terms after comparing alternatives is direct evidence of deliberate lexical choice."
    },
    {
      domain: "Craft and Structure", skill: "Words in Context",
      opening: "A linguist uses several excerpts to demonstrate that a word's contextual role cannot always be recovered from a loose dictionary synonym.",
      closing: "In each case, the surrounding sentence limits the relevant sense of the highlighted term and rules out at least one broader interpretation.",
      question: "Which choice best describes the linguist's view of context?",
      choices: ["Context helps determine which precise sense of a word is active.", "Context makes every possible definition equally likely.", "Dictionary meanings have no connection to usage.", "A difficult word has the same effect in every sentence."],
      explanation: "The linguist treats context as evidence for selecting the relevant, precise sense."
    },
    {
      domain: "Craft and Structure", skill: "Cross-Text Connections",
      opening: "Text 1 presents several excerpts as evidence that specialized terms can preserve distinctions. Text 2 favors familiar language but warns against revisions that alter an author's reasoning.",
      closing: "Although the texts begin from different priorities, both evaluate a revision by asking what meaning survives it.",
      question: "Which statement would the authors of both texts most likely agree with?",
      choices: ["A specialized term should be retained when a simpler replacement changes an essential distinction.", "Every uncommon word improves a passage.", "Accessibility should never influence editing.", "Meaning is unaffected by word choice."],
      explanation: "Both texts accept simplification in principle but reject it when essential meaning is lost."
    },
    {
      domain: "Information and Ideas", skill: "Central Ideas and Details",
      opening: "A study asked experienced readers to explain several excerpts before and after the highlighted terms were replaced with broad paraphrases.",
      closing: "Readers understood the general topics in both versions, but their descriptions of the revised passages were less specific.",
      question: "Which choice best states the study's principal finding?",
      choices: ["Broad paraphrases preserved general topics while reducing interpretive precision.", "Readers could understand only the revised passages.", "The highlighted terms prevented readers from identifying any topic.", "Specificity increased whenever a term was removed."],
      explanation: "The contrast is between stable general comprehension and reduced specificity after replacement."
    },
    {
      domain: "Craft and Structure", skill: "Text Structure and Purpose",
      opening: "A critic first quotes several passages and then supplies a brief gloss for each highlighted term.",
      closing: "Only after establishing those contextual meanings does the critic compare the passages' broader arguments.",
      question: "Why does the critic discuss the highlighted terms before comparing the arguments?",
      choices: ["To establish the lexical distinctions needed for the later comparison.", "To prove that the passages were written by the same person.", "To replace the passages with unrelated definitions.", "To show that none of the passages has an argument."],
      explanation: "The initial lexical analysis supplies the interpretive groundwork for the later comparison."
    },
    {
      domain: "Information and Ideas", skill: "Command of Evidence",
      opening: "A researcher claims that readers respond to the highlighted terms because of their precise meanings, not simply because the words look unfamiliar.",
      closing: "The current excerpts are consistent with that claim, but the researcher proposes a controlled follow-up study.",
      question: "Which result would most directly support the researcher's claim?",
      choices: ["Readers respond similarly to familiar paraphrases that preserve the same precise distinctions.", "Readers prefer passages printed in a larger font.", "The longest excerpt contains the most punctuation.", "Participants report that they have seen some words before."],
      explanation: "A similar response to meaning-preserving paraphrases would isolate precision rather than unfamiliar appearance as the cause."
    },
    {
      domain: "Information and Ideas", skill: "Inferences",
      opening: "An instructor asks students to revise several excerpts for a general audience while preserving every claim made by the originals.",
      closing: "Some students retain the highlighted terms and define them briefly; others use longer paraphrases that preserve the same distinctions.",
      question: "What does the instructor's response most strongly suggest?",
      choices: ["Clarity can be achieved through more than one strategy as long as meaning is preserved.", "Only the original wording can ever be clear.", "Definitions always make a passage less accessible.", "Longer paraphrases necessarily distort meaning."],
      explanation: "Both brief definitions and accurate paraphrases satisfy the instructor's goal."
    },
    {
      domain: "Information and Ideas", skill: "Central Ideas and Details",
      opening: "A corpus analysis tracks how several highlighted terms are used across scientific, historical, and literary writing.",
      closing: "The subjects vary considerably, yet each term repeatedly marks a narrow relationship that broad substitutes express only imperfectly.",
      question: "Which choice best summarizes the analysis?",
      choices: ["Different fields can rely on the same kind of lexical precision even when their subjects differ.", "All fields use the highlighted words with identical sentences.", "Broad substitutes are always grammatically incorrect.", "Literary writing contains no specialized distinctions."],
      explanation: "The analysis finds a shared need for precision across otherwise different subject areas."
    },
    {
      domain: "Craft and Structure", skill: "Cross-Text Connections",
      opening: "Text 1 argues from the following excerpts that precise terminology is worth occasional difficulty. Text 2 cautions that unexplained terminology can exclude readers even when it is exact.",
      closing: "The two authors therefore disagree less about precision itself than about a writer's responsibility to make that precision accessible.",
      question: "How would the author of Text 2 most likely respond to Text 1?",
      choices: ["By accepting the value of precision while asking writers to provide sufficient context or explanation.", "By denying that words can carry precise meanings.", "By insisting that every difficult term be removed regardless of meaning.", "By claiming that readers never need contextual support."],
      explanation: "Text 2 accepts precision but adds an accessibility requirement."
    }
  ];

  const COHERENT_READING_BLUEPRINTS = [
    {
      domain: "Information and Ideas", skill: "Central Ideas and Details",
      question: "Which choice best states the main idea of the text?",
      choices: ["Making language more familiar is useful only when the revision preserves distinctions important to the original reasoning.", "Every uncommon word is more precise than every familiar alternative.", "Readers cannot identify a passage's topic after any vocabulary has been simplified.", "Editors should value difficulty itself even when it contributes no meaning."],
      explanation: "The study accepts clarity as a goal but uses the loss of important distinctions to limit when simplification counts as an improvement."
    },
    {
      domain: "Information and Ideas", skill: "Inferences",
      question: "Which choice most logically follows from the instructor's findings?",
      choices: ["A reader can often handle an unfamiliar word without knowing all of its definitions if the sentence reveals the relevant logical role.", "Excerpts from different fields cannot support the same conclusion about reading.", "A word's surrounding sentence makes its meaning less constrained.", "Understanding a passage requires connecting every example into one continuous event."],
      explanation: "The instructor's conclusion explicitly prioritizes the contextually active sense over complete knowledge of every possible definition."
    },
    {
      domain: "Information and Ideas", skill: "Central Ideas and Details",
      question: "Which choice best describes the study's principal result?",
      choices: ["Simplified paraphrases could feel easier while making readers' accounts of important relationships less exact.", "Participants rejected every paraphrase because each one was grammatically incorrect.", "The subject area of an excerpt entirely determined whether readers understood it.", "Replacing a difficult word improved both ease and precision in every case."],
      explanation: "The result is a concession-and-turn: apparent ease increased, yet precision about cause, degree, or attitude decreased."
    },
    {
      domain: "Information and Ideas", skill: "Command of Evidence",
      question: "Which finding from the exercise most directly supports the teacher's recommended approach?",
      choices: ["Students who prioritized words affecting claims and contrasts retained the central reasoning more often than students who pursued every definition.", "Students used dictionaries published by several different companies.", "Some excerpts contained more sentences than others.", "Students disagreed about which subject was most interesting."],
      explanation: "The performance difference directly compares the recommended prioritization strategy with the habit of resolving every uncertainty."
    },
    {
      domain: "Craft and Structure", skill: "Words in Context",
      question: "According to the text, why should readers combine lexical clues with structural clues?",
      choices: ["The two kinds of clues provide complementary information about a word's semantic area and its role in the passage's reasoning.", "Structural clues make the meanings of all words irrelevant.", "Lexical clues and structural clues always produce incompatible interpretations.", "Either kind of clue by itself guarantees complete understanding in every passage."],
      explanation: "The linguist assigns the clues different but complementary jobs and rejects treating either one as sufficient alone."
    },
    {
      domain: "Craft and Structure", skill: "Text Structure and Purpose",
      question: "What is the main function of the discussion of the strongest summaries?",
      choices: ["It specifies what successful structural reading looks like and supplies evidence for the concluding principle about selective summary.", "It introduces a competing study that overturns the researcher's project.", "It shows that accurate summaries must reproduce every detail in its original order.", "It shifts the passage from reading comprehension to the history of standardized testing."],
      explanation: "The strongest summaries are evidence: their focus on background, turn, and resulting claim supports the final principle about hierarchy."
    }
  ];

  const READING_STRUCTURE_PROFILES = [
    {
      lead: "Editors sometimes assume that replacing an uncommon word with a familiar near-synonym will preserve everything that matters. To test that assumption, a vocabulary researcher compared several independent excerpts rather than treating them as parts of one story.",
      close: "Although readers could still identify each excerpt's broad topic after simplification, they were less able to describe the precise relationship expressed in the original. The researcher therefore concludes that clarity improves a passage only when revision preserves its important distinctions.",
      pattern: "Common assumption → Test → Evidence → Revised conclusion",
      structureChoices: ["The text introduces a common assumption, tests it with examples, and then revises it in light of the results.", "The text states a conclusion, lists unrelated background information, and then changes to a different topic.", "The text narrates every stage of a failed experiment in chronological order.", "The text compares two researchers whose theories are entirely opposed."],
      pivot: "Although readers could still identify each excerpt's broad topic after simplification...",
      functionQuestion: "What is the main function of the sentence beginning with “Although” in the argument?",
      functionChoices: ["It concedes that simplification preserves the general topic before emphasizing the more important limitation: a precise relationship is lost.", "It denies the validity of all the preceding examples.", "It introduces a new area of research unrelated to word meaning.", "It proves that a passage becomes more accurate whenever it contains more unfamiliar words."],
      mainPoint: "Replacing an unfamiliar word is not necessarily wrong; the real test is whether the revision preserves the original passage's important distinctions.",
      trap: "Do not mistake “readers still understood the general topic” for the conclusion. The author's real advance comes after “Although.”"
    },
    {
      lead: "A reading instructor wanted to know why students can understand the subject of a sentence yet still misread the author's reasoning. The instructor assembled independent excerpts that use demanding vocabulary in different fields and examined what each target word contributes locally.",
      close: "The topics of the excerpts differ, but the same pattern emerges: the surrounding sentence narrows each word to a particular role. Thus, readers need not know every possible definition; they need to identify the sense that fits the sentence's logic.",
      pattern: "Research question → Diverse samples → Shared pattern → Reading strategy",
      structureChoices: ["The text begins with a reading problem, identifies a shared pattern across different samples, and then proposes a practical strategy.", "The text combines unrelated examples into one event and tries to reconstruct their chronological order.", "The text criticizes students and then argues that dictionaries have no use at all.", "The text introduces several subjects independently but reaches no common conclusion."],
      pivot: "The topics of the excerpts differ, but the same pattern emerges...",
      functionQuestion: "What function does the sentence “The topics ... differ, but the same pattern emerges” serve?",
      functionChoices: ["It acknowledges that the samples concern different subjects while showing that they support the same principle about context.", "It indicates that all of the samples actually describe the same event.", "It invalidates the earlier decision to use multiple samples.", "It shifts the passage from reading research to historical narration."],
      mainPoint: "Readers do not need every possible definition of a word; they need to use sentence logic to identify the sense active in that context.",
      trap: "Do not force the independent examples into one storyline. They are parallel pieces of evidence supporting a shared conclusion."
    },
    {
      lead: "In an editing study, participants first read original sentences and then versions in which a target word had been replaced by a broad paraphrase. The researchers used independent excerpts so that any repeated result would not depend on a single subject area.",
      close: "The paraphrases often sounded easier, yet participants gave less exact accounts of cause, degree, or attitude. This contrast suggests that a reader should track what a difficult word is doing in the argument before deciding whether not knowing it blocks comprehension.",
      pattern: "Experimental design → Independent samples → Contrasting result → Practical implication",
      structureChoices: ["The text explains how an experiment compares two kinds of text, presents a contrasting result, and turns that result into a reading strategy.", "The text introduces a historical controversy and resolves it through the author's biography.", "The text lists several definitions and then declares that they are identical.", "The text reports participants' preferences but refuses to discuss their significance."],
      pivot: "The paraphrases often sounded easier, yet participants gave less exact accounts...",
      functionQuestion: "What logical relationship does “yet” establish in the sentence reporting the results?",
      functionChoices: ["The paraphrases appeared easier but reduced readers' precision about cause, degree, or attitude.", "The paraphrases were easier, so every measure of comprehension improved.", "The two results are unrelated and merely happen to appear next to each other.", "The researchers decided to stop comparing the two kinds of text."],
      mainPoint: "When encountering a difficult word, first ask whether it carries structural information such as cause, degree, or attitude; investigate it deeply only if it affects the argument.",
      trap: "Do not conclude that the revision is better simply because it sounds “easier.” The word “yet” moves the evaluative weight to the second result."
    },
    {
      lead: "Some students pause at every unfamiliar word, believing that complete lexical certainty must come before any understanding of a passage. A teacher challenged that approach with a packet of independent excerpts and asked students to mark only words that changed a claim, contrast, or conclusion.",
      close: "Students who ignored nonessential uncertainty usually recovered the passages' central reasoning, whereas students who pursued every possible definition often lost track of it. The exercise does not make vocabulary irrelevant; instead, it gives vocabulary a priority based on argumentative function.",
      pattern: "Ineffective habit → Alternative method → Comparative result → Qualified conclusion",
      structureChoices: ["The text identifies an ineffective habit, tests an alternative method, compares the results, and then qualifies the conclusion.", "The text argues that every unfamiliar word should always be ignored.", "The text compares the styles of two passages without evaluating any reading method.", "The text begins with a conclusion and gradually withdraws all of its evidence."],
      pivot: "The exercise does not make vocabulary irrelevant; instead...",
      functionQuestion: "What possible misreading does the “not ... instead” construction in the final sentence prevent?",
      functionChoices: ["It prevents readers from confusing “prioritize words by function” with “vocabulary is completely irrelevant.”", "It prevents readers from recognizing that the passage discusses students.", "It prevents readers from noticing the comparison reported earlier.", "It prevents readers from distinguishing claims from evidence."],
      mainPoint: "The third pass is not about eliminating every unknown word; it is about allocating attention by argumentative function, with words affecting claims, contrasts, or conclusions receiving priority.",
      trap: "The author does not say that vocabulary is unimportant. The final sentence qualifies the claim and corrects that overgeneralization."
    },
    {
      lead: "A linguist argues that dictionary knowledge and structural reading solve different problems. To illustrate the distinction, the linguist presents independent excerpts and asks what relation each target word establishes inside its own sentence.",
      close: "A definition may identify a word's general semantic territory, but transitions and syntax reveal why that meaning matters at a particular point. Consequently, effective readers combine lexical clues with the passage's larger movement rather than treating either source of evidence as sufficient alone.",
      pattern: "Conceptual distinction → Illustrative task → Separate functions → Integrated conclusion",
      structureChoices: ["The text distinguishes two reading resources, uses examples to explain their separate roles, and concludes that readers should combine them.", "The text proves that syntax is always more important than word meaning.", "The text argues that consulting a dictionary inevitably produces a wrong answer.", "The text presents the historical origins of several words in sequence."],
      pivot: "A definition may identify ... but transitions and syntax reveal...",
      functionQuestion: "What argumentative task do the two clauses joined by “but” perform together?",
      functionChoices: ["They distinguish the problems solved by lexical and structural clues, preparing for the conclusion that readers should combine them.", "They demonstrate that the first clause is factually false.", "They abruptly shift the passage from linguistics to research ethics.", "They show that the two kinds of evidence conflict and cannot coexist."],
      mainPoint: "Word meaning tells readers roughly what is being discussed, while transitions and syntax reveal why the author says it at that point; effective reading combines both.",
      trap: "This is not an either-or choice. Here, “but” separates functions, and “Consequently” introduces the integrated conclusion."
    },
    {
      lead: "A test-preparation researcher examined why a reader may answer a detail question correctly but miss a passage's main point. The researcher used independent vocabulary-rich excerpts and required readers to summarize each one as a sequence of author moves rather than as a list of facts.",
      close: "The strongest summaries identified background, a turn in reasoning, and the claim produced by that turn; they did not reproduce every detail. The finding implies that a useful summary is selective: it preserves the hierarchy of ideas instead of preserving every sentence equally.",
      pattern: "Skill gap → New task → Features of strong performance → General principle",
      structureChoices: ["The text identifies a skill gap, introduces a new task, describes strong performance, and then derives a general principle.", "The text lists every fact in the passage and argues that more detail always produces a better summary.", "The text compares several tests without proposing any reading method.", "The text rejects the value of summarizing and then introduces a vocabulary list."],
      pivot: "The strongest summaries identified background, a turn in reasoning, and the claim...",
      functionQuestion: "Why is the description of the strongest summaries important evidence in the passage?",
      functionChoices: ["It specifies what successful structural reading looks like and supports the conclusion that an effective summary preserves hierarchy.", "It proves that every detail must be reproduced with equal emphasis.", "It shows that readers need to memorize only the background information.", "It has no connection to the problem introduced at the beginning."],
      mainPoint: "Understanding a passage does not mean reproducing all of its information; it means identifying the background, the turn in reasoning, and the central claim produced by that turn.",
      trap: "Answering a detail question correctly does not guarantee that the main point is understood. The main point depends on the hierarchy of ideas and the author's moves."
    }
  ];

  const CURATED_GROUP_READINGS = {
    1: [
      {
        wordIds: ["accomplice", "unwitting", "labyrinthine"],
        domain: "Information and Ideas", skill: "Inferences",
        passage: "Historian Mara Velez argues that a seventeenth-century smuggling network endured less because its leaders inspired loyalty than because the port's labyrinthine accounting system concealed who was responsible for each shipment. One clerk, long described as an accomplice, recorded false cargo weights but never received the coded instructions found in senior merchants' ledgers. Velez therefore considers it plausible that the clerk was an unwitting participant: his work enabled the scheme, yet the surviving evidence does not establish that he understood its purpose.",
        question: "Which choice most logically follows from Velez's argument?",
        choices: ["A person may materially assist a scheme without knowing the larger plan that the assistance serves.", "The clerk designed the accounting system used by the senior merchants.", "Coded instructions were available to every employee at the port.", "The network survived primarily because the clerk was loyal to its leaders."],
        explanation: "Velez separates causal participation from knowledge of the scheme; the clerk's work helped the network, but the records do not show that he understood it.",
        structure: { pattern: "Accepted label → Missing evidence → Qualified reinterpretation", pivot: "but never received", nudge: "Notice what the historian concedes about the clerk, then what the surviving evidence still cannot establish.", mainPoint: "The clerk may have enabled the operation without knowingly joining it.", trap: "Do not turn the passage's evidence of assistance into evidence of intention." }
      },
      {
        wordIds: ["downcast", "phlegmatic", "undaunted"],
        domain: "Craft and Structure", skill: "Text Structure and Purpose",
        passage: "In early reviews of Nella Hart's novel, critics treated the heroine's downcast gaze after a courtroom defeat as proof that she had surrendered. Literary scholar Imani Cole reads the scene differently. Throughout the novel, Hart gives the heroine a phlegmatic manner precisely when her plans are most threatened; emotional restraint signals calculation, not passivity. By placing this familiar pattern beside the courtroom scene, Cole recasts the heroine as undaunted and prepares readers to recognize the strategic reversal in the next chapter.",
        question: "What is the main function of Cole's discussion of the heroine's manner elsewhere in the novel?",
        choices: ["It supplies a recurring pattern that supports a reinterpretation of the courtroom scene.", "It proves that the courtroom defeat never occurred.", "It introduces a second character whose motives oppose the heroine's.", "It shows that early reviewers had not read the next chapter."],
        explanation: "Cole uses a recurring characterization pattern as evidence that apparent passivity in the courtroom scene should instead be read as controlled resolve.",
        structure: { pattern: "Earlier interpretation → Recurring pattern → Reinterpretation", pivot: "reads the scene differently", nudge: "Ask why Cole brings in scenes from elsewhere in the novel instead of discussing the courtroom moment alone.", mainPoint: "A recurring pattern of emotional restraint changes how the apparent defeat should be interpreted.", trap: "The later chapter is not the evidence itself; Cole's evidence is the recurring characterization pattern." }
      },
      {
        wordIds: ["entreat", "hew to", "salient", "yield"],
        domain: "Information and Ideas", skill: "Central Ideas and Details",
        passage: "During a prolonged drought, regional officials continued to hew to a rule that distributed irrigation water according to farms' historical acreage. Small growers began to entreat the agency for an emergency formula based on current crop needs instead. A review found that the most salient predictor of a farm's survival was not its former size but whether its remaining fields could yield food under severe water limits. The agency consequently retained acreage records for ordinary years but suspended their use during declared droughts.",
        question: "Which choice best states the main idea of the text?",
        choices: ["Evidence that an old allocation rule poorly predicted survival led officials to adopt a limited exception rather than discard the rule entirely.", "Officials permanently replaced all historical records with requests from small growers.", "Farm size became a better predictor of survival as the drought intensified.", "The review concluded that emergency water should be distributed equally in every circumstance."],
        explanation: "The agency changes policy only for declared droughts, so the conclusion is a qualified revision rather than a total rejection of the original rule.",
        structure: { pattern: "Established rule → Challenge → Relevant evidence → Limited policy revision", pivot: "not its former size but", nudge: "Track what the review rejects as a predictor and what the agency changes only under a specific condition.", mainPoint: "Officials created a drought exception after evidence exposed a weakness in the usual acreage rule.", trap: "Avoid absolute answers: the original rule remains in place during ordinary years." }
      }
    ],
    2: [
      {
        wordIds: ["cosmopolitan", "insecticide", "swarm"],
        domain: "Information and Ideas", skill: "Command of Evidence",
        passage: "Public-health historians have often credited a 1908 insecticide campaign with ending recurrent fever outbreaks in a cosmopolitan port city. Municipal logs, however, show that infection rates had begun falling weeks before chemicals were distributed, just after crews drained pools where each swarm of mosquitoes reproduced. The campaign may have reinforced the decline, but the chronology suggests that eliminating breeding sites was the earlier and possibly more consequential intervention.",
        question: "Which finding, if true, would most strongly support the historians' original explanation?",
        choices: ["Neighborhoods treated with the chemical experienced an additional decline that otherwise similar untreated neighborhoods did not.", "The city's population included merchants born in many different countries.", "Drainage crews completed most of their work before the chemical campaign began.", "Officials advertised both interventions in several local newspapers."],
        explanation: "A difference between otherwise similar treated and untreated neighborhoods would isolate the chemical campaign's contribution.",
        structure: { pattern: "Standard explanation → Earlier timeline → Qualified causal revision", pivot: "however", nudge: "The passage questions one cause by putting two interventions on a timeline; look for evidence that would isolate the disputed intervention.", mainPoint: "Drainage appears to have begun the decline, though the later chemical campaign may still have helped.", trap: "Evidence that an intervention occurred is weaker than evidence comparing outcomes with and without it." }
      },
      {
        wordIds: ["exculpate", "lavish", "vindicate"],
        domain: "Information and Ideas", skill: "Inferences",
        passage: "When a newly built concert hall developed severe cracks, critics pointed to its lavish interior as evidence that the architect had valued spectacle over structural safety. Engineering tests later showed that the original design met every load requirement, a finding that may vindicate the architect's calculations. Yet the tests do not exculpate the construction firm: invoices reveal that it substituted weaker concrete after the architect had approved a different material.",
        question: "Which choice most logically follows from the text?",
        choices: ["Responsibility for a failed project can shift when evidence distinguishes a sound design from its faulty execution.", "The expensive interior caused the concrete to become weaker.", "Meeting design requirements guarantees that every finished building will be safe.", "The construction firm used exactly the material specified by the architect."],
        explanation: "The passage separates the adequacy of the design from the firm's later material substitution, shifting responsibility toward execution.",
        structure: { pattern: "Visible suspicion → Technical evidence → Responsibility reassigned", pivot: "Yet", nudge: "Separate the person whose calculations were tested from the firm that chose the actual material.", mainPoint: "New evidence clears the design while preserving a case against the contractor.", trap: "Do not treat evidence favoring one party as evidence clearing every party." }
      },
      {
        wordIds: ["coerce", "petulant", "pit against", "stoic"],
        domain: "Craft and Structure", skill: "Text Structure and Purpose",
        passage: "Biographers once portrayed Governor Ekan as a stoic mediator whose calm offset a petulant legislature. Private correspondence complicates that contrast. Ekan instructed allies to coerce wavering delegates by threatening to withhold local grants and tried to pit two regional blocs against one another before they could form a majority. The letters do not prove that his composure was insincere, but they show that demeanor alone is an unreliable guide to political method.",
        question: "What is the main function of the discussion of Ekan's private correspondence?",
        choices: ["It challenges an inference about Ekan's political conduct that biographers drew from his public demeanor.", "It establishes that the legislature consistently supported Ekan's policies.", "It proves that Ekan behaved emotionally in every private exchange.", "It explains why regional grants were larger than national grants."],
        explanation: "The letters reveal coercive tactics hidden by Ekan's calm public manner, undermining the equation of demeanor with method.",
        structure: { pattern: "Public characterization → Private evidence → Limited reinterpretation", pivot: "complicates that contrast", nudge: "Ask what readers were invited to infer from calm behavior and what the letters reveal that behavior did not.", mainPoint: "A calm public manner did not necessarily imply a conciliatory political strategy.", trap: "The author questions what the demeanor signifies; the passage does not claim the demeanor itself was fake." }
      }
    ],
    25: [
      {
        wordIds: ["collision", "demarcation", "stance"],
        domain: "Information and Ideas", skill: "Inferences",
        passage: "Legal historians once treated a 1924 collision between two fishing vessels as the event that hardened neighboring states' maritime claims. Newly cataloged cabinet minutes complicate that account. Months before the accident, both governments had already adopted a public stance against joint patrols, and surveyors had begun drafting a formal demarcation of the disputed waters. The accident intensified public attention, but the minutes suggest that it accelerated a conflict whose institutional foundations were already in place.",
        question: "Which choice most logically follows from the newly cataloged minutes?",
        choices: ["The accident probably increased the dispute's visibility without creating the governments' underlying disagreement.", "The two governments began surveying the waters only after the accident.", "Joint patrols were the central demand of both governments before 1924.", "Public attention to the dispute declined immediately after the accident."],
        explanation: "The minutes place policy opposition and boundary planning before the accident, supporting the claim that the accident accelerated rather than originated the dispute.",
        structure: { pattern: "Standard causal story → Earlier evidence → Revised causal role", pivot: "complicate that account", nudge: "Put the cabinet minutes and the accident on a timeline before deciding what caused what.", mainPoint: "The accident intensified an existing dispute rather than initiating it.", trap: "Do not confuse the event that drew attention with the earlier developments that created the conflict." }
      },
      {
        wordIds: ["apt", "asunder", "plethora"],
        domain: "Craft and Structure", skill: "Text Structure and Purpose",
        passage: "When archaeologists found a ceremonial bowl broken asunder beneath a collapsed wall, a plethora of nearby figurines led them to identify the room as a public shrine. Yet chemical analysis showed that the bowl had held medicinal compounds, while wear on the figurines matched objects handled repeatedly in private homes. Calling the room a shrine had seemed apt when the artifacts were considered mainly by number and appearance; once evidence of use was examined, however, a household healing space became the stronger interpretation.",
        question: "What is the main function of the sentence beginning with “Calling the room a shrine”?",
        choices: ["It explains why the initial interpretation was reasonable while showing how later evidence weakened it.", "It argues that the number of artifacts is always more informative than evidence of their use.", "It introduces a disagreement about whether the bowl was actually broken.", "It establishes that public shrines and household healing spaces served identical purposes."],
        explanation: "The sentence concedes that the earlier view fit the initial evidence, then prepares the revision prompted by chemical and wear analysis.",
        structure: { pattern: "Initial classification → New functional evidence → Better explanation", pivot: "once evidence of use was examined", nudge: "Distinguish the evidence that made the first label plausible from the evidence that later became more diagnostic.", mainPoint: "Functional evidence overturned a plausible classification based mostly on quantity and appearance.", trap: "A qualified concession to the old view does not mean the author ultimately accepts it." }
      },
      {
        wordIds: ["dejected", "desultory", "moody", "self-esteem"],
        domain: "Information and Ideas", skill: "Central Ideas and Details",
        passage: "A longitudinal study of adolescent motivation found that students with fragile self-esteem were not uniformly moody. Their reactions depended on what a setback seemed to imply. After random losses in a computer game, they were briefly dejected but resumed playing with no lasting change in effort. After receiving feedback framed as evidence of low ability, however, the same students showed desultory engagement for several days. The researchers conclude that the meaning assigned to failure, rather than unpleasant emotion alone, predicts whether motivation deteriorates.",
        question: "Which choice best states the main idea of the text?",
        choices: ["The interpretation of a setback better predicts lasting motivational decline than the immediate negative feeling it produces.", "Students with low confidence respond to every setback in the same way.", "Random losses cause a more persistent reduction in effort than ability-related feedback does.", "Negative emotion has no relationship to how adolescents respond to failure."],
        explanation: "The study contrasts short-lived sadness after random losses with sustained disengagement after ability-related feedback, making interpretation the decisive factor.",
        structure: { pattern: "Broad expectation → Controlled contrast → Explanatory conclusion", pivot: "however", nudge: "Compare what happens after a random loss with what happens after feedback that seems to reveal low ability.", mainPoint: "A setback's perceived meaning, not merely its unpleasantness, determines whether effort continues to fall.", trap: "The passage does not say emotion is irrelevant; it says emotion alone does not explain the lasting change." }
      }
    ]
  };

  function architectReadingsForGroup(group) {
    return window.ARCHITECT_GROUP_READINGS?.[Number(group)] || CURATED_GROUP_READINGS[Number(group)];
  }

  function stableHash(value) {
    let result = 2166136261;
    for (let index = 0; index < value.length; index += 1) result = Math.imul(result ^ value.charCodeAt(index), 16777619);
    return result >>> 0;
  }

  const OFFLINE_READING_FRAMES = [
    { domain: "Information and Ideas", skill: "Central Ideas and Details", pattern: "Initial interpretation → Complicating evidence → Qualified conclusion" },
    { domain: "Information and Ideas", skill: "Inferences", pattern: "Observation → Competing explanation → Evidential limit" },
    { domain: "Craft and Structure", skill: "Text Structure and Purpose", pattern: "Received view → Reassessment → Revised account" }
  ];

  function exactWordCount(text, id) {
    const escaped = String(id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return (String(text).match(new RegExp(`(^|[^a-z])${escaped}(?=$|[^a-z])`, "gi")) || []).length;
  }

  function fallbackEvidenceSentence(word, index) {
    const example = String(word.example || "").trim().replace(/[.!?]+$/, "");
    const definition = String(word.definition || "a consequential feature").replace(/^\([^)]*\)\s*/, "").replace(/[.!?]+$/, "");
    if (example && exactWordCount(example, word.id) === 1) return `${example}.`;
    const pos = String(word.pos || "").toLowerCase();
    if (pos.includes("adjective")) return `The report characterizes the resulting pattern as ${word.id}, or ${definition}.`;
    if (pos.includes("adverb")) return `The report states that the relevant elements had moved ${word.id}, a detail central to its reconstruction.`;
    if (pos.includes("verb")) return `The researchers ask whether the new evidence can ${word.id} the earlier account.`;
    return `The analysis treats ${word.id}—${definition}—as a consequential feature rather than a peripheral detail.`;
  }

  function fallbackReading(words, cardIndex, variantId) {
    const frame = OFFLINE_READING_FRAMES[cardIndex % OFFLINE_READING_FRAMES.length];
    const evidence = words.map(fallbackEvidenceSentence).join(" ");
    const avoidTargetTerms = text => words.reduce((result, word) => {
      const escaped = String(word.id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return result.replace(new RegExp(`(^|[^a-z])${escaped}(?=$|[^a-z])`, "gi"), "$1the earlier view");
    }, text);
    const lead = avoidTargetTerms("A recent interdisciplinary review reconsiders an explanation that had become conventional largely because no competing account had been tested against the full record.");
    const close = avoidTargetTerms("Taken together, these details do not make the conventional explanation impossible, but they show that it treated a provisional inference as a settled conclusion.");
    const passage = `${lead} ${evidence} ${close}`;
    const choices = [
      "The fuller record weakens the certainty of a conventional explanation without proving that explanation impossible.",
      "Every detail in the record directly contradicts the conventional explanation.",
      "The review accepts the conventional explanation because no alternative can be imagined.",
      "The record is too incomplete to support any inference whatsoever."
    ];
    const desiredAnswer = window.LexiverseAnswerLayout?.positionFor(state.group, cardIndex);
    const finalSet = shuffledAnswerSet(choices, `${state.group}|${variantId}|fallback`, [], desiredAnswer);
    return {
      domain: frame.domain, skill: frame.skill, passage,
      question: cardIndex % 3 === 2 ? "What is the main function of the final sentence?" : "Which choice best states the main idea of the text?",
      choices: finalSet.choices, answer: finalSet.answer,
      explanation: "The author revises the confidence placed in the earlier account but explicitly stops short of rejecting it outright.",
      structure: { ...frame, pivot: "but", nudge: "Identify what the final sentence weakens and what it deliberately leaves possible.", mainPoint: choices[0], trap: "Do not turn a qualified challenge into total rejection or complete uncertainty." },
      variantId
    };
  }

  function shuffledAnswerSet(items, key, notes = [], desiredAnswerIndex = null) {
    if (window.LexiverseAnswerLayout?.arrange) return window.LexiverseAnswerLayout.arrange(items, key, desiredAnswerIndex, notes);
    const ordered = items
      .map((text, originalIndex) => ({ text, originalIndex, note: notes[originalIndex] || "" }))
      .sort((a, b) => stableHash(`${key}|${a.text}`) - stableHash(`${key}|${b.text}`));
    return { choices: ordered.map(item => item.text), choiceNotes: ordered.map(item => item.note), answer: ordered.findIndex(item => item.originalIndex === 0) };
  }

  function readingFor(words, cardIndex) {
    const variantId = state.variants[String(state.group)]?.[cardIndex] ?? cardIndex;
    const readingKey = `${state.group}|${variantId}|${words.map(word => word.id).join("|")}`;
    const curated = architectReadingsForGroup(Number(state.group))?.[cardIndex];
    if (!curated) return fallbackReading(words, cardIndex, variantId);
    const defaultChoiceNotes = [
      "正确：完整保留了文章的范围、逻辑关系和限定语。",
      "错误：这个选项抓住了局部信息，但改变了文章真正需要判断的关系。",
      "错误：这个选项扩大、缩小或反转了原文结论。",
      "错误：这个说法可能听起来合理，但正文没有提供足够依据。"
    ];
    const desiredAnswer = window.LexiverseAnswerLayout?.positionFor(state.group, cardIndex);
    const finalSet = shuffledAnswerSet(curated.choices, `${readingKey}|final-v4`, curated.analysis?.choiceNotes || defaultChoiceNotes, desiredAnswer);
    return {
      difficulty: 4,
      subject: curated.subject || "Humanities",
      ...curated,
      choices: finalSet.choices,
      choiceNotes: finalSet.choiceNotes,
      answer: finalSet.answer,
      analysis: {
        evidence: curated.analysis?.evidence || curated.structure?.pivot || "回到文章中改变论证方向或限制结论范围的句子。",
        reasoning: curated.analysis?.reasoning || curated.explanation,
        trap: curated.analysis?.trap || curated.structure?.trap,
        takeaway: curated.analysis?.takeaway || "先确定作者最终保留的结论范围，再比较选项。",
        choiceNotes: finalSet.choiceNotes
      },
      variantId
    };
  }

  function renderReadingHistory() {
    if (!readingHistoryBox || !readingStatCards) return;
    const history = Array.isArray(state.readingHistory) ? state.readingHistory : [];
    const today = localDayStart(Date.now());
    const todayRows = history.filter(record => localDayStart(record.answeredAt) === today);
    const currentRows = history.filter(record => Number(record.group) === Number(state.group));
    const correct = history.filter(record => record.correct).length;
    const accuracy = history.length ? Math.round(correct / history.length * 100) : 0;
    const structuredRows = history.filter(record => record.structure);
    const reflectedRows = structuredRows.filter(record => record.structure.mode === "post-answer" || record.structure.reviewed || record.habit);
    readingStatCards.innerHTML = `
      <article><span>今天完成</span><strong>${todayRows.length}<small> 篇</small></strong><p>今天三刷训练量</p></article>
      <article><span>当前 Group</span><strong>${currentRows.length}<small> 篇</small></strong><p>Group ${state.group} 累计</p></article>
      <article><span>全部阅读</span><strong>${history.length}<small> 篇</small></strong><p>记录永久保存在本机</p></article>
      <article><span>DSAT 正确率</span><strong>${accuracy}<small>%</small></strong><p>${correct} 篇最终题答对</p></article>
      <article><span>主线复盘</span><strong>${reflectedRows.length}<small> 篇</small></strong><p>答后回看结构，不增加额外题目</p></article>`;
    const visible = (readingHistoryFilter === "current" ? currentRows : history).slice().sort((a, b) => b.answeredAt - a.answeredAt).slice(0, 60);
    readingHistoryBox.innerHTML = visible.length ? visible.map(record => `
      <details class="reading-history-item ${record.correct ? "correct" : "incorrect"}">
        <summary><span>G${record.group} · 三刷结构阅读 · Reading ${record.readingIndex + 1}</span><strong>${record.structure?.mode === "post-answer" ? "主线已复盘 · " : ""}${record.correct ? "题目答对" : "题目答错"}</strong><small>${new Date(record.answeredAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</small></summary>
        <div class="reading-history-detail">
          <div class="group-reading-targets">${(record.words || []).map(id => `<span>${escapeHtml(id)}</span>`).join("")}</div>
          <p>${escapeHtml(record.passage)}</p>
          ${record.structure ? `<section class="history-logic-review"><span>LOGIC MAP</span><strong>${escapeHtml(record.structure.pattern)}</strong><p>${escapeHtml(record.structure.mainPoint)}</p><small>${escapeHtml(record.structure.trap)}</small>${record.habit ? `<em>本次干扰：${escapeHtml(record.habit)}</em>` : ""}</section>` : ""}
          <strong>${escapeHtml(record.question)}</strong>
          <ol>${(record.choices || []).map((choice, index) => `<li class="${index === record.answer ? "answer" : index === record.selected ? "selected" : ""}">${escapeHtml(choice)}</li>`).join("")}</ol>
          <p class="history-explanation">${escapeHtml(record.explanation)}</p>
          ${record.analysis ? `<section class="history-answer-analysis"><strong>决定性证据</strong><p>${escapeHtml(record.analysis.evidence)}</p><strong>推理链</strong><p>${escapeHtml(record.analysis.reasoning)}</p><ol>${(record.analysis.choiceNotes || []).map((note, index) => `<li><b>${String.fromCharCode(65 + index)}</b>${escapeHtml(note)}</li>`).join("")}</ol><small>${escapeHtml(record.analysis.takeaway || "")}</small></section>` : ""}
        </div>
      </details>`).join("") : `<p class="reading-history-empty">${readingHistoryFilter === "current" ? `Group ${state.group} 还没有阅读记录。完成上面的任意一题后会自动保存在这里。` : "还没有阅读记录。"}</p>`;
  }

  function recordReadingAttempt({ data, words, readingIndex, selected, key }) {
    state.readingHistory = Array.isArray(state.readingHistory) ? state.readingHistory : [];
    const record = {
      id: `${key}|${Date.now()}`,
      key,
      group: Number(state.group),
      pass: 3,
      readingIndex,
      words: words.map(word => word.id),
      passage: data.passage,
      question: data.question,
      choices: data.choices,
      answer: data.answer,
      selected,
      correct: selected === data.answer,
      explanation: data.explanation,
      subject: data.subject,
      difficulty: data.difficulty || 4,
      analysis: data.analysis ? {
        evidence: data.analysis.evidence,
        reasoning: data.analysis.reasoning,
        trap: data.analysis.trap,
        takeaway: data.analysis.takeaway,
        choiceNotes: data.choiceNotes || data.analysis.choiceNotes || []
      } : null,
      variantId: data.variantId,
      fingerprint: readingFingerprint(state.group, data.variantId, words.map(word => word.id)),
      structure: {
        pattern: data.structure.pattern,
        mode: "post-answer",
        reviewed: true,
        pivot: data.structure.pivot,
        mainPoint: data.structure.mainPoint,
        trap: data.structure.trap
      },
      answeredAt: Date.now()
    };
    state.readingHistory.push(record);
    if (state.readingHistory.length > 800) state.readingHistory = state.readingHistory.slice(-800);
    state.readingRewarded = Array.isArray(state.readingRewarded) ? state.readingRewarded : [];
    if (!state.readingRewarded.includes(key)) {
      state.readingRewarded.push(key);
      markPassComplete(words.map(word => word.id), 3, null, "pass-3-reading");
      const gain = 10 + (record.correct ? 14 : 0);
      state.totalXp = (Number(state.totalXp) || 0) + gain;
      rewardMessage = `${record.correct ? "主线判断命中" : "已完成一次高质量错因复盘"} · 阅读能量 +${gain} XP。`;
    }
    delete state.readingDrafts[key];
    persist();
    renderReadingHistory();
    renderStats();
    renderRewardBar();
    return record;
  }

  function highlightedPassage(text, words) {
    return words.slice().sort((first, second) => second.id.length - first.id.length).reduce((html, word) => {
      const escapedId = escapeHtml(word.id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const exactPattern = new RegExp(`(^|[^a-z])(${escapedId})(?=$|[^a-z])`, "i");
      if (exactPattern.test(html)) return html.replace(exactPattern, "$1<mark>$2</mark>");
      const head = escapeHtml(String(word.id).split(/\s+/)[0]).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return html.replace(new RegExp(`(^|[^a-z])(${head})(?=$|[^a-z])`, "i"), "$1<mark>$2</mark>");
    }, escapeHtml(text));
  }

  function renderReadings(force = false) {
    const split = buildSplit(force);
    const sizes = split.map(part => part.length);
    const pass = 3;
    document.getElementById("study-split-summary").textContent = `固定 3 篇精品精读 · ${sizes.join(" / ")} 覆盖本 Group 全部 ${sizes.reduce((sum, size) => sum + size, 0)} 词，每词在正文中只出现一次 · 一篇只做一道题`;
    readingList.innerHTML = "";
    split.forEach((ids, index) => {
      const words = ids.map(id => wordMap.get(id)).filter(Boolean);
      const data = readingFor(words, index);
      const fingerprint = readingFingerprint(state.group, data.variantId, ids);
      const attemptKey = `${state.group}|${pass}|${data.variantId}|${[...ids].sort((a, b) => a.localeCompare(b)).join(",")}`;
      const doneCount = (state.readingHistory || []).filter(record => readingRecordFingerprint(record) === fingerprint).length;
      const article = document.createElement("article");
      article.className = `group-reading-card pass-${pass}`;
      article.innerHTML = `
        <div class="group-reading-meta"><span>READING ${index + 1} · LEVEL ${data.difficulty || 4} · ${escapeHtml(data.subject || data.domain)} · ${escapeHtml(data.skill)}</span><span>${doneCount ? `COMPLETED ${doneCount} ${doneCount === 1 ? "TIME" : "TIMES"}` : `${words.length} TARGET WORDS`}</span></div>
        <div class="reading-assigned-words" aria-label="Target words used in this passage">${words.map(word => `<span>${escapeHtml(word.id)}</span>`).join("")}</div>
        <div class="reading-logic-compass"><span>STUDENT MODE · ONE QUESTION</span><strong>Read once, choose independently, then inspect the architecture.</strong><small>No hints or answer cues are shown before submission.</small></div>
        <p class="group-reading-passage">${escapeHtml(data.passage)}</p>
        <section class="reading-training-stage reading-single-question">
          <span class="reading-stage-label">ONE DSAT-STYLE QUESTION</span>
          <p class="group-reading-question">${escapeHtml(data.question)}</p>
          <div class="group-reading-choices">${data.choices.map((choice, choiceIndex) => `<button type="button" data-choice="${choiceIndex}">${String.fromCharCode(65 + choiceIndex)}. ${escapeHtml(choice)}</button>`).join("")}</div>
          <section class="group-reading-answer reading-answer-analysis" data-final-feedback hidden>
            <div class="reading-answer-verdict"><strong>Correct answer: ${String.fromCharCode(65 + data.answer)}</strong><p>${escapeHtml(data.explanation)}</p></div>
            <div class="reading-evidence-chain"><span>DECISIVE EVIDENCE</span><blockquote>${escapeHtml(data.analysis?.evidence || data.structure?.pivot || "Return to the sentence that limits the conclusion.")}</blockquote><span>REASONING CHAIN · 中文</span><p>${escapeHtml(data.analysis?.reasoning || data.explanation)}</p></div>
            <div class="reading-choice-diagnosis"><span>WHY EACH CHOICE WORKS OR FAILS</span>${data.choices.map((choice, choiceIndex) => `<article class="${choiceIndex === data.answer ? "correct" : ""}"><b>${String.fromCharCode(65 + choiceIndex)}</b><p>${escapeHtml(data.choiceNotes?.[choiceIndex] || (choiceIndex === data.answer ? "正确：与原文的范围和逻辑关系一致。" : "错误：与原文的范围或逻辑关系不一致。"))}</p></article>`).join("")}</div>
            <div class="reading-transfer-rule"><span>SAT TRAP</span><strong>${escapeHtml(data.analysis?.trap || data.structure?.trap || "Scope distortion")}</strong><p>${escapeHtml(data.analysis?.takeaway || "先确定作者最终保留的结论范围，再比较选项。")}</p></div>
          </section>
        </section>
        <section class="reading-structure-debrief" hidden>
          <span>ONE-SENTENCE MAP</span><strong>${escapeHtml(data.structure.pattern)}</strong>
          <p>${escapeHtml(data.structure.mainPoint)}</p><small>${escapeHtml(data.structure.trap)}</small>
          <div class="reading-habit-check"><span>What tried to pull you off the main line?</span><button type="button" data-reading-habit="A local detail">A local detail</button><button type="button" data-reading-habit="One difficult word">One difficult word</button><button type="button" data-reading-habit="I missed the turn">I missed the turn</button><button type="button" data-reading-habit="Nothing; the structure was clear">The structure was clear</button></div>
        </section>
        <div class="group-reading-target-review" hidden><span>TARGET WORDS · REVIEW ONLY AFTER ANSWERING</span><div class="group-reading-targets">${words.map(word => `<span><b>${escapeHtml(word.id)}</b> · ${escapeHtml(word.pos)} · ${escapeHtml(word.definition || "")}</span>`).join("")}</div></div>`;
      let answered = false;
      let attemptRecord = null;
      article.querySelectorAll("[data-choice]").forEach(button => button.addEventListener("click", () => {
        if (answered) return;
        answered = true;
        const selectedIndex = Number(button.dataset.choice);
        article.querySelectorAll("[data-choice]").forEach((choice, choiceIndex) => {
          choice.disabled = true;
          if (choiceIndex === data.answer) choice.classList.add("correct");
        });
        if (selectedIndex !== data.answer) button.classList.add("incorrect");
        const verdict = article.querySelector(".reading-answer-verdict strong");
        if (verdict) verdict.textContent = `${selectedIndex === data.answer ? "Correct" : "Incorrect"} · Correct answer: ${String.fromCharCode(65 + data.answer)}`;
        article.querySelector("[data-final-feedback]").hidden = false;
        article.querySelector(".reading-structure-debrief").hidden = false;
        article.querySelector(".group-reading-target-review").hidden = false;
        attemptRecord = recordReadingAttempt({ data, words, readingIndex: index, selected: selectedIndex, key: attemptKey });
      }));
      article.querySelectorAll("[data-reading-habit]").forEach(button => button.addEventListener("click", () => {
        if (!attemptRecord) return;
        attemptRecord.habit = button.dataset.readingHabit;
        article.querySelectorAll("[data-reading-habit]").forEach(item => item.classList.toggle("selected", item === button));
        persist();
      }));
      readingList.append(article);
    });
    renderPassSelector();
    renderReadingHistory();
    renderRewardBar();
  }

  function renderGroup(forceSplit = false) {
    groupSelect.value = String(state.group);
    state.index = Math.min(storedPassIndex(), Math.max(0, currentWords().length - 1));
    renderPassSelector();
    if (Number(state.studyPass) === 3) {
      document.getElementById("study-group-progress").textContent = `Group ${state.group} · 第三遍：${groupPassCount(3)} / ${currentWords().length}`;
      renderReadings(forceSplit);
      renderStats();
      renderRewardBar();
    } else {
      renderWord();
    }
    window.dispatchEvent(new CustomEvent("lexiverse-group-change", { detail: { group: Number(state.group) } }));
  }

  groupSelect.innerHTML = groupNumbers.map(number => `<option value="${number}">Group ${number}</option>`).join("");
  groupSelect.addEventListener("change", () => {
    savePassIndex();
    state.group = Number(groupSelect.value);
    state.index = storedPassIndex();
    persist();
    renderGroup();
  });
  document.getElementById("study-prev-group").addEventListener("click", () => {
    savePassIndex();
    const position = groupNumbers.indexOf(Number(state.group));
    state.group = groupNumbers[Math.max(0, position - 1)];
    state.index = storedPassIndex();
    renderGroup();
  });
  document.getElementById("study-next-group").addEventListener("click", () => {
    savePassIndex();
    const position = groupNumbers.indexOf(Number(state.group));
    state.group = groupNumbers[Math.min(groupNumbers.length - 1, position + 1)];
    state.index = storedPassIndex();
    renderGroup();
  });
  document.getElementById("study-prev-word").addEventListener("click", () => {
    state.index = Math.max(0, Number(state.index) - 1);
    savePassIndex();
    renderWord();
  });
  document.getElementById("study-next-word").addEventListener("click", () => {
    state.index = Math.min(currentWords().length - 1, Number(state.index) + 1);
    savePassIndex();
    renderWord();
  });

  function rateAndAdvance(level) {
    const word = currentWords()[state.index];
    const currentPass = Number(state.studyPass);
    if (!word || ![1, 2].includes(currentPass) || ![1, 2, 3, 4, 5].includes(Number(level))) return;
    word.level = Number(level);
    const methodSource = currentPass === 2 ? "pass-2-relations-family" : "pass-1-full-card";
    const newlyPassed = markPassComplete(word.id, currentPass, level, methodSource).length > 0;
    const passCount = Math.max(currentPass, Number(window.LexiversePasses?.get(word.id)) || 1);
    levelStore[word.id] = word.level;
    localStorage.setItem("lexiverse-levels", JSON.stringify(levelStore));
    window.dispatchEvent(new CustomEvent("lexiverse-level-change", { detail: { id: word.id, level: word.level, source: "group-study-flow" } }));
    let newlyCompletedId = "";
    const wasCompleted = Boolean(state.completed[word.id]);
    if (!wasCompleted) {
      state.completed[word.id] = Date.now();
      newlyCompletedId = word.id;
    }
    const ratingDay = localDayStart(Date.now());
    if (Number(state.comboDay) !== ratingDay) sessionCombo = 0;
    sessionCombo += 1;
    state.currentCombo = sessionCombo;
    state.comboDay = ratingDay;
    state.sprintProgress = (Number(state.sprintProgress) || 0) + 1;
    state.rescueStep = (Number(state.rescueStep) || 0) + 1;
    if (word.level <= 2) enqueueRescue(word.id, currentPass === 2 ? 4 : 5, `pass-${currentPass}-weak`);
    const comboBonus = sessionCombo % 5 === 0 ? 5 : 0;
    let sprintBonus = 0;
    let unlockedFragment = false;
    if (state.sprintProgress >= 10) {
      state.sprintProgress = 0;
      state.totalSprints = (Number(state.totalSprints) || 0) + 1;
      state.starFragments = (Number(state.starFragments) || 0) + 1;
      sprintBonus = 25;
      unlockedFragment = true;
    }
    const baseGain = newlyPassed ? 10 : 4;
    state.totalXp = (Number(state.totalXp) || 0) + baseGain + comboBonus + sprintBonus;
    state.bestCombo = Math.max(Number(state.bestCombo) || 0, sessionCombo);
    const missionRewards = claimDailyMissionRewards(learnedTodayCount());
    if (missionRewards.length) {
      rewardMessage = `✦ ${missionRewards.map(mission => mission.name).join("、")}完成！额外获得 ${missionRewards.reduce((sum, mission) => sum + mission.bonus, 0)} XP。`;
    } else if (unlockedFragment) {
      rewardMessage = `✦ 十词跃迁完成！获得 1 枚星图碎片与 ${sprintBonus} XP。`;
    } else if (comboBonus) {
      rewardMessage = `连击 ${sessionCombo}！本词 ${baseGain} XP + 连击奖励 ${comboBonus} XP。`;
    } else if (level <= 2) {
      rewardMessage = `${word.id} 已进入记忆救援队列，隔开 ${currentPass === 2 ? 4 : 5} 词后闭卷重现 · +${baseGain} XP。`;
    } else if (level === 5) {
      rewardMessage = `${word.id} 已达到秒反应 · +${baseGain} XP。`;
    } else {
      rewardMessage = `${newlyPassed ? "完成" : "复习"} ${word.id} · +${baseGain} XP。`;
    }
    rewardMessage += ` · 已记录第 ${currentPass} 遍「${PASS_METHODS[currentPass].title}」；累计 ${passCount} 遍。`;
    if (currentPass === 2) {
      state.recallBuffer.push(word.id);
      if (state.recallBuffer.length > 5) state.recallBuffer = state.recallBuffer.slice(-5);
      queueRecallCheckpoint();
    }
    const words = currentWords();
    let changedGroup = false;
    if (state.index < words.length - 1) {
      state.index += 1;
      savePassIndex();
    } else {
      const position = groupNumbers.indexOf(Number(state.group));
      const nextGroup = groupNumbers[position + 1];
      if (nextGroup) {
        const completedGroup = state.group;
        savePassIndex();
        state.group = nextGroup;
        const nextWords = currentWords();
        const firstUnfinished = nextWords.findIndex(item => !isPassComplete(item.id, currentPass));
        state.index = firstUnfinished >= 0 ? firstUnfinished : storedPassIndex();
        savePassIndex();
        changedGroup = true;
        rewardMessage = `Group ${completedGroup} 第 ${currentPass} 遍完成，继续进入 Group ${nextGroup} 的同一种学习方法。`;
      }
    }
    persist();
    if (changedGroup) renderGroup();
    else renderWord();
    if (rewardMessage.startsWith("✦")) triggerRewardBurst();
    if (newlyCompletedId) window.dispatchEvent(new CustomEvent("lexiverse-study-complete", { detail: { id: newlyCompletedId } }));
  }

  window.addEventListener("lexiverse-pass-change", event => {
    const source = event.detail?.source;
    const trackable = ["group-study-flow", "group-reading", "confusable-mastered", "confusable-review", "context-review", "adaptive-reading", "memory-rescue"];
    if (!trackable.includes(source)) return;
    recordStudyActivity(event.detail?.ids || [], source);
    if (["context-review", "adaptive-reading"].includes(source)) setTimeout(() => {
      renderRewardBar();
      renderStats();
    }, 0);
  });

  window.addEventListener("lexiverse-context-review", event => {
    const quality = Math.max(0, Math.min(2, Number(event.detail?.quality) || 0));
    const gain = quality === 2 ? 12 : quality === 1 ? 6 : 2;
    state.totalXp = (Number(state.totalXp) || 0) + gain;
    rewardMessage = quality === 2
      ? `词义与使用场景完整取回 · +${gain} XP · 场景连击 ${Number(event.detail?.streak) || 1}。`
      : quality === 1
        ? `认得词义，场景连接待加固 · +${gain} XP。`
        : `发现一处语境记忆断点 · +${gain} XP，10 分钟后重新连接。`;
    persist();
    renderRewardBar();
    renderStats();
  });

  window.addEventListener("lexiverse-confusable-complete", event => {
    const mastered = Boolean(event.detail?.mastered);
    const gain = mastered ? (event.detail?.firstMastery ? 15 : 5) : 2;
    state.totalXp = (Number(state.totalXp) || 0) + gain;
    rewardMessage = mastered ? `易混词边界建立成功 · +${gain} XP。` : `已标记为需要再次对比 · +${gain} XP。`;
    persist();
    renderRewardBar();
  });

  window.addEventListener("lexiverse-level-change", event => {
    if (!event.detail?.id || ["group-study-flow", "memory-rescue", "recall-checkpoint"].includes(event.detail.source)) return;
    const word = wordMap.get(event.detail.id);
    if (!word) return;
    word.level = Number(event.detail.level) || 1;
    levelStore[word.id] = word.level;
    if (currentWords()[state.index]?.id === word.id) renderWord();
    else renderStats();
  });

  document.addEventListener("keydown", event => {
    if (state.activeRest) return;
    const target = event.target;
    if (target instanceof HTMLElement && (target.matches("input, textarea, select") || target.isContentEditable)) return;
    const section = document.getElementById("group-study");
    const rect = section?.getBoundingClientRect();
    if (!rect || rect.bottom < 120 || rect.top > window.innerHeight - 120) return;
    if (state.pendingRecall && Number(state.studyPass) === 2) {
      if (state.pendingRecall.answeredAt && event.key === "Enter") {
        event.preventDefault();
        wordCard.querySelector("[data-recall-continue]")?.click();
        return;
      }
      const choiceIndex = ["a", "b", "c", "d"].indexOf(event.key.toLowerCase());
      if (!state.pendingRecall.answeredAt && choiceIndex >= 0) {
        event.preventDefault();
        const choices = [...wordCard.querySelectorAll("[data-recall-choice]")];
        choices[choiceIndex]?.click();
      }
      return;
    }
    if (state.pendingRescue && [1, 2].includes(Number(state.studyPass))) {
      if (state.pendingRescue.answeredAt && event.key === "Enter") {
        event.preventDefault();
        wordCard.querySelector("[data-rescue-continue]")?.click();
        return;
      }
      const choiceIndex = ["a", "b", "c", "d"].indexOf(event.key.toLowerCase());
      if (!state.pendingRescue.answeredAt && choiceIndex >= 0) {
        event.preventDefault();
        const choices = [...wordCard.querySelectorAll("[data-rescue-choice]")];
        choices[choiceIndex]?.click();
      }
      return;
    }
    if (["1", "2", "3", "4", "5"].includes(event.key) && Number(state.studyPass) !== 3) {
      event.preventDefault();
      rateAndAdvance(Number(event.key));
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      state.index = Math.max(0, Number(state.index) - 1);
      renderWord();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      state.index = Math.min(currentWords().length - 1, Number(state.index) + 1);
      renderWord();
    }
  });
  document.getElementById("reshuffle-group-readings").addEventListener("click", () => {
    if (Number(state.studyPass) === 3) renderReadings(true);
  });
  document.querySelectorAll("[data-study-pass]").forEach(button => button.addEventListener("click", () => {
    const nextPass = Number(button.dataset.studyPass);
    if (![1, 2, 3].includes(nextPass) || nextPass === Number(state.studyPass)) return;
    savePassIndex();
    state.studyPass = nextPass;
    state.readingPass = 3;
    state.index = storedPassIndex();
    rewardMessage = `已切换到第 ${nextPass} 遍 · ${PASS_METHODS[nextPass].title}。其他遍的记录保持不变。`;
    persist();
    renderGroup();
  }));
  document.querySelectorAll("[data-reading-history-filter]").forEach(button => button.addEventListener("click", () => {
    readingHistoryFilter = button.dataset.readingHistoryFilter;
    document.querySelectorAll("[data-reading-history-filter]").forEach(option => option.setAttribute("aria-pressed", String(option === button)));
    renderReadingHistory();
  }));
  document.querySelectorAll("[data-group-progress-filter]").forEach(button => button.addEventListener("click", () => {
    groupProgressFilter = button.dataset.groupProgressFilter;
    document.querySelectorAll("[data-group-progress-filter]").forEach(option => option.setAttribute("aria-pressed", String(option === button)));
    renderStats();
  }));
  progressImportButton?.addEventListener("click", () => progressImportFile?.click());
  progressImportFile?.addEventListener("change", async () => {
    const file = progressImportFile.files?.[0];
    if (!file) return;
    showImportStatus(`正在核对 ${file.name}……`);
    try {
      await importNotionProgress(file);
    } catch (error) {
      showImportStatus(error?.message || "导入失败，请重新选择文件。", true);
      progressImportFile.value = "";
    }
  });
  progressImportUndo?.addEventListener("click", () => {
    try {
      const backup = JSON.parse(localStorage.getItem("lexiverse-notion-import-backup-v1"));
      if (!backup) return;
      if (backup.levels === null) localStorage.removeItem("lexiverse-levels");
      else localStorage.setItem("lexiverse-levels", backup.levels);
      if (backup.groupStudy === null) localStorage.removeItem("lexiverse-group-study-v1");
      else localStorage.setItem("lexiverse-group-study-v1", backup.groupStudy);
      if (backup.passes === null) localStorage.removeItem(window.LexiversePasses?.key || "lexiverse-word-passes-v1");
      else {
        localStorage.setItem(window.LexiversePasses?.key || "lexiverse-word-passes-v1", backup.passes);
        try { window.LexiversePasses?.restore(JSON.parse(backup.passes), "notion-import-undo"); } catch {}
      }
      localStorage.removeItem("lexiverse-notion-import-backup-v1");
      localStorage.removeItem("lexiverse-notion-import-report-v1");
      window.location.reload();
    } catch {
      showImportStatus("无法恢复导入前的备份。", true);
    }
  });
  document.getElementById("xp-alert-step")?.addEventListener("change", event => {
    const nextStep = Number(event.target.value);
    if (![100, 250, 500, 1000].includes(nextStep)) return;
    state.xpAlertStep = nextStep;
    state.lastXpAlertMilestone = Math.floor((Number(state.totalXp) || 0) / nextStep) * nextStep;
    rewardMessage = `XP 里程碑提醒已调整为每 ${nextStep} XP 一次。`;
    persist();
    renderRewardBar();
  });
  document.getElementById("xp-game-alert-close")?.addEventListener("click", closeXpGameAlert);
  document.getElementById("xp-game-alert-confirm")?.addEventListener("click", closeXpGameAlert);
  document.getElementById("xp-game-alert")?.addEventListener("click", event => {
    if (event.target === event.currentTarget) closeXpGameAlert();
  });
  document.getElementById("xp-rest-overlay-end")?.addEventListener("click", () => finishRestSession(false));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeXpGameAlert();
  });

  restoreImportSummary();
  renderGroup();
})();
