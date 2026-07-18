(() => {
  const root = document.getElementById("smart-route");
  const reason = document.getElementById("smart-route-reason");
  const startButton = document.getElementById("smart-route-start");
  const metrics = document.getElementById("smart-route-metrics");
  const steps = document.getElementById("smart-route-steps");
  if (!root || !reason || !startButton || !metrics || !steps) return;

  const satWords = (window.WORDBANK_WORDS || []).filter(word => /^Group \d+$/.test(word.group || ""));
  const satIds = new Set(satWords.map(word => word.id));
  let currentRecommendation = { action: "group" };
  let refreshTimer = null;

  function readStore(key, fallback = {}) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value && typeof value === "object" ? value : fallback;
    } catch { return fallback; }
  }

  function localDayStart(timestamp = Date.now()) {
    const date = new Date(Number(timestamp) || Date.now());
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  }

  function isToday(timestamp) {
    return Number.isFinite(Number(timestamp)) && localDayStart(timestamp) === localDayStart();
  }

  function uniqueToday(rows, timestampKey, idKey) {
    return new Set((Array.isArray(rows) ? rows : [])
      .filter(row => isToday(row?.[timestampKey]))
      .map(row => row?.[idKey])
      .filter(Boolean));
  }

  function passRecords(state, pass) {
    return state?.passProgress?.[pass] || state?.passProgress?.[String(pass)] || {};
  }

  function routeData() {
    const groupState = readStore("lexiverse-group-study-v1");
    const levels = readStore("lexiverse-levels");
    const review = readStore("lexiverse-review-v1");
    const confusable = readStore("lexiverse-confusable-study-v1");
    const contextReview = readStore("lexiverse-context-review-v1");
    const group = Math.max(1, Number(groupState.group) || 1);
    const studyPass = [1, 2, 3].includes(Number(groupState.studyPass)) ? Number(groupState.studyPass) : 1;
    const groupWords = satWords.filter(word => word.group === `Group ${group}`);
    const currentPassRecords = passRecords(groupState, studyPass);
    const passDone = groupWords.filter(word => currentPassRecords[word.id]).length;
    const passTwo = passRecords(groupState, 2);
    const passTwoDone = groupWords.filter(word => passTwo[word.id]).length;
    const studiedToday = uniqueToday(groupState.studyHistory, "at", "id");
    if (!studiedToday.size) {
      Object.entries(groupState.completed || {}).forEach(([id, timestamp]) => {
        if (isToday(timestamp)) studiedToday.add(id);
      });
    }
    const readingsToday = (Array.isArray(groupState.readingHistory) ? groupState.readingHistory : [])
      .filter(row => isToday(row?.answeredAt)).length;
    const confusableToday = (Array.isArray(confusable.history) ? confusable.history : [])
      .filter(row => isToday(row?.at)).length;
    const recallAttempts = Math.max(0, Number(groupState.recallStats?.attempts) || 0);
    const recallCorrect = Math.max(0, Number(groupState.recallStats?.correct) || 0);
    const recallAccuracy = recallAttempts ? Math.round(recallCorrect / recallAttempts * 100) : null;
    const rescueQueueCount = Array.isArray(groupState.rescueQueue) ? groupState.rescueQueue.length : 0;
    const rescueCleared = Math.max(0, Number(groupState.rescueStats?.cleared) || 0);
    const contextToday = (Array.isArray(contextReview.history) ? contextReview.history : []).filter(row => isToday(row?.at)).length;
    const contextAttempts = Math.max(0, Number(contextReview.attempts) || 0);
    const contextCorrect = Math.max(0, Number(contextReview.correct) || 0);
    const contextStrong = Math.max(0, Number(contextReview.strong) || 0);
    const contextAccuracy = contextAttempts ? Math.round(contextCorrect / contextAttempts * 100) : null;

    const knownIds = new Set(Object.keys(review));
    Object.entries(levels).forEach(([id, level]) => { if (Number(level) > 1) knownIds.add(id); });
    Object.keys(groupState.completed || {}).forEach(id => knownIds.add(id));
    (Array.isArray(groupState.studyHistory) ? groupState.studyHistory : []).forEach(row => row?.id && knownIds.add(row.id));
    [1, 2, 3].forEach(pass => Object.keys(passRecords(groupState, pass)).forEach(id => knownIds.add(id)));
    const dueCount = satWords.filter(word => {
      if (!knownIds.has(word.id) || Number(levels[word.id] || word.level || 1) >= 5) return false;
      const record = review[word.id];
      return !record || Number(record.nextReview || 0) <= Date.now();
    }).length;
    const lowLevelCount = [...knownIds].filter(id => satIds.has(id) && Number(levels[id] || 1) <= 2).length;
    return {
      group, studyPass, groupWords, passDone, passTwoDone,
      learnedToday: studiedToday.size, readingsToday, confusableToday,
      recallAttempts, recallAccuracy, dueCount, lowLevelCount, rescueQueueCount, rescueCleared,
      contextToday, contextAttempts, contextAccuracy, contextStrong
    };
  }

  function chooseRecommendation(data) {
    const groupSize = data.groupWords.length || 10;
    if (data.dueCount >= 15) return {
      action: "review", label: "激活 20 个到期场景",
      reason: `${data.dueCount} 个已学词到达记忆下降点。系统只挑最容易遗忘的 20 个做一轮，不要求一次清空积压。`
    };
    if (data.learnedToday < 10 && data.studyPass === 3) return {
      action: "reading", label: "开始第三遍阅读",
      reason: `从 Group ${data.group} 的第一篇 3 / 3 / 4 阅读开始，用语境启动今天的第三遍训练。`
    };
    if (data.learnedToday < 10) return {
      action: "group", label: "启动 10 词冲刺",
      reason: `从 Group ${data.group} 第 ${data.studyPass} 遍开始，只承诺先完成 10 词；进入节奏后再决定是否继续。`
    };
    if (data.dueCount > 0) return {
      action: "review", label: `复习 ${data.dueCount} 个到期词`,
      reason: `今日已经热身 ${data.learnedToday} 词，现在清掉 ${data.dueCount} 个到期词，记忆收益最高。`
    };
    if (data.rescueQueueCount >= 5) return {
      action: "group", pass: data.studyPass === 3 ? 2 : null, label: `救回 ${data.rescueQueueCount} 个薄弱词`,
      reason: `${data.rescueQueueCount} 个 L1–L2 词正在等待延迟再现。继续主线，系统会每隔 3–5 词穿插一次闭卷救援。`
    };
    if (data.recallAttempts >= 5 && data.recallAccuracy !== null && data.recallAccuracy < 75) return {
      action: "group", pass: 2, label: "继续二刷提取练习",
      reason: `主动回忆正确率 ${data.recallAccuracy}%，继续在第二遍中完成 5 词一组的闭卷检查，比重复阅读更能加固记忆。`
    };
    if (data.passTwoDone >= groupSize && data.readingsToday < 3) return {
      action: "reading", label: "进入第三遍阅读",
      reason: `Group ${data.group} 的第二遍已经完成。现在用 3 / 3 / 4 原创阅读训练看到词就能直接反应。`
    };
    if (data.confusableToday < 3 && data.learnedToday >= 20) return {
      action: "confusable", label: "辨析 3 组易混词",
      reason: `今天已积累 ${data.learnedToday} 词，穿插 ${3 - data.confusableToday} 组易混辨析可以形成更清楚的词义边界。`
    };
    if (data.learnedToday < 100 && data.studyPass === 3) return {
      action: "reading", label: "继续第三遍阅读",
      reason: `今天已在语境中复习 ${data.learnedToday}/100 词；继续 Group ${data.group} 的第三遍阅读。`
    };
    if (data.learnedToday < 100) return {
      action: "group", label: "继续当前 Group",
      reason: `今天已完成 ${data.learnedToday}/100 词；Group ${data.group} 第 ${data.studyPass} 遍还剩 ${Math.max(0, groupSize - data.passDone)} 词。`
    };
    if (data.readingsToday < 3) return {
      action: "reading", label: "用阅读收尾",
      reason: "今日 100 词目标已经达成，用一篇高难度语境阅读把短期记忆转成快速识别。"
    };
    return {
      action: "confusable", label: "完成轻量辨析",
      reason: "今日主线已经完成。用一组易混词主动选择作为收尾，保持连续感但不过度疲劳。"
    };
  }

  const metricCard = (value, label, detail, tone = "cyan") => `
    <article data-tone="${tone}"><strong>${value}</strong><span>${label}</span><small>${detail}</small></article>`;

  function renderMetrics(data) {
    const recall = data.contextAttempts
      ? `${data.contextAccuracy}%`
      : data.recallAccuracy === null ? "—" : `${data.recallAccuracy}%`;
    metrics.innerHTML = [
      metricCard(`${Math.min(100, data.learnedToday)}/100`, "今日不同单词", data.learnedToday >= 100 ? "目标完成" : `还差 ${100 - Math.min(100, data.learnedToday)} 词`, "cyan"),
      metricCard(data.dueCount, "到期复习", data.dueCount ? "仅统计已经学过的词" : "当前已清空", data.dueCount ? "coral" : "green"),
      metricCard(recall, "语境取回", data.contextAttempts ? `今日激活 ${data.contextToday} 词 · 场景稳固 ${data.contextStrong}` : data.rescueQueueCount ? `救援 ${data.rescueQueueCount} 词 · 已救回 ${data.rescueCleared}` : "到达遗忘点后自动出现", "purple"),
      metricCard(data.readingsToday, "今日阅读", `${data.confusableToday} 组易混辨析`, "gold")
    ].join("");
  }

  function renderSteps(data, recommendation) {
    const groupSize = data.groupWords.length || 10;
    const rows = [
      { action: "group", index: "01", title: `Group ${data.group} · 第 ${data.studyPass} 遍`, detail: `${data.passDone}/${groupSize} 词 · 救援队列 ${data.rescueQueueCount}`, done: data.passDone >= groupSize && data.rescueQueueCount === 0 },
      { action: "review", index: "02", title: "遗忘周期 · 语境再激活", detail: data.dueCount ? `${data.dueCount} 个场景到期 · 今日激活 ${data.contextToday}` : `到期已清空 · 今日激活 ${data.contextToday}`, done: data.dueCount === 0 },
      { action: "confusable", index: "03", title: "建立词义边界", detail: `${Math.min(3, data.confusableToday)}/3 组易混辨析 · L1–L2 共 ${data.lowLevelCount} 词`, done: data.confusableToday >= 3 },
      { action: "reading", index: "04", title: "进入原文语境", detail: `${Math.min(3, data.readingsToday)}/3 篇 · 二刷 ${data.passTwoDone}/${groupSize}`, done: data.readingsToday >= 3 }
    ];
    steps.innerHTML = rows.map(row => {
      const current = row.action === recommendation.action;
      const state = row.done ? "done" : current ? "current" : "pending";
      return `<button type="button" data-smart-route-action="${row.action}" data-state="${state}" ${current ? 'aria-current="step"' : ""}>
        <i>${row.done ? "✓" : row.index}</i><span><strong>${row.title}</strong><small>${row.detail}</small></span><em>${row.done ? "完成" : current ? "推荐" : "稍后"}</em>
      </button>`;
    }).join("");
    steps.querySelectorAll("[data-smart-route-action]").forEach(button => button.addEventListener("click", () => activate(button.dataset.smartRouteAction)));
  }

  function scrollToTarget(selector) {
    const target = document.querySelector(selector);
    if (!target) return false;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    return true;
  }

  function activate(action, pass = null) {
    if (action === "review") {
      document.querySelector('[data-review-filter="due"]')?.click();
      scrollToTarget("#review-system");
    } else if (action === "reading") {
      const passThree = document.querySelector('[data-study-pass="3"]');
      if (passThree?.getAttribute("aria-pressed") !== "true") passThree?.click();
      requestAnimationFrame(() => scrollToTarget("#group-reading-panel, #group-reading-list"));
    } else if (action === "confusable") {
      scrollToTarget("#confusable-study");
    } else {
      const passButton = pass ? document.querySelector(`[data-study-pass="${pass}"]`) : null;
      if (passButton?.getAttribute("aria-pressed") !== "true") passButton?.click();
      requestAnimationFrame(() => scrollToTarget("#study-word-card, .sequence-study-card"));
    }
    root.classList.add("route-launched");
    setTimeout(() => root.classList.remove("route-launched"), 720);
  }

  function render() {
    const data = routeData();
    const recommendation = chooseRecommendation(data);
    currentRecommendation = recommendation;
    root.dataset.recommendation = recommendation.action;
    reason.textContent = recommendation.reason;
    startButton.textContent = recommendation.label;
    renderMetrics(data);
    renderSteps(data, recommendation);
  }

  function scheduleRender() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(render, 40);
  }

  startButton.addEventListener("click", () => activate(currentRecommendation.action, currentRecommendation.pass));
  ["lexiverse-level-change", "lexiverse-group-change", "lexiverse-study-complete", "lexiverse-confusable-complete", "lexiverse-pass-change", "lexiverse-context-review"]
    .forEach(name => window.addEventListener(name, scheduleRender));
  window.addEventListener("storage", scheduleRender);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) scheduleRender(); });
  const observed = ["study-daily-goal", "review-session-progress", "group-reading-history", "confusable-study"]
    .map(id => document.getElementById(id)).filter(Boolean);
  if (observed.length) {
    const observer = new MutationObserver(scheduleRender);
    observed.forEach(node => observer.observe(node, { childList: true, subtree: true, characterData: true }));
  }
  setInterval(scheduleRender, 60000);
  render();
})();
