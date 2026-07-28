const fs = require('fs');

const path = 'functions/index.js';
let content = fs.readFileSync(path, 'utf8');

// Replace orderNumber logic globally
content = content.replace(/orderNumber: glovoOrder\.order_code \|\| glovoOrder\.order_id\.toString\(\)\.slice\(-4\),/g, 'orderNumber: glovoOrder.order_code || glovoOrder.order_id.toString(),');

// Add notes to items and order
content = content.replace(/items: \(glovoOrder\.products \|\| \[\]\)\.map\(p => \{([\s\S]*?)return \{([\s\S]*?)selectedExtras: selectedExtras\n\s*\};\n\s*\}\)/g, (match, p1, p2) => {
    return `note: glovoOrder.special_instructions || glovoOrder.observations || "",
            items: (glovoOrder.products || []).map(p => {${p1}return {${p2}selectedExtras: selectedExtras,
                    note: p.special_instructions || p.instructions || p.observations || ""
                };
            })`;
});

fs.writeFileSync(path, content, 'utf8');
console.log("index.js patched!");
