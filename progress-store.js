(() => {
  const STORAGE_KEY = "lexiverse-word-passes-v1";
  let store = {};
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && typeof saved === "object" && !Array.isArray(saved)) store = saved;
  } catch {}

  let completed = {};
  try {
    completed = JSON.parse(localStorage.getItem("lexiverse-group-study-v1"))?.completed || {};
  } catch {}

  let seeded = false;
  (window.WORDBANK_WORDS || []).forEach(word => {
    const current = Number(store[word.id]);
    if (Number.isFinite(current) && current >= 1) return;
    store[word.id] = completed[word.id] ? 2 : 1;
    seeded = true;
  });
  if (seeded) localStorage.setItem(STORAGE_KEY, JSON.stringify(store));

  const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  const cleanIds = ids => [...new Set((Array.isArray(ids) ? ids : [ids]).map(id => String(id || "").trim()).filter(Boolean))];
  const notify = (ids, source) => window.dispatchEvent(new CustomEvent("lexiverse-pass-change", {
    detail: { ids, counts: Object.fromEntries(ids.map(id => [id, Number(store[id]) || 0])), source }
  }));

  window.LexiversePasses = {
    key: STORAGE_KEY,
    get(id) {
      return Math.max(0, Number(store[id]) || 0);
    },
    ensure(id, minimum = 1, source = "migration") {
      const cleanId = String(id || "").trim();
      if (!cleanId) return 0;
      const next = Math.max(Number(store[cleanId]) || 0, Math.max(0, Number(minimum) || 0));
      if (next !== Number(store[cleanId])) {
        store[cleanId] = next;
        save();
        notify([cleanId], source);
      }
      return next;
    },
    increment(ids, source = "study") {
      const clean = cleanIds(ids);
      clean.forEach(id => { store[id] = Math.max(0, Number(store[id]) || 0) + 1; });
      if (clean.length) {
        save();
        notify(clean, source);
      }
      return Object.fromEntries(clean.map(id => [id, Number(store[id]) || 0]));
    },
    snapshot() {
      return { ...store };
    },
    restore(snapshot, source = "restore") {
      store = snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) ? { ...snapshot } : {};
      save();
      notify(Object.keys(store), source);
    }
  };
})();
