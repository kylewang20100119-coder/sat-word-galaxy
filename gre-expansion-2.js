(() => {
  const make = (id, pos, phonetic, zh, definition, example, collocations, etymology, memory) => ({
    id, pos, phonetic, zh, definition, example, collocations, etymology, memory,
    level: 1, group: "GRE Advanced", greTier: "GRE Advanced", source: "GRE high-value semantic expansion"
  });

  const additions = [
    make("abeyance", "noun", "/əˈbeɪəns/", "暂缓；中止状态", "a temporary state of suspension or inactivity", "The disputed regulation was held in abeyance while the court reviewed it.", ["hold in abeyance", "remain in abeyance"], "Anglo-French abeiance, from Old French abeer, ‘to gape or wait expectantly’; not a Latin formation.", "事情张着口等待结果，先悬在那里，就是 in abeyance。"),
    make("abscond", "verb", "/əbˈskɑːnd/", "潜逃；携款逃走", "to leave secretly and hurriedly, especially to avoid arrest", "The treasurer absconded before auditors discovered the missing funds.", ["abscond with funds", "abscond from custody"], "Latin abscondere: abs- ‘away’ + condere ‘hide or store’.", "abs- 离开 + condere 藏：藏起来并逃走。"),
    make("adumbrate", "verb", "/ˈædəmˌbreɪt/", "预示；勾勒轮廓", "to foreshadow or describe something only in outline", "The opening image adumbrates the conflict that dominates the final chapter.", ["adumbrate a theory", "adumbrate later events"], "Latin adumbrare: ad- ‘toward’ + umbra ‘shadow’—to sketch in shadow.", "先画出 umbra 阴影，轮廓出现，也预示后文。"),
    make("apoplectic", "adjective", "/ˌæpəˈplektɪk/", "暴怒的；中风相关的", "overcome with extreme anger; historically, relating to stroke", "The editor was apoplectic when the fabricated quotation reached print.", ["apoplectic with rage", "an apoplectic reaction"], "Greek apoplektikos, from apoplessein ‘strike down’: apo- ‘away’ + plessein ‘strike’.", "愤怒像被突然 strike down 一样猛烈。"),
    make("aporia", "noun", "/əˈpɔːriə/", "困惑；逻辑上的疑难", "an irresolvable contradiction, doubt, or impasse in reasoning", "The essay ends in aporia, unable to reconcile freedom with prediction.", ["rhetorical aporia", "end in aporia"], "Greek aporia: a- ‘without’ + poros ‘passage or way’.", "没有 passage 可走，思想卡在疑难里。"),
    make("apprise", "verb", "/əˈpraɪz/", "告知；通知", "to inform someone about a situation or fact", "The committee apprised residents of the revised timetable.", ["apprise someone of", "keep someone apprised"], "French appris, from apprendre ‘learn or inform’, ultimately linked to Latin apprehendere ‘grasp’.", "让对方 grasp 抓住信息，就是正式告知。"),
    make("asperse", "verb", "/əˈspɜːrs/", "诽谤；中伤", "to attack someone’s reputation with harmful accusations", "The pamphlet aspersed the scientist without addressing her evidence.", ["asperse a reputation", "asperse someone’s motives"], "Latin aspergere: ad- ‘upon’ + spargere ‘scatter or sprinkle’.", "把污点像水滴一样 scatter 到别人身上，就是中伤。"),
    make("bombastic", "adjective", "/bɑːmˈbæstɪk/", "浮夸空洞的；言辞夸张的", "high-sounding but with little real meaning", "The proposal’s bombastic language concealed its lack of evidence.", ["bombastic rhetoric", "bombastic style"], "From bombast ‘cotton padding’, via Medieval Latin bombax ‘cotton’ and Greek bombyx.", "用棉花 padding 把句子塞得鼓鼓的，却没有内容。"),
    make("captious", "adjective", "/ˈkæpʃəs/", "吹毛求疵的；故意挑错的", "inclined to find fault or raise petty objections", "A captious reviewer focused on punctuation while ignoring the argument.", ["captious critic", "captious objection"], "Latin captiosus ‘fallacious, fault-finding’, from captio ‘a catching or trap’.", "总想 catch 别人的小漏洞，所以吹毛求疵。"),
    make("contumacious", "adjective", "/ˌkɑːntʊˈmeɪʃəs/", "抗命的；顽固不服从的", "stubbornly disobedient to authority", "The contumacious official ignored three lawful orders.", ["contumacious conduct", "contumacious refusal"], "Latin contumax ‘unyielding or insolent’, source of contumacy.", "contumax 是顽固不屈服：面对命令仍拒绝服从。"),
    make("diaphanous", "adjective", "/daɪˈæfənəs/", "轻薄透明的；精致飘逸的", "light, delicate, and almost transparent", "A diaphanous membrane allowed light to reach the sensor.", ["diaphanous fabric", "diaphanous layer"], "Greek diaphanes: dia- ‘through’ + phainein ‘show’.", "光能 through 并 show 出后面的东西，所以轻薄透明。"),
    make("exigent", "adjective", "/ˈeksɪdʒənt/", "紧迫的；要求苛刻的", "pressing, urgent, or demanding immediate attention", "Exigent circumstances forced the researchers to alter the protocol.", ["exigent circumstances", "exigent demand"], "Latin exigere ‘drive out, demand, measure’: ex- ‘out’ + agere ‘drive’.", "把行动 drive 出来，不容拖延，就是紧迫。"),
    make("expiate", "verb", "/ˈekspieɪt/", "赎罪；补偿过错", "to make amends for guilt or wrongdoing", "He funded the restoration partly to expiate his role in the demolition.", ["expiate guilt", "expiate a crime"], "Latin expiare ‘purify or atone for’, from ex- + piare ‘appease by sacred rites’.", "通过仪式把罪过清出去，联想为赎罪补偿。"),
    make("expostulate", "verb", "/ɪkˈspɑːstʃəleɪt/", "严正劝诫；强烈反对", "to express strong disagreement or disapproval", "Residents expostulated with officials over the abrupt closure.", ["expostulate with someone", "expostulate about a decision"], "Latin expostulare ‘demand urgently or remonstrate’.", "把 objection 强烈 post 出来，记作严正反对。"),
    make("fatuous", "adjective", "/ˈfætʃuəs/", "愚蠢空洞的；自鸣得意的", "silly, pointless, and often smugly unaware", "The critic dismissed the claim as fatuous because it ignored contrary data.", ["fatuous remark", "fatuous optimism"], "Latin fatuus ‘foolish, insipid’.", "fatuus 就是 foolish；看似自信，内容却空洞。"),
    make("fulminate", "verb", "/ˈfʊlmɪneɪt/", "猛烈抨击；怒斥", "to denounce something loudly and forcefully", "The columnist fulminated against the policy without proposing an alternative.", ["fulminate against", "fulminate over"], "Latin fulminare ‘strike with lightning’, from fulmen ‘thunderbolt’.", "批评像 thunderbolt 雷霆劈下，就是猛烈抨击。"),
    make("legerdemain", "noun", "/ˌledʒərdəˈmeɪn/", "戏法；障眼法；欺骗手段", "skillful deception or sleight of hand", "Statistical legerdemain made a minor change appear transformative.", ["financial legerdemain", "verbal legerdemain"], "French léger de main, literally ‘light of hand’.", "手 main 很轻很快，看不清动作，便成了障眼法。"),
    make("limn", "verb", "/lɪm/", "描绘；勾画；生动描述", "to depict or describe clearly and vividly", "The biography limns a leader whose caution was often mistaken for weakness.", ["limn a portrait", "limn the contours of"], "From Middle English luminen ‘illuminate a manuscript’, ultimately Latin illuminare.", "最初给手稿 illuminate 上色，后来就是描绘。"),
    make("machination", "noun", "/ˌmækəˈneɪʃən/", "阴谋；诡计", "a crafty scheme designed to achieve a hidden end", "The reform survived the machinations of officials who benefited from delay.", ["political machinations", "secret machination"], "Latin machinatio, from machinari ‘contrive or plot’, related to machina ‘machine’.", "像设计 machine 一样精密设计暗中计划，就是阴谋。"),
    make("mendacious", "adjective", "/menˈdeɪʃəs/", "撒谎的；虚假的", "not truthful; characterized by deliberate falsehood", "The witness’s mendacious account collapsed under cross-examination.", ["mendacious claim", "mendacious witness"], "Latin mendax, mendac- ‘lying or false’.", "mendax 表示 false；mendacious 就是习惯性说假话。"),
    make("obloquy", "noun", "/ˈɑːbləkwi/", "公开谴责；恶名", "strong public criticism or the disgrace it produces", "The failed commander endured years of obloquy before new evidence emerged.", ["public obloquy", "heap obloquy on"], "Latin obloqui: ob- ‘against’ + loqui ‘speak’.", "所有人 speak against 你，便是公开谴责与恶名。"),
    make("parsimony", "noun", "/ˈpɑːrsəmoʊni/", "吝啬；过度节俭", "extreme unwillingness to spend money or use resources", "Budgetary parsimony left the archive unable to preserve fragile documents.", ["fiscal parsimony", "extreme parsimony"], "Latin parsimonia ‘thrift’, from parcere ‘spare or save’.", "一味 spare 不肯使用资源，节俭就变成吝啬。"),
    make("quiescence", "noun", "/kwiˈesəns/", "静止；沉寂；休眠", "a state of inactivity, stillness, or dormancy", "After decades of quiescence, the volcano began releasing gas again.", ["period of quiescence", "cellular quiescence"], "Latin quiescere ‘become quiet or rest’, from quies ‘rest’.", "quiet 与 quies 同源：进入安静不活动的状态。"),
    make("refulgent", "adjective", "/rɪˈfʌldʒənt/", "辉煌灿烂的；闪耀的", "shining brightly or radiantly", "The refulgent mosaic drew attention to the otherwise austere chamber.", ["refulgent light", "refulgent surface"], "Latin refulgere: re- ‘back’ + fulgere ‘shine’.", "光 shine back 反射回来，所以灿烂闪耀。"),
    make("effulgent", "adjective", "/ɪˈfʊldʒənt/", "光辉灿烂的", "radiantly bright or splendid", "Effulgent panels transformed the dim station at sunrise.", ["effulgent glow", "effulgent beauty"], "Latin effulgere: ex- ‘out’ + fulgere ‘shine’.", "光从里面 shine out，便是光辉四射。"),
    make("scurrilous", "adjective", "/ˈskɜːrələs/", "恶毒诽谤的；粗俗辱骂的", "making scandalous, abusive, or defamatory attacks", "The journal withdrew a scurrilous accusation unsupported by evidence.", ["scurrilous attack", "scurrilous allegation"], "Latin scurra ‘buffoon or vulgar jester’, through scurrilis ‘coarsely joking’.", "像粗俗小丑 scurra 一样用污言攻击别人。"),
    make("torpid", "adjective", "/ˈtɔːrpɪd/", "迟钝无力的；不活跃的", "mentally or physically inactive and sluggish", "Investment remained torpid despite the reduction in interest rates.", ["torpid economy", "torpid state"], "Latin torpidus, from torpere ‘be numb or inactive’.", "torpere 是 numb：麻木后动作迟缓、缺乏活力。"),
    make("vituperative", "adjective", "/vaɪˈtuːpərətɪv/", "辱骂性的；尖刻批判的", "bitter, abusive, and severely critical", "The debate became vituperative once both sides abandoned the evidence.", ["vituperative language", "vituperative attack"], "Latin vituperare ‘blame or censure’, from vitium ‘fault’ + parare ‘set forth’.", "把对方的 fault 全部摆出来痛骂，就是尖刻辱骂。"),
    make("occlude", "verb", "/əˈkluːd/", "堵塞；遮蔽；使闭合", "to block, close, or prevent passage", "Clouds occluded the sensor’s view of the coastline.", ["occlude a vessel", "partially occlude"], "Latin occludere: ob- ‘against’ + claudere ‘close’.", "把东西 close 住，通道就被堵塞或遮蔽。"),
    make("opprobrious", "adjective", "/əˈproʊbriəs/", "应受谴责的；侮辱性的", "shameful or expressing severe scorn and abuse", "The committee condemned the official’s opprobrious remarks.", ["opprobrious conduct", "opprobrious epithet"], "Latin opprobriosus, from opprobrium ‘reproach or disgrace’.", "opprobrium 是耻辱谴责；opprobrious 就是带来或表达这种谴责。"),
    make("perspicuity", "noun", "/ˌpɜːrspɪˈkjuːəti/", "清晰明了；表达透彻", "clarity of expression or understanding", "The lecturer’s perspicuity made a technical dispute accessible.", ["perspicuity of style", "remarkable perspicuity"], "Latin perspicuitas, from perspicuus ‘transparent’, from perspicere ‘look through’.", "能 look through 看透，表达自然清晰透彻。"),
    make("philippic", "noun", "/fɪˈlɪpɪk/", "猛烈抨击；檄文", "a bitter verbal attack or denunciatory speech", "The editorial was a philippic against the industry’s secrecy.", ["deliver a philippic", "a philippic against"], "From Greek Philippikos, the title of Demosthenes’ speeches attacking Philip II of Macedon.", "记住演说家猛烈攻击 Philip：philippic 就是长篇痛斥。"),
    make("temerarious", "adjective", "/ˌteməˈreriəs/", "鲁莽的；冒失的", "recklessly bold or rash", "The temerarious expedition ignored both weather data and local advice.", ["temerarious decision", "temerarious conduct"], "Latin temerarius ‘rash or accidental’, from temere ‘blindly, at random’.", "blindly 行动，不做判断，就是鲁莽冒失。"),
    make("vacuity", "noun", "/væˈkjuːəti/", "空虚；思想贫乏；真空", "emptiness, especially a lack of thought or substance", "Elegant phrasing could not disguise the argument’s vacuity.", ["intellectual vacuity", "moral vacuity"], "Latin vacuitas ‘emptiness’, from vacuus ‘empty’.", "vacuum、vacant 都是 empty；vacuity 就是空洞状态。")
  ];

  const existingWords = [...(window.WORDBANK_WORDS || []), ...(window.WORDS || []), ...(window.GRE_WORDS || [])];
  const existingIds = new Set(existingWords.map(word => word.id));
  const novel = additions.filter(word => !existingIds.has(word.id));
  window.GRE_WORDS = [...(window.GRE_WORDS || []), ...novel];
  window.GRE_INDEX = [...new Set([...(window.GRE_INDEX || []), ...additions.map(word => word.id)])];
  window.GRE_META = { ...(window.GRE_META || {}) };
  additions.forEach(word => { window.GRE_META[word.id] = { tier: word.greTier }; });

  const syn = (a, b, strength) => [a, b, "synonym", strength];
  const ant = (a, b, strength) => [a, b, "antonym", strength];
  const ety = (a, b, strength) => [a, b, "etymology", strength];
  const pre = (a, b, strength) => [a, b, "prefix", strength];
  const relations = [
    syn("abeyance", "dormant", .72), syn("abeyance", "respite", .64),
    syn("abscond", "evade", .86),
    syn("adumbrate", "foreshadow", .92), syn("adumbrate", "delineate", .66),
    syn("apoplectic", "irate", .90),
    syn("aporia", "conundrum", .86), syn("aporia", "predicament", .75),
    syn("apprise", "enlighten", .78), syn("apprise", "divulge", .64),
    syn("asperse", "slander", .93), syn("asperse", "calumny", .81),
    syn("bombastic", "pompous", .92), ant("bombastic", "laconic", .78),
    syn("captious", "carping", .94),
    syn("contumacious", "intransigent", .91), syn("contumacious", "defiant", .87), ant("contumacious", "amenable", .87),
    ant("diaphanous", "opaque", .94),
    syn("exigent", "imperative", .86), syn("exigent", "onerous", .72), ant("exigent", "trivial", .67),
    syn("expiate", "redress", .68), pre("expiate", "expunge", .48),
    syn("expostulate", "censure", .76), syn("expostulate", "admonish", .74),
    syn("fatuous", "vacuous", .86), ant("fatuous", "sagacious", .90),
    syn("fulminate", "denounce", .92), syn("fulminate", "rail", .87),
    syn("legerdemain", "artifice", .88), syn("legerdemain", "chicanery", .86),
    syn("limn", "delineate", .92),
    syn("machination", "intrigue", .90), syn("machination", "artifice", .78), syn("machination", "chicanery", .80),
    syn("mendacious", "duplicitous", .94), ant("mendacious", "candid", .88), ety("mendacious", "mendacity", .99),
    syn("obloquy", "opprobrium", .95), syn("obloquy", "censure", .82),
    ety("parsimony", "parsimonious", .99), ant("parsimony", "munificent", .88),
    syn("quiescence", "dormant", .72), syn("quiescence", "tranquil", .68), ant("quiescence", "tumult", .82),
    syn("refulgent", "effulgent", .97), ety("refulgent", "effulgent", .99), ant("refulgent", "opaque", .84),
    syn("scurrilous", "calumny", .80), syn("scurrilous", "invective", .78),
    syn("torpid", "sluggish", .94), syn("torpid", "lethargic", .92), ant("torpid", "vivacious", .93),
    syn("vituperative", "caustic", .84), syn("vituperative", "invective", .90), ant("vituperative", "conciliatory", .82), ety("vituperative", "vituperate", .99),
    syn("occlude", "obstruct", .92), ety("occlude", "preclude", .97),
    ety("opprobrious", "opprobrium", .99), ant("opprobrious", "approbation", .76),
    syn("perspicuity", "lucid", .88), ant("perspicuity", "opaque", .91), ety("perspicuity", "perspicacious", .96),
    syn("philippic", "diatribe", .95), syn("philippic", "tirade", .92),
    syn("temerarious", "rash", .92), ant("temerarious", "circumspect", .94),
    ety("vacuity", "vacuous", .99)
  ];

  const fullIds = new Set([...existingIds, ...novel.map(word => word.id)]);
  const relationKey = row => {
    const [a, b, type] = row;
    return `${a < b ? a : b}|${a < b ? b : a}|${type}`;
  };
  const seenRelations = new Set((window.GRE_RELATIONS || []).map(relationKey));
  const validRelations = relations.filter(row => fullIds.has(row[0]) && fullIds.has(row[1]) && !seenRelations.has(relationKey(row)));
  window.GRE_RELATIONS = [...(window.GRE_RELATIONS || []), ...validRelations];

  const families = [
    { root: "Latin umbra · shadow", members: [["adumbrate", "预示；以阴影勾勒"], ["umbrella", "伞；原义为遮阴物"], ["penumbra", "半影"], ["umbrage", "不快；原义为阴影、遮蔽"]] },
    { root: "Greek poros · passage / way", members: [["aporia", "无路可走的思想困境"], ["porous", "多孔可通过的"], ["pore", "孔隙"], ["aporetic", "表示疑难或矛盾的"]] },
    { root: "Latin spargere · scatter / sprinkle", members: [["asperse", "把污名撒到别人身上"], ["disperse", "使散开"], ["sparse", "稀疏的"], ["aspersion", "诽谤；洒水"]] },
    { root: "Greek phainein · show / appear", members: [["diaphanous", "可透过而显现的"], ["phenomenon", "显现出来的现象"], ["epiphany", "突然显现；顿悟"], ["phantom", "显现的幻影"]] },
    { root: "Latin fulgere · shine", members: [["refulgent", "反射般闪耀的"], ["effulgent", "向外放射光辉的"], ["effulgence", "灿烂光辉"], ["fulgent", "闪耀的"]] },
    { root: "Latin mendax · lying", members: [["mendacious", "撒谎的；虚假的"], ["mendacity", "虚假；撒谎倾向"], ["mendaciously", "虚假地"]] },
    { root: "Latin quies / quiescere · rest / become quiet", members: [["quiescence", "静止；休眠"], ["quiet", "安静的"], ["acquiesce", "安静下来并接受"], ["acquiescence", "默许；默认"]] },
    { root: "Latin claudere · close", members: [["occlude", "堵塞；闭合"], ["preclude", "预先关闭可能性；阻止"], ["seclude", "隔离；关在一旁"], ["conclude", "关闭讨论；得出结论"]] },
    { root: "Latin specere / perspicere · look / look through", members: [["perspicuity", "表达清晰透彻"], ["perspicacious", "洞察力强的"], ["inspect", "向内仔细看；检查"], ["spectacle", "可观看的景象"]] },
    { root: "Latin torpere · be numb", members: [["torpid", "迟钝不活跃的"], ["torpor", "麻木；迟钝状态"], ["torpedo", "电鳐；原义为使人麻木的鱼"], ["torpidity", "迟钝；不活跃"]] },
    { root: "Latin vituperare · blame", members: [["vituperative", "辱骂性的"], ["vituperate", "痛斥；辱骂"], ["vituperation", "猛烈谴责"], ["vituperator", "辱骂者"]] },
    { root: "Latin vacuus / vacare · empty / be empty", members: [["vacuity", "空虚；思想贫乏"], ["vacuous", "空洞的"], ["vacant", "空着的"], ["evacuate", "撤空；疏散"]] }
  ];
  const existingRoots = new Set((window.LEXICAL_FAMILIES || []).map(family => family.root));
  window.LEXICAL_FAMILIES = [...(window.LEXICAL_FAMILIES || []), ...families.filter(family => !existingRoots.has(family.root))];
})();
