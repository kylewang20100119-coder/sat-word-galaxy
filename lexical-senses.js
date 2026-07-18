(() => {
  const curated = {
    salient: [
      { pos: "adjective", definition: "Most noticeable or important.", zh: "显著的；突出的；最重要的" },
      { pos: "noun", definition: "A piece of land or a military position that projects outward.", zh: "突出部；凸出阵地" }
    ],
    yield: [
      { pos: "verb", definition: "To produce, provide, or generate a result.", zh: "产生；出产；带来（结果）" },
      { pos: "verb", definition: "To give way, surrender, or submit.", zh: "让步；屈服；放弃" },
      { pos: "noun", definition: "The amount produced or the return from an investment.", zh: "产量；收益；回报率" }
    ],
    cosmopolitan: [
      { pos: "adjective", definition: "Including people or influences from many different countries.", zh: "世界性的；国际化的；见多识广的" },
      { pos: "noun", definition: "A person who is familiar and comfortable with many countries and cultures.", zh: "世界主义者；四海为家的人" }
    ],
    lavish: [
      { pos: "adjective", definition: "Sumptuously rich, elaborate, or given in generous amounts.", zh: "奢华的；大量的；慷慨的" },
      { pos: "verb", definition: "To give or spend something in generous or extravagant quantities.", zh: "慷慨给予；大量花费" }
    ],
    stoic: [
      { pos: "noun", definition: "A person who endures pain or hardship without complaining.", zh: "坚忍克制的人；斯多葛派信徒" },
      { pos: "adjective", definition: "Enduring pain or hardship without showing one's feelings.", zh: "坚忍的；克制的；斯多葛派的" }
    ],
    swarm: [
      { pos: "noun", definition: "A large or dense group of insects or people.", zh: "一大群（昆虫或人）" },
      { pos: "verb", definition: "To move or gather somewhere in large numbers.", zh: "成群移动；蜂拥；挤满" }
    ],
    obscure: [
      { pos: "adjective", definition: "Not well known, clear, or easy to understand.", zh: "鲜为人知的；晦涩的；不清楚的" },
      { pos: "verb", definition: "To conceal, block from view, or make unclear.", zh: "遮蔽；使模糊；掩盖" }
    ],
    hamper: [
      { pos: "verb", definition: "To hinder or impede the movement or progress of something.", zh: "阻碍；妨碍；限制" },
      { pos: "noun", definition: "A large basket, usually with a lid, used for storage or carrying.", zh: "有盖大篮子；洗衣篮" }
    ],
    elaborate: [
      { pos: "adjective", definition: "Involving many carefully arranged parts or details.", zh: "精心制作的；复杂详尽的" },
      { pos: "verb", definition: "To develop or explain an idea in greater detail.", zh: "详细说明；进一步阐述" }
    ],
    novel: [
      { pos: "adjective", definition: "New, original, and different from what was known before.", zh: "新颖的；新奇的；原创的" },
      { pos: "noun", definition: "A long fictional prose narrative, usually published as a book.", zh: "（长篇）小说" }
    ],
    patent: [
      { pos: "noun", definition: "A legal right granting an inventor exclusive use of an invention.", zh: "专利；专利权" },
      { pos: "adjective", definition: "Clearly apparent or obvious.", zh: "显而易见的；明显的" },
      { pos: "verb", definition: "To obtain a patent for an invention.", zh: "取得……的专利权" }
    ],
    premise: [
      { pos: "noun", definition: "A proposition on which an argument or theory is based.", zh: "前提；假定；论据" },
      { pos: "verb", definition: "To base an argument, theory, or statement on an idea.", zh: "以……为前提；预先提出" }
    ],
    prompt: [
      { pos: "adjective", definition: "Done without delay; punctual or immediate.", zh: "迅速的；及时的；准时的" },
      { pos: "verb", definition: "To cause, encourage, or remind someone to act or speak.", zh: "促使；激起；提示" },
      { pos: "noun", definition: "A cue, reminder, or instruction that initiates a response.", zh: "提示；提示语；启发性问题" }
    ],
    sanction: [
      { pos: "noun", definition: "Official permission or approval.", zh: "正式批准；许可" },
      { pos: "noun", definition: "A penalty imposed to enforce a law or rule, especially against a country.", zh: "制裁；处罚" },
      { pos: "verb", definition: "To give official permission or approval to something.", zh: "正式批准；认可" },
      { pos: "verb", definition: "To impose a penalty or sanction on someone or something.", zh: "制裁；处罚" }
    ],
    strain: [
      { pos: "noun", definition: "Pressure, tension, or a force that stretches something.", zh: "压力；紧张；拉力" },
      { pos: "noun", definition: "A particular type, variety, or genetic line.", zh: "品种；菌株；类型" },
      { pos: "verb", definition: "To stretch, exert excessively, or make a great effort.", zh: "拉伤；使过度紧张；竭力" }
    ],
    temper: [
      { pos: "noun", definition: "A person's state of mind, especially regarding anger or calmness.", zh: "脾气；情绪；性情" },
      { pos: "verb", definition: "To moderate, soften, or balance something.", zh: "使缓和；调和；使适中" },
      { pos: "verb", definition: "To harden a material, especially metal, by controlled heating and cooling.", zh: "回火；锻炼（金属）" }
    ],
    saddle: [
      { pos: "noun", definition: "A seat fastened on a horse or bicycle for riding.", zh: "马鞍；车座" },
      { pos: "verb", definition: "To put a saddle on an animal or burden someone with a responsibility.", zh: "给……装鞍；使承担（责任或债务）" }
    ],
    preface: [
      { pos: "noun", definition: "An introduction to a book, speech, or other work.", zh: "序言；前言；开场白" },
      { pos: "verb", definition: "To introduce a statement or action with preliminary words.", zh: "为……写序言；以……作为开场白" }
    ],
    mercenary: [
      { pos: "adjective", definition: "Primarily concerned with making money, sometimes at the expense of ethics.", zh: "唯利是图的；贪财的" },
      { pos: "noun", definition: "A professional soldier hired to serve in a foreign army.", zh: "雇佣兵" }
    ],
    parody: [
      { pos: "noun", definition: "A humorous imitation that exaggerates a writer's or artist's style.", zh: "滑稽模仿作品；戏仿" },
      { pos: "verb", definition: "To imitate something humorously or satirically.", zh: "滑稽地模仿；戏仿" }
    ]
  };

  const normalizeSense = (sense, word) => ({
    pos: String(sense?.pos || word?.pos || "word").trim(),
    definition: String(sense?.definition || "").trim(),
    zh: String(sense?.zh || sense?.meaning || "").trim()
  });

  function getLexicalSenses(word) {
    if (!word) return [];
    const supplied = Array.isArray(word.senses) && word.senses.length ? word.senses : curated[word.id];
    if (Array.isArray(supplied) && supplied.length) return supplied.map(sense => normalizeSense(sense, word));
    const parts = String(word.pos || "word").split(/\s*(?:\/|,|;|\||\band\b)\s*/i).filter(Boolean);
    const meanings = String(word.zh || "").split(/\s*[；;]\s*/).filter(Boolean);
    if (parts.length > 1 && meanings.length >= parts.length) {
      return parts.map((pos, index) => normalizeSense({ pos, zh: meanings[index], definition: index === 0 ? word.definition : "" }, word));
    }
    return [normalizeSense({ pos: word.pos, definition: word.definition, zh: word.zh }, word)];
  }

  function getLexicalPosLabel(word) {
    return [...new Set(getLexicalSenses(word).map(sense => sense.pos).filter(Boolean))].join(" · ") || "word";
  }

  [...(window.WORDBANK_WORDS || []), ...(window.WORDS || []), ...(window.GRE_WORDS || [])].forEach(word => {
    if (curated[word.id]) word.senses = curated[word.id].map(sense => ({ ...sense }));
  });
  window.LEXICAL_SENSES = curated;
  window.getLexicalSenses = getLexicalSenses;
  window.getLexicalPosLabel = getLexicalPosLabel;
})();
