(() => {
  const installButton = document.getElementById("install-app");
  const dialog = document.getElementById("install-app-dialog");
  const closeButton = document.getElementById("install-app-close");
  const confirmButton = document.getElementById("install-app-confirm");
  const steps = document.getElementById("install-app-steps");
  const description = document.getElementById("install-app-description");
  const networkStatus = document.getElementById("app-network-status");
  if (!installButton || !dialog) return;

  const userAgent = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(userAgent);
  const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || Boolean(navigator.standalone);
  let deferredInstallPrompt = null;
  let statusTimer = null;
  let previousFocus = null;

  function setNetworkStatus(message, tone = "ready", keep = false) {
    if (!networkStatus) return;
    clearTimeout(statusTimer);
    networkStatus.textContent = message;
    networkStatus.className = `app-network-status ${tone}`;
    networkStatus.hidden = false;
    requestAnimationFrame(() => networkStatus.classList.add("visible"));
    if (!keep) statusTimer = setTimeout(() => {
      networkStatus.classList.remove("visible");
      setTimeout(() => { networkStatus.hidden = true; }, 220);
    }, 3200);
  }

  function installInstructions() {
    if (isIOS) return [
      "在 Safari 底部或顶部点“分享”按钮。",
      "向下找到并选择“添加到主屏幕”。",
      "确认名称为 Lexiverse，然后点右上角“添加”。"
    ];
    if (isAndroid) return [
      "打开浏览器右上角菜单。",
      "选择“安装应用”或“添加到主屏幕”。",
      "确认安装，之后从主屏幕进入 Lexiverse。"
    ];
    return [
      "查看地址栏右侧的安装图标，或打开浏览器菜单。",
      "选择“安装 Lexiverse”或“安装此网站为应用”。",
      "确认后可从桌面、程序坞或开始菜单独立启动。"
    ];
  }

  function renderInstallGuide() {
    if (description) description.textContent = isIOS
      ? "在 iPad 或 iPhone 上安装后，可像普通 App 一样从主屏幕全屏打开；首次完整加载后核心学习功能支持离线使用。"
      : "安装后可以独立启动；首次完整加载后，核心词库与学习功能可以离线使用。";
    if (steps) steps.innerHTML = installInstructions().map((text, index) => `<li><i>${index + 1}</i><span>${text}</span></li>`).join("");
  }

  function openDialog() {
    previousFocus = document.activeElement;
    renderInstallGuide();
    dialog.hidden = false;
    document.body.classList.add("install-app-open");
    requestAnimationFrame(() => {
      dialog.classList.add("visible");
      confirmButton?.focus();
    });
  }

  function closeDialog() {
    dialog.classList.remove("visible");
    document.body.classList.remove("install-app-open");
    setTimeout(() => { dialog.hidden = true; }, 220);
    previousFocus?.focus?.();
  }

  async function requestInstall() {
    if (isStandalone()) {
      installButton.hidden = true;
      setNetworkStatus("Lexiverse 已经作为应用运行。", "success");
      return;
    }
    if (!deferredInstallPrompt) {
      openDialog();
      return;
    }
    try {
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      if (choice?.outcome === "accepted") {
        installButton.hidden = true;
        setNetworkStatus("安装完成，可以从设备主屏幕进入 Lexiverse。", "success");
      } else openDialog();
    } catch {
      deferredInstallPrompt = null;
      openDialog();
    }
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installButton.classList.add("install-ready");
    installButton.title = "安装 Lexiverse 应用";
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    installButton.hidden = true;
    closeDialog();
    setNetworkStatus("Lexiverse 已安装，学习星系现在就在你的设备上。", "success");
  });

  installButton.addEventListener("click", requestInstall);
  closeButton?.addEventListener("click", closeDialog);
  confirmButton?.addEventListener("click", closeDialog);
  dialog.addEventListener("click", event => { if (event.target === dialog) closeDialog(); });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !dialog.hidden) closeDialog();
  });

  window.addEventListener("offline", () => setNetworkStatus("已进入离线模式 · 核心词库、背词和复习仍可使用", "offline", true));
  window.addEventListener("online", () => setNetworkStatus("网络已恢复 · 学习进度始终保存在本机", "success"));

  async function registerOfflineApp() {
    const canRegister = "serviceWorker" in navigator && ["http:", "https:"].includes(location.protocol);
    if (!canRegister) return;
    try {
      const registration = await navigator.serviceWorker.register("./service-worker.js", { scope: "./" });
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            setNetworkStatus("新版本已准备好 · 下次打开自动使用最新内容", "ready");
          }
        });
      });
      registration.update().catch(() => {});
    } catch {
      setNetworkStatus("离线安装暂不可用，在线学习功能不受影响。", "offline");
    }
  }

  if (isStandalone()) installButton.hidden = true;
  if (!navigator.onLine) setNetworkStatus("已进入离线模式 · 核心学习功能仍可使用", "offline", true);
  renderInstallGuide();
  window.addEventListener("load", registerOfflineApp, { once: true });
})();
