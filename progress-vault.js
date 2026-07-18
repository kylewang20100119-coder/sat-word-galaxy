(() => {
  const FORMAT = "lexiverse-progress-vault-v1";
  const BACKUP_KEY = "lexiverse-vault-import-backup-v1";
  const ONBOARDING_KEY = "lexiverse-onboarding-complete-v1";
  const MAX_FILE_BYTES = 6 * 1024 * 1024;
  const PORTABLE_KEYS = [
    "lexiverse-levels",
    "lexiverse-group-study-v1",
    "lexiverse-word-passes-v1",
    "lexiverse-review-v1",
    "lexiverse-practice-attempts-v1",
    "lexiverse-review-reading-attempts-v1",
    "lexiverse-context-review-v1",
    "lexiverse-production-recall-v1",
    "lexiverse-confusable-study-v1",
    "lexiverse-theme",
    "lexiverse-show-practice-meanings",
    "lexiverse-review-mode",
    "lexiverse-section-nav-collapsed"
  ];
  const JSON_SHAPES = {
    "lexiverse-levels": "object",
    "lexiverse-group-study-v1": "object",
    "lexiverse-word-passes-v1": "object",
    "lexiverse-review-v1": "object",
    "lexiverse-practice-attempts-v1": "array",
    "lexiverse-review-reading-attempts-v1": "array",
    "lexiverse-context-review-v1": "object",
    "lexiverse-production-recall-v1": "object",
    "lexiverse-confusable-study-v1": "object"
  };

  const summaryBox = document.getElementById("progress-vault-summary");
  const exportButton = document.getElementById("progress-vault-export");
  const selectButton = document.getElementById("progress-vault-select");
  const undoButton = document.getElementById("progress-vault-undo");
  const fileInput = document.getElementById("progress-vault-file");
  const preview = document.getElementById("progress-vault-preview");
  const previewTitle = document.getElementById("progress-vault-preview-title");
  const previewDetail = document.getElementById("progress-vault-preview-detail");
  const applyButton = document.getElementById("progress-vault-apply");
  const cancelButton = document.getElementById("progress-vault-cancel");
  const statusBox = document.getElementById("progress-vault-status");
  const guideReopen = document.getElementById("progress-vault-onboarding");
  let pendingPayload = null;

  const safeParse = raw => {
    if (typeof raw !== "string") return null;
    try { return JSON.parse(raw); } catch { return null; }
  };
  const isObject = value => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const countObject = value => isObject(value) ? Object.keys(value).length : 0;
  const number = value => Math.max(0, Number(value) || 0);
  const formatDate = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "未知时间" : new Intl.DateTimeFormat("zh-CN", {
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
    }).format(date);
  };
  const hash = value => {
    let result = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      result ^= value.charCodeAt(index);
      result = Math.imul(result, 16777619);
    }
    return (result >>> 0).toString(16).padStart(8, "0");
  };

  function collectStorage() {
    return Object.fromEntries(PORTABLE_KEYS
      .map(key => [key, localStorage.getItem(key)])
      .filter(([, value]) => value !== null));
  }

  function summarize(storage) {
    const levels = safeParse(storage["lexiverse-levels"]) || {};
    const group = safeParse(storage["lexiverse-group-study-v1"]) || {};
    const passes = safeParse(storage["lexiverse-word-passes-v1"]) || {};
    const practice = safeParse(storage["lexiverse-practice-attempts-v1"]) || [];
    const reviewReadings = safeParse(storage["lexiverse-review-reading-attempts-v1"]) || [];
    const contextReview = safeParse(storage["lexiverse-context-review-v1"]) || {};
    const confusable = safeParse(storage["lexiverse-confusable-study-v1"]) || {};
    const levelCounts = [1, 2, 3, 4, 5].map(level => Object.values(levels).filter(value => Number(value) === level).length);
    const introduced = new Set([
      ...Object.entries(levels).filter(([, value]) => Number(value) > 1).map(([id]) => id),
      ...Object.keys(group.completed || {}),
      ...(Array.isArray(group.studyHistory) ? group.studyHistory.map(row => row?.id).filter(Boolean) : []),
      ...Object.entries(passes).filter(([, value]) => Number(value) >= 2).map(([id]) => id)
    ]).size;
    const repeated = Object.values(passes).filter(value => Number(value) >= 2).length;
    const readings = (Array.isArray(group.readingHistory) ? group.readingHistory.length : 0) + (Array.isArray(reviewReadings) ? reviewReadings.length : 0);
    const questions = Array.isArray(practice) ? practice.length : 0;
    const confusableAttempts = Array.isArray(confusable.history) ? confusable.history.length : 0;
    return {
      introduced,
      repeated,
      readings,
      questions,
      confusableAttempts,
      contextAttempts: number(contextReview.attempts),
      contextCorrect: number(contextReview.correct),
      contextStrong: number(contextReview.strong),
      totalXp: number(group.totalXp),
      bestCombo: number(group.bestCombo),
      levelCounts
    };
  }

  function createPayload(storage = collectStorage()) {
    const payload = {
      format: FORMAT,
      version: 1,
      exportedAt: new Date().toISOString(),
      app: "SAT + GRE Word Galaxy",
      storage,
      summary: summarize(storage)
    };
    payload.integrity = hash(JSON.stringify(payload.storage));
    return payload;
  }

  function validatePayload(payload) {
    if (!isObject(payload) || payload.format !== FORMAT || payload.version !== 1 || !isObject(payload.storage)) {
      throw new Error("这不是 Word Galaxy 生成的完整进度备份。");
    }
    const unknownKeys = Object.keys(payload.storage).filter(key => !PORTABLE_KEYS.includes(key));
    if (unknownKeys.length) throw new Error("备份包含无法识别的数据，已为你停止恢复。");
    if (!Object.keys(payload.storage).length) throw new Error("这个备份里没有可恢复的学习记录。");
    Object.entries(payload.storage).forEach(([key, raw]) => {
      if (typeof raw !== "string") throw new Error("备份内容不完整，请重新选择文件。");
      const expected = JSON_SHAPES[key];
      if (!expected) return;
      const parsed = safeParse(raw);
      const valid = expected === "array" ? Array.isArray(parsed) : isObject(parsed);
      if (!valid) throw new Error("备份中的学习记录已损坏，未覆盖当前进度。");
    });
    if (payload.integrity && payload.integrity !== hash(JSON.stringify(payload.storage))) {
      throw new Error("备份文件似乎被截断或修改过，未覆盖当前进度。");
    }
    return payload;
  }

  function setStatus(message, type = "") {
    if (!statusBox) return;
    statusBox.textContent = message;
    statusBox.className = `progress-vault-status${type ? ` ${type}` : ""}`;
  }

  function summarySentence(data) {
    return `${data.introduced} 个已接触单词 · ${data.repeated} 个进入二刷及以上 · 语境取回 ${data.contextCorrect}/${data.contextAttempts} · 场景稳固 ${data.contextStrong} 次 · ${data.readings} 篇阅读 · ${data.questions} 道题 · ${data.totalXp} XP`;
  }

  function renderCurrentSummary() {
    if (!summaryBox) return;
    const data = summarize(collectStorage());
    summaryBox.innerHTML = `
      <span><strong>${data.introduced}</strong><small>已接触单词</small></span>
      <span><strong>${data.repeated}</strong><small>二刷及以上</small></span>
      <span><strong>${data.readings}</strong><small>阅读记录</small></span>
      <span><strong>${data.questions}</strong><small>已做题目</small></span>
      <span><strong>${data.totalXp}</strong><small>累计 XP</small></span>`;
    if (undoButton) undoButton.hidden = !localStorage.getItem(BACKUP_KEY);
  }

  function downloadBackup() {
    const payload = createPayload();
    const date = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lexiverse-progress-${date}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    setStatus(`完整备份已生成：${summarySentence(payload.summary)}。`, "success");
  }

  function clearPreview() {
    pendingPayload = null;
    if (preview) preview.hidden = true;
    if (fileInput) fileInput.value = "";
  }

  async function inspectFile(file) {
    clearPreview();
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) throw new Error("备份文件异常大，已停止读取以保护当前进度。");
    let payload;
    try { payload = JSON.parse(await file.text()); }
    catch { throw new Error("无法读取这个文件，请选择下载过的 lexiverse-progress 文件。"); }
    pendingPayload = validatePayload(payload);
    const data = summarize(pendingPayload.storage);
    if (previewTitle) previewTitle.textContent = `备份时间：${formatDate(pendingPayload.exportedAt)}`;
    if (previewDetail) previewDetail.textContent = `${summarySentence(data)}。确认后会先自动保存当前进度，再恢复这份备份。`;
    if (preview) preview.hidden = false;
    setStatus("备份检查通过，请核对摘要后再确认恢复。", "ready");
  }

  function applyStorage(storage) {
    PORTABLE_KEYS.forEach(key => localStorage.removeItem(key));
    Object.entries(storage).forEach(([key, value]) => localStorage.setItem(key, value));
  }

  function restorePayload(payload) {
    const checked = validatePayload(payload);
    applyStorage(checked.storage);
  }

  function applyImport() {
    if (!pendingPayload) return;
    const rollback = createPayload();
    try {
      localStorage.setItem(BACKUP_KEY, JSON.stringify(rollback));
      restorePayload(pendingPayload);
      localStorage.setItem(BACKUP_KEY, JSON.stringify(rollback));
      localStorage.setItem(ONBOARDING_KEY, "true");
      setStatus("恢复成功，正在重新载入你的学习星系……", "success");
      setTimeout(() => location.reload(), 260);
    } catch (error) {
      try { restorePayload(rollback); } catch {}
      setStatus(error?.name === "QuotaExceededError" ? "浏览器存储空间不足，当前进度没有被覆盖。" : "恢复失败，已经自动保留原来的进度。", "error");
    }
  }

  function undoImport() {
    const raw = localStorage.getItem(BACKUP_KEY);
    if (!raw) return;
    try {
      const rollback = validatePayload(JSON.parse(raw));
      applyStorage(rollback.storage);
      localStorage.removeItem(BACKUP_KEY);
      localStorage.setItem(ONBOARDING_KEY, "true");
      setStatus("已经恢复到导入前的状态，正在刷新……", "success");
      setTimeout(() => location.reload(), 260);
    } catch {
      setStatus("无法读取撤销记录；当前学习进度没有变化。", "error");
    }
  }

  exportButton?.addEventListener("click", downloadBackup);
  selectButton?.addEventListener("click", () => fileInput?.click());
  fileInput?.addEventListener("change", async event => {
    try { await inspectFile(event.target.files?.[0]); }
    catch (error) { clearPreview(); setStatus(error?.message || "无法读取备份。", "error"); }
  });
  applyButton?.addEventListener("click", applyImport);
  cancelButton?.addEventListener("click", () => { clearPreview(); setStatus("已取消恢复，当前进度没有变化。"); });
  undoButton?.addEventListener("click", undoImport);
  ["lexiverse-level-change", "lexiverse-group-change", "lexiverse-study-complete", "lexiverse-confusable-complete", "lexiverse-pass-change"]
    .forEach(name => window.addEventListener(name, renderCurrentSummary));

  const guide = document.getElementById("welcome-guide");
  const guideTitle = document.getElementById("welcome-guide-title");
  const guideDescription = document.getElementById("welcome-guide-description");
  const guideKicker = document.getElementById("welcome-guide-kicker");
  const guideDots = document.getElementById("welcome-guide-dots");
  const guideBack = document.getElementById("welcome-guide-back");
  const guideNext = document.getElementById("welcome-guide-next");
  const guideSkip = document.getElementById("welcome-guide-skip");
  const guideClose = document.getElementById("welcome-guide-close");
  const guideSteps = [
    {
      kicker: "WELCOME · 1 / 3",
      title: "先让系统替你决定今天背什么",
      description: "“今天最值得做什么”会结合弱词、到期复习和当前 Group，给你一个很小但明确的起点。每天先完成 10 词冲刺，更容易进入停不下来的节奏。"
    },
    {
      kicker: "MEMORY LOOP · 2 / 3",
      title: "同一个词，分三遍变成长期记忆",
      description: "第一遍完整认识；第二遍用意思、例句、同反义词和同源词建立网络；第三遍进入 DSAT 原文。低熟悉度词还会在几词后突然回来，逼大脑真正提取一次。"
    },
    {
      kicker: "YOUR DATA · 3 / 3",
      title: "安装到设备，进度也可以随身带走",
      description: "点顶部的安装按钮可把 Lexiverse 放进 iPad 或电脑；首次完整加载后核心功能支持离线。熟悉度、XP 和错题仍保存在当前设备，用“完整备份”即可迁移。"
    }
  ];
  let guideIndex = 0;
  let previousFocus = null;

  function hasMeaningfulProgress() {
    const data = summarize(collectStorage());
    return data.introduced > 0 || data.readings > 0 || data.questions > 0 || data.totalXp > 0 || data.confusableAttempts > 0;
  }

  function renderGuide() {
    const step = guideSteps[guideIndex];
    if (!step) return;
    if (guideKicker) guideKicker.textContent = step.kicker;
    if (guideTitle) guideTitle.textContent = step.title;
    if (guideDescription) guideDescription.textContent = step.description;
    if (guideBack) guideBack.hidden = guideIndex === 0;
    if (guideNext) guideNext.textContent = guideIndex === guideSteps.length - 1 ? "带我开始" : "下一步";
    if (guideDots) guideDots.innerHTML = guideSteps.map((_, index) => `<i class="${index === guideIndex ? "active" : ""}" aria-label="第 ${index + 1} 步"></i>`).join("");
  }

  function openGuide(start = 0) {
    if (!guide) return;
    guideIndex = Math.max(0, Math.min(guideSteps.length - 1, Number(start) || 0));
    previousFocus = document.activeElement;
    renderGuide();
    guide.hidden = false;
    document.body.classList.add("welcome-guide-open");
    requestAnimationFrame(() => {
      guide.classList.add("visible");
      guideNext?.focus();
    });
  }

  function closeGuide(markComplete = true, startLearning = false) {
    if (!guide) return;
    if (markComplete) localStorage.setItem(ONBOARDING_KEY, "true");
    guide.classList.remove("visible");
    document.body.classList.remove("welcome-guide-open");
    setTimeout(() => { guide.hidden = true; }, 220);
    if (startLearning) {
      const destination = document.getElementById("smart-route");
      destination?.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => document.getElementById("smart-route-start")?.focus(), 650);
    } else if (previousFocus?.focus) previousFocus.focus();
  }

  guideNext?.addEventListener("click", () => {
    if (guideIndex < guideSteps.length - 1) {
      guideIndex += 1;
      renderGuide();
      return;
    }
    closeGuide(true, true);
  });
  guideBack?.addEventListener("click", () => { guideIndex = Math.max(0, guideIndex - 1); renderGuide(); });
  guideSkip?.addEventListener("click", () => closeGuide(true));
  guideClose?.addEventListener("click", () => closeGuide(true));
  guideReopen?.addEventListener("click", () => openGuide(0));
  guide?.addEventListener("click", event => { if (event.target === guide) closeGuide(true); });
  document.addEventListener("keydown", event => {
    if (!guide || guide.hidden) return;
    if (event.key === "Escape") closeGuide(true);
    if (event.key === "ArrowRight") guideNext?.click();
    if (event.key === "ArrowLeft" && guideIndex > 0) guideBack?.click();
  });

  window.LexiverseProgressVault = {
    format: FORMAT,
    keys: [...PORTABLE_KEYS],
    exportPayload: createPayload,
    validate: validatePayload,
    summarize,
    openGuide
  };

  renderCurrentSummary();
  if (!localStorage.getItem(ONBOARDING_KEY) && !hasMeaningfulProgress()) {
    setTimeout(() => openGuide(0), 520);
  }
})();
