const fs = require('fs');
let c = fs.readFileSync('functions/index.js', 'utf8');
if (c.includes('\\n// ==========================================')) {
    c = c.replace('\\n// ==========================================', '\n// ==========================================');
    fs.writeFileSync('functions/index.js', c);
    console.log('Fixed literal \\n');
}
