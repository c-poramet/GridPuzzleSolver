'use strict';

/*
 * Dependency-free smoke harness. Run with:
 *   node tests/run.js
 * The solver itself is browser-first; this file verifies the source files can
 * be parsed by the requested Node runtime. Browser acceptance checks live in
 * tests.html because the UI and file:// loading are part of the contract.
 */
const fs = require('fs');
const vm = require('vm');
const files = ['core/runtime.js', 'solvers/legacy.js', 'solvers/slots.js', 'solvers/columns.js', 'renderers/answer-table.js', 'solver.js', 'editor.js'];
for (const file of files) {
  const source = fs.readFileSync(require('path').join(__dirname, '..', file), 'utf8');
  new vm.Script(source, { filename: file });
}
console.log(`Parsed ${files.length} browser modules.`);
