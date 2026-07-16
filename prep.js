(() => {
  const satMap = new Map((window.WORDBANK_WORDS || []).map(word => [word.id, { ...word }]));
  (window.WORDS || []).forEach(word => {
    const imported = satMap.get(word.id) || {};
    satMap.set(word.id, { ...imported, ...word, group: imported.group || word.group || "Advanced extension" });
  });
  const satWords = [...satMap.values()].filter(word => /^Group \d+$/.test(word.group || ""));
  const wordMap = new Map(satWords.map(word => [word.id, word]));
  const reviewReadings = Array.isArray(window.REVIEW_SAT_READINGS) ? window.REVIEW_SAT_READINGS : [];
  const questionBank = [...(Array.isArray(window.OFFLINE_SAT_QUESTIONS) ? window.OFFLINE_SAT_QUESTIONS : []), ...reviewReadings];

  let levelStore = {};
  let reviewStore = {};
  let practiceAttempts = [];
  let practiceHistoryFilter = "all";
  let lastDrawnQuestionId = "";
  try { levelStore = JSON.parse(localStorage.getItem("lexiverse-levels")) || {}; } catch {}
  try { reviewStore = JSON.parse(localStorage.getItem("lexiverse-review-v1")) || {}; } catch {}
  try { practiceAttempts = JSON.parse(localStorage.getItem("lexiverse-practice-attempts-v1")) || []; } catch {}
  if (!Array.isArray(practiceAttempts)) practiceAttempts = [];
  satWords.forEach(word => { word.level = Number(levelStore[word.id] || word.level || 1); });

  const groupStart = document.getElementById("passage-group-start");
  const groupEnd = document.getElementById("passage-group-end");
  const wordCount = document.getElementById("passage-word-count");
  const difficulty = document.getElementById("passage-difficulty");
  const genre = document.getElementById("passage-genre");
  const showMeanings = document.getElementById("show-word-meanings");
  const passageForm = document.getElementById("passage-form");
  const poolStatus = document.getElementById("passage-pool-status");
  const apiStatus = document.getElementById("api-status");
  const generateButton = document.getElementById("generate-passage");
  const passageOutput = document.getElementById("passage-output");
  const practiceHistorySummary = document.getElementById("practice-history-summary");
  const practiceHistoryFilters = document.getElementById("practice-history-filters");
  const practiceHistoryList = document.getElementById("practice-history-list");
  const reviewLevels = document.getElementById("review-levels");
  const reviewQueue = document.getElementById("review-queue");
  const reviewSummary = document.getElementById("review-summary-text");
  const reviewSessionProgress = document.getElementById("review-session-progress");
  const reviewFeedback = document.getElementById("review-feedback");
  const reviewReadingCard = document.getElementById("review-reading-card");
  const reviewReadingStatus = document.getElementById("review-reading-status");
  const nextReviewReading = document.getElementById("next-review-reading");
  if (!passageForm || !reviewQueue || !practiceHistoryList) return;

  const savedMeaningPreference = localStorage.getItem("lexiverse-show-practice-meanings");
  showMeanings.checked = savedMeaningPreference === null ? true : savedMeaningPreference === "true";

  const groupNumbers = [...new Set(satWords.map(word => Number(word.group.split(" ")[1])))].sort((a, b) => a - b);
  const groupOptions = groupNumbers.map(number => `<option value="${number}">Group ${number}</option>`).join("");
  groupStart.innerHTML = groupOptions;
  groupEnd.innerHTML = groupOptions;
  groupStart.value = String(groupNumbers[0] || 1);
  groupEnd.value = String(groupNumbers[groupNumbers.length - 1] || 179);

  function selectedLevels() {
    return new Set([...passageForm.querySelectorAll(".familiarity-filter input:checked")].map(input => Number(input.value)));
  }

  function generatorPool() {
    const low = Math.min(Number(groupStart.value), Number(groupEnd.value));
    const high = Math.max(Number(groupStart.value), Number(groupEnd.value));
    const levels = selectedLevels();
    return satWords.filter(word => {
      const group = Number(word.group.split(" ")[1]);
      return group >= low && group <= high && levels.has(Number(word.level));
    });
  }

  function passageContainsWord(passage, id) {
    const escaped = String(id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, "i").test(String(passage || ""));
  }

  function questionCandidates() {
    const poolIds = new Set(generatorPool().map(word => word.id));
    const completedIds = new Set(practiceAttempts.map(attempt => attempt.questionId));
    const requestedDifficulty = difficulty.value;
    const requestedCount = Number(wordCount.value);
    return questionBank
      .filter(item => !completedIds.has(item.id))
      .filter(item => item.skill !== "Cross-Text Connections")
      .filter(item => item.genre === genre.value)
      .filter(item => requestedDifficulty !== "hard" || item.difficulty === "hard")
      .map(item => ({
        item,
        matches: (item.targets || []).filter(id => poolIds.has(id) && passageContainsWord(item.passage, id))
      }))
      .filter(entry => entry.matches.length >= requestedCount)
      .sort((a, b) => Number(b.item.quality === "curated") - Number(a.item.quality === "curated") || b.matches.length - a.matches.length);
  }

  function updatePoolStatus() {
    const pool = generatorPool();
    const levels = [...selectedLevels()].sort().join("、") || "未选择";
    const candidates = questionCandidates();
    const strongest = candidates[0]?.matches.length || 0;
    poolStatus.textContent = candidates.length
      ? `当前范围 ${pool.length} 个词 · 熟悉度 ${levels} · 剩余 ${candidates.length} 题 · 每题正文保证出现所选 ${Number(wordCount.value)} 个词`
      : `这个筛选范围内没有同时在正文中出现 ${Number(wordCount.value)} 个目标词的未完成题目。可扩大 Group 范围、熟悉度或切换文章类型。`;
    generateButton.disabled = !selectedLevels().size || !candidates.length;
  }

  function escapePattern(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function appendHighlightedPassage(container, text, targetWords) {
    const ids = targetWords.map(word => word.id).sort((a, b) => b.length - a.length);
    if (!ids.length) { container.textContent = text; return; }
    const pattern = new RegExp(`(${ids.map(escapePattern).join("|")})`, "gi");
    const lookup = new Set(ids.map(id => id.toLowerCase()));
    text.split(pattern).forEach(part => {
      if (lookup.has(part.toLowerCase())) {
        const mark = document.createElement("mark");
        mark.textContent = part;
        container.append(mark);
      } else {
        container.append(document.createTextNode(part));
      }
    });
  }

  function updateTargetWordMeanings() {
    passageOutput.querySelectorAll(".target-word-list span[data-word]").forEach(chip => {
      const label = `${chip.dataset.word} · ${chip.dataset.pos || "词性未知"}`;
      chip.textContent = showMeanings.checked && chip.dataset.meaning
        ? `${label} · ${chip.dataset.meaning}`
        : label;
    });
  }

  function renderPractice(data, targetWords, archivedAttempt = null) {
    passageOutput.innerHTML = `
      <div class="practice-meta"><span id="practice-difficulty"></span><span id="practice-domain"></span><span id="practice-skill"></span><span id="practice-range"></span></div>
      <h3 class="practice-title"></h3>
      <p class="practice-passage"></p>
      <div class="target-word-list" aria-label="本次目标词"></div>
      <div class="question-block">
        <span class="question-number">DIGITAL SAT · ORIGINAL PRACTICE</span>
        <p class="question-text"></p>
        <div class="choice-list"></div>
        <p class="answer-explanation" hidden></p>
      </div>`;
    passageOutput.querySelector("#practice-difficulty").textContent = data.difficulty === "hard" ? "高难度" : "中高难度";
    passageOutput.querySelector("#practice-domain").textContent = data.domain;
    passageOutput.querySelector("#practice-skill").textContent = data.skill;
    passageOutput.querySelector("#practice-range").textContent = archivedAttempt
      ? "历史记录"
      : `Group ${Math.min(Number(groupStart.value), Number(groupEnd.value))}–${Math.max(Number(groupStart.value), Number(groupEnd.value))}`;
    passageOutput.querySelector(".practice-title").textContent = data.title;
    appendHighlightedPassage(passageOutput.querySelector(".practice-passage"), data.passage, targetWords);
    const vocabulary = new Map((data.vocabulary || []).map(item => [String(item.word).toLowerCase(), item]));
    const targetList = passageOutput.querySelector(".target-word-list");
    targetWords.forEach(word => {
      const chip = document.createElement("span");
      const note = vocabulary.get(word.id.toLowerCase());
      chip.dataset.word = word.id;
      chip.dataset.pos = word.pos || "词性未知";
      chip.dataset.meaning = note?.meaning_in_context || word.zh || "";
      targetList.append(chip);
    });
    updateTargetWordMeanings();
    passageOutput.querySelector(".question-text").textContent = data.question;
    const choiceList = passageOutput.querySelector(".choice-list");
    const explanation = passageOutput.querySelector(".answer-explanation");
    (data.choices || []).forEach((choice, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice-button";
      button.textContent = `${String.fromCharCode(65 + index)}. ${choice}`;
      if (!archivedAttempt) {
        button.addEventListener("click", () => {
          [...choiceList.children].forEach((option, optionIndex) => {
            option.disabled = true;
            if (optionIndex === Number(data.answer)) option.classList.add("correct");
          });
          if (index !== Number(data.answer)) button.classList.add("incorrect");
          explanation.textContent = data.explanation;
          explanation.hidden = false;
          savePracticeAttempt(data, targetWords, index);
        });
      }
      choiceList.append(button);
    });
    if (archivedAttempt) {
      [...choiceList.children].forEach((option, optionIndex) => {
        option.disabled = true;
        if (optionIndex === Number(data.answer)) option.classList.add("correct");
        if (optionIndex === Number(archivedAttempt.selectedAnswer) && optionIndex !== Number(data.answer)) option.classList.add("incorrect");
      });
      explanation.textContent = data.explanation;
      explanation.hidden = false;
    }
  }

  function savePracticeAttempt(question, targetWords, selectedAnswer) {
    if (practiceAttempts.some(attempt => attempt.questionId === question.id)) return;
    practiceAttempts.push({
      questionId: question.id,
      selectedAnswer,
      correct: Number(selectedAnswer) === Number(question.answer),
      answeredAt: Date.now(),
      targetIds: targetWords.map(word => word.id)
    });
    localStorage.setItem("lexiverse-practice-attempts-v1", JSON.stringify(practiceAttempts));
    apiStatus.className = "api-status ready";
    apiStatus.textContent = Number(selectedAnswer) === Number(question.answer)
      ? "答题记录已保存 · 这道题不会再次进入正常抽题池"
      : "错题已保存 · 可在下方错题记录中随时查看";
    renderPracticeHistory();
    updatePoolStatus();
  }

  function renderPracticeHistory() {
    const wrongCount = practiceAttempts.filter(attempt => !attempt.correct).length;
    const accuracy = practiceAttempts.length ? Math.round((practiceAttempts.length - wrongCount) / practiceAttempts.length * 100) : 0;
    practiceHistorySummary.textContent = practiceAttempts.length
      ? `已完成 ${practiceAttempts.length} / ${questionBank.length} 题 · 错题 ${wrongCount} · 正确率 ${accuracy}%`
      : "还没有已提交的题目。";
    practiceHistoryFilters.innerHTML = `
      <button class="history-filter" type="button" data-history-filter="all" aria-pressed="${practiceHistoryFilter === "all"}">全部记录 ${practiceAttempts.length}</button>
      <button class="history-filter" type="button" data-history-filter="wrong" aria-pressed="${practiceHistoryFilter === "wrong"}">错题 ${wrongCount}</button>`;
    practiceHistoryFilters.querySelectorAll("[data-history-filter]").forEach(button => button.addEventListener("click", () => {
      practiceHistoryFilter = button.dataset.historyFilter;
      renderPracticeHistory();
    }));

    const visibleAttempts = practiceAttempts
      .filter(attempt => practiceHistoryFilter !== "wrong" || !attempt.correct)
      .slice()
      .sort((a, b) => Number(b.answeredAt) - Number(a.answeredAt));
    practiceHistoryList.innerHTML = "";
    if (!visibleAttempts.length) {
      practiceHistoryList.innerHTML = `<p class="history-empty">${practiceHistoryFilter === "wrong" ? "目前没有错题。" : "完成并提交题目后，记录会出现在这里。"}</p>`;
      return;
    }
    visibleAttempts.forEach(attempt => {
      const question = questionBank.find(item => item.id === attempt.questionId);
      if (!question) return;
      const card = document.createElement("article");
      card.className = "history-card";
      card.innerHTML = `
        <div class="history-card-top"><h4></h4><span class="history-result"></span></div>
        <p class="history-meta"></p>
        <div class="history-targets"></div>
        <button class="view-history-question" type="button">查看题目与解析</button>`;
      card.querySelector("h4").textContent = question.title;
      const result = card.querySelector(".history-result");
      result.className = `history-result ${attempt.correct ? "correct" : "wrong"}`;
      result.textContent = attempt.correct ? "正确" : "错题";
      const date = new Date(Number(attempt.answeredAt) || Date.now()).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
      card.querySelector(".history-meta").textContent = `${question.domain} · ${question.skill} · ${date}`;
      const targets = card.querySelector(".history-targets");
      (attempt.targetIds || []).forEach(id => {
        const chip = document.createElement("span");
        const targetWord = wordMap.get(id);
        chip.textContent = `${id} · ${targetWord?.pos || "词性未知"}`;
        targets.append(chip);
      });
      card.querySelector(".view-history-question").addEventListener("click", () => {
        const targetWords = (attempt.targetIds || question.targets).map(id => wordMap.get(id)).filter(Boolean);
        renderPractice(question, targetWords, attempt);
        passageOutput.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      practiceHistoryList.append(card);
    });
  }

  passageForm.addEventListener("submit", event => {
    event.preventDefault();
    const candidates = questionCandidates();
    const count = Number(wordCount.value);
    if (!candidates.length) { updatePoolStatus(); return; }
    const preferredQuality = candidates[0].item.quality === "curated";
    const qualityTier = candidates.filter(entry => (entry.item.quality === "curated") === preferredQuality);
    const bestMatch = Math.max(...qualityTier.map(entry => entry.matches.length));
    const strongest = qualityTier.filter(entry => entry.matches.length === bestMatch);
    const fresh = strongest.filter(entry => entry.item.id !== lastDrawnQuestionId);
    const choices = fresh.length ? fresh : strongest;
    const selected = choices[Math.floor(Math.random() * choices.length)];
    const targets = selected.matches.slice(0, count).map(id => wordMap.get(id)).filter(Boolean);
    renderPractice(selected.item, targets);
    lastDrawnQuestionId = selected.item.id;
    apiStatus.className = "api-status ready";
    apiStatus.textContent = `离线题库已匹配 · 本题重点复习 ${targets.length} 个筛选词 · 不调用 API`;
  });

  let reviewFilter = "due";
  let reviewSeen = new Set();
  let reviewSessionCount = 0;
  let reviewSessionPromoted = 0;
  let lastReviewReadingId = "";
  let reviewReadingAttempts = [];
  try { reviewReadingAttempts = JSON.parse(localStorage.getItem("lexiverse-review-reading-attempts-v1")) || []; } catch {}
  if (!Array.isArray(reviewReadingAttempts)) reviewReadingAttempts = [];
  const intervals = { 1: 1, 2: 2, 3: 5, 4: 12, 5: 30 };

  function isDue(word) {
    const state = reviewStore[word.id];
    return !state || Number(state.nextReview || 0) <= Date.now();
  }

  function todayStudiedIds() {
    let completed = {};
    try { completed = JSON.parse(localStorage.getItem("lexiverse-group-study-v1"))?.completed || {}; } catch {}
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
    return new Set(Object.entries(completed)
      .filter(([, timestamp]) => Number(timestamp) >= todayStart && Number(timestamp) < tomorrowStart)
      .map(([id]) => id));
  }

  function todayReviewWords() {
    const ids = todayStudiedIds();
    return satWords.filter(word => ids.has(word.id) && Number(word.level) !== 5);
  }

  function persistReview() {
    localStorage.setItem("lexiverse-review-v1", JSON.stringify(reviewStore));
    localStorage.setItem("lexiverse-levels", JSON.stringify(levelStore));
  }

  function updateWordLevel(word, remembered) {
    const now = Date.now();
    const previous = reviewStore[word.id] || { streak: 0 };
    const oldLevel = Number(word.level) || 1;
    word.level = remembered ? Math.min(5, oldLevel + 1) : Math.max(1, oldLevel - 1);
    levelStore[word.id] = word.level;
    reviewStore[word.id] = remembered
      ? { streak: Number(previous.streak || 0) + 1, lastReviewed: now, nextReview: now + intervals[word.level] * 86400000 }
      : { streak: 0, lastReviewed: now, nextReview: now + 10 * 60000 };
    reviewSeen.add(word.id);
    reviewSessionCount += 1;
    window.LexiversePasses?.increment(word.id, "review-card");
    if (remembered && word.level > oldLevel) reviewSessionPromoted += 1;
    persistReview();
    window.dispatchEvent(new CustomEvent("lexiverse-level-change", { detail: { id: word.id, level: word.level, source: "prep" } }));
    reviewFeedback.textContent = remembered
      ? word.level > oldLevel
        ? `✓ ${word.id}：熟悉度 ${oldLevel} → ${word.level}，已自动进入下一级。`
        : `✓ ${word.id} 已稳定在最高熟悉度 5。`
      : word.level < oldLevel
        ? `${word.id}：熟悉度 ${oldLevel} → ${word.level}，稍后会更快再次出现。`
        : `${word.id} 暂时保留在熟悉度 1，10 分钟后再次到期。`;
    renderReview();
    updatePoolStatus();
    renderAdaptiveReading();
  }

  function renderLevelFilters() {
    const counts = Object.fromEntries([1, 2, 3, 4, 5].map(level => [level, satWords.filter(word => word.level === level).length]));
    const dueCount = satWords.filter(isDue).length;
    const todayCount = todayReviewWords().length;
    reviewLevels.innerHTML = `
      <button class="review-filter" type="button" data-review-filter="due" aria-pressed="${reviewFilter === "due"}"><strong>${dueCount}</strong><span>到期复习</span></button>
      <button class="review-filter" type="button" data-review-filter="today" aria-pressed="${reviewFilter === "today"}"><strong>${todayCount}</strong><span>今日新背 · 未到 L5</span></button>
      ${[1, 2, 3, 4, 5].map(level => `<button class="review-filter" type="button" data-review-filter="${level}" aria-pressed="${String(reviewFilter) === String(level)}"><strong>${counts[level]}</strong><span>熟悉度 ${level}</span></button>`).join("")}`;
    reviewLevels.querySelectorAll("[data-review-filter]").forEach(button => button.addEventListener("click", () => {
      reviewFilter = button.dataset.reviewFilter;
      reviewSeen = new Set();
      reviewSessionCount = 0;
      reviewSessionPromoted = 0;
      reviewFeedback.textContent = reviewFilter === "due"
        ? "已切换到到期队列，优先从熟悉度最低的词开始。"
        : reviewFilter === "today"
          ? "开始复习今天新背且尚未达到熟悉度 5 的单词。"
        : `已进入熟悉度 ${reviewFilter} 连续复习；记得后会自动升到下一级。`;
      renderReview();
    }));
  }

  function reviewCandidates() {
    const filtered = reviewFilter === "due"
      ? satWords.filter(isDue)
      : reviewFilter === "today"
        ? todayReviewWords()
        : satWords.filter(word => word.level === Number(reviewFilter));
    return filtered
      .filter(word => !reviewSeen.has(word.id))
      .sort((a, b) => a.level - b.level || Number(reviewStore[a.id]?.nextReview || 0) - Number(reviewStore[b.id]?.nextReview || 0) || a.id.localeCompare(b.id, "en"));
  }

  function renderReview() {
    renderLevelFilters();
    const candidates = reviewCandidates();
    const totalInFilter = reviewFilter === "due"
      ? satWords.filter(isDue).length
      : reviewFilter === "today"
        ? todayReviewWords().length
        : satWords.filter(word => word.level === Number(reviewFilter)).length;
    reviewSummary.textContent = reviewFilter === "due"
      ? `今天有 ${totalInFilter} 个词到期。每次只显示一个，回答后自动进入下一个。`
      : reviewFilter === "today"
        ? `今天新背的单词中有 ${totalInFilter} 个尚未达到熟悉度 5；升到 L5 后会自动离开这个队列。`
      : `正在连续复习熟悉度 ${reviewFilter}；点击“记得”会立即升级，点击“忘记”会降低一级并缩短间隔。`;
    reviewSessionProgress.textContent = `本轮 ${reviewSessionCount} 词 · 升级 ${reviewSessionPromoted} 词 · 剩余 ${candidates.length}`;
    reviewQueue.innerHTML = "";
    if (!candidates.length) {
      reviewQueue.innerHTML = `<div class="review-session-complete"><span>✦</span><h3>${reviewSessionCount ? "这一轮完成了" : "这一组暂时没有单词"}</h3><p>${reviewSessionCount ? `你连续处理了 ${reviewSessionCount} 个词，其中 ${reviewSessionPromoted} 个成功升级。` : "可以选择其他熟悉度，或切换到到期复习。"}</p><button type="button" class="secondary-button" id="restart-review-session">再来一轮</button></div>`;
      document.getElementById("restart-review-session")?.addEventListener("click", () => {
        reviewSeen = new Set();
        reviewSessionCount = 0;
        reviewSessionPromoted = 0;
        reviewFeedback.textContent = "新一轮开始。";
        renderReview();
      });
      return;
    }
    const word = candidates[0];
    const oldLevel = Number(word.level) || 1;
    const card = document.createElement("article");
    card.className = "review-card review-focus-card";
    card.tabIndex = 0;
    card.innerHTML = `
      <div class="review-card-header"><h3></h3><span class="review-level-badge"></span></div>
      <p class="review-group"></p>
      <div class="review-prompt"><span>先在脑中回忆中文意思和英文解释</span><small>空格：显示答案 · ←：忘记 · →：记得</small></div>
      <div class="review-answer" hidden><strong class="review-zh"></strong><p class="review-definition"></p><blockquote class="review-example"></blockquote></div>
      <button class="reveal-review" type="button">显示答案</button>
      <div class="review-actions"><button class="forgot" type="button">忘记 · ${oldLevel > 1 ? `降到 L${oldLevel - 1}` : "留在 L1"}</button><button class="skip-review" type="button">暂时跳过</button><button class="remembered" type="button">记得 · ${oldLevel < 5 ? `升到 L${oldLevel + 1}` : "保持 L5"}</button></div>`;
    card.querySelector("h3").textContent = word.id;
    card.querySelector(".review-level-badge").textContent = `LEVEL ${word.level}`;
    card.querySelector(".review-group").textContent = `${word.group} · 词性 ${word.pos || "未知"}`;
    card.querySelector(".review-zh").textContent = word.zh;
    card.querySelector(".review-definition").textContent = word.definition;
    card.querySelector(".review-example").textContent = word.example;
    const answer = card.querySelector(".review-answer");
    const reveal = () => {
      answer.hidden = false;
      card.querySelector(".reveal-review").hidden = true;
    };
    card.querySelector(".reveal-review").addEventListener("click", reveal);
    card.querySelector(".forgot").addEventListener("click", () => updateWordLevel(word, false));
    card.querySelector(".remembered").addEventListener("click", () => updateWordLevel(word, true));
    card.querySelector(".skip-review").addEventListener("click", () => {
      reviewSeen.add(word.id);
      reviewFeedback.textContent = `已暂时跳过 ${word.id}，熟悉度没有改变。`;
      renderReview();
    });
    card.addEventListener("keydown", event => {
      if (event.key === " ") { event.preventDefault(); reveal(); }
      if (event.key === "ArrowLeft") { event.preventDefault(); updateWordLevel(word, false); }
      if (event.key === "ArrowRight") { event.preventDefault(); updateWordLevel(word, true); }
    });
    reviewQueue.append(card);
  }

  function adaptiveReadingCandidates() {
    const completed = new Set(reviewReadingAttempts.map(attempt => attempt.id));
    return reviewReadings.map(reading => {
      const words = (reading.targets || []).map(id => wordMap.get(id)).filter(Boolean);
      const weakCount = words.filter(word => Number(word.level) <= 2).length;
      const priority = words.reduce((sum, word) => sum + Math.max(0, 6 - Number(word.level || 1)), 0);
      return { reading, words, weakCount, priority, completed: completed.has(reading.id) };
    }).sort((a, b) => Number(a.completed) - Number(b.completed) || b.weakCount - a.weakCount || b.priority - a.priority || a.reading.id.localeCompare(b.reading.id));
  }

  function renderAdaptiveReading(forceNext = false) {
    if (!reviewReadingCard || !reviewReadings.length) return;
    const candidates = adaptiveReadingCandidates();
    const available = candidates.filter(entry => entry.reading.id !== lastReviewReadingId);
    const selected = (forceNext ? available : candidates)[0] || candidates[0];
    if (!selected) return;
    const { reading, words, weakCount } = selected;
    lastReviewReadingId = reading.id;
    reviewReadingStatus.textContent = `本篇匹配 ${weakCount} 个 L1–L2 薄弱词 · ${words.map(word => `${word.id} (${word.pos}, L${word.level})`).join(" · ")}`;
    reviewReadingCard.innerHTML = `
      <div class="review-reading-meta"><span>${escapeHtml(reading.domain)}</span><span>${escapeHtml(reading.skill)}</span><span>高难度 · 人工校验</span></div>
      <h4>${escapeHtml(reading.title)}</h4>
      <p class="review-reading-passage"></p>
      <div class="review-reading-targets"></div>
      <p class="review-reading-question">${escapeHtml(reading.question)}</p>
      <div class="review-reading-choices">${reading.choices.map((choice, index) => `<button type="button" data-review-reading-choice="${index}">${String.fromCharCode(65 + index)}. ${escapeHtml(choice)}</button>`).join("")}</div>
      <p class="review-reading-explanation" hidden></p>`;
    appendHighlightedPassage(reviewReadingCard.querySelector(".review-reading-passage"), reading.passage, words);
    const targetBox = reviewReadingCard.querySelector(".review-reading-targets");
    words.forEach(word => {
      const chip = document.createElement("span");
      chip.textContent = `${word.id} · ${word.pos || "词性未知"} · L${word.level}`;
      targetBox.append(chip);
    });
    reviewReadingCard.querySelectorAll("[data-review-reading-choice]").forEach(button => button.addEventListener("click", () => {
      const selectedAnswer = Number(button.dataset.reviewReadingChoice);
      reviewReadingCard.querySelectorAll("[data-review-reading-choice]").forEach((choice, index) => {
        choice.disabled = true;
        if (index === Number(reading.answer)) choice.classList.add("correct");
      });
      if (selectedAnswer !== Number(reading.answer)) button.classList.add("incorrect");
      const explanation = reviewReadingCard.querySelector(".review-reading-explanation");
      explanation.textContent = reading.explanation;
      explanation.hidden = false;
      if (!reviewReadingAttempts.some(attempt => attempt.id === reading.id)) {
        reviewReadingAttempts.push({ id: reading.id, correct: selectedAnswer === Number(reading.answer), answeredAt: Date.now() });
        localStorage.setItem("lexiverse-review-reading-attempts-v1", JSON.stringify(reviewReadingAttempts));
        window.LexiversePasses?.increment(words.map(word => word.id), "adaptive-reading");
      }
    }));
  }

  passageForm.addEventListener("change", updatePoolStatus);
  showMeanings.addEventListener("change", () => {
    localStorage.setItem("lexiverse-show-practice-meanings", String(showMeanings.checked));
    updateTargetWordMeanings();
  });
  nextReviewReading?.addEventListener("click", () => renderAdaptiveReading(true));
  window.addEventListener("lexiverse-study-complete", () => {
    if (reviewFilter === "today") renderReview();
    else renderLevelFilters();
  });
  window.addEventListener("lexiverse-level-change", event => {
    if (!event.detail?.id || event.detail.source === "prep") return;
    const word = wordMap.get(event.detail.id);
    if (!word) return;
    word.level = Number(event.detail.level);
    levelStore[word.id] = word.level;
    renderReview();
    renderAdaptiveReading();
    updatePoolStatus();
  });

  updatePoolStatus();
  renderPracticeHistory();
  renderReview();
  renderAdaptiveReading();
})();
