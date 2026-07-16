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
  let state = { group: groupNumbers[0] || 1, index: 0, completed: {}, splits: {}, variants: {}, totalXp: 0, bestCombo: 0, dailyRewards: {}, modeRewards: {}, readingHistory: [], readingRewarded: [], readingPass: 2, badges: {}, studyHistory: [], sprintProgress: 0, totalSprints: 0, starFragments: 0, constellations: [] };
  let levelStore = {};
  let sessionCombo = 0;
  let rewardMessage = "从今天的第一个词开始点亮星系。";
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
    { id: "review-10", name: "回收舱", detail: "复习卡完成 10 词", target: 10, sources: ["review-card"], bonus: 80 },
    { id: "confusable-3", name: "辨析舱", detail: "对比 3 组易混词", target: 3, sources: ["confusable-mastered", "confusable-review"], bonus: 90 },
    { id: "reading-1", name: "实战舱", detail: "完成 1 篇词汇阅读", target: 1, sources: ["group-reading", "adaptive-reading"], bonus: 100 }
  ];
  const CONSTELLATIONS = ["猎户座", "天琴座", "天鹅座", "仙女座", "飞马座", "凤凰座", "北冕座", "天龙座", "船帆座", "天鹰座", "双子座", "鲸鱼座"];

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
    { id: "confusable-five", icon: "VS", title: "边界猎手", detail: "分清 5 组易混词", test: data => data.confusable >= 5 },
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
    if (xp) xp.textContent = `${totalXp} XP`;
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
      const levels = [1, 2, 3, 4, 5].map(level => words.filter(word => Number(levelStore[word.id] || word.level || 1) === level).length);
      const averageLevel = words.length
        ? levels.reduce((sum, count, index) => sum + count * (index + 1), 0) / words.length
        : 0;
      const averagePasses = words.length
        ? words.reduce((sum, word) => sum + (window.LexiversePasses?.get(word.id) || 0), 0) / words.length
        : 0;
      return { number, total: words.length, learned, levels, averageLevel, averagePasses, percent: words.length ? Math.round(learned / words.length * 100) : 0 };
    });
    const completedGroups = progressRows.filter(row => row.total && row.learned === row.total).length;
    const strongerWords = satWords.filter(word => Number(levelStore[word.id] || word.level || 1) >= 3).length;
    const streak = learningStreak(timestamps);
    const overallPercent = satWords.length ? Math.round(completedIds.size / satWords.length * 100) : 0;
    const totalPasses = satWords.reduce((sum, word) => sum + (window.LexiversePasses?.get(word.id) || 0), 0);
    const passCounts = satWords.map(word => window.LexiversePasses?.get(word.id) || 0);
    const passOne = passCounts.filter(count => count >= 1).length;
    const passTwo = passCounts.filter(count => count >= 2).length;
    const passThree = passCounts.filter(count => count >= 3).length;
    const passFour = passCounts.filter(count => count >= 4).length;
    let confusableMastered = 0;
    try { confusableMastered = Object.keys(JSON.parse(localStorage.getItem("lexiverse-confusable-study-v1"))?.mastered || {}).length; } catch {}
    const readingHistory = Array.isArray(state.readingHistory) ? state.readingHistory : [];
    statCards.innerHTML = `
      <article><span>已背单词</span><strong>${completedIds.size}<small> / ${satWords.length}</small></strong><p>累计学习 ${totalPasses} 遍 · ${overallPercent}% complete</p></article>
      <article><span>完成 Group</span><strong>${completedGroups}<small> / ${groupNumbers.length}</small></strong><p>${progressRows.filter(row => row.learned > 0 && row.learned < row.total).length} 个进行中</p></article>
      <article><span>今日学习</span><strong>${learnedToday}<small> 词</small></strong><p>${learnedToday >= 100 ? "100 词目标已达成" : `再学习 ${Math.max(0, 100 - learnedToday)} 个不同单词完成目标`}</p></article>
      <article><span>连续学习</span><strong>${streak}<small> 天</small></strong><p>熟悉度 ≥ 3：${strongerWords} 词</p></article>`;
    const passJourney = document.getElementById("study-pass-journey");
    if (passJourney) passJourney.innerHTML = `<div class="pass-journey-heading"><div><strong>四阶段征服路线</strong><span>目标不是“见过”，而是把单词推进到原文中秒反应</span></div><small>三刷覆盖 ${Math.round(passThree / Math.max(1, satWords.length) * 100)}%</small></div><div class="pass-journey-grid">${[
      ["I", "开图", passOne, "完成第 1 遍"], ["II", "稳固", passTwo, "完成第 2 遍"], ["III", "实战", passThree, "完成第 3 遍"], ["IV", "秒反应", passFour, "完成 4 遍以上"]
    ].map(([roman, title, count, detail]) => `<article><i>${roman}</i><div><strong>${title}</strong><span>${detail}</span></div><b>${count}<small> / ${satWords.length}</small></b><em><u style="--journey-progress:${count / Math.max(1, satWords.length) * 100}%"></u></em></article>`).join("")}</div>`;
    document.getElementById("study-overall-label").textContent = `${completedIds.size} / ${satWords.length} · ${overallPercent}%`;
    document.getElementById("study-progress-fill").style.width = `${overallPercent}%`;
    const currentRow = progressRows.find(row => row.number === Number(state.group));
    const motivation = document.getElementById("study-motivation");
    motivation.textContent = completedIds.size === satWords.length
      ? "整个 SAT WordBank 已完成。你已经把一片星系走成了自己的路。"
      : learnedToday >= 100
        ? `今天已经拿下 ${learnedToday} 个词，百词目标完成。`
        : currentRow?.learned
          ? `Group ${state.group} 已完成 ${currentRow.learned}/${currentRow.total}，距离点亮这一组还差 ${currentRow.total - currentRow.learned} 个。`
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
      passThree,
      passFour
    });
    const visibleRows = progressRows.filter(row => {
      if (groupProgressFilter === "active") return row.learned > 0 && row.learned < row.total;
      if (groupProgressFilter === "complete") return row.total > 0 && row.learned === row.total;
      return true;
    });
    groupProgressGrid.innerHTML = visibleRows.length ? visibleRows.map(row => `
      <button type="button" data-progress-group="${row.number}" class="${row.learned === row.total ? "complete" : row.learned ? "active" : ""} ${row.number === Number(state.group) ? "current" : ""}" aria-label="Group ${row.number}，已背 ${row.learned} / ${row.total}，平均熟悉度 ${row.averageLevel.toFixed(1)}，平均学习 ${row.averagePasses.toFixed(1)} 遍，L1 到 L5 分别为 ${row.levels.join("、")}">
        <div class="group-progress-top"><span>G${row.number}</span><strong>${row.learned}/${row.total}</strong></div>
        <span class="group-level-average">熟悉度 ${row.averageLevel.toFixed(1)} · 平均 ${row.averagePasses.toFixed(1)} 遍</span>
        <div class="group-level-bar" aria-hidden="true">${row.levels.map((count, index) => `<i class="level-${index + 1}" style="--level-width:${row.total ? count / row.total * 100 : 0}%"></i>`).join("")}</div>
        <div class="group-level-counts" aria-hidden="true">${row.levels.map((count, index) => `<span class="level-${index + 1}">L${index + 1} <b>${count}</b></span>`).join("")}</div>
        <i class="group-completion-bar" style="--group-progress:${row.percent}%" aria-hidden="true"></i>
      </button>`).join("") : `<p class="group-progress-empty">这个筛选下暂时没有 Group。</p>`;
    groupProgressGrid.querySelectorAll("[data-progress-group]").forEach(button => button.addEventListener("click", () => {
      state.group = Number(button.dataset.progressGroup);
      const words = currentWords();
      const firstUnfinished = words.findIndex(word => !state.completed[word.id]);
      state.index = firstUnfinished >= 0 ? firstUnfinished : 0;
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

  function shuffledIds(words) {
    const result = words.map(word => word.id);
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  }

  function buildSplit(force = false) {
    const key = String(state.group);
    const words = currentWords();
    const savedIds = Array.isArray(state.splits[key]) ? state.splits[key].flat() : [];
    const validSaved = savedIds.length === words.length && savedIds.every(id => words.some(word => word.id === id));
    const validVariants = Array.isArray(state.variants?.[key]) && state.variants[key].length === 3;
    if (force || !validSaved) {
      const ids = shuffledIds(words);
      const sizes = splitSizes(ids.length);
      let offset = 0;
      state.splits[key] = sizes.map(size => {
        const part = ids.slice(offset, offset + size);
        offset += size;
        return part;
      });
    }
    if (force || !validVariants) {
      const variantIds = Array.from({ length: COHERENT_READING_BLUEPRINTS.length }, (_, index) => index);
      for (let index = variantIds.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [variantIds[index], variantIds[swapIndex]] = [variantIds[swapIndex], variantIds[index]];
      }
      state.variants = state.variants || {};
      const varied = [];
      variantIds.forEach(variantId => {
        if (varied.length < 3 && !varied.some(selectedId => COHERENT_READING_BLUEPRINTS[selectedId].skill === COHERENT_READING_BLUEPRINTS[variantId].skill)) varied.push(variantId);
      });
      variantIds.forEach(variantId => {
        if (varied.length < 3 && !varied.includes(variantId)) varied.push(variantId);
      });
      state.variants[key] = varied;
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
        <div><strong>${escapeHtml(entry.id)}</strong><small>${escapeHtml(entry.word?.pos || "related word")}</small><b>${percent}%</b></div>
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
    if (count) count.textContent = `${sprintValue} / 10 · 已完成 ${Number(state.totalSprints) || 0} 轮`;
    if (fill) fill.style.width = `${sprintValue * 10}%`;
    const next = words[state.index + 1];
    const groupPosition = groupNumbers.indexOf(Number(state.group));
    const nextGroup = groupNumbers[groupPosition + 1];
    if (preview) preview.textContent = next
      ? `按 1 / 2 / 3 / 4 / 5 自动前进 · 下一颗：${next.id} · ${next.zh || next.definition || "继续保持节奏"}`
      : nextGroup
        ? `本组最后一词 · 完成后自动进入 Group ${nextGroup}`
        : "已经到达最后一颗单词";
  }

  function renderWord() {
    const words = currentWords();
    if (!words.length) return;
    state.index = Math.max(0, Math.min(Number(state.index) || 0, words.length - 1));
    const word = words[state.index];
    const synonyms = relatedEntries(word.id, "synonym", 4);
    const antonyms = relatedEntries(word.id, "antonym", 4);
    const family = familyFor(word);
    const completed = Boolean(state.completed[word.id]);
    const passCount = window.LexiversePasses?.get(word.id) || (completed ? 2 : 1);
    document.getElementById("study-word-position").textContent = `${state.index + 1} / ${words.length}`;
    wordCard.innerHTML = `
      <div class="study-word-meta"><span>词性 · ${escapeHtml(word.pos)}</span><span>${escapeHtml(word.group)}</span><span class="${completed ? "is-complete" : ""}">${completed ? "本轮已完成" : "待本轮"}</span><span class="study-pass-count">累计 ${passCount} 遍</span></div>
      <h3>${escapeHtml(word.id)}</h3>
      <p class="study-phonetic">${escapeHtml(word.phonetic)}</p>
      <p class="study-definition">${escapeHtml(word.definition)}</p>
      <p class="study-meaning">${escapeHtml(word.zh)}</p>
      <div class="study-inline-flow" role="group" aria-label="熟悉度评级并进入下一词">
        <span><b>我的熟悉度 · 评级后自动进入下一词</b><small>直接按 1–5；← → 浏览</small></span>
        ${[[1, "陌生"], [2, "模糊"], [3, "想起"], [4, "掌握"], [5, "秒反应"]].map(([level, label]) => `<button type="button" data-inline-flow-level="${level}" class="level-${level} ${Number(word.level) === level ? "active" : ""}" aria-label="熟悉度 ${level}，${label}，保存并进入下一词"><kbd>${level}</kbd>${label}</button>`).join("")}
      </div>
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
        <div class="study-family-grid">${family.members.length ? family.members.map(member => member.word
          ? `<button type="button" data-study-family="${escapeHtml(member.id)}"><strong>${escapeHtml(member.id)}</strong><small>${escapeHtml(member.word.pos || "word")}</small><span>${escapeHtml(member.meaning)}</span></button>`
          : `<div><strong>${escapeHtml(member.id)}</strong><small>词库外同源词</small><span>${escapeHtml(member.meaning)}</span></div>`).join("")
          : `<div class="study-family-anchor"><strong>${escapeHtml(word.id)} 的祖源</strong><span>${escapeHtml(window.getLexicalEtymology ? window.getLexicalEtymology(word) : word.etymology || "尚待核对")}</span></div>`}</div>
      </section>
      <div class="study-origin"><strong>词源 · 拉丁语优先</strong><p>${escapeHtml(window.getLexicalEtymology ? window.getLexicalEtymology(word) : (word.etymology || "暂未找到可靠词源记录。"))}</p><strong>词源记忆</strong><p>${escapeHtml(word.memory || `把 ${word.id} 与例句语境绑定记忆。`)}</p></div>
      <button class="study-open-galaxy" type="button">在单词星系中查看关系</button>`;
    wordCard.querySelector(".study-open-galaxy").addEventListener("click", () => {
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
    wordStrip.innerHTML = words.map((item, index) => `<button type="button" data-study-index="${index}" class="${index === state.index ? "active" : ""} ${state.completed[item.id] ? "complete" : ""}" aria-label="${escapeHtml(item.id)}，累计 ${window.LexiversePasses?.get(item.id) || 1} 遍">${index + 1}</button>`).join("");
    wordStrip.querySelectorAll("[data-study-index]").forEach(button => button.addEventListener("click", () => {
      state.index = Number(button.dataset.studyIndex);
      persist();
      renderWord();
    }));
    const completedCount = words.filter(item => state.completed[item.id]).length;
    document.getElementById("study-group-progress").textContent = `Group ${state.group}：已背 ${completedCount} / ${words.length}`;
    persist();
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
      choices: ["Independent excerpts can reveal how context gives precise force to vocabulary even when the excerpts concern different subjects.", "Words have useful meanings only when every excerpt addresses the same subject.", "Any unfamiliar word can be replaced by a broad synonym without changing a sentence.", "The excerpts were collected to establish a single historical sequence."],
      explanation: "The packet is explicitly organized around contextual precision, not a shared topic or chronology."
    },
    {
      domain: "Craft and Structure", skill: "Text Structure and Purpose",
      question: "What is the main function of the numbered excerpts in the text as a whole?",
      choices: ["They provide concrete cases for the editor's claim about meaning in context.", "They present stages of one experiment in chronological order.", "They contradict the statement that the excerpts address unrelated subjects.", "They offer biographical information about the editor."],
      explanation: "Each excerpt is a separate example used to support the editor's claim about contextual meaning."
    },
    {
      domain: "Information and Ideas", skill: "Inferences",
      question: "Which choice most logically follows from the editor's method?",
      choices: ["A successful paraphrase must preserve the relationship expressed by the target word, not merely the passage's broad topic.", "A paraphrase is accurate whenever it contains fewer words.", "Context becomes irrelevant once a dictionary definition is supplied.", "Unrelated excerpts cannot be studied together for any purpose."],
      explanation: "The method evaluates whether a replacement preserves a word's precise contextual contribution."
    },
    {
      domain: "Information and Ideas", skill: "Command of Evidence",
      question: "Which finding would most directly strengthen the editor's conclusion?",
      choices: ["Readers given broad replacements identify the excerpts' topics but miss distinctions expressed by the original target words.", "Readers prefer excerpts printed in a larger typeface.", "One excerpt contains more punctuation than another.", "The target words differ in length and number of syllables."],
      explanation: "The finding directly separates broad topic recognition from the loss of precise distinctions."
    },
    {
      domain: "Craft and Structure", skill: "Words in Context",
      question: "As used in the text, “precision” most nearly refers to",
      choices: ["the ability of a word to express a specific relationship or distinction in its sentence.", "the number of letters contained in a word.", "the factual accuracy of every claim in an excerpt.", "the similarity of the excerpts' subject matter."],
      explanation: "The text defines precision through the specific contextual work performed by each target word."
    },
    {
      domain: "Craft and Structure", skill: "Text Structure and Purpose",
      question: "Why does the text explicitly state that the excerpts do not form a continuous article?",
      choices: ["To prevent readers from inferring a false relationship among unrelated examples and clarify the packet's actual purpose.", "To suggest that the excerpts should be rearranged into chronological order.", "To show that none of the excerpts contains meaningful vocabulary.", "To establish that all the excerpts were written by one author."],
      explanation: "The statement makes the structure honest: the excerpts are independent examples joined only by the vocabulary exercise."
    }
  ];

  function stableHash(value) {
    let result = 2166136261;
    for (let index = 0; index < value.length; index += 1) result = Math.imul(result ^ value.charCodeAt(index), 16777619);
    return result >>> 0;
  }

  function quoteSentence(word, index) {
    return `Excerpt ${index + 1} uses ${word.id} in context: “${String(word.example || "").trim()}”`;
  }

  function readingFor(words, cardIndex) {
    const variantId = state.variants[String(state.group)]?.[cardIndex] ?? cardIndex;
    const blueprint = COHERENT_READING_BLUEPRINTS[variantId % COHERENT_READING_BLUEPRINTS.length];
    const passages = words.map(quoteSentence).join(" ");
    const orderedChoices = blueprint.choices
      .map((text, originalIndex) => ({ text, originalIndex }))
      .sort((a, b) => stableHash(`${state.group}|${variantId}|${words.map(word => word.id).join("|")}|${a.text}`) - stableHash(`${state.group}|${variantId}|${words.map(word => word.id).join("|")}|${b.text}`));
    return {
      domain: blueprint.domain,
      skill: blueprint.skill,
      passage: `A vocabulary editor assembled the following independent excerpts to examine how context narrows a word's meaning. The excerpts do not form one continuous article and are not presented as contrasting accounts of the same event. ${passages} The editor concludes that a useful paraphrase must preserve the specific relationship expressed by each target word, not merely the excerpt's general topic.`,
      question: blueprint.question,
      choices: orderedChoices.map(choice => choice.text),
      answer: orderedChoices.findIndex(choice => choice.originalIndex === 0),
      explanation: blueprint.explanation,
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
    readingStatCards.innerHTML = `
      <article><span>今天完成</span><strong>${todayRows.length}<small> 篇</small></strong><p>今天三刷训练量</p></article>
      <article><span>当前 Group</span><strong>${currentRows.length}<small> 篇</small></strong><p>Group ${state.group} 累计</p></article>
      <article><span>全部阅读</span><strong>${history.length}<small> 篇</small></strong><p>记录永久保存在本机</p></article>
      <article><span>正确率</span><strong>${accuracy}<small>%</small></strong><p>${correct} 篇回答正确</p></article>`;
    const visible = (readingHistoryFilter === "current" ? currentRows : history).slice().sort((a, b) => b.answeredAt - a.answeredAt).slice(0, 60);
    readingHistoryBox.innerHTML = visible.length ? visible.map(record => `
      <details class="reading-history-item ${record.correct ? "correct" : "incorrect"}">
        <summary><span>G${record.group} · ${record.pass === 3 ? "三刷原文" : "二刷高亮"} · Reading ${record.readingIndex + 1}</span><strong>${record.correct ? "答对" : "答错"}</strong><small>${new Date(record.answeredAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</small></summary>
        <div class="reading-history-detail">
          <div class="group-reading-targets">${(record.words || []).map(id => `<span>${escapeHtml(id)}</span>`).join("")}</div>
          <p>${escapeHtml(record.passage)}</p>
          <strong>${escapeHtml(record.question)}</strong>
          <ol>${(record.choices || []).map((choice, index) => `<li class="${index === record.answer ? "answer" : index === record.selected ? "selected" : ""}">${escapeHtml(choice)}</li>`).join("")}</ol>
          <p class="history-explanation">${escapeHtml(record.explanation)}</p>
        </div>
      </details>`).join("") : `<p class="reading-history-empty">${readingHistoryFilter === "current" ? `Group ${state.group} 还没有阅读记录。完成上面的任意一题后会自动保存在这里。` : "还没有阅读记录。"}</p>`;
  }

  function recordReadingAttempt({ data, words, readingIndex, selected, key }) {
    state.readingHistory = Array.isArray(state.readingHistory) ? state.readingHistory : [];
    const record = {
      id: `${key}|${Date.now()}`,
      key,
      group: Number(state.group),
      pass: Number(state.readingPass) === 3 ? 3 : 2,
      readingIndex,
      words: words.map(word => word.id),
      passage: data.passage,
      question: data.question,
      choices: data.choices,
      answer: data.answer,
      selected,
      correct: selected === data.answer,
      explanation: data.explanation,
      answeredAt: Date.now()
    };
    state.readingHistory.push(record);
    if (state.readingHistory.length > 800) state.readingHistory = state.readingHistory.slice(-800);
    state.readingRewarded = Array.isArray(state.readingRewarded) ? state.readingRewarded : [];
    if (!state.readingRewarded.includes(key)) {
      state.readingRewarded.push(key);
      window.LexiversePasses?.increment(words.map(word => word.id), "group-reading");
      const gain = record.correct ? 20 : 8;
      state.totalXp = (Number(state.totalXp) || 0) + gain;
      rewardMessage = `${record.correct ? "原文反应正确" : "完成一次原文训练"}，阅读能量 +${gain} XP。`;
    }
    persist();
    renderReadingHistory();
    renderStats();
    renderRewardBar();
  }

  function renderReadings(force = false) {
    const split = buildSplit(force);
    const sizes = split.map(part => part.length);
    const pass = Number(state.readingPass) === 3 ? 3 : 2;
    document.getElementById("study-split-summary").textContent = pass === 3
      ? `三刷模式：不高亮目标词，训练在原文中直接反应词义 · ${sizes.join(" / ")} 覆盖全部 ${sizes.reduce((sum, size) => sum + size, 0)} 词`
      : `二刷模式：高亮目标词并巩固语境 · ${sizes.join(" / ")} 覆盖全部 ${sizes.reduce((sum, size) => sum + size, 0)} 词`;
    readingList.innerHTML = "";
    split.forEach((ids, index) => {
      const words = ids.map(id => wordMap.get(id)).filter(Boolean);
      const data = readingFor(words, index);
      const attemptKey = `${state.group}|${pass}|${data.variantId}|${ids.join(",")}`;
      const doneCount = (state.readingHistory || []).filter(record => record.key === attemptKey).length;
      const article = document.createElement("article");
      article.className = `group-reading-card pass-${pass}`;
      article.innerHTML = `
        <div class="group-reading-meta"><span>READING ${index + 1} · ${escapeHtml(data.domain)} · ${escapeHtml(data.skill)}</span><span>${doneCount ? `已做 ${doneCount} 次` : `${words.length} TARGET WORDS`}</span></div>
        ${pass === 3
          ? `<details class="group-reading-target-reveal"><summary>完成后查看本篇 ${words.length} 个目标词</summary><div class="group-reading-targets">${words.map(word => `<span>${escapeHtml(word.id)} · ${escapeHtml(word.pos)}</span>`).join("")}</div></details>`
          : `<div class="group-reading-targets">${words.map(word => `<span>${escapeHtml(word.id)} · ${escapeHtml(word.pos)}</span>`).join("")}</div>`}
        <p class="group-reading-passage"></p>
        <p class="group-reading-question">${escapeHtml(data.question)}</p>
        <div class="group-reading-choices">${data.choices.map((choice, choiceIndex) => `<button type="button" data-choice="${choiceIndex}">${String.fromCharCode(65 + choiceIndex)}. ${escapeHtml(choice)}</button>`).join("")}</div>
        <p class="group-reading-answer" hidden>正确答案：${String.fromCharCode(65 + data.answer)}。${escapeHtml(data.explanation)}</p>`;
      const passage = article.querySelector(".group-reading-passage");
      const targetPattern = new RegExp(`(${words.map(word => word.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).sort((a, b) => b.length - a.length).join("|")})`, "gi");
      data.passage.split(targetPattern).forEach(part => {
        const matched = words.some(word => word.id.toLowerCase() === part.toLowerCase());
        if (matched && pass === 2) {
          const mark = document.createElement("mark");
          mark.textContent = part;
          passage.append(mark);
        } else passage.append(document.createTextNode(part));
      });
      let answered = false;
      article.querySelectorAll("[data-choice]").forEach(button => button.addEventListener("click", () => {
        if (answered) return;
        answered = true;
        article.querySelectorAll("[data-choice]").forEach((choice, choiceIndex) => {
          choice.disabled = true;
          if (choiceIndex === data.answer) choice.classList.add("correct");
        });
        if (Number(button.dataset.choice) !== data.answer) button.classList.add("incorrect");
        article.querySelector(".group-reading-answer").hidden = false;
        recordReadingAttempt({ data, words, readingIndex: index, selected: Number(button.dataset.choice), key: attemptKey });
      }));
      readingList.append(article);
    });
    document.querySelectorAll("[data-reading-pass]").forEach(button => button.setAttribute("aria-pressed", String(Number(button.dataset.readingPass) === pass)));
    renderReadingHistory();
  }

  function renderGroup(forceSplit = false) {
    groupSelect.value = String(state.group);
    state.index = Math.min(Number(state.index) || 0, Math.max(0, currentWords().length - 1));
    renderWord();
    renderReadings(forceSplit);
    window.dispatchEvent(new CustomEvent("lexiverse-group-change", { detail: { group: Number(state.group) } }));
  }

  groupSelect.innerHTML = groupNumbers.map(number => `<option value="${number}">Group ${number}</option>`).join("");
  groupSelect.addEventListener("change", () => {
    state.group = Number(groupSelect.value);
    state.index = 0;
    persist();
    renderGroup();
  });
  document.getElementById("study-prev-group").addEventListener("click", () => {
    const position = groupNumbers.indexOf(Number(state.group));
    state.group = groupNumbers[Math.max(0, position - 1)];
    state.index = 0;
    renderGroup();
  });
  document.getElementById("study-next-group").addEventListener("click", () => {
    const position = groupNumbers.indexOf(Number(state.group));
    state.group = groupNumbers[Math.min(groupNumbers.length - 1, position + 1)];
    state.index = 0;
    renderGroup();
  });
  document.getElementById("study-prev-word").addEventListener("click", () => {
    state.index = Math.max(0, Number(state.index) - 1);
    renderWord();
  });
  document.getElementById("study-next-word").addEventListener("click", () => {
    state.index = Math.min(currentWords().length - 1, Number(state.index) + 1);
    renderWord();
  });

  function rateAndAdvance(level) {
    const word = currentWords()[state.index];
    if (!word || ![1, 2, 3, 4, 5].includes(Number(level))) return;
    word.level = Number(level);
    const passCounts = window.LexiversePasses?.increment(word.id, "group-study-flow") || {};
    const passCount = Number(passCounts[word.id]) || 1;
    levelStore[word.id] = word.level;
    localStorage.setItem("lexiverse-levels", JSON.stringify(levelStore));
    window.dispatchEvent(new CustomEvent("lexiverse-level-change", { detail: { id: word.id, level: word.level, source: "group-study-flow" } }));
    let newlyCompletedId = "";
    const wasCompleted = Boolean(state.completed[word.id]);
    if (!wasCompleted) {
      state.completed[word.id] = Date.now();
      newlyCompletedId = word.id;
    }
    sessionCombo += 1;
    state.sprintProgress = (Number(state.sprintProgress) || 0) + 1;
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
    const baseGain = wasCompleted ? 4 : 10;
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
      rewardMessage = `${word.id} 已放入重点复习轨道 · +${baseGain} XP。`;
    } else if (level === 5) {
      rewardMessage = `${word.id} 已达到秒反应 · +${baseGain} XP。`;
    } else {
      rewardMessage = `${wasCompleted ? "复习" : "拿下"} ${word.id} · +${baseGain} XP。`;
    }
    rewardMessage += ` · 累计第 ${passCount} 遍。`;
    const words = currentWords();
    let changedGroup = false;
    if (state.index < words.length - 1) {
      state.index += 1;
    } else {
      const position = groupNumbers.indexOf(Number(state.group));
      const nextGroup = groupNumbers[position + 1];
      if (nextGroup) {
        const completedGroup = state.group;
        state.group = nextGroup;
        const nextWords = currentWords();
        const firstUnfinished = nextWords.findIndex(item => !state.completed[item.id]);
        state.index = firstUnfinished >= 0 ? firstUnfinished : 0;
        changedGroup = true;
        rewardMessage = `Group ${completedGroup} 航程结束，已无缝进入 Group ${nextGroup}。`;
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
    const trackable = ["group-study-flow", "group-reading", "confusable-mastered", "confusable-review", "review-card", "adaptive-reading"];
    if (!trackable.includes(source)) return;
    recordStudyActivity(event.detail?.ids || [], source);
    if (["review-card", "adaptive-reading"].includes(source)) setTimeout(() => {
      renderRewardBar();
      renderStats();
    }, 0);
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
    if (!event.detail?.id || event.detail.source === "group-study-flow") return;
    const word = wordMap.get(event.detail.id);
    if (!word) return;
    word.level = Number(event.detail.level) || 1;
    levelStore[word.id] = word.level;
    if (currentWords()[state.index]?.id === word.id) renderWord();
    else renderStats();
  });

  document.addEventListener("keydown", event => {
    const target = event.target;
    if (target instanceof HTMLElement && (target.matches("input, textarea, select") || target.isContentEditable)) return;
    const section = document.getElementById("group-study");
    const rect = section?.getBoundingClientRect();
    if (!rect || rect.bottom < 120 || rect.top > window.innerHeight - 120) return;
    if (["1", "2", "3", "4", "5"].includes(event.key)) {
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
  document.getElementById("reshuffle-group-readings").addEventListener("click", () => renderReadings(true));
  document.querySelectorAll("[data-reading-pass]").forEach(button => button.addEventListener("click", () => {
    state.readingPass = Number(button.dataset.readingPass) === 3 ? 3 : 2;
    persist();
    renderReadings();
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

  restoreImportSummary();
  renderGroup();
})();
