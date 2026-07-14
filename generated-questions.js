(() => {
  const EXTRA_QUESTION_COUNT = 210;
  const existing = Array.isArray(window.OFFLINE_SAT_QUESTIONS) ? window.OFFLINE_SAT_QUESTIONS : [];
  const alreadyUsed = new Set(existing.flatMap(question => question.targets || []));

  function hash(value) {
    let result = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      result ^= value.charCodeAt(index);
      result = Math.imul(result, 16777619);
    }
    return result >>> 0;
  }

  function cleanDefinition(value) {
    return String(value || "")
      .replace(/^\([^)]{1,70}\)\s*/, "")
      .replace(/[.;:]\s*$/, "")
      .trim();
  }

  function categoryFor(word) {
    const text = `${word.id} ${word.definition}`.toLowerCase();
    const categories = [
      ["reasoning", /evidence|reason|logic|argument|claim|conclusion|belief|theory|true|false|prove|infer|knowledge|understand/],
      ["communication", /speak|say|write|word|language|statement|express|communicat|explain|describe|praise|critic|announce|question/],
      ["emotion", /emotion|feeling|happy|sad|anger|fear|love|hate|enthusiasm|calm|anxious|hope|desire|mood/],
      ["conflict", /fight|war|attack|oppose|hostile|force|threat|harm|defend|resist|punish|crime|guilt|blame|enemy/],
      ["society", /society|social|public|government|politic|law|authority|custom|tradition|community|group|people|person/],
      ["change", /change|increase|decrease|improve|worsen|develop|grow|reduce|remove|destroy|create|become|alter|transform/],
      ["quantity", /many|much|few|amount|number|large|small|abundant|scarce|whole|part|degree|extent|enough/],
      ["time", /time|temporary|permanent|old|new|early|late|brief|long|continue|sudden|future|past|frequent/],
      ["nature", /animal|plant|water|land|earth|weather|climate|biolog|natural|species|body|blood|disease|physical/],
      ["action", /act|action|do |make|use|move|work|effort|attempt|perform|prevent|allow|cause|help|avoid/],
      ["quality", /quality|character|manner|appearance|beautiful|important|careful|skill|complex|simple|clear|strange|ordinary/]
    ];
    return categories.find(([, pattern]) => pattern.test(text))?.[0] || "general";
  }

  const eligible = (window.WORDBANK_WORDS || [])
    .filter(word => /^(adjective|noun|verb)$/.test(word.pos || ""))
    .filter(word => /^[a-z][a-z-]{3,}$/.test(word.id || ""))
    .filter(word => word.definition && word.example)
    .filter(word => word.definition.length >= 8 && word.definition.length <= 180)
    .filter(word => word.example.length >= 12 && word.example.length <= 220)
    .filter(word => !alreadyUsed.has(word.id))
    .map(word => ({ ...word, conciseDefinition: cleanDefinition(word.definition), category: categoryFor(word) }))
    .filter(word => word.conciseDefinition.length >= 6)
    .sort((a, b) => hash(`${a.id}-lexiverse-250`) - hash(`${b.id}-lexiverse-250`));

  const buckets = new Map();
  eligible.forEach(word => {
    const key = `${word.pos}:${word.category}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(word);
  });

  const groups = [];
  [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "en"))
    .forEach(([, words]) => {
      for (let index = 0; index + 3 < words.length; index += 4) {
        const group = words.slice(index, index + 4);
        if (new Set(group.map(word => word.conciseDefinition.toLowerCase())).size === 4) groups.push(group);
      }
    });

  groups.sort((a, b) => hash(a.map(word => word.id).join("|")) - hash(b.map(word => word.id).join("|")));

  const genreFrames = {
    science: [
      "While reviewing a scientific report, a student notes the following sentence:",
      "A researcher uses the following wording in a discussion of an observed result:",
      "An excerpt from a science writer's field notes reads:"
    ],
    social: [
      "In an account of a public debate, a historian includes this sentence:",
      "A social scientist quotes the following observation in a case study:",
      "A report about institutions and communities contains this line:"
    ],
    humanities: [
      "In an analysis of an author's language, a scholar considers this sentence:",
      "A critic highlights the following line for its precise diction:",
      "An essay on art and ideas includes the following sentence:"
    ],
    literary: [
      "A narrator offers the following description:",
      "In a work of fiction, the narrator observes:",
      "A character recalls the moment in these words:"
    ]
  };
  const genres = ["science", "social", "humanities", "literary"];
  const genreLabels = { science: "Science", social: "Social Studies", humanities: "Humanities", literary: "Literature" };

  function orderedChoices(correct, distractors, seed) {
    const choices = [correct, ...distractors]
      .map((text, originalIndex) => ({ text, originalIndex }))
      .sort((a, b) => hash(`${seed}:${a.text}`) - hash(`${seed}:${b.text}`));
    return {
      choices: choices.map(choice => choice.text),
      answer: choices.findIndex(choice => choice.originalIndex === 0)
    };
  }

  function makeReadingQuestion(group, index, genre, frame, stableSuffix) {
    const focus = group[0];
    const example = focus.example.trim();
    const meaning = focus.conciseDefinition;
    const readingIndex = index - 90;
    const type = readingIndex % 6;
    const seed = `${focus.id}:${stableSuffix}:${type}`;
    const common = {
      id: `reading-${focus.id}-${stableSuffix}`,
      title: `${genreLabels[genre]} Reading Analysis ${readingIndex + 1}`,
      genre,
      difficulty: readingIndex % 4 === 0 ? "medium" : "hard",
      targets: group.map(word => word.id)
    };

    if (type === 0) {
      const result = orderedChoices(
        "Precise diction can preserve an important distinction that a broad paraphrase might erase.",
        [
          "Specialized language should always be removed, even when it changes an author's point.",
          "A sentence becomes reliable merely because it contains an unfamiliar word.",
          "Readers can understand a passage only when every word has a single possible meaning."
        ], seed
      );
      return {
        ...common,
        domain: "Information and Ideas", skill: "Central Ideas and Details",
        passage: `${frame} “${example}” In the surrounding discussion, the writer explains that ${focus.id} conveys the idea of being or doing something that is ${meaning}. A broader substitute would be easier, the writer acknowledges, but it would also flatten the distinction the original sentence makes.`,
        question: "Which choice best states the main idea of the text?",
        ...result,
        explanation: `The text argues that the precise meaning of ${focus.id} preserves a distinction that a broader replacement would lose.`
      };
    }

    if (type === 1) {
      const result = orderedChoices(
        "The replacement would probably make the sentence less precise.",
        [
          "The replacement would necessarily make the underlying observation false.",
          "The writer would remove the entire sentence from the final work.",
          "The replacement would add a technical distinction absent from the original."
        ], seed
      );
      return {
        ...common,
        domain: "Information and Ideas", skill: "Inferences",
        passage: `${frame} “${example}” An editor proposed replacing ${focus.id} with a more familiar expression. The writer declined, noting that ${focus.id} specifically communicates ${meaning}; the proposed expression communicates only the passage's general topic.`,
        question: "Which choice most logically follows from the text?",
        ...result,
        explanation: "The proposed wording preserves only the general topic, so it would sacrifice the more exact distinction carried by the original word."
      };
    }

    if (type === 2) {
      const result = orderedChoices(
        `Draft notes show that the writer restored ${focus.id} after testing three broader alternatives.`,
        [
          `A later reader reported having seen ${focus.id} in an unrelated book.`,
          "The first draft and final draft contain the same number of sentences.",
          "The writer changed the typeface used for the paragraph's heading."
        ], seed
      );
      return {
        ...common,
        domain: "Information and Ideas", skill: "Command of Evidence",
        passage: `${frame} “${example}” A literary scholar argues that the use of ${focus.id}, meaning ${meaning}, was deliberate rather than accidental. The scholar points out that the word makes the sentence more exact than several common alternatives would.`,
        question: "Which finding, if true, would most directly support the scholar's claim?",
        ...result,
        explanation: "Restoring the word after comparing alternatives is direct evidence that the author selected it deliberately for precision."
      };
    }

    if (type === 3) {
      const result = orderedChoices(
        "It explains the distinction on which the writer's defense of the original wording depends.",
        [
          "It introduces an unrelated event that contradicts the quoted sentence.",
          "It proves that the sentence is the oldest sentence in the work.",
          "It shifts the discussion from language to the writer's biography."
        ], seed
      );
      return {
        ...common,
        domain: "Craft and Structure", skill: "Text Structure and Purpose",
        passage: `Some readers describe the wording in the following sentence as unnecessarily specialized: “${example}” The writer responds that ${focus.id} communicates ${meaning}. Without that distinction, the sentence would make a broader and substantially different claim.`,
        question: "What is the main function of the second sentence in the overall structure of the text?",
        ...result,
        explanation: `The sentence defines the precise distinction conveyed by ${focus.id}, which supports the defense of retaining the original wording.`
      };
    }

    if (type === 4) {
      const result = orderedChoices(
        "Writers should prefer accessible language except when a more specialized word carries a necessary distinction.",
        [
          "Every specialized word is clearer than every familiar alternative.",
          "Readers should be required to infer definitions without contextual help.",
          "Editing for accessibility can never affect a text's meaning."
        ], seed
      );
      return {
        ...common,
        domain: "Craft and Structure", skill: "Cross-Text Connections",
        passage: `Text 1\n${frame} “${example}” The analyst defends ${focus.id} because it specifically conveys ${meaning}.\n\nText 2\nEditor Mara Iqbal generally favors familiar language, but she cautions that replacing a specialized term is unwise when the replacement removes a distinction essential to an author's reasoning.`,
        question: "Which statement would the authors of both texts most likely agree with?",
        ...result,
        explanation: "Both texts favor preserving a specialized word when its exact meaning is necessary, while Text 2 also expresses a general preference for accessibility."
      };
    }

    const result = orderedChoices(
      `To make the sentence communicate the more exact idea associated with ${focus.id}.`,
      [
        "To make the sentence longer without changing any part of its meaning.",
        "To remove the only description of the passage's central subject.",
        "To signal that the writer no longer accepted the observation in the sentence."
      ], seed
    );
    return {
      ...common,
      domain: "Information and Ideas", skill: "Central Ideas and Details",
      passage: `An archive contains two versions of a sentence. An early draft uses a broad, familiar description. The final version reads, “${example}” Notes in the margin define ${focus.id} as ${meaning} and state that the revision was intended to make the observation more exact.`,
      question: `According to the text, why did the writer use ${focus.id} in the final version?`,
      ...result,
      explanation: `The archival note explicitly says that ${focus.id} was chosen to communicate a more exact idea.`
    };
  }

  const generated = groups.slice(0, EXTRA_QUESTION_COUNT).map((group, index) => {
    const focus = group[0];
    const genre = genres[index % genres.length];
    const frames = genreFrames[genre];
    const choiceWords = [...group].sort((a, b) => hash(`${focus.id}:${a.id}:choice`) - hash(`${focus.id}:${b.id}:choice`));
    const answer = choiceWords.findIndex(word => word.id === focus.id);
    const quotedExample = focus.example.replace(/^\s+|\s+$/g, "");
    const stableSuffix = hash(group.map(word => word.id).join("|")).toString(36);
    if (index >= 90) return makeReadingQuestion(group, index, genre, frames[index % frames.length], stableSuffix);
    return {
      id: `vocab-${focus.id}-${stableSuffix}`,
      title: `${genreLabels[genre]} Vocabulary in Context ${index + 1}`,
      genre,
      difficulty: index % 3 === 0 ? "medium" : "hard",
      domain: "Craft and Structure",
      skill: "Words in Context",
      targets: group.map(word => word.id),
      passage: `${frames[index % frames.length]} “${quotedExample}” The word ${focus.id} is especially important to the meaning of the sentence.`,
      question: `As used in the text, what does “${focus.id}” most nearly mean?`,
      choices: choiceWords.map(word => word.conciseDefinition),
      answer,
      explanation: `“${focus.id}” means “${focus.conciseDefinition}.” That meaning fits the quoted sentence; the other choices define ${choiceWords.filter(word => word.id !== focus.id).map(word => word.id).join(", ")}.`
    };
  });

  if (generated.length !== EXTRA_QUESTION_COUNT) {
    console.warn(`Lexiverse generated ${generated.length} expansion questions instead of ${EXTRA_QUESTION_COUNT}.`);
  }
  window.OFFLINE_SAT_QUESTIONS = [...existing, ...generated];
})();
