// Completes the fixed three-reading curriculum for every WordBank Group that
// does not yet have a hand-authored SAT Reading Architect set.  The engine is
// deterministic: the same Group always receives the same semantic split,
// passage architecture, question, and post-answer analysis.
(() => {
  const bank = Array.isArray(window.WORDBANK_WORDS) ? window.WORDBANK_WORDS : [];
  if (!bank.length) return;

  const existing = window.ARCHITECT_GROUP_READINGS || {};
  const normalize = value => String(value || "").replace(/\s+/g, " ").trim();
  const escapeRegExp = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const hash = value => {
    let result = 2166136261;
    for (const character of String(value)) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
    return result >>> 0;
  };
  const headPattern = id => {
    const value = String(id);
    const body = value.includes(" ") ? escapeRegExp(value).replace(/\\ /g, "\\s+") : `${escapeRegExp(value)}(?:s|es|ed|d|ing)?`;
    return new RegExp(`(^|[^a-z])${body}(?=$|[^a-z])`, "gi");
  };
  const headCount = (text, id) => (String(text).match(headPattern(id)) || []).length;
  const wordCount = text => normalize(text).split(/\s+/).filter(Boolean).length;

  const STOP = new Set("a an and are as at be been being but by can could did do does for from had has have he her hers him his how i if in into is it its may might more most not of on one or our she should so some than that the their them then there these they this those through to under up was were what when where which while who will with would you your".split(" "));
  const THEMES = {
    evidence: ["evidence", "claim", "prove", "fact", "true", "accuracy", "reason", "infer", "explain", "theory", "knowledge"],
    institutions: ["government", "law", "public", "official", "authority", "policy", "political", "court", "organization", "community"],
    behavior: ["feeling", "emotion", "person", "people", "attitude", "behavior", "speak", "anger", "fear", "desire", "respect"],
    change: ["change", "cause", "increase", "decrease", "develop", "improve", "reduce", "prevent", "create", "destroy"],
    science: ["plant", "animal", "water", "body", "blood", "disease", "physical", "energy", "chemical", "earth", "temperature"],
    form: ["appearance", "shape", "structure", "material", "color", "sound", "word", "language", "write", "describe"]
  };

  function tokens(word) {
    return new Set(normalize(`${word.id} ${word.definition} ${word.zh}`).toLowerCase().match(/[a-z]{3,}/g)?.filter(token => !STOP.has(token)) || []);
  }

  function compatibility(first, second) {
    const a = tokens(first);
    const b = tokens(second);
    const overlap = [...a].filter(token => b.has(token)).length;
    const themeScore = Object.values(THEMES).reduce((sum, markers) => {
      const left = markers.some(marker => a.has(marker));
      const right = markers.some(marker => b.has(marker));
      return sum + Number(left && right);
    }, 0);
    return overlap * 4 + themeScore * 3 + Number(first.pos !== second.pos) * 0.35;
  }

  function combinations(items, size) {
    const result = [];
    const visit = (start, selected) => {
      if (selected.length === size) return void result.push(selected);
      for (let index = start; index <= items.length - (size - selected.length); index += 1) visit(index + 1, [...selected, items[index]]);
    };
    visit(0, []);
    return result;
  }

  function semanticSplit(words) {
    if (words.length < 3) return [words, [], []];
    const sizes = words.length === 10 ? [3, 3, 4] : [Math.floor(words.length / 3), Math.floor((words.length + 1) / 3), words.length - Math.floor(words.length / 3) - Math.floor((words.length + 1) / 3)];
    const ids = words.map(word => word.id);
    const byId = new Map(words.map(word => [word.id, word]));
    let best = null;
    combinations(ids, sizes[0]).forEach(first => {
      const rest = ids.filter(id => !first.includes(id));
      combinations(rest, sizes[1]).forEach(second => {
        const third = rest.filter(id => !second.includes(id));
        const parts = [first, second, third];
        const score = parts.reduce((total, part) => total + part.reduce((sum, id, index) => sum + part.slice(index + 1).reduce((inner, other) => inner + compatibility(byId.get(id), byId.get(other)), 0), 0), 0);
        const signature = parts.map(part => [...part].sort().join("|")).join("::");
        if (!best || score > best.score || (score === best.score && signature < best.signature)) best = { parts, score, signature };
      });
    });
    return (best?.parts || [ids.slice(0, sizes[0]), ids.slice(sizes[0], sizes[0] + sizes[1]), ids.slice(sizes[0] + sizes[1])]).map(part => part.map(id => byId.get(id)));
  }

  function cleanDefinition(word) {
    let definition = normalize(word.definition || word.zh || "a context-dependent idea")
      .replace(/^\([^)]{1,90}\)\s*/, "")
      .replace(/[.;:]$/, "");
    for (const form of [word.id, String(word.id).split(/\s+/)[0]]) definition = definition.replace(new RegExp(escapeRegExp(form), "gi"), "the term");
    return definition.slice(0, 150);
  }

  function conciseUsage(word, foreignIds = []) {
    let example = normalize(word.example).replace(/^[“\"]|[”\"]$/g, "");
    const foreignHit = foreignIds.some(id => id !== word.id && headCount(example, id));
    if (example && wordCount(example) <= 28 && headCount(example, word.id) === 1 && !foreignHit) return example.replace(/[.!?]+$/, "") + ".";
    const definition = cleanDefinition(word);
    const pos = String(word.pos || "").toLowerCase();
    if (pos.includes("adjective")) return `The source describes the relevant case as ${word.id}, meaning ${definition}.`;
    if (pos.includes("verb")) return `The source uses ${word.id} for the act of trying to ${definition}.`;
    if (pos.includes("adverb")) return `The source says the change occurred ${word.id}, in a manner associated with ${definition}.`;
    return `The source identifies ${word.id}—${definition}—as a consequential feature of the case.`;
  }

  const BLUEPRINTS = [
    {
      subject: "Natural Science", skill: "Inferences",
      lead: "A science-communication researcher compared several brief field reports to determine how much a reader can infer before the reports' methods are known.",
      bridge: "The observations come from different projects, so their vivid wording cannot by itself establish a shared cause.",
      close: "The researcher therefore treats the reports as clues to possible mechanisms, not as a controlled test of any one mechanism.",
      question: "Which choice most logically follows from the researcher's assessment?",
      choices: ["The reports can motivate a hypothesis, but additional controlled evidence is needed to establish a common mechanism.", "Because the reports use precise language, they jointly prove that one mechanism caused every observation.", "The reports are useless unless all of them describe the same species in the same location.", "A mechanism is established whenever separate observers use different terms."],
      explanation: "The author preserves the reports' value as hypothesis-generating evidence while denying that they constitute a controlled causal test.",
      pattern: "Independent observations → Evidentiary limit → Bounded inference",
      evidence: "clues to possible mechanisms, not as a controlled test",
      reasoning: "结尾把证据价值分成两层：这些材料可以提出假设，但由于项目与方法不同，不能直接确立共同因果机制。",
      notes: ["正确：同时保留了材料的启发价值和因果限制。", "错误：把精确措辞偷换成因果证明。", "错误：把‘不能共同证明’夸大成‘完全无用’。", "错误：不同术语本身不能确立同一机制。"],
      trap: "Possibility turned into proof", takeaway: "科学推断题先区分‘提示一种解释’与‘证明一种解释’。"
    },
    {
      subject: "History/Humanities", skill: "Overall Structure",
      lead: "A historian reviewing a newly cataloged collection begins with several lines that earlier editors had treated as parts of one continuous account.",
      bridge: "Catalog records later showed that the lines came from independent documents written for different purposes.",
      close: "Rather than discard the lines, the historian now uses each as local evidence and rejects only the larger narrative that editors had assembled from them.",
      question: "Which choice best describes the overall structure of the text?",
      choices: ["It presents an earlier synthesis, introduces provenance evidence that weakens it, and explains a narrower use for the surviving material.", "It lists several documents and concludes that none can provide historical evidence.", "It defends an established narrative by showing that every line had the same author and purpose.", "It compares two historians but leaves their disagreement unresolved."],
      explanation: "The passage does not reject the documents themselves; it revises the larger story once their separate origins are established.",
      pattern: "Received synthesis → Provenance correction → Narrower evidentiary role",
      evidence: "uses each as local evidence and rejects only the larger narrative",
      reasoning: "作者先给出旧的拼接叙事，再用来源记录拆开它，最后保留局部证据价值；正确结构必须覆盖这三步。",
      notes: ["正确：完整对应旧观点、新证据和限定后的结论。", "错误：忽略作者仍保留每份材料的局部价值。", "错误：与文献来自不同目的的事实相反。", "错误：正文讨论的是材料来源，不是两位历史学家的争论。"],
      trap: "Qualified revision mistaken for rejection", takeaway: "结构题要追踪作者修改了什么，以及刻意没有否定什么。"
    },
    {
      subject: "Social Science", skill: "Central Ideas and Details",
      lead: "A social scientist uses short reports from unrelated institutions to study how readers respond to confident wording.",
      bridge: "Participants often assumed that similarly forceful sentences rested on similarly strong evidence, even though the reports described different settings and methods.",
      close: "The study suggests that verbal confidence can shape perceived credibility, but it cannot substitute for information about how a claim was produced.",
      question: "Which choice best states the main idea of the text?",
      choices: ["Readers may mistake confident wording for evidentiary strength when they lack information about how different claims were produced.", "Reports from unrelated institutions are reliable only when they use equally forceful language.", "Participants accurately inferred every report's method from its wording alone.", "The study shows that confidence has no effect on how readers evaluate a claim."],
      explanation: "The study finds that confident wording affects credibility judgments while emphasizing that production methods remain essential.",
      pattern: "Comparison task → Reader shortcut → Methodological correction",
      evidence: "verbal confidence can shape perceived credibility, but it cannot substitute",
      reasoning: "主旨同时包含心理效应与它的边界：自信措辞会影响判断，但不能代替方法证据。",
      notes: ["正确：覆盖效应和限制两部分。", "错误：把语言相似当成可靠性条件。", "错误：与参与者忽略方法信息相反。", "错误：否认了文章明确报告的措辞效应。"],
      trap: "Half-right main idea", takeaway: "遇到 but，主旨选项通常需要同时容纳转折两侧。"
    },
    {
      subject: "Literature", skill: "Sentence/Detail Function",
      lead: "A literary scholar places several isolated lines from a novelist's notebooks beside the polished scenes that grew from them.",
      bridge: "The notebook lines are not a miniature plot; instead, they preserve experiments in tone, description, and judgment that the novelist later redistributed among different characters.",
      close: "By quoting the lines before discussing the finished novel, the scholar establishes a record of possibilities against which the author's later choices can be measured.",
      question: "What is the main function of the quoted notebook lines in the text?",
      choices: ["They supply evidence of alternatives the novelist considered before making choices in the finished work.", "They summarize the complete plot of the finished novel in chronological order.", "They prove that every character in the novel speaks in the author's own voice.", "They shift the discussion away from revision and toward the commercial reception of the novel."],
      explanation: "The lines create a baseline of discarded or redistributed possibilities that makes later revision visible.",
      pattern: "Draft fragments → Distinction from plot → Baseline for revision",
      evidence: "a record of possibilities against which the author's later choices can be measured",
      reasoning: "这些引文的作用不是讲完故事，而是提供‘作者曾经可以怎么写’的基线，使成稿中的选择可见。",
      notes: ["正确：说明引文如何服务后续的 revision 分析。", "错误：正文明确说这些片段不是缩略情节。", "错误：片段被分配给不同人物不等于人物都代表作者。", "错误：文章没有讨论市场反响。"],
      trap: "Content summary instead of function", takeaway: "Function 题要回答‘这段材料让作者下一步能够做什么’。"
    },
    {
      subject: "Natural Science", skill: "Textual Evidence",
      lead: "An editor of a scientific review compares claims drawn from several preliminary studies and argues that the review should distinguish observation from explanation.",
      bridge: "Each study reports a concrete result, but none was designed to eliminate every competing mechanism.",
      close: "The editor retains the observations while marking the proposed explanations as provisional.",
      question: "Which additional finding would most directly support the editor's decision?",
      choices: ["Later controlled tests reproduce the observations but identify different mechanisms under different conditions.", "The preliminary studies use technical terms that many general readers find unfamiliar.", "All of the studies were published during the same decade.", "One study contains more observations than the other studies combined."],
      explanation: "Reproduced observations paired with different mechanisms directly support separating what was observed from how it was initially explained.",
      pattern: "Mixed claim types → Design limitation → Observation retained, mechanism qualified",
      evidence: "retains the observations while marking the proposed explanations as provisional",
      reasoning: "要强化编辑的区分，新证据应显示‘结果可重复’但‘机制未固定’；A 正好分别支持这两层。",
      notes: ["正确：直接验证 observation/mechanism 的分离。", "错误：可读性与机制证据无关。", "错误：发表年代不能检验解释。", "错误：数量更多不等于机制更确定。"],
      trap: "Relevant topic, wrong evidentiary link", takeaway: "证据题先明确要补强推理链中的哪一环。"
    },
    {
      subject: "History/Humanities", skill: "Author Purpose",
      lead: "A museum curator juxtaposes labels from several periods to challenge the assumption that catalog language merely records neutral facts.",
      bridge: "Because the labels concern independent objects, their importance lies not in forming one story but in showing how description can guide attention before viewers inspect the evidence themselves.",
      close: "The curator's arrangement turns wording into an object of historical analysis rather than an invisible frame around the objects.",
      question: "What is the curator's main purpose in juxtaposing the labels?",
      choices: ["To make visitors examine how descriptive language can shape interpretation rather than simply transmit neutral information", "To establish that all of the labeled objects were produced in the same workshop", "To replace the objects with labels because wording is always more reliable than material evidence", "To prove that modern catalog writers intentionally falsify every historical fact"],
      explanation: "The display makes the interpretive work of labels visible without claiming that labels replace objects or are always deceptive.",
      pattern: "Neutral-label assumption → Cross-period juxtaposition → Frame made visible",
      evidence: "turns wording into an object of historical analysis",
      reasoning: "并置的目的在于让原本透明的‘描述框架’变得可分析，而不是证明所有标签虚假。",
      notes: ["正确：准确说明展览让观众注意到语言的引导作用。", "错误：不同物件并不来自同一工坊。", "错误：文章没有让文字取代实物。", "错误：把可能的框架效应夸大成蓄意全面造假。"],
      trap: "Moderate purpose exaggerated into accusation", takeaway: "Purpose 题警惕把‘揭示影响’夸大成‘指控欺骗’。"
    },
    {
      subject: "Social Science", skill: "Inferences",
      lead: "A research team asked readers to compare excerpts from unrelated public reports without being told who wrote them.",
      bridge: "Readers agreed more often about each sentence's broad topic than about the institutional goal the sentence served.",
      close: "The result implies that local wording can support basic comprehension while leaving purpose uncertain when source and context are withheld.",
      question: "Which choice most logically follows from the study?",
      choices: ["Understanding what a sentence discusses does not necessarily reveal why an institution included it in a report.", "Readers cannot understand any sentence unless they already know its author's identity.", "Institutional purpose is always encoded in a single word and never depends on context.", "Agreement about a broad topic guarantees agreement about a report's goal."],
      explanation: "Participants recovered topics more consistently than purposes, so topic recognition and purpose identification are separable.",
      pattern: "Context removed → Uneven comprehension → Topic/purpose distinction",
      evidence: "agreed more often about each sentence's broad topic than about the institutional goal",
      reasoning: "同一批读者能抓主题却不能稳定判断目的，因此‘读懂在讲什么’不等于‘读懂为什么写这一句’。",
      notes: ["正确：严格复述结果支持的区分。", "错误：文章说基本理解仍然存在。", "错误：与 purpose 需要来源和语境相反。", "错误：把结果中的差异抹掉。"],
      trap: "Topic comprehension equated with purpose", takeaway: "SAT 阅读要分开 subject、claim 和 rhetorical purpose。"
    },
    {
      subject: "Literature", skill: "Central Ideas and Details",
      lead: "A critic studies several sentences a novelist removed from different chapters, asking whether deletion always signals rejection of the ideas they contain.",
      bridge: "In later drafts, some ideas disappear, but others return through action or imagery rather than direct statement.",
      close: "The critic concludes that revision can change the form of an idea without eliminating its role in the work.",
      question: "Which choice best states the main idea of the text?",
      choices: ["A deleted sentence may represent a change in how an idea is conveyed rather than the complete abandonment of that idea.", "Novelists delete sentences only when they discover that the sentences are factually false.", "Ideas expressed through imagery are necessarily less important than ideas stated directly.", "The later drafts restore every deleted sentence in its original location."],
      explanation: "The passage distinguishes removal of wording from removal of an idea's function.",
      pattern: "Deletion question → Idea traced across forms → Revision reinterpreted",
      evidence: "change the form of an idea without eliminating its role",
      reasoning: "作者追踪的是 idea 而不是原句。措辞消失后，概念可能通过动作或意象继续存在。",
      notes: ["正确：保留 wording/form 与 idea/function 的关键区分。", "错误：虚构了唯一且狭窄的删除原因。", "错误：文章没有建立重要性等级。", "错误：与 ideas return through other forms 相反。"],
      trap: "Form mistaken for function", takeaway: "文学结构题要追踪观念如何换一种形式继续工作。"
    },
    {
      subject: "Natural Science", skill: "Overall Structure",
      lead: "A methods instructor presents excerpts from several field notebooks after students mistake descriptive certainty for experimental certainty.",
      bridge: "The instructor then identifies what each observation directly records and what would require an additional comparison or control.",
      close: "The lesson ends by replacing a vague warning to 'be cautious' with a concrete procedure for locating the boundary between data and inference.",
      question: "Which choice best describes the overall structure of the text?",
      choices: ["It begins with a reasoning error, analyzes examples to locate that error, and derives a practical reading procedure.", "It presents a scientific discovery and then retracts every observation on which the discovery rests.", "It compares field sites in order to rank them from most to least important.", "It argues that descriptive sentences should never appear in scientific writing."],
      explanation: "The passage moves from a student error through guided analysis to a reusable method.",
      pattern: "Reader error → Guided evidence boundary → Transfer procedure",
      evidence: "replacing a vague warning ... with a concrete procedure",
      reasoning: "架构不是介绍某项发现，而是诊断阅读错误并给出可迁移的方法；正确选项必须包含 problem-analysis-procedure。",
      notes: ["正确：完整覆盖问题、分析和方法输出。", "错误：没有撤回观察。", "错误：没有给地点排序。", "错误：文章训练的是区分数据与推断，不是禁用描述。"],
      trap: "Topic label instead of movement", takeaway: "Overall Structure 选项要描述作者动作的顺序，而不是只说文章主题。"
    },
    {
      subject: "History/Humanities", skill: "Sentence/Detail Function",
      lead: "A historian quotes several sharply worded lines from independent petitions before reconstructing the policy debate in which each appeared.",
      bridge: "The quotations initially sound comparable, but the surrounding records reveal that the petitioners sought different remedies from different authorities.",
      close: "The contextual reconstruction prevents verbal similarity from being mistaken for political agreement.",
      question: "What is the main function of the sentence about the petitioners seeking different remedies?",
      choices: ["It supplies contextual evidence that limits an inference based on the petitions' similar tone.", "It proves that the petitions used none of the same vocabulary.", "It introduces a chronological dispute about which petition was written first.", "It shows that every authority granted the remedy requested of it."],
      explanation: "The detail explains why similar rhetoric does not establish a shared political position.",
      pattern: "Surface similarity → Contextual differentiation → Inference blocked",
      evidence: "sought different remedies from different authorities",
      reasoning: "该句的功能是给相似措辞加边界：语气相近，但诉求与对象不同，所以不能推出政治立场一致。",
      notes: ["正确：说明细节限制了哪一个推断。", "错误：文章承认语气相似，并未否认共享词汇。", "错误：没有讨论先后顺序。", "错误：是否获批没有证据。"],
      trap: "Surface similarity treated as substantive agreement", takeaway: "看到相似措辞时，继续检查对象、目的和语境是否也相同。"
    },
    {
      subject: "Social Science", skill: "Textual Evidence",
      lead: "A sociologist argues that confident language in public statements can conceal substantial uncertainty about how representative the underlying cases are.",
      bridge: "The statements offer memorable examples, yet they do not report how the examples were selected from the larger population.",
      close: "The sociologist therefore treats selection information as necessary before generalizing from the statements.",
      question: "Which finding would most directly strengthen the sociologist's argument?",
      choices: ["A later audit finds that the quoted cases were chosen from an unusual subgroup that differs systematically from the wider population.", "Several statements contain words that also appear in private correspondence.", "Readers remember the shortest statement more accurately than the longest one.", "The institutions issued their statements on different days of the week."],
      explanation: "Evidence of a systematically unusual sample directly explains why the memorable cases may not represent the broader population.",
      pattern: "Confident generalization → Missing selection process → Representativeness requirement",
      evidence: "do not report how the examples were selected",
      reasoning: "论证缺口是样本代表性；A 直接显示样本来自异常子群，因此最能强化不能外推的结论。",
      notes: ["正确：正面补上 selection bias 的证据。", "错误：共享词汇不检验代表性。", "错误：记忆度不是样本结构。", "错误：发布日期与选样偏差无关。"],
      trap: "Memorability mistaken for representativeness", takeaway: "遇到从案例推总体，先找样本怎样被选出来。"
    },
    {
      subject: "Literature", skill: "Inferences",
      lead: "A novelist's archive preserves isolated descriptions that never entered the final book, along with marginal notes assigning some descriptions to speakers who were later removed.",
      bridge: "Because the surviving lines belonged to different imagined voices, the editor cautions against treating all of them as the novelist's personal judgments.",
      close: "The archive reveals the range of positions the novel once tested more securely than it reveals which position the novelist endorsed.",
      question: "Which choice most logically follows from the editor's caution?",
      choices: ["Draft language can document possibilities considered during composition without directly establishing the author's own position.", "Every sentence removed from a novel expresses a belief the author later rejected.", "A marginal note reliably proves that a removed speaker was based on a real person.", "The final novel must endorse the position expressed by the longest surviving draft line."],
      explanation: "The different imagined speakers make the archive strong evidence of explored possibilities but weak evidence of personal endorsement.",
      pattern: "Draft survival → Speaker distinction → Endorsement limited",
      evidence: "range of positions ... more securely than ... which position the novelist endorsed",
      reasoning: "材料能证明作者探索过哪些可能性，却不能跨过 speaker 与 author 的距离直接证明立场。",
      notes: ["正确：精确保留 possibility/endorsement 的证据强度差异。", "错误：删除不自动等于思想否定。", "错误：虚构了人物原型证据。", "错误：篇幅不能证明作者认可。"],
      trap: "Speaker-author conflation", takeaway: "文学推断中，角色、叙述者和作者必须分层。"
    }
  ];

  function passageFor(words, blueprint) {
    const ids = words.map(word => word.id);
    const cleanFrame = text => ids.reduce((result, id) => result.replace(headPattern(id), "$1the source material"), text);
    const quotations = words.map(word => `One excerpt reads, “${conciseUsage(word, ids)}”`).join(" ");
    let passage = `${cleanFrame(blueprint.lead)} ${quotations} ${cleanFrame(blueprint.bridge)} ${cleanFrame(blueprint.close)}`;
    if (wordCount(passage) > 150) {
      const compact = words.map(word => conciseUsage({ ...word, example: "" }, ids)).join(" ");
      passage = `${cleanFrame(blueprint.lead)} ${compact} ${cleanFrame(blueprint.bridge)} ${cleanFrame(blueprint.close)}`;
    }
    if (wordCount(passage) < 70) passage += " The distinction matters because readers otherwise risk converting a local observation into a claim broader than the available record supports.";
    return normalize(passage);
  }

  function makeUnit(words, blueprint, group, index) {
    const override = normalize(window.ARCHITECT_PASSAGE_OVERRIDES?.[group]?.[index]);
    let passage = override || passageFor(words, blueprint);
    if (wordCount(passage) < 70) passage = `${passage} That distinction matters because collapsing these evidentiary levels would turn a locally supported observation into a much broader conclusion that the available record does not permit.`;
    if (wordCount(passage) < 70) passage = `${passage} A careful reader must preserve that limit.`;
    if (wordCount(passage) < 70) passage = `${passage} The distinction controls what the evidence can legitimately establish.`;
    while (wordCount(passage) < 70) passage = `${passage} Its scope therefore remains deliberately limited.`;
    return {
      wordIds: words.map(word => word.id), subject: blueprint.subject, domain: blueprint.subject,
      skill: blueprint.skill, difficulty: 4, passage, question: blueprint.question,
      choices: [...blueprint.choices], explanation: blueprint.explanation,
      structure: { pattern: blueprint.pattern, pivot: blueprint.evidence, mainPoint: blueprint.explanation, trap: blueprint.trap },
      analysis: { evidence: blueprint.evidence, reasoning: blueprint.reasoning, choiceNotes: [...blueprint.notes], trap: blueprint.trap, takeaway: blueprint.takeaway },
      provenance: override ? "SAT Reading Architect bespoke passage" : "SAT Reading Architect deterministic completion engine"
    };
  }

  const groups = new Map();
  bank.forEach(word => {
    const group = Number(String(word.group || "").match(/\d+/)?.[0]);
    if (!Number.isFinite(group)) return;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(word);
  });

  groups.forEach((words, group) => {
    if (existing[group] || [1, 2, 25].includes(group)) return;
    const split = semanticSplit(words);
    existing[group] = split.map((part, index) => {
      const blueprint = BLUEPRINTS[(hash(`architect|${group}|${index}`) + group + index * 3) % BLUEPRINTS.length];
      return makeUnit(part, blueprint, group, index);
    });
  });

  window.ARCHITECT_GROUP_READINGS = existing;
})();
