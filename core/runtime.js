'use strict';

window.GSRuntime = window.GSRuntime || {};
GSRuntime.esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
GSRuntime.Error = class GSError extends Error {
  constructor(message, line) {
    super(message);
    this.line = line;
  }
};

// Compatibility aliases for the mode modules while the legacy engine is migrated.
window.GSError = GSRuntime.Error;
window.GSEsc = GSRuntime.esc;
