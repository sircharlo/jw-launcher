const test = require("node:test");
const assert = require("node:assert/strict");

const { isEscapeButton, supportKey } = require("../utils/shortcuts");

test("isEscapeButton matches Escape and Esc", () => {
  assert.equal(isEscapeButton({ key: "Escape" }), true);
  assert.equal(isEscapeButton({ key: "Esc" }), true);
  assert.equal(isEscapeButton({ key: "Enter" }), false);
});

test("supportKey accepts letters without modifiers", () => {
  assert.equal(
    supportKey({ key: "a", code: "KeyA", ctrlKey: false, metaKey: false, shiftKey: false }),
    true,
  );
  assert.equal(
    supportKey({ key: "Escape", code: "Escape", ctrlKey: false, metaKey: false, shiftKey: false }),
    true,
  );
});

test("supportKey rejects modifier combinations and unsupported keys", () => {
  assert.equal(
    supportKey({ key: "a", code: "KeyA", ctrlKey: true, metaKey: false, shiftKey: false }),
    false,
  );
  assert.equal(
    supportKey({ key: "1", code: "Digit1", ctrlKey: false, metaKey: false, shiftKey: false }),
    false,
  );
});
