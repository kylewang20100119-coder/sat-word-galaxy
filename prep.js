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
  let reviewSessionCorrect = 0;
  let lastReviewReadingId = "";
  let reviewReadingAttempts = [];
  let contextReview = { attempts: 0, correct: 0, strong: 0, streak: 0, bestStreak: 0, history: [] };
  let introducedIds = new Set();
  try { reviewReadingAttempts = JSON.parse(localStorage.getItem("lexiverse-review-reading-attempts-v1")) || []; } catch {}
  try { contextReview = { ...contextReview, ...(JSON.parse(localStorage.getItem("lexiverse-context-review-v1")) || {}) }; } catch {}
  if (!Array.isArray(reviewReadingAttempts)) reviewReadingAttempts = [];
  if (!Array.isArray(contextReview.history)) contextReview.history = [];
  ["attempts", "correct", "strong", "streak", "bestStreak"].forEach(key => { contextReview[key] = Math.max(0, Number(contextReview[key]) || 0); });
  const intervals = { 1: 0.5, 2: 1.5, 3: 4, 4: 10, 5: 24 };
  const REVIEW_SESSION_LIMIT = 20;

  function refreshIntroducedIds() {
    const next = new Set(Object.keys(reviewStore));
    Object.entries(levelStore).forEach(([id, level]) => { if (Number(level) > 1) next.add(id); });
    try {
      const groupState = JSON.parse(localStorage.getItem("lexiverse-group-study-v1")) || {};
      Object.keys(groupState.completed || {}).forEach(id => next.add(id));
      (Array.isArray(groupState.studyHistory) ? groupState.studyHistory : []).forEach(row => row?.id && next.add(row.id));
      [1, 2, 3].forEach(pass => Object.keys(groupState.passProgress?.[pass] || groupState.passProgress?.[String(pass)] || {}).forEach(id => next.add(id)));
    } catch {}
    introducedIds = next;
  }

  function isDue(word) {
    const state = reviewStore[word.id];
    if (state) return Number(state.nextReview || 0) <= Date.now();
    return introducedIds.has(word.id) && Number(word.level || 1) < 5;
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

  function persistContextReview() {
    if (contextReview.history.length > 2400) contextReview.history = contextReview.history.slice(-2400);
    localStorage.setItem("lexiverse-context-review-v1", JSON.stringify(contextReview));
  }

  function contextHash(value) {
    let result = 2166136261;
    for (let index = 0; index < String(value).length; index += 1) result = Math.imul(result ^ String(value).charCodeAt(index), 16777619);
    return result >>> 0;
  }

  function memoryState(word, now = Date.now()) {
    const record = reviewStore[word.id] || {};
    const stabilityDays = Math.max(0.15, Number(record.stabilityDays) || intervals[Number(word.level) || 1] || 0.5);
    const elapsedDays = record.lastReviewed ? Math.max(0, (now - Number(record.lastReviewed)) / 86400000) : stabilityDays * 1.15;
    const retrievability = Math.max(0.02, Math.min(1, Math.exp(-elapsedDays / stabilityDays)));
    return { record, stabilityDays, elapsedDays, retrievability, strength: Math.round(retrievability * 100) };
  }

  function formatMemoryInterval(days) {
    if (days < 1 / 1440) return "刚刚";
    if (days < 1 / 24) return `${Math.max(10, Math.round(days * 1440))} 分钟`;
    if (days < 1) return `${Math.max(1, Math.round(days * 24))} 小时`;
    return `${Math.max(1, Math.round(days))} 天`;
  }

  function contextMeaning(word) {
    const zh = String(word.zh || "").split("；").slice(0, 2).join("；");
    return `${zh}${zh && word.definition ? " · " : ""}${word.definition || ""}`.trim();
  }

  function sceneLens(word) {
    const pos = String(word.pos || "").toLowerCase();
    if (pos.includes("verb")) return "Picture the actor, the action, and what changes because of it. Notice whether the action causes, prevents, intensifies, or weakens something.";
    if (pos.includes("adjective")) return "Picture the person or thing being evaluated. Notice the attitude, degree, or quality this word adds to the description.";
    if (pos.includes("adverb")) return "Notice how the word changes the manner, certainty, frequency, or intensity of the action around it.";
    if (pos.includes("noun")) return "Identify what kind of person, object, event, or abstract idea the word names, and what relationship it has to the rest of the sentence.";
    return "Picture who is speaking, what is happening, and what attitude, intensity, or relationship this expression adds to the scene.";
  }

  function contextualMeaningOptions(word) {
    const reviewCount = Number(reviewStore[word.id]?.reviewCount) || 0;
    const eligible = satWords
      .filter(candidate => candidate.id !== word.id && contextMeaning(candidate) !== contextMeaning(word))
      .sort((a, b) => contextHash(`${word.id}|${reviewCount}|${a.id}`) - contextHash(`${word.id}|${reviewCount}|${b.id}`));
    const samePos = eligible.filter(candidate => candidate.pos === word.pos);
    const source = [...samePos, ...eligible.filter(candidate => !samePos.includes(candidate))].slice(0, 3);
    const rows = [{ word, correct: true }, ...source.map(candidate => ({ word: candidate, correct: false }))];
    rows.sort((a, b) => contextHash(`${word.id}|choice|${reviewCount}|${a.word.id}`) - contextHash(`${word.id}|choice|${reviewCount}|${b.word.id}`));
    return rows;
  }

  function completeContextReview(word, quality, meaningCorrect) {
    const now = Date.now();
    const oldLevel = Number(word.level) || 1;
    const memory = memoryState(word, now);
    const previous = memory.record;
    const normalizedQuality = Math.max(0, Math.min(2, Number(quality) || 0));
    let nextIntervalDays;
    let stabilityDays;
    if (normalizedQuality === 0) {
      stabilityDays = Math.max(0.15, memory.stabilityDays * 0.42);
      nextIntervalDays = 10 / 1440;
      word.level = Math.max(1, oldLevel - 1);
    } else if (normalizedQuality === 1) {
      stabilityDays = Math.max(0.5, memory.stabilityDays * 0.88);
      nextIntervalDays = Math.max(0.25, stabilityDays * 0.55);
      word.level = oldLevel;
    } else {
      stabilityDays = Math.min(120, Math.max(memory.stabilityDays + 0.75, memory.stabilityDays * (1.55 + (1 - memory.retrievability) * 0.85)));
      nextIntervalDays = stabilityDays;
      word.level = Math.min(5, oldLevel + 1);
    }
    const difficulty = Math.max(0.15, Math.min(0.95, (Number(previous.difficulty) || 0.5) + (normalizedQuality === 0 ? 0.08 : normalizedQuality === 2 ? -0.035 : 0.015)));
    levelStore[word.id] = word.level;
    introducedIds.add(word.id);
    reviewStore[word.id] = {
      ...previous,
      streak: normalizedQuality === 2 ? Number(previous.streak || 0) + 1 : normalizedQuality === 0 ? 0 : Number(previous.streak || 0),
      lastReviewed: now,
      nextReview: now + nextIntervalDays * 86400000,
      stabilityDays,
      difficulty,
      reviewCount: Number(previous.reviewCount || 0) + 1,
      contextHits: Number(previous.contextHits || 0) + Number(normalizedQuality === 2),
      lapses: Number(previous.lapses || 0) + Number(normalizedQuality === 0),
      lastQuality: normalizedQuality
    };
    contextReview.attempts += 1;
    if (meaningCorrect) contextReview.correct += 1;
    if (normalizedQuality === 2) {
      contextReview.strong += 1;
      contextReview.streak += 1;
      contextReview.bestStreak = Math.max(contextReview.bestStreak, contextReview.streak);
    } else contextReview.streak = 0;
    contextReview.history.push({ id: word.id, quality: normalizedQuality, meaningCorrect: Boolean(meaningCorrect), stabilityDays, nextReview: reviewStore[word.id].nextReview, at: now });
    reviewSeen.add(word.id);
    reviewSessionCount += 1;
    if (meaningCorrect) reviewSessionCorrect += 1;
    if (word.level > oldLevel) reviewSessionPromoted += 1;
    window.LexiversePasses?.increment(word.id, "context-review");
    persistReview();
    persistContextReview();
    window.dispatchEvent(new CustomEvent("lexiverse-level-change", { detail: { id: word.id, level: word.level, source: "prep" } }));
    window.dispatchEvent(new CustomEvent("lexiverse-context-review", { detail: { id: word.id, quality: normalizedQuality, stabilityDays, streak: contextReview.streak } }));
    reviewFeedback.textContent = normalizedQuality === 2
      ? `✓ ${word.id} 的词义与使用场景都已取回；预计 ${formatMemoryInterval(nextIntervalDays)} 后再见。`
      : normalizedQuality === 1
        ? `${word.id} 的意思认得，但场景连接仍偏弱；约 ${formatMemoryInterval(nextIntervalDays)} 后再次激活。`
        : `${word.id} 的语境记忆已断开；10 分钟后优先重现，不要求现在死记。`;
    renderReview();
    updatePoolStatus();
    renderAdaptiveReading();
  }

  function renderContextReviewCard(word) {
    const memory = memoryState(word);
    const options = contextualMeaningOptions(word);
    const collocations = Array.isArray(word.collocations) ? word.collocations.filter(Boolean).slice(0, 3) : [];
    const card = document.createElement("article");
    card.className = "review-card review-focus-card context-review-card";
    card.innerHTML = `
      <div class="context-review-top"><span><i></i> CONTEXT REACTIVATION</span><div><strong>${memory.strength}%</strong><small>当前预计记忆强度</small></div></div>
      <div class="context-memory-meter" style="--memory-strength:${memory.strength}%"><i><b></b></i><span>稳定期约 ${formatMemoryInterval(memory.stabilityDays)} · 已过去 ${formatMemoryInterval(memory.elapsedDays)}</span></div>
      <div class="context-scene-heading"><small>${escapeHtml(word.group)} · ${escapeHtml(window.getLexicalPosLabel ? window.getLexicalPosLabel(word) : (word.pos || "word"))} · L${word.level}</small><h3>${escapeHtml(word.id)}</h3><p>${escapeHtml(sceneLens(word))}</p></div>
      <blockquote class="context-scene-sentence"></blockquote>
      <section class="context-meaning-test"><span>MEANING IN THIS SCENE</span><strong>Which meaning best preserves what the word is doing here?</strong><div class="context-meaning-options">${options.map((option, index) => `<button type="button" data-context-meaning="${index}"><kbd>${String.fromCharCode(65 + index)}</kbd><span>${escapeHtml(contextMeaning(option.word))}</span></button>`).join("")}</div></section>
      <section class="context-scene-anchor" hidden>
        <div><span>SCENE ANCHOR</span><strong>${escapeHtml(word.id)}</strong><p>${escapeHtml(contextMeaning(word))}</p></div>
        <blockquote>${escapeHtml(word.example || word.definition || "")}</blockquote>
        ${collocations.length ? `<p class="context-transfer-cue"><b>Transfer cues</b>${collocations.map(item => `<span>${escapeHtml(item)}</span>`).join("")}</p>` : ""}
        <p class="context-memory-hook"><b>Memory hook</b>${escapeHtml(word.memory || word.etymology || `Reconnect ${word.id} with the scene above.`)}</p>
        <small>Now close your eyes for two seconds and replay the sentence as a scene. Could you recognize the same force in a different SAT passage?</small>
      </section>
      <div class="context-review-decision" hidden>
        <button type="button" data-context-quality="1">意思认得，但画面还弱<small>较短间隔后再出现</small></button>
        <button type="button" data-context-quality="2">词义和使用场景都能还原<small>延长稳定期</small></button>
      </div>
      <button type="button" class="context-reconnect-button" data-context-quality="0" hidden>这次没取回 · 带着场景重新连接</button>`;
    appendHighlightedPassage(card.querySelector(".context-scene-sentence"), word.example || word.definition || "", [word]);
    const anchor = card.querySelector(".context-scene-anchor");
    const decision = card.querySelector(".context-review-decision");
    const reconnect = card.querySelector(".context-reconnect-button");
    let answered = false;
    let meaningCorrect = false;
    card.querySelectorAll("[data-context-meaning]").forEach(button => button.addEventListener("click", () => {
      if (answered) return;
      answered = true;
      const selected = options[Number(button.dataset.contextMeaning)];
      meaningCorrect = Boolean(selected?.correct);
      card.querySelectorAll("[data-context-meaning]").forEach((choice, index) => {
        choice.disabled = true;
        if (options[index]?.correct) choice.classList.add("correct");
      });
      if (!meaningCorrect) button.classList.add("incorrect");
      anchor.hidden = false;
      decision.hidden = !meaningCorrect;
      reconnect.hidden = meaningCorrect;
      anchor.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }));
    card.querySelectorAll("[data-context-quality]").forEach(button => button.addEventListener("click", () => {
      completeContextReview(word, Number(button.dataset.contextQuality), meaningCorrect);
    }));
    reviewQueue.append(card);
  }

  function renderLevelFilters() {
    refreshIntroducedIds();
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
      reviewSessionCorrect = 0;
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
      .sort((a, b) => memoryState(a).retrievability - memoryState(b).retrievability || Number(reviewStore[a.id]?.nextReview || 0) - Number(reviewStore[b.id]?.nextReview || 0) || a.level - b.level || a.id.localeCompare(b.id, "en"))
      .slice(0, Math.max(0, REVIEW_SESSION_LIMIT - reviewSeen.size));
  }

  function renderReview() {
    renderLevelFilters();
    const sessionHint = document.querySelector(".review-session-status span");
    if (sessionHint) sessionHint.textContent = "先读场景，再判断词义；最后确认能否还原它的语气和作用";
    const candidates = reviewCandidates();
    const totalInFilter = reviewFilter === "due"
      ? satWords.filter(isDue).length
      : reviewFilter === "today"
        ? todayReviewWords().length
        : satWords.filter(word => word.level === Number(reviewFilter)).length;
    reviewSummary.textContent = reviewFilter === "due"
      ? `有 ${totalInFilter} 个词的预计记忆强度已经下降到复习点。每轮只取最容易遗忘的 ${Math.min(REVIEW_SESSION_LIMIT, totalInFilter)} 个，避免被积压数量压垮。`
      : reviewFilter === "today"
        ? `今天新背且未达到 L5 的 ${totalInFilter} 个词会在原句中重新激活，防止短期印象在今晚消失。`
        : `正在处理熟悉度 ${reviewFilter}：先用原句测试语境义，再根据“只认得意思 / 能还原场景”调整稳定期。`;
    reviewSessionProgress.textContent = `本轮 ${reviewSessionCount} 词 · 语境义答对 ${reviewSessionCorrect} 词 · 稳定升级 ${reviewSessionPromoted} 词 · 剩余 ${candidates.length}`;
    reviewQueue.innerHTML = "";
    if (!candidates.length) {
      reviewQueue.innerHTML = `<div class="review-session-complete"><span>✦</span><h3>${reviewSessionCount ? "这一轮语境已重新点亮" : "这一组暂时没有到期场景"}</h3><p>${reviewSessionCount ? `你重新激活了 ${reviewSessionCount} 个词的使用场景，语境义答对 ${reviewSessionCorrect} 个，其中 ${reviewSessionPromoted} 个延长了记忆稳定期。` : "可以选择其他熟悉度，或回到到期队列。"}</p><button type="button" class="secondary-button" id="restart-review-session">${reviewSessionCount >= REVIEW_SESSION_LIMIT ? "继续下一轮 20 词" : "再来一轮"}</button></div>`;
      document.getElementById("restart-review-session")?.addEventListener("click", () => {
        reviewSeen = new Set();
        reviewSessionCount = 0;
        reviewSessionPromoted = 0;
        reviewSessionCorrect = 0;
        reviewFeedback.textContent = "新一轮开始。";
        renderReview();
      });
      return;
    }
    renderContextReviewCard(candidates[0]);
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
    refreshIntroducedIds();
    if (reviewFilter === "today") renderReview();
    else renderLevelFilters();
  });
  window.addEventListener("lexiverse-level-change", event => {
    if (!event.detail?.id || event.detail.source === "prep") return;
    const word = wordMap.get(event.detail.id);
    if (!word) return;
    word.level = Number(event.detail.level);
    levelStore[word.id] = word.level;
    introducedIds.add(word.id);
    renderReview();
    renderAdaptiveReading();
    updatePoolStatus();
  });

  updatePoolStatus();
  renderPracticeHistory();
  renderReview();
  renderAdaptiveReading();
})();
