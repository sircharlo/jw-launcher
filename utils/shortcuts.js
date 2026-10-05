function isEscapeButton(event) {
  return event.key === "Escape" || event.key === "Esc";
}

function supportKey(event) {
  return (
    !(event.ctrlKey || event.metaKey || event.shiftKey) &&
    (event.code.includes("Key") ||
      /^[a-z]$/i.test(event.key) ||
      isEscapeButton(event))
  );
}

// Loaded as a plain <script> in the renderer, and via require() in tests
if (typeof module === "object") {
  module.exports = {
    isEscapeButton,
    supportKey,
  };
}
