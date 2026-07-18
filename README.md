<p align="center">
  <img src="media/lexiverse-promo-3d-cover.png" alt="Lexiverse SAT + GRE Word Galaxy" width="100%">
</p>

<h1 align="center">SAT + GRE Word Galaxy</h1>

<p align="center">
  把单词表变成一片可以探索、可以复习、也可以征服的星系。
</p>

<p align="center">
  <strong>无需数据库 · 无需 API Key · 支持 GitHub Pages · 手机 / iPad / 电脑均可使用</strong>
</p>

背单词不该只是盯着一张越来越长的表。

Lexiverse 把 SAT 和 GRE 词汇放进一张关系星图：点开一个词，你会看到它的同义词、反义词、词源、前缀、同源词和真实语境；继续学习时，系统会记住你的熟悉度、学习遍数、错题、连击和阅读进度。第一遍认识单词，第二遍建立词义网络，第三遍把单词放回 Digital SAT 风格的文章中，最终目标不是“背过”，而是在阅读时能够迅速理解作者的逻辑。

> 如果你完全不懂编程，请直接看下面的 **“5 分钟发布到 GitHub Pages”**。只需要上传文件和点击几个按钮。

## 你可以在这里做什么

| 模块 | 它会怎样帮助你 |
| --- | --- |
| 🌌 单词星系 | 用不同颜色显示同义词、反义词、词源和前缀关系；点击单词后，星系会平滑转向新的中心词。 |
| 🧠 三遍学习 | 第一遍完整认识；第二遍结合释义、例句、同反义词和同源词理解；第三遍进入文章，训练语境反应和文章结构。 |
| 📚 SAT + GRE 词库 | 保留 SAT Group 1–179，并补充能与 SAT 词形成明确关系的 GRE 高频、高难词汇。 |
| 🧭 Group 顺序背词 | 可以按 Group、遍数和词位继续学习，系统自动保存断点，并让下方学习卡与上方星系联动。 |
| 📰 阅读训练 | 每个 Group 配有 3 篇精修阅读，共 537 篇；每篇只配一道题，重点训练主旨、转折、证据和作者意图。 |
| 🎯 智能复习 | 按熟悉度、遗忘间隔和使用语境安排复习；今天学过但尚未达到 L5 的词可以集中回顾。 |
| 🪞 易混词对比 | 对比拼写相近、意思容易混淆或来自同一词根的词，展示核心差异、例句和记忆钩子。 |
| 🏆 游戏化学习 | 每日 100 词目标、XP、连击、星图碎片、勋章、阶段奖励和可兑换的休息倒计时。 |
| 💾 进度保险箱 | 导出完整备份，再在另一台电脑或 iPad 中恢复熟悉度、遍数、错题、阅读和奖励记录。 |

默认训练内容全部来自项目内的离线题库，打开网页就能使用，不会消耗 OpenAI API 额度。

---

## 5 分钟发布到 GitHub Pages（零基础版）

发布后，你会得到一个类似下面的网址：

```text
https://你的GitHub用户名.github.io/仓库名称/
```

例如仓库叫 `sat-word-galaxy`，用户名叫 `kyle`，网址通常就是：

```text
https://kyle.github.io/sat-word-galaxy/
```

### 第 1 步：准备 GitHub 仓库

