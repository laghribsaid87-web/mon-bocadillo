const fs = require('fs');
let content = fs.readFileSync('functions/index.js', 'utf8');
content = content.replace(
    /if \(isQty\) return originalNote; \/\/ Keep Glovo options\s+return null;/g,
    \if (isQty) return originalNote; // Keep Glovo options
                if (lowerNote.includes('sans')) return originalNote; // ALWAYS KEEP SANS
                return null;\
);
fs.writeFileSync('functions/index.js', content);
