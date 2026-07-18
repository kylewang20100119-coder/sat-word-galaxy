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
  const GALAXY_WORD_FONT_SIZE = 14;
  const stage = document.getElementById("galaxy-stage");
  const canvas = document.getElementById("galaxy-canvas");
  const ctx = canvas.getContext("2d");
  const detail = document.getElementById("word-detail");
  const status = document.getElementById("network-status");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // A restrained pixel ratio keeps canvas text crisp without making every frame
  // unnecessarily expensive on Retina displays.
  let dpr = Math.min(devicePixelRatio || 1, 1.35);
  let width = 0, height = 0, animationFrame;
  let selectedId = "benevolent";
  let hoveredId = null;
  let enabledTypes = new Set(Object.keys(colors));
  let scopedIds = null;
  let nodes = [];
  let graphWords = [];
  let graphLinks = [];
  let fadingLinks = [];
  let density = "compact";
  let catalog = "all";
  const densitySettings = {
    compact: { maxNodes: 22, directLimit: 10, contextEdges: false },
    standard: { maxNodes: 34, directLimit: 15, contextEdges: true },
    rich: { maxNodes: 48, directLimit: 20, contextEdges: true }
  };
  let camera = { x: 0, y: 0, scale: 1 };
  let targetCamera = { x: 0, y: 0, scale: 1 };
  let orbit = { yaw: 0, pitch: -.08, targetYaw: 0, targetPitch: -.08, yawVelocity: 0, pitchVelocity: 0 };
  let graphMorph = { startedAt: 0, duration: 0, direction: 1, yaw: 0, pitch: 0, roll: 0 };
  let focusPulse = 0;
  let detailRenderToken = 0;
  let dragging = false, moved = false, lastPointer = null;

  function requestDraw() {
    if (!animationFrame) animationFrame = requestAnimationFrame(draw);
  }

  function hash(value) {
    let h = 2166136261;
    for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
    return (h >>> 0) / 4294967295;
  }

  function clamp01(value) { return Math.max(0, Math.min(1, value)); }
  function smootherStep(value) {
    const t = clamp01(value);
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  function vectorLength(vector) { return Math.hypot(vector.x, vector.y, vector.z); }
  function normalizeVector(vector, fallback = { x: 1, y: 0, z: 0 }) {
    const length = vectorLength(vector);
    return length > .0001
      ? { x: vector.x / length, y: vector.y / length, z: vector.z / length }
      : { ...fallback };
  }
  function crossVector(a, b) {
    return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
  }
  function slerpDirection(from, to, progress) {
    const a = normalizeVector(from);
    const b = normalizeVector(to, a);
    const rawDot = a.x * b.x + a.y * b.y + a.z * b.z;
    if (rawDot < -.995) {
      // Antipodal points have no unique shortest arc. Pick a stable orthogonal
      // axis so a node never collapses through the centre halfway through.
      const reference = Math.abs(a.y) < .82 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
      const axis = normalizeVector(crossVector(a, reference), { x: 0, y: 0, z: 1 });
      const angle = Math.PI * progress;
      const cosine = Math.cos(angle), sine = Math.sin(angle);
      const axisDot = axis.x * a.x + axis.y * a.y + axis.z * a.z;
      return {
        x: a.x * cosine + (axis.y * a.z - axis.z * a.y) * sine + axis.x * axisDot * (1 - cosine),
        y: a.y * cosine + (axis.z * a.x - axis.x * a.z) * sine + axis.y * axisDot * (1 - cosine),
        z: a.z * cosine + (axis.x * a.y - axis.y * a.x) * sine + axis.z * axisDot * (1 - cosine)
      };
    }
    const dot = Math.max(-.9995, Math.min(.9995, rawDot));
    const angle = Math.acos(dot);
    const sine = Math.sin(angle);
    if (Math.abs(sine) < .001) return normalizeVector({
      x: a.x + (b.x - a.x) * progress,
      y: a.y + (b.y - a.y) * progress,
      z: a.z + (b.z - a.z) * progress
    }, a);
    const startWeight = Math.sin((1 - progress) * angle) / sine;
    const endWeight = Math.sin(progress * angle) / sine;
    return {
      x: a.x * startWeight + b.x * endWeight,
      y: a.y * startWeight + b.y * endWeight,
      z: a.z * startWeight + b.z * endWeight
    };
  }
  function rotatePoint(point, yaw, pitch, roll) {
    const cosYaw = Math.cos(yaw), sinYaw = Math.sin(yaw);
    const yawX = point.x * cosYaw - point.z * sinYaw;
    const yawZ = point.x * sinYaw + point.z * cosYaw;
    const cosPitch = Math.cos(pitch), sinPitch = Math.sin(pitch);
    const pitchY = point.y * cosPitch - yawZ * sinPitch;
    const pitchZ = point.y * sinPitch + yawZ * cosPitch;
    const cosRoll = Math.cos(roll), sinRoll = Math.sin(roll);
    return {
      x: yawX * cosRoll - pitchY * sinRoll,
      y: yawX * sinRoll + pitchY * cosRoll,
      z: pitchZ
    };
  }
  function cubicPoint(start, controlA, controlB, end, progress) {
    const inverse = 1 - progress;
    const a = inverse * inverse * inverse;
    const b = 3 * inverse * inverse * progress;
    const c = 3 * inverse * progress * progress;
    const d = progress * progress * progress;
    return {
      x: start.x * a + controlA.x * b + controlB.x * c + end.x * d,
      y: start.y * a + controlA.y * b + controlB.y * c + end.y * d,
      z: start.z * a + controlA.z * b + controlB.z * c + end.z * d
    };
  }

  function morphPoint(node, progress) {
    const eased = smootherStep(progress);
    const envelope = Math.sin(Math.PI * progress);
    const start = { x: node.motionStartX, y: node.motionStartY, z: node.motionStartZ };
    const target = { x: node.tx, y: node.ty, z: node.tz };
    const startRadius = vectorLength(start);
    const targetRadius = vectorLength(target);
    let point;
    if (startRadius > 12 && targetRadius > 12) {
      // Directions travel over the surface of an imaginary sphere instead of
      // cutting through it on a straight line. The radius contracts/expands
      // separately, which makes the network feel like one turning solid.
      const direction = slerpDirection(start, target, eased);
      const radius = (startRadius + (targetRadius - startRadius) * eased) * (1 + envelope * .055);
      point = { x: direction.x * radius, y: direction.y * radius, z: direction.z * radius };
    } else {
      // A focus node cannot be slerped to radius zero. Give it a curved cubic
      // flight path so it visibly arcs into (or out of) the exact centre.
      const outer = startRadius > targetRadius ? normalizeVector(start) : normalizeVector(target);
      let tangent = normalizeVector(crossVector({ x: .18, y: 1, z: .36 }, outer), { x: 0, y: 0, z: 1 });
      const curveDirection = graphMorph.direction * (node.exiting ? -1 : 1);
      tangent = { x: tangent.x * curveDirection, y: tangent.y * curveDirection, z: tangent.z * curveDirection };
      const curve = Math.min(116, 58 + Math.hypot(target.x - start.x, target.y - start.y, target.z - start.z) * .26);
      const controlA = { x: start.x + tangent.x * curve, y: start.y + tangent.y * curve, z: start.z + tangent.z * curve + 34 };
      const controlB = { x: target.x + tangent.x * curve * .48, y: target.y + tangent.y * curve * .48, z: target.z + tangent.z * curve * .48 + 18 };
      point = cubicPoint(start, controlA, controlB, target, eased);
    }
    // One shared rotation axis is applied to every node. This is the rigid-body
    // cue that turns the rearrangement into a sphere/polyhedron rotation.
    return rotatePoint(
      point,
      graphMorph.yaw * envelope,
      graphMorph.pitch * envelope,
      graphMorph.roll * envelope
    );
  }

  const polyhedron = (() => {
    const phi = (1 + Math.sqrt(5)) / 2;
    const raw = [
      [0, -1, -phi], [0, -1, phi], [0, 1, -phi], [0, 1, phi],
      [-1, -phi, 0], [-1, phi, 0], [1, -phi, 0], [1, phi, 0],
      [-phi, 0, -1], [phi, 0, -1], [-phi, 0, 1], [phi, 0, 1]
    ];
    const vertices = raw.map(([x, y, z]) => normalizeVector({ x, y, z }));
    const edges = [];
    for (let i = 0; i < vertices.length; i++) {
      for (let j = i + 1; j < vertices.length; j++) {
        const distance = Math.hypot(vertices[i].x - vertices[j].x, vertices[i].y - vertices[j].y, vertices[i].z - vertices[j].z);
        if (distance < 1.08) edges.push([i, j]);
      }
    }
    return { vertices, edges };
  })();

  function nudgeOrbit(id, amount = 1) {
    const canonicalYaw = (hash(id + "orbit-direction") - .5) * .3;
    const canonicalPitch = -.08 + (hash(id + "orbit-pitch") - .5) * .12;
    const blend = amount >= .75 ? 1 : amount;
    orbit.targetYaw += (canonicalYaw - orbit.targetYaw) * blend;
    orbit.targetPitch += (canonicalPitch - orbit.targetPitch) * blend;
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
    const transitionStartedAt = performance.now();
    const spinDirection = hash(focusId + "polyhedron-spin") > .5 ? 1 : -1;
    const previousLinks = graphLinks;
    const previousFocusId = nodes.find(node => !node.exiting && node.depth === 0)?.id;
    const hasPreviousFocus = Boolean(previousFocusId && previousFocusId !== focusId);
    graphMorph = {
      startedAt: transitionStartedAt,
      duration: reducedMotion || !hasPreviousFocus ? 0 : 1120,
      direction: spinDirection,
      yaw: spinDirection * (.52 + hash(focusId + "shared-yaw") * .16),
      pitch: (hash(focusId + "shared-pitch") - .5) * .34,
      roll: spinDirection * (.08 + hash(focusId + "shared-roll") * .07)
    };
    const linkKey = link => `${link.source}|${link.target}|${link.type}`;
    const previousLinkKeys = new Set(previousLinks.map(linkKey));
    const nextLinkKeys = new Set(sliced.links.map(linkKey));
    graphWords = visible;
    graphLinks = sliced.links.map(link => {
      const retained = previousLinkKeys.has(linkKey(link));
      const startOpacity = reducedMotion ? 1 : retained ? 1 : 0;
      return {
        ...link,
        opacity: startOpacity,
        motionStartOpacity: startOpacity,
        motionTargetOpacity: 1,
        motionStartedAt: transitionStartedAt,
        motionDuration: reducedMotion || retained ? 0 : 820,
        exiting: false
      };
    });
    // Keep only the old centre spokes for a brief hand-off. This avoids a hard
    // flash without drawing an entire second network.
    fadingLinks = reducedMotion ? [] : previousLinks
      .filter(link => !nextLinkKeys.has(linkKey(link)) && (link.source === previousFocusId || link.target === previousFocusId))
      .slice(0, 12)
      .map(link => ({
        ...link,
        opacity: link.opacity ?? 1,
        motionStartOpacity: link.opacity ?? 1,
        motionTargetOpacity: 0,
        motionStartedAt: transitionStartedAt,
        motionDuration: 650,
        exiting: true
      }));
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
    const previousNodes = nodes.filter(node => !node.exiting);
    const old = new Map(previousNodes.map(n => [n.id, n]));
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
        const fontSize = GALAXY_WORD_FONT_SIZE;
        const isFocus = word.id === focusId;
        const entryAngle = hash(word.id + "focus-entry-angle") * Math.PI * 2;
        const freshFocusX = Math.cos(entryAngle) * 86;
        const freshFocusY = Math.sin(entryAngle) * 52;
        const startX = isFocus ? (prev?.x ?? (hasPreviousLayout ? freshFocusX : 0)) : (prev?.x ?? tx * .82);
        const startY = isFocus ? (prev?.y ?? (hasPreviousLayout ? freshFocusY : 0)) : (prev?.y ?? ty * .82);
        const startZ = isFocus ? (prev?.z ?? (hasPreviousLayout ? 90 : 0)) : (prev?.z ?? tz + 34);
        const motionDuration = reducedMotion || !hasPreviousLayout ? 0 : graphMorph.duration;
        const startOpacity = prev?.opacity ?? (hasPreviousLayout ? 0 : 1);
        nextNodes.push({
          ...word, tx, ty,
          x: startX,
          y: startY,
          z: startZ,
          vx: 0,
          vy: 0,
          vz: 0,
          motionStartX: startX,
          motionStartY: startY,
          motionStartZ: startZ,
          motionStartedAt: transitionStartedAt,
          motionDuration,
          tz,
          anchorX: tx, anchorY: ty,
          rotation: showLabel && depth > 0 ? (hash(word.id + "r") - .5) * .032 : 0,
          fontSize,
          showLabel,
          accent: relation ? colors[relation.type] : colors.synonym,
          depth,
          opacity: startOpacity,
          motionStartOpacity: startOpacity,
          motionTargetOpacity: 1,
          exiting: false
        });
      });
    });
    relaxLabels(nextNodes);
    const nextIds = new Set(nextNodes.map(node => node.id));
    const outgoingNodes = reducedMotion ? [] : previousNodes
      .filter(node => !nextIds.has(node.id))
      .sort((a, b) => Number(b.showLabel) - Number(a.showLabel) || a.depth - b.depth)
      .slice(0, 8)
      .map(node => ({
        ...node,
        tx: node.x * 1.08,
        ty: node.y * 1.08,
        tz: node.z + 62,
        motionStartX: node.x,
        motionStartY: node.y,
        motionStartZ: node.z,
        motionStartedAt: transitionStartedAt,
        motionDuration: graphMorph.duration || 760,
        motionStartOpacity: node.opacity ?? 1,
        motionTargetOpacity: 0,
        exiting: true
      }));
    nodes = [...outgoingNodes, ...nextNodes];
    updateStatus();
    requestDraw();
  }

  function relaxLabels(layoutNodes) {
    const labeled = layoutNodes.filter(node => node.showLabel);
    const frameWidth = Math.max(320, width || stage.clientWidth || 1000);
    const frameHeight = Math.max(440, height || stage.clientHeight || 560);
    for (let round = 0; round < 36; round++) {
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

  function drawMorphScaffold(now) {
    if (!graphMorph.duration) return;
    const progress = clamp01((now - graphMorph.startedAt) / graphMorph.duration);
    if (progress <= 0 || progress >= 1) return;
    const visibility = Math.pow(Math.sin(Math.PI * progress), 1.35);
    const radius = Math.min(214, Math.max(142, Math.min(width, height) * .34));
    const sharedSpin = graphMorph.direction * (-.5 + progress) * 1.08;
    const points = polyhedron.vertices.map(vertex => {
      const turned = rotatePoint(
        { x: vertex.x * radius, y: vertex.y * radius, z: vertex.z * radius },
        sharedSpin + graphMorph.yaw * Math.sin(Math.PI * progress),
        graphMorph.pitch * .65 * Math.sin(Math.PI * progress),
        graphMorph.roll * Math.sin(Math.PI * progress)
      );
      return screenPosition(turned);
    });
    ctx.save();
    ctx.lineWidth = .62;
    polyhedron.edges.forEach(([from, to], index) => {
      const a = points[from], b = points[to];
      const near = Math.max(.42, Math.min(1, 1 - (a.z + b.z) / 900));
      ctx.globalAlpha = visibility * near * (index % 3 === 0 ? .105 : .065);
      ctx.strokeStyle = index % 3 === 0 ? colors.etymology : colors.synonym;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    });
    ctx.restore();
  }

  function draw() {
    animationFrame = null;
    ctx.clearRect(0, 0, width, height);
    const now = performance.now();
    camera.x += (targetCamera.x - camera.x) * (reducedMotion ? 1 : .14);
    camera.y += (targetCamera.y - camera.y) * (reducedMotion ? 1 : .14);
    camera.scale += (targetCamera.scale - camera.scale) * (reducedMotion ? 1 : .12);
    if (Math.abs(targetCamera.x - camera.x) < .08) camera.x = targetCamera.x;
    if (Math.abs(targetCamera.y - camera.y) < .08) camera.y = targetCamera.y;
    if (Math.abs(targetCamera.scale - camera.scale) < .0005) camera.scale = targetCamera.scale;
    focusPulse = 0;
    if (reducedMotion) {
      orbit.yaw = orbit.targetYaw; orbit.pitch = orbit.targetPitch;
    } else {
      orbit.yaw += (orbit.targetYaw - orbit.yaw) * .085;
      orbit.pitch += (orbit.targetPitch - orbit.pitch) * .095;
      if (Math.abs(orbit.targetYaw - orbit.yaw) < .0005) orbit.yaw = orbit.targetYaw;
      if (Math.abs(orbit.targetPitch - orbit.pitch) < .0005) orbit.pitch = orbit.targetPitch;
      orbit.yawVelocity = 0;
      orbit.pitchVelocity = 0;
    }
    nodes.forEach(n => {
      if (reducedMotion) {
        n.x = n.tx; n.y = n.ty; n.z = n.tz; n.opacity = n.motionTargetOpacity ?? 1;
        n.motionProgress = 1;
        n.vx = 0; n.vy = 0; n.vz = 0;
        return;
      }
      if (!n.motionDuration) {
        n.x = n.tx; n.y = n.ty; n.z = n.tz; n.motionProgress = 1;
      } else {
        const progress = Math.max(0, Math.min(1, (now - n.motionStartedAt) / n.motionDuration));
        n.motionProgress = progress;
        const eased = smootherStep(progress);
        const point = morphPoint(n, progress);
        n.x = point.x; n.y = point.y; n.z = point.z;
        n.opacity = n.motionStartOpacity + ((n.motionTargetOpacity ?? 1) - n.motionStartOpacity) * eased;
        if (progress === 1) {
          n.x = n.tx; n.y = n.ty; n.z = n.tz;
          n.opacity = n.motionTargetOpacity ?? 1;
          n.motionDuration = 0;
        }
      }
    });
    nodes = nodes.filter(node => !node.exiting || node.opacity > .01);
    const graphMorphing = nodes.some(node => node.motionDuration);

    const updateLinkOpacity = link => {
      if (!link.motionDuration) return;
      const progress = Math.max(0, Math.min(1, (now - link.motionStartedAt) / link.motionDuration));
      const eased = progress * progress * (3 - 2 * progress);
      link.opacity = link.motionStartOpacity + (link.motionTargetOpacity - link.motionStartOpacity) * eased;
      if (progress === 1) {
        link.opacity = link.motionTargetOpacity;
        link.motionDuration = 0;
      }
    };
    graphLinks.forEach(updateLinkOpacity);
    fadingLinks.forEach(updateLinkOpacity);
    fadingLinks = fadingLinks.filter(link => link.opacity > .01);

    drawMorphScaffold(now);

    const nodeById = new Map(nodes.map(n => [n.id, n]));
    const drawSettings = activeDensitySettings();
    [...fadingLinks, ...visibleRelations()].forEach(rel => {
      const a = nodeById.get(rel.source), b = nodeById.get(rel.target);
      if (!a || !b) return;
      const p1 = screenPosition(a), p2 = screenPosition(b);
      const active = rel.source === selectedId || rel.target === selectedId;
      const hovered = rel.source === hoveredId || rel.target === hoveredId;
      const context = rel.exiting
        || (graphMorphing && a.depth <= 1 && b.depth <= 1)
        || (drawSettings.contextEdges && a.depth <= 1 && b.depth <= 1);
      if (!active && !hovered && !context) return;
      ctx.save();
      const depthAlpha = Math.max(.62, Math.min(1, (p1.scale + p2.scale) / 2));
      const linkOpacity = Math.min(a.opacity ?? 1, b.opacity ?? 1);
      ctx.globalAlpha = (rel.exiting ? .3 : active ? .58 : hovered ? .38 : graphMorphing ? .13 : .055) * depthAlpha * linkOpacity * (rel.opacity ?? 1);
      ctx.strokeStyle = colors[rel.type];
      ctx.lineWidth = (active ? .9 + rel.strength : .55) * Math.min(1.12, (p1.scale + p2.scale) / 2);
      if (rel.type === "antonym") ctx.setLineDash([5, 5]);
      if (rel.type === "etymology") ctx.setLineDash([2, 4]);
      ctx.beginPath();
      const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
      const curve = (hash(rel.source + rel.target + rel.type) - .5) * 70;
      ctx.moveTo(p1.x, p1.y);
      if (graphMorphing) ctx.lineTo(p2.x, p2.y);
      else ctx.quadraticCurveTo(mx - (p2.y - p1.y) * curve / 300, my + (p2.x - p1.x) * curve / 300, p2.x, p2.y);
      ctx.stroke(); ctx.restore();
    });

    const textColor = getComputedStyle(document.documentElement).getPropertyValue("--text").trim();
    const mutedColor = getComputedStyle(document.documentElement).getPropertyValue("--muted").trim();
    nodes.map(node => ({node, p: screenPosition(node)})).sort((a,b) => b.p.z-a.p.z).forEach(({node,p}) => {
      const selected = node.id === selectedId, hovered = node.id === hoveredId;
      const labelVisible = selected || hovered || node.showLabel;
      const labelScale = camera.scale;
      const motionOpacity = node.opacity ?? 1;
      const projectedTilt = selected ? 0 : node.rotation + Math.max(-.018, Math.min(.018, p.z / 7000));
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(projectedTilt);
      if (selected) {
        ctx.globalAlpha = motionOpacity;
        const glowRadius = (58 + focusPulse * 24) * p.scale;
        const glow = ctx.createRadialGradient(0, 0, 3, 0, 0, glowRadius);
        glow.addColorStop(0, `rgba(66,214,218,${.26 + focusPulse * .16})`); glow.addColorStop(1, "rgba(66,214,218,0)");
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, glowRadius, 0, Math.PI * 2); ctx.fill();
      }
      const dotY = labelVisible ? -(selected ? 25 : node.fontSize * .88) * p.scale : 0;
      const depthVisibility = Math.max(.48, Math.min(1, p.scale));
      ctx.globalAlpha = (selected || hovered ? 1 : node.depth === 1 ? .82 : .38) * depthVisibility * motionOpacity;
      ctx.fillStyle = node.accent;
      ctx.shadowColor = node.accent; ctx.shadowBlur = selected ? 15 : hovered ? 10 : 5;
      ctx.beginPath(); ctx.arc(0, dotY, (selected ? 3.5 : node.depth === 1 ? 2.8 : 2.1) * p.scale, 0, Math.PI * 2); ctx.fill();
      const kind = catalogKind(node);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = (selected || hovered ? .9 : .55) * motionOpacity;
      ctx.strokeStyle = kind === "overlap" ? colors.prefix : kind === "gre" ? colors.etymology : colors.synonym;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, dotY, (selected ? 6.2 : node.depth === 1 ? 5.1 : 4.1) * p.scale, 0, Math.PI * 2); ctx.stroke();
      if (labelVisible) {
        ctx.globalAlpha = (selected || hovered ? 1 : .9) * Math.max(.72, depthVisibility) * motionOpacity;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.font = `500 ${node.fontSize * labelScale}px ${selected ? '"Fraunces", Georgia, serif' : '"Manrope", sans-serif'}`;
        ctx.fillStyle = selected ? colors.synonym : hovered ? textColor : node.depth === 1 ? textColor : mutedColor;
        ctx.shadowColor = selected ? colors.synonym : "rgba(7,16,29,.9)"; ctx.shadowBlur = selected ? 15 : 5;
        ctx.fillText(node.id, 0, 0);
        if (selected) {
          ctx.shadowBlur = 0; ctx.font = `500 ${9 * labelScale}px "Manrope", sans-serif`; ctx.fillStyle = mutedColor;
          ctx.fillText("SELECTED", 0, 24 * labelScale);
        }
      }
      ctx.restore();
    });
    const cameraMoving = Math.abs(targetCamera.x - camera.x) >= .08
      || Math.abs(targetCamera.y - camera.y) >= .08
      || Math.abs(targetCamera.scale - camera.scale) >= .0005;
    const orbitMoving = Math.abs(orbit.targetYaw - orbit.yaw) >= .0005
      || Math.abs(orbit.targetPitch - orbit.pitch) >= .0005;
    const nodesMoving = nodes.some(node => node.motionDuration);
    const linksMoving = graphLinks.some(link => link.motionDuration) || fadingLinks.some(link => link.motionDuration);
    if (dragging || cameraMoving || orbitMoving || nodesMoving || linksMoving) requestDraw();
  }

  function updateStatus() {
    const total = universeWords().length;
    const satTotal = words.filter(word => word.exams.includes("SAT")).length;
    const greTotal = words.filter(word => word.exams.includes("GRE")).length;
    const directWords = nodes.filter(node => !node.exiting && node.depth === 1).length;
    const contextDots = nodes.filter(node => !node.exiting && node.depth > 1 && !node.showLabel).length;
    status.textContent = `第一圈 ${directWords} 词（全部显示） · 第二圈 ${contextDots} 个关系星点 · 当前 ${total} · SAT ${satTotal} · GRE ${greTotal}`;
  }

  function relatedFor(id) {
    return visibleRelations().filter(r => r.source === id || r.target === id).sort((a,b) => b.strength-a.strength);
  }

  function fullRelatedFor(id, type) {
    return relations
      .filter(relation => relation.type === type && (relation.source === id || relation.target === id))
      .sort((a, b) => b.strength - a.strength || a.source.localeCompare(b.source, "en"));
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
    const senses = window.getLexicalSenses ? window.getLexicalSenses(word) : [{ pos: word.pos, definition: word.definition, zh: word.zh }];
    const posLabel = window.getLexicalPosLabel ? window.getLexicalPosLabel(word) : word.pos;
    const senseMarkup = senses.map((sense, index) => `<article class="lexical-sense ${senses.length > 1 ? "is-polysemous" : ""}">
      <span>${sense.pos}</span><div>${sense.definition ? `<p>${sense.definition}</p>` : ""}${sense.zh ? `<strong>${sense.zh}</strong>` : ""}</div>
    </article>`).join("");
    const kind = catalogKind(word);
    const catalogText = kind === "overlap"
      ? `SAT + GRE · ${word.group} · ${word.greTier || "GRE Core"}`
      : kind === "gre" ? `GRE · ${word.greTier || word.group}` : `SAT · ${word.group}`;
    const synonymLinks = fullRelatedFor(word.id, "synonym").slice(0, 8);
    const antonymLinks = fullRelatedFor(word.id, "antonym").slice(0, 8);
    const relationColumn = (items, emptyText) => items.length
      ? items.map(relation => {
          const relatedId = relation.source === word.id ? relation.target : relation.source;
          const relatedWord = wordMap.get(relatedId);
          const relatedPos = relatedWord && window.getLexicalPosLabel ? window.getLexicalPosLabel(relatedWord) : (relatedWord?.pos || "词性未知");
          return `<button class="related-word" type="button" data-related-word="${relatedId}">${relatedId}<small>${relatedPos} · ${Math.round(relation.strength * 100)}%</small></button>`;
        }).join("")
      : `<span class="relation-empty">${emptyText}</span>`;
    const etymology = window.getLexicalEtymology ? window.getLexicalEtymology(word) : (word.etymology || "暂未找到可靠词源记录。");
    const passCount = window.LexiversePasses?.get(word.id) || 0;
    const memory = word.memory || `把 ${word.id} 与例句中的具体语境绑定记忆。`;
    const normalizeStem = value => String(value || "").toLowerCase().replace(/[^a-z]/g, "").replace(/(ingly|edly|ation|ition|ment|ness|ence|ance|able|ible|ious|ous|ive|ity|ally|al|ic|ate|ify|ize|ing|ed|ly|s)$/i, "");
    const curatedFamily = (window.LEXICAL_FAMILIES || []).find(family => family.members.some(([id]) => id === word.id));
    const stem = normalizeStem(word.id);
    const derivedFamily = !curatedFamily && stem.length >= 5
      ? words.filter(candidate => candidate.id !== word.id && normalizeStem(candidate.id) === stem).slice(0, 5).map(candidate => [candidate.id, candidate.zh || candidate.definition])
      : [];
    const familyRoot = curatedFamily?.root || (derivedFamily.length ? `${stem} · 同一派生词干` : "祖源锚点");
    const familyMembers = curatedFamily?.members || derivedFamily;
    const familyMarkup = familyMembers.length
      ? familyMembers.map(([id, meaning]) => wordMap.has(id)
        ? `<button type="button" class="family-word" data-family-word="${id}"><strong>${id}</strong><span>${meaning}</span></button>`
        : `<div class="family-word external"><strong>${id}</strong><span>${meaning}</span></div>`).join("")
      : `<div class="family-word root-anchor"><strong>${word.id} 的祖源</strong><span>${etymology}</span></div>`;
    detail.innerHTML = `
      <div class="detail-intro">
        <span class="word-type">词性 · ${posLabel}</span><span class="word-catalog ${kind}">${catalogText}</span><span class="word-pass-count">累计 ${passCount} 遍</span>
        <div class="detail-word">${word.id}</div>
        <p class="phonetic">${word.phonetic}</p>
        <div class="familiarity"><span>我的熟悉度</span><div class="familiarity-options" role="group" aria-label="熟悉度 1 到 5">
          ${[1,2,3,4,5].map(n => `<button type="button" data-level="${n}" class="${n === word.level ? "active" : ""}" aria-label="熟悉度 ${n}">${n}</button>`).join("")}
        </div></div>
      </div>
      <div class="detail-meaning">
        <span class="detail-label">Parts of speech & meanings · 词性与对应意思</span>
        <div class="lexical-senses">${senseMarkup}</div>
        <span class="detail-label">Example</span><p class="example">“${word.example}”</p>
        <span class="detail-label">Collocations</span><div class="collocations">${(word.collocations || []).map(c => `<span>${c}</span>`).join("")}</div>
        <div class="detail-relations">
          <section class="relation-column synonyms"><span class="detail-label">Synonyms · 同义词</span><div>${relationColumn(synonymLinks, "暂无明确同义词")}</div></section>
          <section class="relation-column antonyms"><span class="detail-label">Antonyms · 反义词</span><div>${relationColumn(antonymLinks, "暂无明确反义词")}</div></section>
        </div>
      </div>
      <div class="detail-memory">
        <span class="detail-label">Etymology · 拉丁语优先</span><p class="etymology-text">${etymology}</p>
        <div class="memory-box"><span class="detail-label">词源记忆方法</span><p>${memory}</p></div>
        <section class="word-family"><div class="word-family-heading"><span class="detail-label">Word family · 同源词族</span><small>${familyRoot}</small></div><div class="word-family-grid">${familyMarkup}</div></section>
      </div>`;
    fitDetailWord();
    requestAnimationFrame(fitDetailWord);
    document.fonts?.ready.then(fitDetailWord);
    detail.querySelectorAll("[data-level]").forEach(btn => btn.addEventListener("click", () => {
      word.level = Number(btn.dataset.level);
      let savedLevels = {};
      try { savedLevels = JSON.parse(localStorage.getItem("lexiverse-levels")) || {}; } catch {}
      savedLevels[word.id] = word.level;
      localStorage.setItem("lexiverse-levels", JSON.stringify(savedLevels));
      window.dispatchEvent(new CustomEvent("lexiverse-level-change", { detail: { id: word.id, level: word.level, source: "app" } }));
      renderDetail(); buildLayout();
    }));
    detail.querySelectorAll("[data-related-word]").forEach(button => button.addEventListener("click", () => selectWord(button.dataset.relatedWord)));
    detail.querySelectorAll("[data-family-word]").forEach(button => button.addEventListener("click", () => selectWord(button.dataset.familyWord)));
  }

  function selectWord(id, animate = true) {
    if (!wordMap.has(id)) return;
    if (scopedIds && !scopedIds.has(id)) scopedIds = null;
    if (!matchesCatalog(wordMap.get(id))) { catalog = "all"; updateCatalogButtons(); }
    selectedId = id;
    targetCamera = { x: 0, y: 0, scale: 1 };
    buildLayout(id);
    const renderToken = ++detailRenderToken;
    requestAnimationFrame(() => {
      if (renderToken === detailRenderToken && selectedId === id) renderDetail();
    });
    document.getElementById("word-search").value = "";
    document.getElementById("search-results").hidden = true;
  }

  window.addEventListener("lexiverse-pass-change", event => {
    if ((event.detail?.ids || []).includes(selectedId)) renderDetail();
  });

  function nodeAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect(); const x = clientX - rect.left, y = clientY - rect.top;
    return nodes.filter(n => !n.exiting && (n.opacity ?? 1) > .35).slice().sort((a,b) => a.depth-b.depth).find(n => {
      const p = screenPosition(n); const radius = n.showLabel ? Math.max(18, n.id.length * n.fontSize * camera.scale * .29) : 11 * p.scale;
      return Math.hypot(x-p.x, y-p.y) < radius;
    });
  }

  canvas.addEventListener("pointerdown", e => { dragging = true; moved = false; lastPointer = {x:e.clientX,y:e.clientY}; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", e => {
    const nextHoveredId = nodeAt(e.clientX, e.clientY)?.id || null;
    if (nextHoveredId !== hoveredId) { hoveredId = nextHoveredId; requestDraw(); }
    canvas.style.cursor = hoveredId ? "pointer" : (dragging ? "grabbing" : "grab");
    if (!dragging) return; const dx=e.clientX-lastPointer.x, dy=e.clientY-lastPointer.y; if(Math.abs(dx)+Math.abs(dy)>2)moved=true;
    targetCamera.x += dx/targetCamera.scale; targetCamera.y += dy/targetCamera.scale; camera.x = targetCamera.x; camera.y = targetCamera.y;
    orbit.targetYaw += dx * .0011; orbit.targetPitch = Math.max(-.24, Math.min(.12, orbit.targetPitch - dy * .0007));
    lastPointer={x:e.clientX,y:e.clientY}; requestDraw();
  });
  canvas.addEventListener("pointerup", e => { if (!moved) { const hit=nodeAt(e.clientX,e.clientY); if(hit)selectWord(hit.id); } dragging=false; });
  canvas.addEventListener("pointerleave", () => { hoveredId=null; dragging=false; requestDraw(); });
  canvas.addEventListener("wheel", e => { e.preventDefault(); targetCamera.scale = Math.max(.55, Math.min(1.7, targetCamera.scale * (e.deltaY > 0 ? .91 : 1.1))); requestDraw(); }, {passive:false});

  document.querySelectorAll(".relation-chip input").forEach(input => input.addEventListener("change", () => {
    enabledTypes = new Set([...document.querySelectorAll(".relation-chip input:checked")].map(el => el.value)); buildLayout(); renderDetail();
  }));
  document.querySelectorAll("[data-density]").forEach(button => button.addEventListener("click", () => {
    density = button.dataset.density;
    document.querySelectorAll("[data-density]").forEach(option => option.setAttribute("aria-pressed", String(option === button)));
    buildLayout(); renderDetail(); targetCamera = {x:0,y:0,scale:1}; requestDraw();
  }));
  document.querySelectorAll("[data-catalog]").forEach(button => button.addEventListener("click", () => {
    catalog = button.dataset.catalog;
    updateCatalogButtons();
    buildLayout(); renderDetail(); targetCamera = {x:0,y:0,scale:1}; requestDraw();
  }));
  document.getElementById("center-view").addEventListener("click", () => {
    targetCamera={x:0,y:0,scale:1};
    orbit.targetYaw=0; orbit.targetPitch=-.08;
    requestDraw();
  });
  document.getElementById("zoom-in").addEventListener("click", () => { targetCamera.scale=Math.min(1.7,targetCamera.scale*1.18); requestDraw(); });
  document.getElementById("zoom-out").addEventListener("click", () => { targetCamera.scale=Math.max(.55,targetCamera.scale/1.18); requestDraw(); });
  document.getElementById("random-word").addEventListener("click", () => { const pool=universeWords(); selectWord(pool[Math.floor(Math.random()*pool.length)].id); });

  const search = document.getElementById("word-search"), results = document.getElementById("search-results");
  const alphabeticalCollator = new Intl.Collator("en-US", { sensitivity: "base", numeric: false, ignorePunctuation: false });
  const alphabetizedWords = words.slice().sort((a, b) => alphabeticalCollator.compare(a.id, b.id));
  function showSearch() {
    const q = search.value.trim().toLowerCase();
    if (!q) { results.hidden=true; return; }
    const found = alphabetizedWords
      .filter(w => w.id.includes(q) || w.zh.includes(q) || w.definition.toLowerCase().includes(q))
      .slice(0, 8);
    results.innerHTML = found.length ? found.map(w => {
      const kind = catalogKind(w);
      const label = kind === "overlap" ? "SAT + GRE" : kind.toUpperCase();
      const posLabel = window.getLexicalPosLabel ? window.getLexicalPosLabel(w) : w.pos;
      return `<button type="button" class="search-result" role="option" data-word="${w.id}"><span>${w.id}</span><small>${label} · ${posLabel} · ${w.zh}</small></button>`;
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
  document.getElementById("theme-toggle").addEventListener("click", () => { const next=document.documentElement.dataset.theme==="light"?"dark":"light"; document.documentElement.dataset.theme=next; localStorage.setItem("lexiverse-theme",next); requestDraw(); });
  try { const levels=JSON.parse(localStorage.getItem("lexiverse-levels")); if(levels)words.forEach(w => {if(levels[w.id])w.level=levels[w.id]}); } catch {}
  window.addEventListener("lexiverse-level-change", event => {
    if (!event.detail?.id || event.detail.source === "app") return;
    const word = wordMap.get(event.detail.id);
    if (!word) return;
    word.level = Number(event.detail.level);
    if (selectedId === word.id) renderDetail();
  });
  window.addEventListener("lexiverse-select-word", event => {
    if (event.detail?.id) selectWord(event.detail.id);
  });
  new ResizeObserver(() => { resize(); buildLayout(); }).observe(stage);
  new ResizeObserver(fitDetailWord).observe(detail);
  resize(); buildLayout(); renderDetail(); cancelAnimationFrame(animationFrame); draw();
})();
