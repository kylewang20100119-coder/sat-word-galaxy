(() => {
  const shell = document.querySelector(".app-shell");
  const nav = document.getElementById("section-nav");
  const desktopToggle = document.getElementById("section-nav-toggle");
  const mobileToggle = document.getElementById("section-nav-mobile-toggle");
  const scrim = document.getElementById("section-nav-scrim");
  if (!shell || !nav || !desktopToggle || !mobileToggle) return;

  const links = [...nav.querySelectorAll("[data-section-link]")];
  const sections = links.map(link => document.getElementById(link.dataset.sectionLink)).filter(Boolean);
  let selectedSection = "";
  let selectedLockUntil = 0;
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

  function lockSelection(link) {
    selectedSection = link.dataset.sectionLink;
    selectedLockUntil = performance.now() + 6000;
    activate(selectedSection);
  }

  links.forEach(link => link.addEventListener("pointerdown", () => lockSelection(link)));
  links.forEach(link => link.addEventListener("click", event => {
    event.preventDefault();
    lockSelection(link);
    const target = document.getElementById(selectedSection);
    if (target) {
      history.pushState(null, "", `#${selectedSection}`);
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setTimeout(scheduleActiveSync, 6050);
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

  let activeFrame = 0;
  function syncActiveSection() {
    activeFrame = 0;
    if (selectedSection && performance.now() < selectedLockUntil) {
      activate(selectedSection);
      return;
    }
    selectedSection = "";
    const focusLine = Math.max(112, Math.min(160, window.innerHeight * .28));
    const crossingSections = sections.filter(section => {
      const rect = section.getBoundingClientRect();
      return rect.top <= focusLine && rect.bottom > focusLine;
    });
    const crossing = crossingSections[crossingSections.length - 1];
    if (crossing) {
      activate(crossing.id);
      return;
    }
    const nearest = sections
      .map(section => ({ section, distance: Math.abs(section.getBoundingClientRect().top - focusLine) }))
      .sort((a, b) => a.distance - b.distance)[0];
    if (nearest) activate(nearest.section.id);
  }

  function scheduleActiveSync() {
    if (activeFrame) return;
    activeFrame = requestAnimationFrame(syncActiveSection);
  }

  window.addEventListener("scroll", scheduleActiveSync, { passive: true });
  window.addEventListener("resize", scheduleActiveSync);
  activate(location.hash.slice(1) || "galaxy");
  requestAnimationFrame(syncActiveSection);
  setTimeout(syncActiveSection, 450);

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
