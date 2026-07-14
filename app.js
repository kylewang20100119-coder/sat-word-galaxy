(() => {
  const satIds = new Set([...(window.WORDBANK_WORDS || []), ...(window.WORDS || [])].map(word => word.id));
  const greIndex = new Set(window.GRE_INDEX || []);
  const greMeta = window.GRE_META || {};
  const mergedWords = new Map((window.WORDBANK_WORDS || []).map(word => [word.id, word]));
  (window.WORDS || []).forEach(word => {
    const imported = mergedWords.get(word.id) || {};
    mergedWords.set(word.id, { ...imported, ...word, group: imported.group || "Advanced extension", source: imported.source || "Advanced extension" });
  });
  (window.GRE_WORDS || []).forEach(word => {
    const imported = mergedWords.get(word.id) || {};
    mergedWords.set(word.id, { ...word, ...imported, greTier: word.greTier || greMeta[word.id]?.tier });
  });
  const words = [...mergedWords.values()].map(word => {
    const isSat = satIds.has(word.id);
    const isGre = greIndex.has(word.id) || Boolean(greMeta[word.id]);
    return { ...word, exams: [isSat && "SAT", isGre && "GRE"].filter(Boolean), greTier: word.greTier || greMeta[word.id]?.tier || null };
  });
  const relationRows = [...(window.WORDBANK_RELATIONS || []), ...(window.RELATIONS || []), ...(window.GRE_RELATIONS || [])];
  const relationMap = new Map();
  relationRows.forEach(([source, target, type, strength]) => {
    if (!mergedWords.has(source) || !mergedWords.has(target) || source === target) return;
    const [a, b] = source < target ? [source, target] : [target, source];
    const key = `${a}|${b}|${type}`;
    const previous = relationMap.get(key);
    if (!previous || strength > previous.strength) relationMap.set(key, { source: a, target: b, type, strength });
  });
  const relations = [...relationMap.values()].map((relation, id) => ({ id, ...relation }));
  const wordMap = new Map(words.map(word => [word.id, word]));
  const colors = { synonym: "#42d6da", antonym: "#ff765f", etymology: "#a990ff", prefix: "#f2c14e" };
  const typeNames = { synonym: "同义词", antonym: "反义词", etymology: "同词源", prefix: "同前缀" };
  const stage = document.getElementById("galaxy-stage");
  const canvas = document.getElementById("galaxy-canvas");
  const ctx = canvas.getContext("2d");
  const detail = document.getElementById("word-detail");
  const status = document.getElementById("network-status");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let dpr = Math.min(devicePixelRatio || 1, 2);
  let width = 0, height = 0, animationFrame;
  let selectedId = "benevolent";
  let hoveredId = null;
  let enabledTypes = new Set(Object.keys(colors));
  let scopedIds = null;
  let nodes = [];
  let graphWords = [];
  let graphLinks = [];
  let density = "compact";
  let catalog = "all";
  const densitySettings = {
    compact: { maxNodes: 28, directLimit: 12, contextEdges: false },
    standard: { maxNodes: 44, directLimit: 18, contextEdges: true },
    rich: { maxNodes: 64, directLimit: 24, contextEdges: true }
  };
  let camera = { x: 0, y: 0, scale: 1 };
  let targetCamera = { x: 0, y: 0, scale: 1 };
  let orbit = { yaw: 0, pitch: -.08, targetYaw: 0, targetPitch: -.08, yawVelocity: 0, pitchVelocity: 0 };
  let dragging = false, moved = false, lastPointer = null;

  function hash(value) {
    let h = 2166136261;
    for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
    return (h >>> 0) / 4294967295;
  }

  function nudgeOrbit(id, amount = 1) {
    const direction = hash(id + "orbit-direction") > .5 ? 1 : -1;
    orbit.targetYaw += direction * (.2 + hash(id + "orbit-distance") * .16) * amount;
    orbit.targetPitch = -.08 + (hash(id + "orbit-pitch") - .5) * .2 * amount;
    if (reducedMotion) {
      orbit.yaw = orbit.targetYaw;
      orbit.pitch = orbit.targetPitch;
      orbit.yawVelocity = 0;
      orbit.pitchVelocity = 0;
    }
  }

  function activeDensitySettings() {
    const base = densitySettings[density];
    if (width >= 620) return base;
    const mobileCaps = density === "compact"
      ? { maxNodes: 20, directLimit: 8 }
      : density === "standard"
        ? { maxNodes: 28, directLimit: 12 }
        : { maxNodes: 38, directLimit: 16 };
    return { ...base, ...mobileCaps };
  }

  function catalogKind(word) {
    if (word.exams.includes("SAT") && word.exams.includes("GRE")) return "overlap";
    if (word.exams.includes("GRE")) return "gre";
    return "sat";
  }

  function matchesCatalog(word) {
    if (catalog === "all") return true;
    if (catalog === "overlap") return word.exams.includes("SAT") && word.exams.includes("GRE");
    return word.exams.includes(catalog.toUpperCase());
  }

  function updateCatalogButtons() {
    document.querySelectorAll("[data-catalog]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.catalog === catalog)));
  }

  function universeWords() { return words.filter(word => (!scopedIds || scopedIds.has(word.id)) && matchesCatalog(word)); }
  function visibleWords() { return graphWords; }
  function visibleRelations() { return graphLinks; }

  function sliceGraph(focusId) {
    const universe = universeWords();
    const universeIds = new Set(universe.map(word => word.id));
    if (!universeIds.has(focusId)) focusId = universe[0]?.id;
    if (!focusId) return { focusId: null, visible: [], links: [] };
    const candidateLinks = relations.filter(relation => enabledTypes.has(relation.type) && universeIds.has(relation.source) && universeIds.has(relation.target));
    const adjacency = new Map();
    candidateLinks.forEach(link => {
      if (!adjacency.has(link.source)) adjacency.set(link.source, []);
      if (!adjacency.has(link.target)) adjacency.set(link.target, []);
      adjacency.get(link.source).push({ other: link.target, link });
      adjacency.get(link.target).push({ other: link.source, link });
    });
    adjacency.forEach(items => items.sort((a, b) => b.link.strength - a.link.strength));
    const settings = activeDensitySettings();
    const selected = new Set([focusId]);
    const direct = [];
    const directIds = new Set();
    for (const item of adjacency.get(focusId) || []) {
      if (directIds.has(item.other)) continue;
      directIds.add(item.other);
      direct.push(item);
      if (direct.length >= settings.directLimit) break;
    }
    direct.forEach(item => selected.add(item.other));
    const queue = direct.map(item => ({ id: item.other, depth: 1 }));
    while (queue.length && selected.size < settings.maxNodes) {
      const current = queue.shift();
      if (current.depth >= 2) continue;
      for (const item of adjacency.get(current.id) || []) {
        if (selected.size >= settings.maxNodes) break;
        if (!selected.has(item.other)) {
          selected.add(item.other);
          queue.push({ id: item.other, depth: current.depth + 1 });
        }
      }
    }
    if (scopedIds && universe.length <= settings.maxNodes) universe.forEach(word => selected.add(word.id));
    if (selected.size < Math.min(12, settings.maxNodes)) {
      const focusGroup = wordMap.get(focusId)?.group;
      universe.filter(word => word.group === focusGroup).slice(0, 12 - selected.size).forEach(word => selected.add(word.id));
    }
    const visible = universe.filter(word => selected.has(word.id));
    const links = candidateLinks.filter(link => selected.has(link.source) && selected.has(link.target));
    return { focusId, visible, links };
  }

  function buildLayout(focusId = selectedId) {
    const sliced = sliceGraph(focusId);
    focusId = sliced.focusId;
    const visible = sliced.visible;
    graphWords = visible;
    graphLinks = sliced.links;
    if (!focusId) return;
    selectedId = focusId;
    const links = graphLinks;
    const distance = new Map([[focusId, 0]]);
    let frontier = [focusId];
    for (let depth = 1; depth < 5 && frontier.length; depth++) {
      const next = [];
      frontier.forEach(id => links.forEach(r => {
        const other = r.source === id ? r.target : r.target === id ? r.source : null;
        if (other && !distance.has(other)) { distance.set(other, depth); next.push(other); }
      }));
      frontier = next;
    }
    const old = new Map(nodes.map(n => [n.id, n]));
    const focusLinks = links
      .filter(link => link.source === focusId || link.target === focusId)
      .sort((a, b) => b.strength - a.strength);
    const directRank = new Map(focusLinks.map((link, index) => [link.source === focusId ? link.target : link.source, index]));
    const directLink = new Map(focusLinks.map(link => [link.source === focusId ? link.target : link.source, link]));
    const smallScope = Boolean(scopedIds && visible.length <= 14);
    const hasPreviousLayout = old.size > 0;
    const grouped = new Map();
    visible.forEach(word => {
      const depth = distance.get(word.id) ?? 2;
      if (!grouped.has(depth)) grouped.set(depth, []);
      grouped.get(depth).push(word);
    });
    const nextNodes = [];
    [...grouped.entries()].sort((a,b) => a[0]-b[0]).forEach(([depth, group]) => {
      group.sort((a,b) => (directRank.get(a.id) ?? 999) - (directRank.get(b.id) ?? 999) || hash(a.id) - hash(b.id));
      group.forEach((word, i) => {
        const direct = links.filter(r => (r.source === focusId && r.target === word.id) || (r.target === focusId && r.source === word.id));
        const strongest = direct.reduce((m, r) => Math.max(m, r.strength), 0);
        const responsiveScale = width < 620 ? .72 : 1;
        const radius = depth === 0 ? 0 : (105 + depth * 92) * responsiveScale * (1.08 - strongest * .25);
        const angle = depth === 0 ? 0 : (i / group.length) * Math.PI * 2 - Math.PI / 2 + depth * .38 + (hash(word.id) - .5) * .22;
        const tx = Math.cos(angle) * radius;
        const ty = Math.sin(angle) * radius * .66;
        const tz = depth === 0 ? 0 : (hash(word.id + "z") - .5) * (95 + depth * 58) * responsiveScale;
        const prev = old.get(word.id);
        const showLabel = depth === 0 || depth === 1 || smallScope;
        const relation = directLink.get(word.id);
        const fontSize = depth === 0 ? 26 : depth === 1 ? 13 + strongest * 3.5 : 11;
        nextNodes.push({
          ...word, tx, ty,
          x: prev?.x ?? (reducedMotion || !hasPreviousLayout ? tx : tx * .18),
          y: prev?.y ?? (reducedMotion || !hasPreviousLayout ? ty : ty * .18),
          z: prev?.z ?? (reducedMotion || !hasPreviousLayout ? tz : 210 + (hash(word.id + "arrival") - .5) * 45),
          vx: prev?.vx ?? 0,
          vy: prev?.vy ?? 0,
          vz: prev?.vz ?? 0,
          tz,
          anchorX: tx, anchorY: ty,
          rotation: showLabel && depth > 0 ? (hash(word.id + "r") - .5) * .032 : 0,
          fontSize,
          showLabel,
          accent: relation ? colors[relation.type] : colors.synonym,
          depth
        });
      });
    });
    relaxLabels(nextNodes);
    nodes = nextNodes;
    updateStatus();
  }

  function relaxLabels(layoutNodes) {
    const labeled = layoutNodes.filter(node => node.showLabel);
    const frameWidth = Math.max(320, width || stage.clientWidth || 1000);
    const frameHeight = Math.max(440, height || stage.clientHeight || 560);
    for (let round = 0; round < 80; round++) {
      for (let i = 0; i < labeled.length; i++) {
        const a = labeled[i];
        for (let j = i + 1; j < labeled.length; j++) {
          const b = labeled[j];
          const dx = b.tx - a.tx || .1;
          const dy = b.ty - a.ty || .1;
          const halfWidth = (a.id.length * a.fontSize * .3 + b.id.length * b.fontSize * .3) + 16;
          const halfHeight = (a.fontSize + b.fontSize) * .62 + 7;
          const overlapX = halfWidth - Math.abs(dx);
          const overlapY = halfHeight - Math.abs(dy);
          if (overlapX > 0 && overlapY > 0) {
            const movableA = a.depth !== 0;
            const movableB = b.depth !== 0;
            if (overlapX < overlapY) {
              const push = Math.sign(dx) * overlapX * .28;
              if (movableA) a.tx -= push;
              if (movableB) b.tx += push;
            } else {
              const push = Math.sign(dy) * overlapY * .3;
              if (movableA) a.ty -= push;
              if (movableB) b.ty += push;
            }
          }
        }
        if (a.depth !== 0) {
          const centerDistance = Math.hypot(a.tx, a.ty);
          if (centerDistance < 92) {
            const factor = 92 / Math.max(centerDistance, 1);
            a.tx *= factor; a.ty *= factor;
          }
          a.tx += (a.anchorX - a.tx) * .018;
          a.ty += (a.anchorY - a.ty) * .018;
          a.tx = Math.max(-frameWidth * .43, Math.min(frameWidth * .43, a.tx));
          a.ty = Math.max(-frameHeight * .38, Math.min(frameHeight * .38, a.ty));
        }
      }
    }
  }

  function resize() {
    const rect = stage.getBoundingClientRect();
    width = rect.width; height = rect.height;
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    canvas.style.width = width + "px"; canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function screenPosition(node) {
    const cosYaw = Math.cos(orbit.yaw), sinYaw = Math.sin(orbit.yaw);
    const cosPitch = Math.cos(orbit.pitch), sinPitch = Math.sin(orbit.pitch);
    const x1 = node.x * cosYaw - node.z * sinYaw;
    const z1 = node.x * sinYaw + node.z * cosYaw;
    const y1 = node.y * cosPitch - z1 * sinPitch;
    const z2 = node.y * sinPitch + z1 * cosPitch;
    const perspective = Math.max(.72, Math.min(1.28, 760 / (760 + z2)));
    const scale = camera.scale * perspective;
    return {
      x: width / 2 + (x1 + camera.x) * scale,
      y: height / 2 + (y1 + camera.y) * scale,
      z: z2,
      scale
    };
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    camera.x += (targetCamera.x - camera.x) * (reducedMotion ? 1 : .1);
    camera.y += (targetCamera.y - camera.y) * (reducedMotion ? 1 : .1);
    camera.scale += (targetCamera.scale - camera.scale) * (reducedMotion ? 1 : .1);
    if (reducedMotion) {
      orbit.yaw = orbit.targetYaw; orbit.pitch = orbit.targetPitch;
    } else {
      orbit.yawVelocity = (orbit.yawVelocity + (orbit.targetYaw - orbit.yaw) * .013) * .86;
      orbit.pitchVelocity = (orbit.pitchVelocity + (orbit.targetPitch - orbit.pitch) * .016) * .84;
      orbit.yaw += orbit.yawVelocity;
      orbit.pitch += orbit.pitchVelocity;
    }
    nodes.forEach(n => {
      if (reducedMotion) {
        n.x = n.tx; n.y = n.ty; n.z = n.tz;
        n.vx = 0; n.vy = 0; n.vz = 0;
        return;
      }
      n.vx = (n.vx + (n.tx - n.x) * .014) * .84;
      n.vy = (n.vy + (n.ty - n.y) * .014) * .84;
      n.vz = (n.vz + (n.tz - n.z) * .012) * .85;
      n.x += n.vx; n.y += n.vy; n.z += n.vz;
    });

    const nodeById = new Map(nodes.map(n => [n.id, n]));
    const drawSettings = activeDensitySettings();
    visibleRelations().forEach(rel => {
      const a = nodeById.get(rel.source), b = nodeById.get(rel.target);
      if (!a || !b) return;
      const p1 = screenPosition(a), p2 = screenPosition(b);
      const active = rel.source === selectedId || rel.target === selectedId;
      const hovered = rel.source === hoveredId || rel.target === hoveredId;
      const context = drawSettings.contextEdges && a.depth <= 1 && b.depth <= 1;
      if (!active && !hovered && !context) return;
      ctx.save();
      const depthAlpha = Math.max(.62, Math.min(1, (p1.scale + p2.scale) / 2));
      ctx.globalAlpha = (active ? .58 : hovered ? .38 : .055) * depthAlpha;
      ctx.strokeStyle = colors[rel.type];
      ctx.lineWidth = (active ? .9 + rel.strength : .55) * Math.min(1.12, (p1.scale + p2.scale) / 2);
      if (rel.type === "antonym") ctx.setLineDash([5, 5]);
      if (rel.type === "etymology") ctx.setLineDash([2, 4]);
      ctx.beginPath();
      const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
      const curve = (hash(rel.source + rel.target + rel.type) - .5) * 70;
      ctx.moveTo(p1.x, p1.y);
      ctx.quadraticCurveTo(mx - (p2.y - p1.y) * curve / 300, my + (p2.x - p1.x) * curve / 300, p2.x, p2.y);
      ctx.stroke(); ctx.restore();
    });

    const textColor = getComputedStyle(document.documentElement).getPropertyValue("--text").trim();
    const mutedColor = getComputedStyle(document.documentElement).getPropertyValue("--muted").trim();
    nodes.map(node => ({node, p: screenPosition(node)})).sort((a,b) => b.p.z-a.p.z).forEach(({node,p}) => {
      const selected = node.id === selectedId, hovered = node.id === hoveredId;
      const labelVisible = selected || hovered || node.showLabel;
      const projectedTilt = selected ? 0 : node.rotation + Math.max(-.018, Math.min(.018, p.z / 7000));
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(projectedTilt);
      if (selected) {
        const glowRadius = 58 * p.scale;
        const glow = ctx.createRadialGradient(0, 0, 3, 0, 0, glowRadius);
        glow.addColorStop(0, "rgba(66,214,218,.26)"); glow.addColorStop(1, "rgba(66,214,218,0)");
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, glowRadius, 0, Math.PI * 2); ctx.fill();
      }
      const dotY = labelVisible ? -(selected ? 25 : node.fontSize * .88) * p.scale : 0;
      const depthVisibility = Math.max(.48, Math.min(1, p.scale));
      ctx.globalAlpha = (selected || hovered ? 1 : node.depth === 1 ? .82 : .38) * depthVisibility;
      ctx.fillStyle = node.accent;
      ctx.shadowColor = node.accent; ctx.shadowBlur = selected ? 15 : hovered ? 10 : 5;
      ctx.beginPath(); ctx.arc(0, dotY, (selected ? 3.5 : node.depth === 1 ? 2.8 : 2.1) * p.scale, 0, Math.PI * 2); ctx.fill();
      const kind = catalogKind(node);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = selected || hovered ? .9 : .55;
      ctx.strokeStyle = kind === "overlap" ? colors.prefix : kind === "gre" ? colors.etymology : colors.synonym;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, dotY, (selected ? 6.2 : node.depth === 1 ? 5.1 : 4.1) * p.scale, 0, Math.PI * 2); ctx.stroke();
      if (labelVisible) {
        ctx.globalAlpha = (selected || hovered ? 1 : .9) * Math.max(.72, depthVisibility);
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.font = `500 ${node.fontSize * p.scale}px ${selected ? '"Fraunces", Georgia, serif' : '"Manrope", sans-serif'}`;
        ctx.fillStyle = selected ? colors.synonym : hovered ? textColor : node.depth === 1 ? textColor : mutedColor;
        ctx.shadowColor = selected ? colors.synonym : "rgba(7,16,29,.9)"; ctx.shadowBlur = selected ? 15 : 5;
        ctx.fillText(node.id, 0, 0);
        if (selected) {
          ctx.shadowBlur = 0; ctx.font = `500 ${9 * p.scale}px "Manrope", sans-serif`; ctx.fillStyle = mutedColor;
          ctx.fillText("SELECTED", 0, 24 * p.scale);
        }
      }
      ctx.restore();
    });
    animationFrame = requestAnimationFrame(draw);
  }

  function updateStatus() {
    const total = universeWords().length;
    const satTotal = words.filter(word => word.exams.includes("SAT")).length;
    const greTotal = words.filter(word => word.exams.includes("GRE")).length;
    const directWords = nodes.filter(node => node.depth === 1).length;
    const contextDots = nodes.filter(node => node.depth > 1 && !node.showLabel).length;
    status.textContent = `第一圈 ${directWords} 词（全部显示） · 第二圈 ${contextDots} 个关系星点 · 当前 ${total} · SAT ${satTotal} · GRE ${greTotal}`;
  }

  function relatedFor(id) {
    return visibleRelations().filter(r => r.source === id || r.target === id).sort((a,b) => b.strength-a.strength);
  }

  function fitDetailWord() {
    const label = detail.querySelector(".detail-word");
    if (!label) return;
    const maxSize = 58;
    const minSize = 28;
    label.style.setProperty("--detail-word-size", `${maxSize}px`);
    const available = label.clientWidth;
    const required = label.scrollWidth;
    if (available > 0 && required > available) {
      label.style.setProperty("--detail-word-size", `${Math.max(minSize, Math.floor(maxSize * available / required))}px`);
    }
  }

  function renderDetail() {
    const word = wordMap.get(selectedId);
    if (!word) { detail.innerHTML = ""; return; }
    const kind = catalogKind(word);
    const catalogText = kind === "overlap"
      ? `SAT + GRE · ${word.group} · ${word.greTier || "GRE Core"}`
      : kind === "gre" ? `GRE · ${word.greTier || word.group}` : `SAT · ${word.group}`;
    const tags = relatedFor(word.id).slice(0, 4).map(r => `<span>${typeNames[r.type]} · ${r.source === word.id ? r.target : r.source}</span>`).join("");
    detail.innerHTML = `
      <div class="detail-intro">
        <span class="word-type">${word.pos}</span><span class="word-catalog ${kind}">${catalogText}</span>
        <div class="detail-word">${word.id}</div>
        <p class="phonetic">${word.phonetic}</p>
        <div class="familiarity"><span>我的熟悉度</span><div class="familiarity-options" role="group" aria-label="熟悉度 1 到 5">
          ${[1,2,3,4,5].map(n => `<button type="button" data-level="${n}" class="${n === word.level ? "active" : ""}" aria-label="熟悉度 ${n}">${n}</button>`).join("")}
        </div></div>
      </div>
      <div class="detail-meaning">
        <span class="detail-label">Meaning & usage</span>
        <p class="english-definition">${word.definition}</p>
        <p class="chinese-meaning">${word.zh}</p>
        <span class="detail-label">Example</span><p class="example">“${word.example}”</p>
        <span class="detail-label">Collocations</span><div class="collocations">${word.collocations.map(c => `<span>${c}</span>`).join("")}${tags}</div>
      </div>
      <div class="detail-memory">
        <span class="detail-label">Etymology</span><p class="etymology-text">${word.etymology}</p>
        <div class="memory-box"><span class="detail-label">记忆方法</span><p>${word.memory}</p></div>
      </div>`;
    fitDetailWord();
    requestAnimationFrame(fitDetailWord);
    document.fonts?.ready.then(fitDetailWord);
    detail.querySelectorAll("[data-level]").forEach(btn => btn.addEventListener("click", () => {
      word.level = Number(btn.dataset.level);
      localStorage.setItem("lexiverse-levels", JSON.stringify(Object.fromEntries(words.map(w => [w.id, w.level]))));
      window.dispatchEvent(new CustomEvent("lexiverse-level-change", { detail: { id: word.id, level: word.level, source: "app" } }));
      renderDetail(); buildLayout();
    }));
  }

  function selectWord(id, animate = true) {
    if (!wordMap.has(id)) return;
    if (scopedIds && !scopedIds.has(id)) scopedIds = null;
    if (!matchesCatalog(wordMap.get(id))) { catalog = "all"; updateCatalogButtons(); }
    selectedId = id; buildLayout(id); renderDetail();
    if (animate) nudgeOrbit(id);
    targetCamera = { x: 0, y: 0, scale: animate ? 1.06 : 1 };
    document.getElementById("word-search").value = "";
    document.getElementById("search-results").hidden = true;
  }

  function nodeAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect(); const x = clientX - rect.left, y = clientY - rect.top;
    return nodes.slice().sort((a,b) => a.depth-b.depth).find(n => {
      const p = screenPosition(n); const radius = n.showLabel ? Math.max(18, n.id.length * n.fontSize * p.scale * .29) : 11 * p.scale;
      return Math.hypot(x-p.x, y-p.y) < radius;
    });
  }

  canvas.addEventListener("pointerdown", e => { dragging = true; moved = false; lastPointer = {x:e.clientX,y:e.clientY}; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", e => {
    hoveredId = nodeAt(e.clientX, e.clientY)?.id || null; canvas.style.cursor = hoveredId ? "pointer" : (dragging ? "grabbing" : "grab");
    if (!dragging) return; const dx=e.clientX-lastPointer.x, dy=e.clientY-lastPointer.y; if(Math.abs(dx)+Math.abs(dy)>2)moved=true;
    targetCamera.x += dx/targetCamera.scale; targetCamera.y += dy/targetCamera.scale; camera.x = targetCamera.x; camera.y = targetCamera.y;
    orbit.targetYaw += dx * .0011; orbit.targetPitch = Math.max(-.24, Math.min(.12, orbit.targetPitch - dy * .0007));
    lastPointer={x:e.clientX,y:e.clientY};
  });
  canvas.addEventListener("pointerup", e => { if (!moved) { const hit=nodeAt(e.clientX,e.clientY); if(hit)selectWord(hit.id); } dragging=false; });
  canvas.addEventListener("pointerleave", () => { hoveredId=null; dragging=false; });
  canvas.addEventListener("wheel", e => { e.preventDefault(); targetCamera.scale = Math.max(.55, Math.min(1.7, targetCamera.scale * (e.deltaY > 0 ? .91 : 1.1))); }, {passive:false});

  document.querySelectorAll(".relation-chip input").forEach(input => input.addEventListener("change", () => {
    enabledTypes = new Set([...document.querySelectorAll(".relation-chip input:checked")].map(el => el.value)); buildLayout(); renderDetail(); nudgeOrbit(selectedId,.28);
  }));
  document.querySelectorAll("[data-density]").forEach(button => button.addEventListener("click", () => {
    density = button.dataset.density;
    document.querySelectorAll("[data-density]").forEach(option => option.setAttribute("aria-pressed", String(option === button)));
    buildLayout(); renderDetail(); targetCamera = {x:0,y:0,scale:1}; nudgeOrbit(selectedId,.32);
  }));
  document.querySelectorAll("[data-catalog]").forEach(button => button.addEventListener("click", () => {
    catalog = button.dataset.catalog;
    updateCatalogButtons();
    buildLayout(); renderDetail(); targetCamera = {x:0,y:0,scale:1}; nudgeOrbit(selectedId,.32);
  }));
  document.getElementById("center-view").addEventListener("click", () => {
    targetCamera={x:0,y:0,scale:1};
    orbit.targetYaw=0; orbit.targetPitch=-.08;
  });
  document.getElementById("zoom-in").addEventListener("click", () => targetCamera.scale=Math.min(1.7,targetCamera.scale*1.18));
  document.getElementById("zoom-out").addEventListener("click", () => targetCamera.scale=Math.max(.55,targetCamera.scale/1.18));
  document.getElementById("random-word").addEventListener("click", () => { const pool=universeWords(); selectWord(pool[Math.floor(Math.random()*pool.length)].id); });

  const search = document.getElementById("word-search"), results = document.getElementById("search-results");
  function showSearch() {
    const q = search.value.trim().toLowerCase();
    if (!q) { results.hidden=true; return; }
    const found = words
      .filter(w => w.id.includes(q) || w.zh.includes(q) || w.definition.toLowerCase().includes(q))
      .sort((a, b) => a.id.localeCompare(b.id, "en", { sensitivity: "base" }))
      .slice(0, 8);
    results.innerHTML = found.length ? found.map(w => {
      const kind = catalogKind(w);
      const label = kind === "overlap" ? "SAT + GRE" : kind.toUpperCase();
      return `<button type="button" class="search-result" role="option" data-word="${w.id}"><span>${w.id}</span><small>${label} · ${w.zh}</small></button>`;
    }).join("") : `<div class="search-result"><small>没有找到匹配单词</small></div>`;
    results.hidden=false; results.querySelectorAll("[data-word]").forEach(btn => btn.addEventListener("click", () => selectWord(btn.dataset.word)));
  }
  search.addEventListener("input", showSearch);
  search.addEventListener("keydown", e => { if(e.key === "Enter") { const first=results.querySelector("[data-word]"); if(first)selectWord(first.dataset.word); } if(e.key === "Escape")results.hidden=true; });
  document.addEventListener("keydown", e => { if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k") { e.preventDefault(); search.focus(); } });
  document.addEventListener("click", e => { if(!e.target.closest(".search-box"))results.hidden=true; });

  const groupFilter = document.getElementById("group-filter");
  const groups = [...new Set(words.map(word => word.group).filter(group => /^Group \d+$/.test(group)))].sort((a, b) => Number(a.split(" ")[1]) - Number(b.split(" ")[1]));
  groupFilter.insertAdjacentHTML("beforeend", `<optgroup label="SAT Excel 分组">${groups.map(group => `<option value="${group}">${group}</option>`).join("")}</optgroup><optgroup label="GRE 分类"><option value="__GRE_CORE__">GRE Core（高频阅读）</option><option value="__GRE_ADVANCED__">GRE Advanced（高难拓展）</option><option value="__OVERLAP__">SAT + GRE 重合高频词</option></optgroup>`);
  groupFilter.addEventListener("change", () => {
    if (!groupFilter.value) return;
    const selectedGroup = groupFilter.value;
    const groupWords = selectedGroup === "__GRE_CORE__"
      ? words.filter(word => word.exams.includes("GRE") && (word.greTier || "GRE Core") === "GRE Core")
      : selectedGroup === "__GRE_ADVANCED__"
        ? words.filter(word => word.exams.includes("GRE") && word.greTier === "GRE Advanced")
        : selectedGroup === "__OVERLAP__"
          ? words.filter(word => word.exams.includes("SAT") && word.exams.includes("GRE"))
          : words.filter(word => word.group === selectedGroup);
    const groupLabel = selectedGroup === "__GRE_CORE__" ? "GRE Core" : selectedGroup === "__GRE_ADVANCED__" ? "GRE Advanced" : selectedGroup === "__OVERLAP__" ? "SAT + GRE 重合词" : selectedGroup;
    scopedIds = new Set(groupWords.map(word => word.id));
    catalog = "all"; updateCatalogButtons();
    selectedId = groupWords[0]?.id || selectedId;
    document.getElementById("scope-input").value = groupWords.map(word => word.id).join(", ");
    document.getElementById("scope-feedback").textContent = `${groupLabel}：已显示 ${groupWords.length} 个单词。`;
    buildLayout(); renderDetail(); targetCamera = {x:0,y:0,scale:1};
  });

  document.getElementById("apply-scope").addEventListener("click", () => {
    groupFilter.value="";
    const raw=document.getElementById("scope-input").value.toLowerCase().split(/[\n,，;；]+/).map(value => value.trim()).filter(Boolean);
    const valid=raw.filter(id => wordMap.has(id)); const missing=raw.filter(id => !wordMap.has(id));
    if(!valid.length) { document.getElementById("scope-feedback").textContent="请至少输入一个词库中存在的单词。"; return; }
    scopedIds=new Set(valid); if(!scopedIds.has(selectedId))selectedId=valid[0]; buildLayout(); renderDetail(); targetCamera={x:0,y:0,scale:1};
    document.getElementById("scope-feedback").textContent=`已显示 ${valid.length} 个单词${missing.length ? `；未收录：${missing.join("、")}` : ""}`;
  });
  document.getElementById("clear-scope").addEventListener("click", () => { scopedIds=null; groupFilter.value=""; document.getElementById("scope-input").value=""; document.getElementById("scope-feedback").textContent="已恢复完整词库。"; buildLayout(); });

  const savedTheme=localStorage.getItem("lexiverse-theme"); if(savedTheme)document.documentElement.dataset.theme=savedTheme;
  document.getElementById("theme-toggle").addEventListener("click", () => { const next=document.documentElement.dataset.theme==="light"?"dark":"light"; document.documentElement.dataset.theme=next; localStorage.setItem("lexiverse-theme",next); });
  try { const levels=JSON.parse(localStorage.getItem("lexiverse-levels")); if(levels)words.forEach(w => {if(levels[w.id])w.level=levels[w.id]}); } catch {}
  window.addEventListener("lexiverse-level-change", event => {
    if (event.detail?.source !== "prep") return;
    const word = wordMap.get(event.detail.id);
    if (!word) return;
    word.level = Number(event.detail.level);
    if (selectedId === word.id) renderDetail();
  });
  new ResizeObserver(() => { resize(); buildLayout(); }).observe(stage);
  new ResizeObserver(fitDetailWord).observe(detail);
  resize(); buildLayout(); renderDetail(); cancelAnimationFrame(animationFrame); draw();
})();
