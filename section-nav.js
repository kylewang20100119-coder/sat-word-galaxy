(() => {
  const shell = document.querySelector(".app-shell");
  const nav = document.getElementById("section-nav");
  const desktopToggle = document.getElementById("section-nav-toggle");
  const mobileToggle = document.getElementById("section-nav-mobile-toggle");
  const scrim = document.getElementById("section-nav-scrim");
  if (!shell || !nav || !desktopToggle || !mobileToggle) return;

  const links = [...nav.querySelectorAll("[data-section-link]")];
  const sections = links.map(link => document.getElementById(link.dataset.sectionLink)).filter(Boolean);
  const compactQuery = window.matchMedia("(max-width: 1120px)");
  const savedCollapsed = localStorage.getItem("lexiverse-section-nav-collapsed") === "true";
  shell.classList.toggle("section-nav-collapsed", savedCollapsed && !compactQuery.matches);

  function isCompact() { return compactQuery.matches; }

  function setDrawer(open) {
    shell.classList.toggle("section-nav-drawer-open", Boolean(open));
    mobileToggle.setAttribute("aria-expanded", String(Boolean(open)));
    nav.setAttribute("aria-hidden", String(isCompact() && !open));
    nav.inert = isCompact() && !open;
  }

  function syncMode() {
    if (isCompact()) {
      shell.classList.remove("section-nav-collapsed");
      setDrawer(false);
    } else {
      setDrawer(false);
      shell.classList.toggle("section-nav-collapsed", localStorage.getItem("lexiverse-section-nav-collapsed") === "true");
      nav.removeAttribute("aria-hidden");
    }
  }

  desktopToggle.addEventListener("click", () => {
    const collapsed = !shell.classList.contains("section-nav-collapsed");
    shell.classList.toggle("section-nav-collapsed", collapsed);
    localStorage.setItem("lexiverse-section-nav-collapsed", String(collapsed));
    desktopToggle.setAttribute("aria-label", collapsed ? "展开页面导引" : "收起页面导引");
    desktopToggle.title = collapsed ? "展开页面导引" : "收起页面导引";
  });
  mobileToggle.addEventListener("click", () => setDrawer(!shell.classList.contains("section-nav-drawer-open")));
  scrim?.addEventListener("click", () => setDrawer(false));
  document.addEventListener("keydown", event => { if (event.key === "Escape") setDrawer(false); });
  compactQuery.addEventListener?.("change", syncMode);

  links.forEach(link => link.addEventListener("click", () => {
    if (isCompact()) setDrawer(false);
  }));

  function activate(id) {
    links.forEach(link => {
      const active = link.dataset.sectionLink === id;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }

  const visible = new Map();
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => visible.set(entry.target.id, entry.intersectionRatio));
    const best = [...visible.entries()].filter(([, ratio]) => ratio > 0).sort((a, b) => b[1] - a[1])[0];
    if (best) activate(best[0]);
  }, { rootMargin: "-16% 0px -62% 0px", threshold: [0, .08, .2, .45, .7] });
  sections.forEach(section => observer.observe(section));
  activate(location.hash.slice(1) || "galaxy");

  const sourceDaily = document.getElementById("study-daily-goal");
  const sourceFill = document.getElementById("study-daily-fill");
  const sourceGroup = document.getElementById("study-group-select");
  const navDaily = document.getElementById("section-nav-daily");
  const navFill = document.getElementById("section-nav-daily-fill");
  const navGroup = document.getElementById("section-nav-current-group");

  function syncStatus() {
    const dailyText = sourceDaily?.textContent?.trim() || "0 / 100";
    const [done = 0, target = 100] = dailyText.split("/").map(value => Number(value.trim()));
    if (navDaily) navDaily.textContent = dailyText;
    if (navFill) navFill.style.width = `${Math.min(100, Math.max(0, target ? done / target * 100 : 0))}%`;
    if (navGroup) navGroup.textContent = `Group ${Number(sourceGroup?.value) || 1} · 继续积累`;
  }

  if (sourceDaily) new MutationObserver(syncStatus).observe(sourceDaily, { childList: true, characterData: true, subtree: true });
  if (sourceFill) new MutationObserver(syncStatus).observe(sourceFill, { attributes: true, attributeFilter: ["style"] });
  sourceGroup?.addEventListener("change", syncStatus);
  window.addEventListener("lexiverse-group-change", syncStatus);
  window.addEventListener("lexiverse-level-change", syncStatus);
  syncMode();
  syncStatus();
})();
