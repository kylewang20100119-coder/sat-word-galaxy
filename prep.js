(() => {
  const satMap = new Map((window.WORDBANK_WORDS || []).map(word => [word.id, { ...word }]));
  (window.WORDS || []).forEach(word => {
    const imported = satMap.get(word.id) || {};
    satMap.set(word.id, { ...imported, ...word, group: imported.group || word.group || "Advanced extension" });
  });
  const satWords = [...satMap.values()].filter(word => /^Group \d+$/.test(word.group || ""));
  const wordMap = new Map(satWords.map(word => [word.id, word]));
  const questionBank = Array.isArray(window.OFFLINE_SAT_QUESTIONS) ? window.OFFLINE_SAT_QUESTIONS : [];

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

  function questionCandidates() {
    const poolIds = new Set(generatorPool().map(word => word.id));
    const completedIds = new Set(practiceAttempts.map(attempt => attempt.questionId));
    const requestedDifficulty = difficulty.value;
    return questionBank
      .filter(item => !completedIds.has(item.id))
      .filter(item => item.genre === genre.value)
      .filter(item => requestedDifficulty !== "hard" || item.difficulty === "hard")
      .map(item => ({ item, matches: item.targets.filter(id => poolIds.has(id)) }))
      .filter(entry => entry.matches.length > 0)
      .sort((a, b) => b.matches.length - a.matches.length);
  }

  function updatePoolStatus() {
    const pool = generatorPool();
    const levels = [...selectedLevels()].sort().join("、") || "未选择";
    const candidates = questionCandidates();
    const strongest = candidates[0]?.matches.length || 0;
    poolStatus.textContent = candidates.length
      ? `当前范围 ${pool.length} 个词 · 熟悉度 ${levels} · 剩余 ${candidates.length} 题 · 最多命中 ${strongest} 个重点词`
      : `这个筛选范围内的匹配题已经完成，或暂时没有可匹配题目。可调整 Group、熟悉度、难度或文章类型。`;
    generateButton.disabled = !selectedLevels().size || !candidates.length;
  }

  function escapePattern(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
      chip.textContent = showMeanings.checked && chip.dataset.meaning
        ? `${chip.dataset.word} · ${chip.dataset.meaning}`
        : chip.dataset.word;
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
        chip.textContent = id;
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
    const bestMatch = candidates[0].matches.length;
    const strongest = candidates.filter(entry => entry.matches.length === bestMatch);
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
  const intervals = { 1: 1, 2: 2, 3: 5, 4: 12, 5: 30 };

  function isDue(word) {
    const state = reviewStore[word.id];
    return !state || Number(state.nextReview || 0) <= Date.now();
  }

  function persistReview() {
    localStorage.setItem("lexiverse-review-v1", JSON.stringify(reviewStore));
    localStorage.setItem("lexiverse-levels", JSON.stringify(levelStore));
  }

  function updateWordLevel(word, remembered) {
    const now = Date.now();
    const previous = reviewStore[word.id] || { streak: 0 };
    word.level = remembered ? Math.min(5, word.level + 1) : Math.max(1, word.level - 1);
    levelStore[word.id] = word.level;
    reviewStore[word.id] = remembered
      ? { streak: Number(previous.streak || 0) + 1, lastReviewed: now, nextReview: now + intervals[word.level] * 86400000 }
      : { streak: 0, lastReviewed: now, nextReview: now + 10 * 60000 };
    persistReview();
    window.dispatchEvent(new CustomEvent("lexiverse-level-change", { detail: { id: word.id, level: word.level, source: "prep" } }));
    renderReview();
    updatePoolStatus();
  }

  function renderLevelFilters() {
    const counts = Object.fromEntries([1, 2, 3, 4, 5].map(level => [level, satWords.filter(word => word.level === level).length]));
    const dueCount = satWords.filter(isDue).length;
    reviewLevels.innerHTML = `
      <button class="review-filter" type="button" data-review-filter="due" aria-pressed="${reviewFilter === "due"}"><strong>${dueCount}</strong><span>到期复习</span></button>
      ${[1, 2, 3, 4, 5].map(level => `<button class="review-filter" type="button" data-review-filter="${level}" aria-pressed="${String(reviewFilter) === String(level)}"><strong>${counts[level]}</strong><span>熟悉度 ${level}</span></button>`).join("")}`;
    reviewLevels.querySelectorAll("[data-review-filter]").forEach(button => button.addEventListener("click", () => {
      reviewFilter = button.dataset.reviewFilter;
      renderReview();
    }));
  }

  function reviewCandidates() {
    const filtered = reviewFilter === "due" ? satWords.filter(isDue) : satWords.filter(word => word.level === Number(reviewFilter));
    return filtered.sort((a, b) => a.level - b.level || Number(reviewStore[a.id]?.nextReview || 0) - Number(reviewStore[b.id]?.nextReview || 0) || a.id.localeCompare(b.id, "en")).slice(0, 12);
  }

  function renderReview() {
    renderLevelFilters();
    const candidates = reviewCandidates();
    reviewSummary.textContent = reviewFilter === "due"
      ? `今天有 ${satWords.filter(isDue).length} 个词可复习，当前优先显示熟悉度最低的 12 个。`
      : `正在查看熟悉度 ${reviewFilter} 的单词，按字母顺序显示前 12 个。`;
    reviewQueue.innerHTML = "";
    if (!candidates.length) {
      reviewQueue.innerHTML = `<p class="review-empty">这一组暂时没有需要复习的单词。</p>`;
      return;
    }
    candidates.forEach(word => {
      const card = document.createElement("article");
      card.className = "review-card";
      card.innerHTML = `
        <div class="review-card-header"><h3></h3><span class="review-level-badge"></span></div>
        <p class="review-group"></p>
        <p class="review-answer" hidden></p>
        <button class="reveal-review" type="button">查看释义</button>
        <div class="review-actions"><button class="forgot" type="button">忘记了</button><button class="remembered" type="button">记得</button></div>`;
      card.querySelector("h3").textContent = word.id;
      card.querySelector(".review-level-badge").textContent = `LEVEL ${word.level}`;
      card.querySelector(".review-group").textContent = word.group;
      const answer = card.querySelector(".review-answer");
      answer.textContent = `${word.zh} · ${word.definition}`;
      card.querySelector(".reveal-review").addEventListener("click", event => {
        answer.hidden = false;
        event.currentTarget.hidden = true;
      });
      card.querySelector(".forgot").addEventListener("click", () => updateWordLevel(word, false));
      card.querySelector(".remembered").addEventListener("click", () => updateWordLevel(word, true));
      reviewQueue.append(card);
    });
  }

  passageForm.addEventListener("change", updatePoolStatus);
  showMeanings.addEventListener("change", () => {
    localStorage.setItem("lexiverse-show-practice-meanings", String(showMeanings.checked));
    updateTargetWordMeanings();
  });
  window.addEventListener("lexiverse-level-change", event => {
    if (!event.detail?.id || event.detail.source === "prep") return;
    const word = wordMap.get(event.detail.id);
    if (!word) return;
    word.level = Number(event.detail.level);
    levelStore[word.id] = word.level;
    renderReview();
    updatePoolStatus();
  });

  updatePoolStatus();
  renderPracticeHistory();
  renderReview();
})();
