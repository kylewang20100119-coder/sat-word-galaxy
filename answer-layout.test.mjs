import test from "node:test";
import assert from "node:assert/strict";

globalThis.window = globalThis;
await import("./answer-layout.js");

const { positionFor, arrange } = globalThis.LexiverseAnswerLayout;

test("each Group uses three distinct answer positions", () => {
  for (let group = 1; group <= 179; group += 1) {
    const positions = [0, 1, 2].map(index => positionFor(group, index));
    assert.equal(new Set(positions).size, 3, `Group ${group}: ${positions.join(",")}`);
    positions.forEach(position => assert.ok(position >= 0 && position <= 3));
  }
});

test("the 537 Group readings remain balanced across A–D", () => {
  const distribution = [0, 0, 0, 0];
  for (let group = 1; group <= 179; group += 1) {
    for (let index = 0; index < 3; index += 1) distribution[positionFor(group, index)] += 1;
  }
  const spread = Math.max(...distribution) - Math.min(...distribution);
  assert.ok(spread <= 3, `unbalanced distribution: ${distribution.join(",")}`);
});

test("arrange places the source answer at the requested position", () => {
  const choices = ["correct", "distractor one", "distractor two", "distractor three"];
  const notes = ["correct note", "note one", "note two", "note three"];
  for (let desired = 0; desired < 4; desired += 1) {
    const result = arrange(choices, "stable-key", desired, notes);
    assert.equal(result.answer, desired);
    assert.equal(result.choices[desired], "correct");
    assert.equal(result.choiceNotes[desired], "correct note");
    assert.deepEqual(new Set(result.choices), new Set(choices));
  }
});

test("arrange is deterministic and keeps distractor notes paired", () => {
  const choices = ["correct", "b", "c", "d"];
  const notes = ["A-note", "B-note", "C-note", "D-note"];
  const first = arrange(choices, "group-18-reading-2", 3, notes);
  const second = arrange(choices, "group-18-reading-2", 3, notes);
  assert.deepEqual(first, second);
  first.choices.forEach((choice, index) => {
    const sourceIndex = choices.indexOf(choice);
    assert.equal(first.choiceNotes[index], notes[sourceIndex]);
  });
});
