(() => {
  const root = document.getElementById("confusable-study");
  if (!root) return;

  const allWords = new Map();
  [...(window.WORDBANK_WORDS || []), ...(window.WORDS || []), ...(window.GRE_WORDS || [])].forEach(word => {
    allWords.set(word.id, { ...(allWords.get(word.id) || {}), ...word });
  });
  const pairs = (window.CONFUSABLE_WORD_PAIRS || [])
    .map(pair => ({ ...pair, id: pair.words.join("::"), entries: pair.words.map(id => allWords.get(id)).filter(Boolean) }))
    .filter(pair => pair.entries.length === 2);
  if (!pairs.length) return;

  let saved = { mastered: {}, review: {}, history: [], filter: "group", index: 0 };
  try { saved = { ...saved, ...(JSON.parse(localStorage.getItem("lexiverse-confusable-study-v1")) || {}) }; } catch {}
  if (!saved.mastered || typeof saved.mastered !== "object") saved.mastered = {};
  if (!saved.review || typeof saved.review !== "object") saved.review = {};
  if (!Array.isArray(saved.history)) saved.history = [];

  const levelStore = (() => {
    try { return JSON.parse(localStorage.getItem("lexiverse-levels")) || {}; } catch { return {}; }
  })();
  let activePairs = [];
  let quizState = { pairId: "", targetIndex: 0, answered: false, choice: "" };

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  const currentGroup = () => `Group ${Number(document.getElementById("study-group-select")?.value) || 1}`;
  const persist = () => localStorage.setItem("lexiverse-confusable-study-v1", JSON.stringify(saved));
  const pairLevel = pair => Math.min(...pair.entries.map(word => Number(levelStore[word.id] || word.level || 1)));
  const localDay = timestamp => {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  };

  function groupPairs() {
    const group = currentGroup();
    return pairs.filter(pair => pair.entries.some(word => word.group === group));
  }

  function focusedFallback() {
    return pairs.slice().sort((a, b) =>
      Number(Boolean(saved.review[b.id])) - Number(Boolean(saved.review[a.id])) ||
      Number(Boolean(saved.mastered[a.id])) - Number(Boolean(saved.mastered[b.id])) ||
      pairLevel(a) - pairLevel(b)
    ).slice(0, 8);
  }

  function filteredPairs() {
    if (saved.filter === "weak") {
      const weak = pairs.filter(pair => pairLevel(pair) <= 2 || saved.review[pair.id]);
      return (weak.length ? weak : focusedFallback()).sort((a, b) =>
        Number(Boolean(saved.review[b.id])) - Number(Boolean(saved.review[a.id])) || pairLevel(a) - pairLevel(b)
      ).slice(0, 18);
    }
    if (saved.filter === "all") {
      return pairs.slice().sort((a, b) =>
        Number(Boolean(saved.mastered[a.id])) - Number(Boolean(saved.mastered[b.id])) || a.words[0].localeCompare(b.words[0], "en")
      );
    }
    const matched = groupPairs();
    return (matched.length ? matched : focusedFallback()).sort((a, b) =>
      Number(Boolean(saved.review[b.id])) - Number(Boolean(saved.review[a.id])) ||
      Number(Boolean(saved.mastered[a.id])) - Number(Boolean(saved.mastered[b.id]))
    );
  }

  function resetQuiz(pair) {
    const attempts = saved.history.filter(row => row.pair === pair.id).length;
    const seed = [...pair.id].reduce((total, character) => total + character.charCodeAt(0), 0);
    quizState = { pairId: pair.id, targetIndex: (seed + attempts) % 2, answered: false, choice: "" };
  }

  function buildQuestion(pair) {
    const target = pair.entries[quizState.targetIndex];
    const example = String(target.example || "").trim();
    const needle = String(target.id || "").toLowerCase();
    const start = example.toLowerCase().indexOf(needle);
    if (example && needle && start >= 0) {
      let end = start + needle.length;
      const tail = example.slice(end).toLowerCase();
      const suffix = ["ingly", "ing", "ed", "es", "s", "d"].find(item => tail.startsWith(item) && !/[a-z]/i.test(tail[item.length] || ""));
      if (suffix) end += suffix.length;
      const prefix = example.slice(0, start);
      const remainder = example.slice(end);
      const prompt = `${prefix}${/[a-z0-9]$/i.test(prefix) ? " " : ""}_____${/^[a-z0-9]/i.test(remainder) ? " " : ""}${remainder}`;
      const full = `${prefix}${/[a-z0-9]$/i.test(prefix) ? " " : ""}${example.slice(start, end)}${/^[a-z0-9]/i.test(remainder) ? " " : ""}${remainder}`;
      return { prompt, full, fallback: false };
    }
    return {
      prompt: `Which word best matches this meaning: “${target.definition || target.zh || "the intended meaning"}”?`,
      full: `${target.id}: ${target.example || target.definition || target.zh || ""}`,
      fallback: true
    };
  }

  function wordMini(word, side) {
    const level = Number(levelStore[word.id] || word.level || 1);
    const passes = window.LexiversePasses?.get(word.id) || 0;
    return `<article class="confusable-word-mini side-${side}">
      <button type="button" data-confusable-word="${escapeHtml(word.id)}" aria-label="在上方星系中查看 ${escapeHtml(word.id)}">
        <small>${escapeHtml(word.pos || "word")} · 熟悉度 ${level} · ${passes} 遍</small>
        <strong>${escapeHtml(word.id)}</strong>
      </button>
      <p>${escapeHtml(word.zh || "暂无中文释义")}</p>
      <p>${escapeHtml(word.definition || "")}</p>
    </article>`;
  }

  function choiceClass(word, correctWord) {
    if (!quizState.answered) return "";
    if (word === correctWord) return " correct";
    if (word === quizState.choice) return " incorrect";
    return "";
  }

  function render() {
    activePairs = filteredPairs();
    saved.index = Math.max(0, Math.min(Number(saved.index) || 0, activePairs.length - 1));
    const pair = activePairs[saved.index] || activePairs[0];
    if (!pair) return;
    if (quizState.pairId !== pair.id) resetQuiz(pair);

    const today = localDay(Date.now());
    const masteredCount = pairs.filter(item => saved.mastered[item.id]).length;
    const todayCount = saved.history.filter(row => localDay(row.at) === today).length;
    const matches = groupPairs();
    const masteredTimes = Number(saved.mastered[pair.id] || 0);
    const question = buildQuestion(pair);
    const correctWord = pair.words[quizState.targetIndex];
    const correct = quizState.answered && quizState.choice === correctWord;
    const promptHtml = escapeHtml(question.prompt).replace("_____", "<mark>_____</mark>");
    const filterStatus = saved.filter === "group"
      ? (matches.length ? `当前 Group 共 ${activePairs.length} 对` : "本组暂无直接词对 · 推荐 8 对薄弱辨析")
      : (saved.filter === "weak" ? `聚焦 ${activePairs.length} 对薄弱词` : `完整题库 ${activePairs.length} 对`);

    root.innerHTML = `
      <div class="confusable-heading">
        <div><p class="eyebrow"><span></span> CONFUSABLE PAIRS</p><h3>易混词语境辨析</h3><p>先抓住核心边界，再在真实语境中二选一。答完才揭晓解析，让你不是“看懂了”，而是真的能分清。</p></div>
        <div class="confusable-stats"><span><strong>${masteredCount}</strong><small>已分清</small></span><span><strong>${todayCount}</strong><small>今日练习</small></span><span><strong>${matches.length}</strong><small>本组匹配</small></span><span><strong>${pairs.length}</strong><small>词库总量</small></span></div>
      </div>
      <div class="confusable-toolbar">
        <div role="group" aria-label="筛选易混词对">
          <button type="button" data-confusable-filter="group" aria-pressed="${saved.filter === "group"}">只看当前 Group</button>
          <button type="button" data-confusable-filter="weak" aria-pressed="${saved.filter === "weak"}">薄弱词优先</button>
          <button type="button" data-confusable-filter="all" aria-pressed="${saved.filter === "all"}">全部高频词对</button>
        </div>
        <span>${saved.index + 1} / ${activePairs.length} · ${filterStatus}</span>
      </div>
      <div class="confusable-deck ${masteredTimes ? "mastered" : ""}">
        <div class="confusable-pair-label"><span>${masteredTimes ? `已分清 ${masteredTimes} 次` : "STEP 1 · 看边界"}</span><i></i><strong>VS</strong><i></i><span>STEP 2 · 进语境</span></div>
        <div class="confusable-contrast">${wordMini(pair.entries[0], "left")}<span class="confusable-vs">versus</span>${wordMini(pair.entries[1], "right")}</div>
        <div class="confusable-boundary"><span>一句话核心区别</span><strong>${escapeHtml(pair.distinction)}</strong></div>
        <section class="confusable-quiz" aria-label="易混词语境选择题">
          <div class="confusable-quiz-heading"><span>STEP 2 · 不看例句，主动选择</span><small>${quizState.answered ? "已揭晓" : "先凭语感作答"}</small></div>
          <p class="confusable-prompt">${promptHtml}</p>
          <div class="confusable-choices">
            ${pair.words.map(word => `<button type="button" class="confusable-choice${choiceClass(word, correctWord)}" data-confusable-choice="${escapeHtml(word)}" ${quizState.answered ? "disabled" : ""}>${escapeHtml(word)}</button>`).join("")}
          </div>
          ${quizState.answered ? `<div class="confusable-reveal" data-result="${correct ? "correct" : "incorrect"}">
            <strong>${correct ? "选对了：你已经抓住两词的语义边界。" : `正确答案是 ${escapeHtml(correctWord)}。先别急着记错，看看它为什么适合这个语境。`}</strong>
            <p>${escapeHtml(question.full)}</p>
            <p><b>记忆钩子</b>${escapeHtml(pair.hook)}</p>
            <div class="confusable-example-pair"><blockquote><b>${escapeHtml(pair.words[0])}</b> · ${escapeHtml(pair.entries[0].example || pair.entries[0].definition || "")}</blockquote><blockquote><b>${escapeHtml(pair.words[1])}</b> · ${escapeHtml(pair.entries[1].example || pair.entries[1].definition || "")}</blockquote></div>
          </div>` : ""}
        </section>
        <div class="confusable-actions">
          <button type="button" id="confusable-prev" class="secondary-button">上一对</button>
          <button type="button" id="confusable-review" class="confusable-review-button" ${quizState.answered ? "" : "disabled"}>还会混 · 放回薄弱队列</button>
          <button type="button" id="confusable-master" class="primary-button" ${quizState.answered ? "" : "disabled"}>已经分清 · 两词各 +1 遍</button>
          <button type="button" id="confusable-next" class="secondary-button">下一对</button>
        </div>
        <p id="confusable-feedback" class="confusable-feedback" aria-live="polite">${quizState.answered ? "根据真实感受选择“还会混”或“已经分清”。" : "完成语境二选一后，再决定是否真正分清。点击词名仍可联动上方星系。"}</p>
      </div>`;

    root.querySelectorAll("[data-confusable-filter]").forEach(button => button.addEventListener("click", () => {
      saved.filter = button.dataset.confusableFilter;
      saved.index = 0;
      quizState.pairId = "";
      persist();
      render();
    }));
    root.querySelectorAll("[data-confusable-word]").forEach(button => button.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("lexiverse-select-word", { detail: { id: button.dataset.confusableWord, source: "confusable-study" } }));
      root.querySelector("#confusable-feedback").textContent = `${button.dataset.confusableWord} 已在上方星系展开；当前辨析题保持不变。`;
    }));
    root.querySelectorAll("[data-confusable-choice]").forEach(button => button.addEventListener("click", () => {
      quizState.answered = true;
      quizState.choice = button.dataset.confusableChoice;
      render();
      root.querySelector("#confusable-feedback").textContent = quizState.choice === correctWord
        ? "判断正确。现在按真实感受确认是否已经分清。"
        : "这次判断错了。读完解析后，把它放回薄弱队列会更有效。";
    }));
    root.querySelector("#confusable-prev").addEventListener("click", () => move(-1));
    root.querySelector("#confusable-next").addEventListener("click", () => move(1));
    root.querySelector("#confusable-review").addEventListener("click", () => completePair(pair, false));
    root.querySelector("#confusable-master").addEventListener("click", () => completePair(pair, true));
  }

  function move(direction) {
    saved.index = (saved.index + direction + activePairs.length) % activePairs.length;
    quizState.pairId = "";
    persist();
    render();
  }

  function completePair(pair, mastered) {
    window.LexiversePasses?.increment(pair.words, mastered ? "confusable-mastered" : "confusable-review");
    const now = Date.now();
    if (mastered) {
      saved.mastered[pair.id] = Number(saved.mastered[pair.id] || 0) + 1;
      delete saved.review[pair.id];
    } else saved.review[pair.id] = now;
    saved.history.push({ pair: pair.id, mastered, correct: quizState.choice === pair.words[quizState.targetIndex], at: now });
    if (saved.history.length > 1200) saved.history = saved.history.slice(-1200);
    window.dispatchEvent(new CustomEvent("lexiverse-confusable-complete", { detail: { words: pair.words, mastered, firstMastery: mastered && saved.mastered[pair.id] === 1 } }));
    saved.index = (saved.index + 1) % Math.max(1, activePairs.length);
    quizState.pairId = "";
    persist();
    render();
    const feedback = root.querySelector("#confusable-feedback");
    if (feedback) feedback.textContent = mastered ? `已记录 ${pair.words.join(" / ")}，两词各增加 1 遍。` : `${pair.words.join(" / ")} 已放入薄弱词优先队列。`;
  }

  window.addEventListener("lexiverse-group-change", () => {
    if (saved.filter === "group") { saved.index = 0; quizState.pairId = ""; render(); }
  });
  window.addEventListener("lexiverse-level-change", event => {
    if (event.detail?.id) levelStore[event.detail.id] = Number(event.detail.level) || 1;
    if (saved.filter === "weak") render();
  });
  window.addEventListener("lexiverse-pass-change", () => render());
  render();
})();
