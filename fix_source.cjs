const fs = require('fs');
let content = fs.readFileSync('functions/index.js', 'utf8');

const oldCheck = if (!newData || newData.source !== 'glovo') return null;;
const newCheck = if (!newData || (newData.source !== 'glovo' && newData.source !== 'glovo_automator')) return null;;

content = content.replace(oldCheck, newCheck);
fs.writeFileSync('functions/index.js', content, 'utf8');