1. 登录 [GitHub](https://github.com/)。
2. 点击右上角的 `+`，选择 `New repository`。
3. Repository name 填写 `sat-word-galaxy`。
4. 建议选择 `Public`。GitHub 免费账户可以直接为公开仓库使用 GitHub Pages。
5. 点击 `Create repository`。

### 第 2 步：上传项目文件

1. 进入刚创建的仓库。
2. 点击 `Add file` → `Upload files`。
3. 打开电脑上的 `sat-word-galaxy` 项目文件夹。
4. 把**文件夹里面的全部内容**拖进上传区域，不要只上传压缩包。
5. 等待上传完成，在页面下方填写说明，例如 `Upload Lexiverse`。
6. 点击 `Commit changes`。

上传完成后，请确认仓库首页直接看得到以下文件：

```text
index.html
styles.css
app.js
README.md
```

同时应当能看到 `icons` 和 `media` 文件夹。`index.html` 必须在仓库最外层，不能藏在第二层同名文件夹里，否则网页会找不到首页。

> GitHub 网页上传单个文件的上限是 25 MiB。本项目运行所需文件都不需要大型媒体文件，因此可以正常上传。

### 第 3 步：开启 GitHub Pages

1. 在仓库顶部点击 `Settings`。
2. 左侧找到 `Pages`。
3. 在 `Build and deployment` 下，把 `Source` 设为 `Deploy from a branch`。
4. Branch 选择 `main`，右侧文件夹选择 `/ (root)`。
5. 点击 `Save`。

GitHub 会开始发布网页。通常等待 1–3 分钟后，刷新 `Settings` → `Pages`，页面顶部就会显示可访问的网址。第一次发布较慢时，也可以在仓库顶部的 `Actions` 页面查看进度。

GitHub 官方操作说明：[配置 GitHub Pages 发布来源](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

### 第 4 步：打开并安装

用浏览器打开 GitHub Pages 给出的网址。建议先完整加载一次，然后：

- **iPad / iPhone：** Safari → 分享按钮 → `添加到主屏幕` → `添加`
- **Android：** Chrome 菜单 → `添加到主屏幕` 或 `安装应用`
- **电脑：** Chrome / Edge 地址栏右侧的安装图标 → `安装`

安装后它会像一个独立 App 一样出现在桌面。核心词库、Group 背词、复习和离线题库在首次加载完成后可以继续离线使用。

---

## 在电脑上本地运行（VS Code）

如果你只想自己使用，暂时不发布到网络，本地运行最简单。

### 第 1 步：安装两个免费软件

1. 安装 [VS Code](https://code.visualstudio.com/)。
2. 安装 [Node.js](https://nodejs.org/)。安装 Node.js 后，`npm` 会一起安装，不需要单独寻找。

### 第 2 步：打开项目

1. 下载并解压项目。
2. 打开 VS Code。
3. 选择 `File` → `Open Folder`。
4. 选择 `sat-word-galaxy` 文件夹。

### 第 3 步：启动网页

在 VS Code 顶部选择 `Terminal` → `New Terminal`，把下面这一行复制进去并按回车：

```bash
npm run dev
```

看到下面类似的内容就代表启动成功：

```text
Serving HTTP on :: port 8000
```

然后在浏览器打开：

```text
http://localhost:8000
```

使用结束后，在终端按 `Control + C` 停止服务。停止或重新启动服务不会删除学习记录。

### 如果提示 `Address already in use`

这表示 8000 端口已经被另一个程序占用，不是项目坏了。改用 8001：

```bash
PORT=8001 npm run dev
```

然后打开：

```text
http://localhost:8001
```

---

## 第一次打开，建议这样开始

1. 在侧栏进入 **Group 背词**，选择正在学习的 SAT Group。
2. 选择当前遍数：一刷、二刷或三刷。
3. 每看完一个词，用 `1–5` 记录熟悉度；数字越高代表越熟悉。
4. 点击词语，让上方星系展示它和其他单词的关系。
5. 二刷时重点看同义词、反义词、例句与同源词，不需要做阅读。
6. 三刷时完成每个 Group 的 3 篇文章，先判断文章骨架和转折，再回答那一道题。
7. 学习一段时间后进入 **进度保险箱**，下载一份完整备份。

熟悉度建议：

| 等级 | 建议含义 |
| --- | --- |
| L1 | 几乎不认识 |
| L2 | 看过，但意思模糊 |
| L3 | 能认出主要意思 |
| L4 | 熟悉，能在语境中判断 |
| L5 | 看到后可以快速反应并理解用法 |

---

## 学习数据会不会消失？

学习记录保存在当前浏览器的本地存储中，所以：

- 刷新网页，记录仍然存在。
- 按 `Control + C` 停止本地服务，记录仍然存在。
- 更新 GitHub 代码，通常不会影响原来的记录。
- 同一网址、同一浏览器再次打开，记录仍然存在。
- 清除浏览器网站数据、使用无痕模式或换设备，不会自动带走旧设备的记录。

如果要换电脑、换浏览器或在 iPad 上继续：

1. 在旧设备打开 **进度保险箱**。
2. 下载完整备份文件。
3. 把备份文件发送到新设备。
4. 在新设备的进度保险箱中选择恢复。

当前版本不使用云数据库，因此不同设备之间不会自动同步。备份与恢复可以让你的进度安全迁移，同时也避免公开仓库保存任何个人学习数据。

---

## 后期怎样更新网站？

最适合经常更新的方法是使用 [GitHub Desktop](https://desktop.github.com/)：

1. 安装并登录 GitHub Desktop。
2. 选择 `File` → `Clone repository`，把你的 `sat-word-galaxy` 下载到电脑。
3. 用新版文件替换仓库文件夹里的旧版文件，保持文件名和文件夹结构不变。
4. 回到 GitHub Desktop，左下角填写更新说明，例如 `Improve SAT readings`。
5. 点击 `Commit to main`。
6. 点击顶部的 `Push origin`。

GitHub Pages 会自动重新发布。等待一会儿后刷新网页即可。也可以继续使用 GitHub 网页里的 `Add file` → `Upload files` 覆盖文件；官方说明见：[向仓库添加文件](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)。

如果更新后仍然看到旧界面：

- 先等待 1–3 分钟，让 GitHub Pages 完成发布。
- Mac 按 `Command + Shift + R` 强制刷新。
- Windows 按 `Control + F5` 强制刷新。
- 仍未更新时，先用无痕窗口打开一次。

---

## 项目的核心学习设计

### 一刷：建立第一印象

查看词性、每个词性的释义、发音、例句、固定搭配、词源和记忆方法。完成后记录熟悉度，并累计这个单词的学习遍数。

### 二刷：从一个词扩展到一个词族

把中文意思、英文释义、例句、同义词、反义词和同源词放在一起理解。系统会解释它们“哪里相同、哪里不同”，帮助你从背一个词逐渐建立一整张词义网络。

### 三刷：在文章结构中真正认出它

每个 SAT Group 的全部单词会被分配进 3 篇精修文章。训练先引导你观察作者在做什么、转折改变了什么、结论落在哪里，再完成一道 Digital SAT 风格题目。目标不是逐词翻译，而是抓住文章的骨架。

### 智能复习：对抗遗忘，而不是机械重复

系统结合熟悉度、上次学习时间、遗忘情况和单词出现的语境安排复习。记住的词会逐渐延长间隔，忘记的词会更快重现；L1–L2 弱词还会在学习过程中延迟回访。

### 游戏系统：让“再背十个”变得容易

每日目标默认为 100 词。学习可以获得 XP、星图碎片、连击和勋章；XP 可以兑换 5、15 或 30 分钟的休息时间，倒计时结束后会提醒你回到学习。累计 XP 和段位不会因为兑换而下降。

---

## 词库与题库

- 保留 SAT Group 1–179 的原始分类。
- 合并 SAT、GRE Core 和 GRE Advanced 词汇，并标出重合词。
- 搜索可以覆盖完整词库，星系只绘制当前词附近的有限节点，避免一次渲染全部词汇造成卡顿。
- 每个词可包含多个词性及其分别对应的意思。
- 词源优先使用可靠的拉丁语来源；没有拉丁来源时，会标注希腊语、法语、古英语或其他真实来源。
- 同源词不必局限于当前词库，并会显示各自的意思，方便比较词根如何产生不同词义。
- 每个 Group 配有 3 篇文章，共 537 篇 Group 阅读。
- 另有 250 道离线训练题，覆盖词汇语境、主旨、推断、证据、篇章目的和跨文本联系等题型。
- 已完成的题目会从正常抽题池中排除，并保存正确率、错题和历史作答。

所有练习内容均为本项目原创学习材料，用于模拟 Digital SAT 的文本长度、推理方式和选项结构，不是官方真题。

---

## 可选的 OpenAI 接口（普通使用者可以跳过）

日常背词、星系、离线题库和复习系统都不需要 API Key。

项目保留了实验性的本地文章接口。如果你要继续开发实时生成功能，可以在 macOS / Linux 终端运行：

```bash
export OPENAI_API_KEY="你的 OpenAI API Key"
npm run dev:api
```

API Key 只由本机的 `server.py` 读取。**不要把 API Key 写进 `index.html`、JavaScript 文件或上传到 GitHub。**

GitHub Pages 只能托管静态网页，不能运行 `server.py`；但这不会影响项目默认的离线功能。

---

## 项目文件说明

| 文件或文件夹 | 用途 |
| --- | --- |
| `index.html` | 网页入口与主要页面结构 |
| `styles.css` | 界面样式、动画和移动端适配 |
| `app.js` | 单词星系、搜索、筛选和详情交互 |
| `wordbank.js` / `gre.js` | SAT 分组词库与 GRE 词库 |
| `lexical-expansion.js` / `lexical-senses.js` | 词义、词性、词源、同源词和关系扩充 |
| `group-study.js` | 三遍 Group 背词流程与进度统计 |
| `architect-readings.js` | Group 阅读的目标词与题目配置 |
| `architect-passage-overrides.js` | 精修后的 Group 阅读正文 |
| `architect-reading-engine.js` | 阅读结构分析与展示逻辑 |
| `answer-layout.js` | 让正确选项在 A–D 之间稳定、均衡分布 |
| `offline-questions.js` / `generated-questions.js` | 离线 DSAT 训练题库 |
| `review-readings.js` / `smart-route.js` | 复习文章和智能学习路线 |
| `progress-store.js` / `progress-vault.js` | 学习记录、备份与恢复 |
| `confusables.js` / `confusable-study.js` | 易混词词库与对比学习 |
| `service-worker.js` / `manifest.webmanifest` | 安装到设备与离线使用 |
| `icons/` | App 图标 |
| `media/lexiverse-promo-3d-cover.png` | README 顶部的项目封面图 |

开发者可以运行：

```bash
npm test
npm run audit:readings:complete
```

前者检查 Group 阅读正确选项是否在 A–D 中合理分布，后者检查文章长度、目标词覆盖、题目结构和全部 Group 的完整性。

---

## 常见问题

### GitHub Pages 显示 404

确认 `Settings` → `Pages` 选择的是 `main` 和 `/ (root)`，并确认 `index.html` 位于仓库最外层。刚刚开启 Pages 时先等待几分钟。

### 网页打开后是空白或文件加载失败

不要直接双击 `index.html`。本地使用时要先运行 `npm run dev`，再打开 `http://localhost:8000`。

### 搜索或背词记录刷新后还在吗？

在同一浏览器和同一网址中会保留。为了避免清理浏览器数据造成损失，建议定期下载完整备份。

### GitHub 更新会覆盖我的熟悉度吗？

通常不会。代码在 GitHub，学习记录在每位使用者自己的浏览器中；更新网页文件不会把所有人的进度混在一起。

### 能不能让电脑和 iPad 自动同步？

当前版本没有账号和云数据库，因此不会自动同步。可以用进度保险箱导出和恢复。未来如果加入登录与云端存储，才可以实现自动同步。

### 需要付费吗？

项目本身、本地运行和公开仓库的 GitHub Pages 都可以免费使用。只有你主动开发并调用第三方付费 API 时，才可能产生额外费用。

---

## 声明

本项目是个人 SAT / GRE 学习工具，与 College Board、ETS 或任何官方考试机构无隶属、授权或合作关系。题库与阅读材料用于学习和模拟训练，请勿将其视为官方真题。

如果它让你从“今天不想背”走到了“再来十个”，那这片星系就已经开始发挥作用了。
