globalThis.window = globalThis;

await import("./wordbank.js");
await import("./words.js");
await import("./architect-readings.js");
await import("./architect-passage-overrides.js");
await import("./architect-reading-engine.js");

const bank = Array.isArray(globalThis.WORDBANK_WORDS) ? globalThis.WORDBANK_WORDS : [];
const readings = globalThis.ARCHITECT_GROUP_READINGS || {};
const allowedSubjects = new Set(["Literature", "History/Humanities", "Social Science", "Natural Science"]);
const allowedSkills = new Set(["Central Ideas and Details", "Inferences", "Command of Evidence", "Textual Evidence", "Author Purpose", "Sentence/Detail Function", "Overall Structure", "Text Structure and Purpose"]);
const issues = [];

const groupIds = group => bank.filter(word => word.group === `Group ${group}`).map(word => word.id).sort();
const headPattern = id => {
  const value = String(id);
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const body = value.includes(" ") ? escaped.replace(/\\ /g, "\\s+") : `${escaped}(?:s|es|ed|d|ing)?`;
  return new RegExp(`(^|[^a-z])${body}(?=$|[^a-z])`, "gi");
};

Object.entries(readings).forEach(([groupKey, units]) => {
  const group = Number(groupKey);
  if (!Array.isArray(units) || units.length !== 3) issues.push(`Group ${group}: expected exactly 3 units.`);
  const assigned = [];
  (units || []).forEach((unit, index) => {
    const label = `Group ${group} Reading ${index + 1}`;
    const wordCount = String(unit.passage || "").trim().split(/\s+/).filter(Boolean).length;
    if (wordCount < 70 || wordCount > 150) issues.push(`${label}: passage has ${wordCount} words; expected 70–150.`);
    if (!allowedSubjects.has(unit.subject)) issues.push(`${label}: invalid subject ${unit.subject}.`);
    if (!allowedSkills.has(unit.skill)) issues.push(`${label}: invalid skill ${unit.skill}.`);
    if (!Array.isArray(unit.choices) || unit.choices.length !== 4 || new Set(unit.choices).size !== 4) issues.push(`${label}: choices must be four unique options.`);
    if (!unit.analysis?.evidence || !unit.analysis?.reasoning || !unit.analysis?.trap || !unit.analysis?.takeaway) issues.push(`${label}: incomplete post-answer analysis.`);
    if (!Array.isArray(unit.analysis?.choiceNotes) || unit.analysis.choiceNotes.length !== 4) issues.push(`${label}: expected four choice diagnoses.`);
    if (!Array.isArray(unit.wordIds) || ![3, 4].includes(unit.wordIds.length) && !(group === 179 && unit.wordIds.length >= 1)) issues.push(`${label}: unexpected target-word count.`);
    (unit.wordIds || []).forEach(id => {
      assigned.push(id);
      const matches = String(unit.passage || "").match(headPattern(id)) || [];
      if (matches.length !== 1) issues.push(`${label}: target “${id}” appears ${matches.length} times by lexical-head count.`);
    });
  });
  const expected = groupIds(group);
  const actual = assigned.sort();
  if (expected.join("|") !== actual.join("|")) issues.push(`Group ${group}: assigned target set does not match WordBank.`);
});

if (process.argv.includes("--complete")) {
  const missing = Array.from({ length: 179 }, (_, index) => index + 1).filter(group => !readings[group] && ![1, 2, 25].includes(group));
  if (missing.length) issues.push(`Complete audit: ${missing.length} groups remain uncurated (${missing.slice(0, 20).join(", ")}${missing.length > 20 ? ", …" : ""}).`);
}

if (issues.length) {
  console.error(`SAT Reading Architect audit failed with ${issues.length} issue(s):\n- ${issues.join("\n- ")}`);
  process.exit(1);
}

const unitCount = Object.values(readings).reduce((sum, units) => sum + units.length, 0);
console.log(`SAT Reading Architect audit passed: ${Object.keys(readings).length} groups, ${unitCount} units.`);
