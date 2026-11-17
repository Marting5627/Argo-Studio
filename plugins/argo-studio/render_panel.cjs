'use strict';
// The one source assembly rule shared by fixtures and packaging checks.
const fs = require('node:fs');
const path = require('node:path');
const marker = '/* ARGO_GENERATION_BOARD_MODULE */';
function renderPanel(directory = __dirname) {
  const template = fs.readFileSync(path.join(directory, 'library.html'), 'utf8');
  const source = fs.readFileSync(path.join(directory, 'generation-board.js'), 'utf8');
  if (template.split(marker).length !== 2 || /<\/script/i.test(source)) throw Error('Invalid panel module assembly');
  return template.replace(marker, source);
}
module.exports = { renderPanel, marker };
if (require.main === module) process.stdout.write(renderPanel(process.argv[2] || __dirname));
