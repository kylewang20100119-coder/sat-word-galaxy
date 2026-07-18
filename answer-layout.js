// Stable answer placement for the three fixed readings in every Group.
// Source question data keeps the correct choice first for authoring clarity;
// this module positions it at A–D for students without repeating a position
// inside the same Group.
(() => {
  function stableHash(value) {
    let result = 2166136261;
    for (let index = 0; index < String(value).length; index += 1) {
      result = Math.imul(result ^ String(value).charCodeAt(index), 16777619);
    }
    return result >>> 0;
  }

  function positionFor(group, readingIndex) {
    const safeGroup = Math.max(1, Math.floor(Number(group) || 1));
    const safeIndex = Math.max(0, Math.floor(Number(readingIndex) || 0));
    const balancedStarts = [2, 0, 3, 1];
    const start = balancedStarts[(safeGroup - 1) % balancedStarts.length];
    const direction = stableHash(`answer-direction|${safeGroup}`) % 2 ? 1 : -1;
    return (start + direction * safeIndex + 8) % 4;
  }

  function arrange(items, key, desiredAnswerIndex, notes = []) {
    const source = (Array.isArray(items) ? items : []).map((text, originalIndex) => ({
      text,
      originalIndex,
      note: notes[originalIndex] || ""
    }));
    if (source.length !== 4) {
      return {
        choices: source.map(item => item.text),
        choiceNotes: source.map(item => item.note),
        answer: source.findIndex(item => item.originalIndex === 0)
      };
    }
    const desired = Number.isInteger(desiredAnswerIndex) && desiredAnswerIndex >= 0 && desiredAnswerIndex < 4
      ? desiredAnswerIndex
      : stableHash(`${key}|answer`) % 4;
    const correct = source[0];
    const distractors = source.slice(1).sort((first, second) => {
      const score = stableHash(`${key}|${first.originalIndex}|${first.text}`) - stableHash(`${key}|${second.originalIndex}|${second.text}`);
      return score || first.originalIndex - second.originalIndex;
    });
    const ordered = Array(4);
    ordered[desired] = correct;
    let distractorIndex = 0;
    for (let index = 0; index < ordered.length; index += 1) {
      if (index !== desired) ordered[index] = distractors[distractorIndex++];
    }
    return {
      choices: ordered.map(item => item.text),
      choiceNotes: ordered.map(item => item.note),
      answer: desired
    };
  }

  window.LexiverseAnswerLayout = Object.freeze({ positionFor, arrange });
})();
