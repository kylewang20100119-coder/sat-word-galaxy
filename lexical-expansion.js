(() => {
  const make = (id, pos, zh, definition, example, collocations, etymology, memory, tier = "GRE Advanced") => ({
    id, pos, phonetic: "", zh, definition, example, collocations, etymology, memory,
    level: 1, group: tier, greTier: tier, source: "GRE synonym network expansion",
    etymologySource: `https://www.etymonline.com/word/${encodeURIComponent(id)}`
  });

  const additions = [
    make("abstemious", "adjective", "有节制的；饮食简朴的", "moderate, especially in eating and drinking", "Despite the lavish banquet, the diplomat remained abstemious.", ["abstemious habits", "an abstemious diet"], "Latin abstemius: ab- ‘away from’ + temetum ‘strong drink’.", "离开烈酒 temetum，便是饮食有节制。"),
    make("adulterate", "verb", "掺杂；使不纯", "to make something poorer in quality by adding another substance", "The supplier was fined for adulterating the medicine with cheap fillers.", ["adulterate a product", "adulterated evidence"], "Latin adulterare, ‘to corrupt or falsify’, related to adulter ‘adulterer’.", "把原本纯正的东西弄假、弄坏，就是 adulterate。"),
    make("assiduous", "adjective", "勤勉的；坚持不懈的", "showing great care, attention, and persistent effort", "Her assiduous archival research overturned the accepted account.", ["assiduous research", "an assiduous student"], "Latin assiduus, from assidere: ad- ‘to’ + sedere ‘sit’—to sit continually at one’s work.", "一直 sit 在任务旁，就是持续勤勉。", "GRE Core"),
    make("benighted", "adjective", "愚昧的；落后的", "lacking knowledge, education, or moral understanding", "The essay rejects the benighted belief that scientific progress is automatic.", ["benighted attitude", "benighted era"], "Old English compound be- + night; figuratively, left in intellectual darkness.", "被困在 night 的黑暗里，引申为愚昧无知。"),
    make("canny", "adjective", "精明谨慎的；善于判断的", "shrewd, careful, and showing good judgment", "A canny negotiator secured safeguards without provoking opposition.", ["canny investor", "canny decision"], "Scots canny, from can ‘know’; originally ‘knowing, prudent’.", "can 表示 know：真正知道门道的人精明谨慎。", "GRE Core"),
    make("concurrent", "adjective", "同时发生的；并行的", "existing, happening, or operating at the same time", "The archive records concurrent changes in trade and migration.", ["concurrent events", "run concurrently"], "Latin concurrere: con- ‘together’ + currere ‘run’—to run together.", "两件事一起 run，所以同时并行发生。", "GRE Core"),
    make("concomitant", "adjective / noun", "伴随的；伴随物", "naturally accompanying or associated with something", "Rapid urban growth brought a concomitant increase in water demand.", ["concomitant change", "a concomitant of"], "Latin concomitari: con- ‘together’ + comitari ‘accompany’, from comes ‘companion’.", "共同 companion 一路相伴，所以是伴随发生的。"),
    make("cupidity", "noun", "贪财；贪婪", "greed for money or possessions", "The regulation was designed to restrain corporate cupidity.", ["corporate cupidity", "driven by cupidity"], "Latin cupiditas ‘desire’, from cupidus ‘eagerly desirous’.", "Cupid 代表欲望；欲望指向金钱时就是贪婪。"),
    make("disabuse", "verb", "纠正错误观念；使醒悟", "to free someone from a mistaken belief", "The new evidence disabused historians of a comforting myth.", ["disabuse someone of", "quickly disabuse"], "French désabuser: dés- ‘away’ + abuser ‘mislead’.", "把 abuse 造成的错误想法拿走，就是使醒悟。", "GRE Core"),
    make("eclectic", "adjective", "兼收并蓄的；多元选择的", "deriving ideas or style from a broad range of sources", "The critic’s eclectic method combines archival and statistical evidence.", ["eclectic approach", "eclectic collection"], "Greek eklektikos ‘selective’, from eklegein ‘pick out’.", "从多处 pick out 最合适的部分，形成兼收并蓄。", "GRE Core"),
    make("efficacious", "adjective", "有效的；奏效的", "successful in producing the intended result", "The treatment was efficacious only when administered early.", ["efficacious treatment", "highly efficacious"], "Latin efficax ‘effective’, from efficere: ex- ‘out’ + facere ‘make, do’.", "真正把结果 make 出来，才叫有效。", "GRE Core"),
    make("enervate", "verb", "使衰弱；削弱活力", "to cause someone or something to feel drained of energy", "Endless procedural delays enervated the reform movement.", ["enervate opposition", "politically enervated"], "Latin enervare: e- ‘out’ + nervus ‘sinew, strength’—to remove the strength.", "把 nerve/力量抽走，所以不是 energize，而是削弱。"),
    make("erudite", "adjective", "博学的；学识渊博的", "having or showing extensive scholarly knowledge", "Her erudite commentary clarifies the poem without flattening its ambiguity.", ["erudite scholar", "erudite analysis"], "Latin eruditus: e- ‘out’ + rudis ‘rough, untrained’—trained out of ignorance.", "从 rudis 的粗糙无知中走出来，就是博学。", "GRE Core"),
    make("extant", "adjective", "现存的；尚存的", "still existing, especially when very old", "Only three extant manuscripts preserve the original ending.", ["extant records", "oldest extant"], "Latin exstare ‘stand out, remain in existence’: ex- + stare ‘stand’.", "经历时间仍 stand 着，所以仍然现存。", "GRE Core"),
    make("fervid", "adjective", "热烈的；炽热的", "intensely enthusiastic or passionate", "The candidate’s fervid rhetoric energized supporters but alienated moderates.", ["fervid support", "fervid imagination"], "Latin fervidus ‘boiling, glowing’, from fervere ‘to boil’.", "情绪像水 boiling 一样炽热。"),
    make("flout", "verb", "公然蔑视；无视", "to openly disregard a rule, convention, or authority", "The company repeatedly flouted safety regulations.", ["flout the law", "openly flout"], "Probably from Middle Dutch fluiten ‘whistle, jeer’; not from Latin.", "吹口哨嘲弄规则，联想为公然无视。", "GRE Core"),
    make("foment", "verb", "煽动；助长", "to instigate or encourage trouble or unrest", "False reports fomented distrust between the communities.", ["foment unrest", "foment rebellion"], "Latin fomentum ‘warm application’, from fovere ‘to warm, cherish’; later ‘encourage’.", "给火持续加温，便是助长、煽动。"),
    make("fractious", "adjective", "易怒难管的；不合作的", "irritable, unruly, and difficult to control", "The coalition became fractious as the deadline approached.", ["fractious debate", "fractious child"], "Latin frangere ‘break’; via obsolete fraction ‘discord’.", "关系像被 break 一样破裂，于是争吵且难管。"),
    make("garrulous", "adjective", "喋喋不休的；话多的", "excessively talkative, especially about trivial matters", "The garrulous witness buried the relevant detail in anecdotes.", ["garrulous host", "garrulous account"], "Latin garrulus ‘talkative’, from garrire ‘chatter’.", "garr- 模仿 chatter 的连续声响，记作话多。"),
    make("hackneyed", "adjective", "陈腐的；老生常谈的", "overused and therefore lacking freshness or meaning", "The novelist revitalizes what could have been a hackneyed plot.", ["hackneyed phrase", "hackneyed idea"], "From hackney, a horse for ordinary hire; figuratively, worn out by common use.", "租用马被反复使用到磨损，引申为陈词滥调。"),
    make("incisive", "adjective", "尖锐透彻的；切中要害的", "clear, direct, and intelligently analytical", "Her incisive question exposed the model’s hidden assumption.", ["incisive analysis", "incisive critique"], "Medieval Latin incisivus, from incidere ‘cut into’: in- + caedere ‘cut’.", "像刀 cut into 一样切入论点核心。", "GRE Core"),
    make("inveterate", "adjective", "根深蒂固的；积习已久的", "long-established and unlikely to change", "An inveterate skeptic, he demanded unusually strong evidence.", ["inveterate habit", "inveterate critic"], "Latin inveteratus ‘made old’, from vetus ‘old’.", "已经 old 了很久，习惯自然根深蒂固。"),
    make("irascible", "adjective", "易怒的；脾气暴躁的", "having a tendency to become angry easily", "The irascible editor treated minor revisions as personal attacks.", ["irascible temper", "irascible critic"], "Latin irascibilis, from irasci ‘become angry’, from ira ‘anger’.", "ira 就是 anger；容易进入 anger 状态就是易怒。"),
    make("laudable", "adjective", "值得赞扬的", "deserving praise and commendation", "The study’s transparency is laudable even though its sample is small.", ["laudable goal", "laudable effort"], "Latin laudabilis, from laudare ‘to praise’, from laus ‘praise’.", "laud 是赞扬，-able 是值得：值得赞扬。", "GRE Core"),
    make("mendacity", "noun", "虚假；撒谎倾向", "untruthfulness or a tendency to lie", "The memoir’s factual errors reflect carelessness rather than mendacity.", ["political mendacity", "a history of mendacity"], "Latin mendacitas, from mendax ‘lying, false’.", "mendax 表 false；mendacity 就是虚假说谎。"),
    make("pellucid", "adjective", "清澈的；表达清晰的", "transparently clear in style or meaning", "The author gives a pellucid account of a difficult theory.", ["pellucid prose", "pellucid explanation"], "Latin pellucidus, from per- ‘through’ + lucere ‘shine’.", "光 luc 穿过 per，水清、文章也清晰。"),
    make("perfidious", "adjective", "背信弃义的；不忠的", "deceitful and untrustworthy", "The treaty failed after a perfidious ally disclosed the plan.", ["perfidious ally", "perfidious conduct"], "Latin perfidiosus, from perfidia ‘faithlessness’: per- + fides ‘faith’.", "把 faith 彻底破坏，就是背信弃义。"),
    make("prolix", "adjective", "冗长啰嗦的", "using too many words and therefore tedious", "A prolix introduction obscured the article’s original claim.", ["prolix style", "prolix account"], "Latin prolixus ‘extended’, literally ‘flowing forth’.", "文字不断 flow forth，延伸过头便是冗长。"),
    make("propitiate", "verb", "安抚；讨好以消除怒气", "to win or regain favor by appeasing someone", "The minister tried to propitiate critics with a limited concession.", ["propitiate critics", "attempt to propitiate"], "Latin propitiare ‘render favorable’, from propitius ‘favorable’.", "把对方变回 favorable，就是安抚取悦。"),
    make("pugnacious", "adjective", "好斗的；爱争吵的", "eager or quick to argue, quarrel, or fight", "The pugnacious commentator turned every disagreement into a contest.", ["pugnacious tone", "pugnacious opponent"], "Latin pugnax, from pugnare ‘fight’, from pugnus ‘fist’.", "pugnus 是 fist，挥拳般好斗。"),
    make("sedulous", "adjective", "勤奋专注的；孜孜不倦的", "showing dedication and careful persistence", "Through sedulous revision, the researcher eliminated several ambiguities.", ["sedulous attention", "sedulous effort"], "Latin sedulus ‘attentive, painstaking’, probably ‘without guile’.", "把心思老老实实全放在任务上，就是勤奋专注。"),
    make("surreptitious", "adjective", "秘密进行的；偷偷摸摸的", "kept secret because it would not be approved", "The team made a surreptitious copy of the endangered archive.", ["surreptitious glance", "surreptitious activity"], "Latin surrepticius, from surripere ‘seize secretly’: sub- + rapere ‘snatch’.", "从下面偷偷 snatch 走，所以是秘密进行。"),
    make("tractable", "adjective", "易处理的；温顺的", "easy to control, influence, or deal with", "Dividing the problem into smaller parts made it tractable.", ["tractable problem", "politically tractable"], "Latin tractabilis ‘manageable’, from tractare ‘handle’, ultimately trahere ‘pull’.", "能被手 handle、牵引，所以容易处理。", "GRE Core"),
    make("vapid", "adjective", "乏味的；无生气的", "offering nothing stimulating or challenging", "The adaptation reduced a complex satire to vapid entertainment.", ["vapid conversation", "vapid remark"], "Latin vapidus ‘flat-tasting, lacking flavor’.", "饮料走味变 flat，文章或谈话就乏味空洞。"),
    make("venal", "adjective", "贪赃枉法的；可收买的", "open to bribery or improperly influenced by money", "The investigation exposed a network of venal officials.", ["venal politician", "venal motive"], "Latin venalis ‘for sale’, from venum ‘sale’.", "人格也 marked for sale，便是可被金钱收买。"),
    make("veracious", "adjective", "诚实的；真实准确的", "speaking or representing the truth", "The biography is vivid, but scholars dispute whether it is veracious.", ["veracious account", "veracious witness"], "Latin verax, from verus ‘true’.", "ver- 是 true：veracity、verify 都围绕真实。"),
    make("vitriolic", "adjective", "刻薄恶毒的；尖酸的", "filled with bitter criticism or malice", "The debate deteriorated into vitriolic personal attacks.", ["vitriolic attack", "vitriolic rhetoric"], "From vitriol ‘sulfuric acid’, ultimately Latin vitriolum ‘glass-like substance’.", "言辞像 sulfuric acid 一样有腐蚀性。"),
    make("wizened", "adjective", "干瘪皱缩的；苍老的", "shrunken and wrinkled, often with age", "The wizened seeds revived after an unexpected rain.", ["wizened face", "wizened old man"], "Old English wisnian ‘wither, dry up’; Germanic, not Latin.", "像植物 wither 干缩，便是皱缩苍老。")
  ];

  const existing = new Set((window.GRE_WORDS || []).map(word => word.id));
  window.GRE_WORDS = [...(window.GRE_WORDS || []), ...additions.filter(word => !existing.has(word.id))];
  window.GRE_INDEX = [...new Set([...(window.GRE_INDEX || []), ...additions.map(word => word.id)])];
  window.GRE_META = { ...(window.GRE_META || {}), ...Object.fromEntries(additions.map(word => [word.id, { tier: word.greTier }])) };

  const syn = (a, b, strength = .82) => [a, b, "synonym", strength];
  const ant = (a, b, strength = .82) => [a, b, "antonym", strength];
  const ety = (a, b, strength = .9) => [a, b, "etymology", strength];
  window.GRE_RELATIONS = [...(window.GRE_RELATIONS || []),
    syn("abstemious", "temperate", .91), syn("abstemious", "ascetic", .76),
    syn("adulterate", "debase", .82), ant("adulterate", "purify", .86),
    syn("assiduous", "diligent", .94), syn("assiduous", "industrious", .85), ant("assiduous", "indolent", .94),
    ant("benighted", "erudite", .88),
    syn("canny", "astute", .92), ant("canny", "naive", .86),
    syn("concurrent", "concomitant", .83), ant("concurrent", "successive", .80),
    syn("cupidity", "avarice", .94), ant("cupidity", "generosity", .79),
    syn("disabuse", "enlighten", .83), ant("disabuse", "mislead", .87),
    syn("eclectic", "diverse", .80), ant("eclectic", "homogeneous", .74),
    syn("efficacious", "effective", .93), ant("efficacious", "futile", .84),
    syn("enervate", "debilitate", .90), ant("enervate", "invigorate", .94),
    ant("erudite", "benighted", .88),
    ant("extant", "obsolete", .76),
    syn("fervid", "fervent", .94), ant("fervid", "apathetic", .84),
    syn("flout", "defy", .91), ant("flout", "comply", .90),
    syn("foment", "agitate", .82), ant("foment", "suppress", .86),
    syn("fractious", "contentious", .86), ant("fractious", "amenable", .82),
    syn("garrulous", "loquacious", .95), ant("garrulous", "taciturn", .94),
    syn("hackneyed", "trite", .96), ant("hackneyed", "novel", .82),
    syn("incisive", "trenchant", .93), ant("incisive", "vague", .78),
    syn("inveterate", "entrenched", .90), ant("inveterate", "transient", .73),
    syn("irascible", "choleric", .93), ant("irascible", "placid", .88),
    syn("laudable", "commendable", .95), ant("laudable", "reprehensible", .84),
    syn("mendacity", "dishonesty", .94), ant("mendacity", "veracity", .95),
    syn("pellucid", "lucid", .95), ant("pellucid", "opaque", .93),
    syn("perfidious", "treacherous", .94), ant("perfidious", "loyal", .89),
    syn("prolix", "verbose", .96), ant("prolix", "laconic", .94),
    syn("propitiate", "appease", .93), ant("propitiate", "provoke", .84),
    syn("pugnacious", "bellicose", .94), ant("pugnacious", "peaceable", .82),
    syn("sedulous", "assiduous", .95), ant("sedulous", "sluggish", .85),
    syn("surreptitious", "clandestine", .94), ant("surreptitious", "overt", .91),
    syn("tractable", "amenable", .90), ant("tractable", "recalcitrant", .94),
    syn("vapid", "insipid", .95), ant("vapid", "stimulating", .81),
    ant("venal", "integrity", .82), ant("venal", "probity", .87),
    syn("veracious", "truthful", .96), ant("veracious", "mendacious", .94),
    syn("vitriolic", "scathing", .91), ant("vitriolic", "conciliatory", .85),
    syn("wizened", "decrepit", .76), syn("wizened", "frail", .72),
    ety("assiduous", "sedentary", .72), ety("pellucid", "lucid", .96), ety("pellucid", "elucidate", .92),
    ety("tractable", "attract", .90), ety("veracious", "veracity", .97), ety("fervid", "fervent", .97),
    ety("laudable", "laud", .98), ety("mendacity", "mendacious", .98), ety("pugnacious", "pugnacity", .98)
  ];

  window.LEXICAL_FAMILIES = [
    { root: "Latin verus · true", members: [["veracious", "诚实的；真实准确的"], ["veracity", "真实性；诚实"], ["verify", "核实；证明为真"], ["verdict", "裁决；字面为‘说出真相’"], ["verisimilitude", "逼真；貌似真实"]] },
    { root: "Latin lucere / lux · shine / light", members: [["pellucid", "清澈的；表达清晰的"], ["lucid", "清楚易懂的"], ["elucidate", "阐明；使清楚"], ["translucent", "半透明的"], ["luminous", "发光的；清晰有力的"]] },
    { root: "Latin trahere / tractus · pull / handle", members: [["tractable", "易处理的；温顺的"], ["attract", "吸引；拉向"], ["distract", "使分心；拉开注意力"], ["extract", "提取；拉出来"], ["intractable", "难处理的"]] },
    { root: "Latin sedere · sit", members: [["assiduous", "勤勉的；一直坐在任务旁"], ["sedentary", "久坐的"], ["reside", "居住；坐留在某处"], ["preside", "主持；坐在前面"], ["dissident", "持不同意见者；坐在分离一边"]] },
    { root: "Latin laus / laudare · praise", members: [["laudable", "值得赞扬的"], ["laud", "赞扬"], ["applaud", "鼓掌赞扬"], ["laudatory", "赞美的"]] },
    { root: "Latin pugnus / pugnare · fist / fight", members: [["pugnacious", "好斗的"], ["pugnacity", "好斗性"], ["impugn", "质疑；攻击真实性"], ["repugnant", "令人厌恶的；相抗拒的"]] },
    { root: "Latin fides · faith / trust", members: [["perfidious", "背信弃义的"], ["fidelity", "忠诚；保真度"], ["confide", "信任地吐露"], ["confidence", "信心；信任"], ["diffident", "缺乏自信的"]] },
    { root: "Latin facere / efficere · make / accomplish", members: [["efficacious", "有效的"], ["effect", "结果；效果"], ["efficient", "高效的"], ["facilitate", "促进；使容易"], ["deficient", "不足的"]] },
    { root: "Latin nervus · sinew / strength", members: [["enervate", "使衰弱；抽走力量"], ["nerve", "神经；勇气"], ["nervous", "紧张的；神经的"], ["invigorate", "使有活力（语义反向记忆）"]] },
    { root: "Latin mendax · lying", members: [["mendacity", "虚假；撒谎倾向"], ["mendacious", "说谎的；虚假的"], ["mendaciously", "虚假地"]] },
    { root: "Latin rapere · seize / snatch", members: [["surreptitious", "秘密进行的；暗中夺取"], ["rapacious", "贪婪掠夺的"], ["rapture", "狂喜；被情绪攫住"], ["ravish", "强夺；使着迷"]] },
    { root: "Latin frangere / fractus · break", members: [["fractious", "易怒难管的"], ["fracture", "断裂"], ["fragment", "碎片"], ["refract", "折射；使弯折"], ["fragile", "易碎的"]] },
    { root: "Latin fervere · boil", members: [["fervid", "热烈的；炽热的"], ["fervent", "热诚的"], ["fervor", "热情"], ["effervescent", "冒泡的；活泼的"]] },
    { root: "Latin vetus · old", members: [["inveterate", "根深蒂固的；积习已久的"], ["veteran", "老手；退伍军人"], ["veterinary", "兽医的（历史词源同支）"]] },
    { root: "Greek eklegein · select", members: [["eclectic", "兼收并蓄的"], ["elect", "选举；选择"], ["eligible", "符合被选择资格的"], ["selection", "选择"]] },
    { root: "Latin stare · stand", members: [["extant", "仍然现存的"], ["stand", "站立"], ["stable", "稳定的"], ["constant", "持续不变的"], ["stance", "立场；站姿"]] },
    { root: "Latin caedere / incisus · cut", members: [["incisive", "尖锐透彻的"], ["incision", "切口"], ["concise", "简洁的；像被剪短"], ["precise", "精确的；切定边界"], ["decide", "决定；切断其他选择"]] },
    { root: "Latin cupidus · desirous", members: [["cupidity", "贪婪"], ["Cupid", "爱神；欲望的象征"], ["covet", "贪求"], ["concupiscence", "强烈欲望"]] },
    { root: "Latin ira · anger", members: [["irascible", "易怒的"], ["ire", "愤怒"], ["irate", "愤怒的"]] },
    { root: "Latin pro + laxus · flowing forth", members: [["prolix", "冗长的"], ["prolixity", "冗长"], ["lax", "松弛的；不严格的"], ["relax", "放松"]] }
  ];

  const etymologyOverrides = {
    undaunted: "Old French danter ‘to subdue or tame’, ultimately Latin domitare, with English un- ‘not’: not subdued by fear.",
    labyrinthine: "Greek labyrinthos ‘maze’ + English -ine: maze-like in form or complexity.",
    downcast: "Transparent English compound down + cast; eyes cast downward suggested dejection.",
    "hew to": "Old English heawan ‘cut, strike’; the later phrase hew to means to cut closely to a line, hence adhere strictly.",
    insecticide: "Latin insectum ‘insect’ + -cida, from caedere ‘kill’: an insect-killing substance.",
    "pit against": "From English pit ‘set animals to fight in a pit’; hence set one person or force against another.",
    uplift: "Transparent English formation up + lift; literal raising developed the figurative sense ‘improve or inspire’.",
    bedrock: "English bed + rock: the solid rock lying beneath soil, later a metaphor for a fundamental principle.",
    parsimonious: "Latin parsimonia ‘frugality, thrift’, from parcere ‘to spare’; later often negatively ‘stingy’.",
    appeasement: "Old French apaisier, from a- ‘to’ + pais ‘peace’, ultimately Latin pax: the act of bringing to peace.",
    introverted: "Modern Latin introvertere: intro ‘inward’ + vertere ‘turn’: turned inward.",
    disingenuous: "Latin dis- ‘not, apart’ + ingenuus ‘freeborn, frank, sincere’: not candid or sincere.",
    bygone: "English phrase by + gone, literally ‘gone by’; therefore belonging to an earlier time.",
    larval: "Latin larva ‘ghost, mask’, later the immature form of an insect + -al.",
    unequivocal: "English un- ‘not’ + Latin aequivocus: aequus ‘equal’ + vox ‘voice’; not having two equal meanings.",
    acquiescence: "Latin acquiescere: ad- ‘to’ + quiescere ‘become quiet, rest’; acceptance without protest.",
    painstaking: "English pains + taking: taking pains, or making careful effort.",
    overthrow: "Old English over + throw; literally throw over, then remove forcibly from power.",
    manipulative: "Latin manipulus ‘handful’ and later French manipuler ‘handle’; figuratively controlling people as if by hand.",
    thrifty: "From English thrift, originally ‘prosperity’, from thrive; careful use of resources came later.",
    incongruity: "Latin incongruitas: in- ‘not’ + congruere ‘agree, correspond’; lack of agreement or fit.",
    hysterical: "Greek hystera ‘womb’ through an obsolete medical theory; modern use means emotionally uncontrolled and is not gender-specific.",
    assortment: "French assortir ‘match, classify’, from a- + sorte ‘kind’; a collection arranged by kinds.",
    complimentary: "From compliment, via Italian complimento ‘fulfillment of courtesy’; expressing praise. Distinguish complementary, from complete.",
    counterargument: "Latin contra ‘against’ + argumentum ‘evidence, proof’: an argument set against another.",
    ravishing: "Old French ravir ‘seize, carry away’, from Latin rapere; figuratively, beauty that carries one away.",
    judgmental: "From judge, Latin judex: jus ‘law, right’ + dicere ‘say’; inclined to pronounce judgment.",
    deflationary: "Latin de- ‘down, away’ + flare ‘blow’; deflate literally lets air out, then reduces prices or activity.",
    outset: "English out + set; the act of setting out, hence the beginning.",
    outspoken: "English out + spoken: speech brought openly out rather than held back.",
    "hands-on": "Modern English compound hands + on: involving direct practical participation.",
    staggering: "From stagger, probably Old Norse; something so astonishing that it figuratively makes one reel.",
    bystander: "English by + stand + -er: one who stands nearby without taking part.",
    detrimental: "Latin detrimentum ‘loss, damage’, from deterere ‘wear away’: causing harm.",
    personification: "Latin persona ‘character, mask’ + facere ‘make’: making an idea into a person-like figure.",
    longitudinal: "Latin longitudo ‘length’, from longus ‘long’: extending lengthwise.",
    upturn: "English up + turn: a turn upward, especially an improvement in a trend.",
    whimsical: "From whim-wham ‘a fanciful object or notion’, probably Scandinavian in origin; playfully unpredictable.",
    underpinning: "English under + pin: a support fixed beneath something, then a foundational idea.",
    pollyannaish: "From Pollyanna, the excessively optimistic heroine of Eleanor H. Porter’s 1913 novel, + -ish. This is an eponym, not a Latin formation."
  };
  window.getLexicalEtymology = word => {
    const current = String(word?.etymology || "");
    if (current && !current.includes("词典未提供独立词源")) return current;
    if (etymologyOverrides[word?.id]) return etymologyOverrides[word.id];
    const id = String(word?.id || "").toLowerCase();
    const prefixRows = [
      ["counter", "Latin contra, via French contre- ‘against’"], ["under", "Old English under ‘beneath’"], ["over", "Old English ofer ‘above, beyond’"],
      ["inter", "Latin inter- ‘between’"], ["trans", "Latin trans- ‘across’"], ["super", "Latin super- ‘above’"], ["sub", "Latin sub- ‘under’"],
      ["anti", "Greek anti- ‘against’"], ["non", "Latin non- ‘not’"], ["un", "Old English un- ‘not’"],
      ["out", "Old English ut ‘out’"], ["up", "Old English up ‘upward’"], ["down", "Old English dun ‘down’"]
    ];
    const suffixRows = [
      ["ization", "Greek -ize + Latin -ation, forming an action noun"], ["ification", "Latin facere ‘make’ + -ation"], ["tion", "Latin/French -tion, forming an action or result noun"],
      ["ment", "Latin/French -ment, forming a result or process noun"], ["ness", "Old English -ness, forming a state or quality noun"],
      ["ity", "Latin -itas, forming a quality noun"], ["ous", "Latin/French -ous, ‘full of or characterized by’"], ["ive", "Latin -ivus, adjective-forming"],
      ["able", "Latin/French -able, ‘capable of’"], ["ible", "Latin -ibilis, ‘capable of’"], ["less", "Old English -leas, ‘without’"],
      ["ful", "Old English -full, ‘full of’"], ["ward", "Old English -weard, indicating direction"], ["ize", "Greek -izein, verb-forming"]
    ];
    const prefix = prefixRows.find(([form]) => id.startsWith(form) && id.length > form.length + 3);
    const suffix = suffixRows.find(([form]) => id.endsWith(form) && id.length > form.length + 3);
    if (prefix || suffix) {
      const pieces = [prefix?.[1], suffix?.[1]].filter(Boolean).join("; ");
      return `Transparent word-formation clue: ${pieces}. The remaining stem is “${id.slice(prefix?.[0]?.length || 0, suffix ? -suffix[0].length : undefined)}”; its entry-specific historical path still needs separate verification.`;
    }
    return "当前尚无足够可靠的独立词源记录；不强行编造拉丁词根，先通过同义/反义网络和例句记忆，待词源核对后补充。";
  };
})();
