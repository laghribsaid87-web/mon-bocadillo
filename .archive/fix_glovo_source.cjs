const fs = require('fs');
const glob = require('glob');
const path = require('path');

const dir = path.join(__dirname, 'src');

function fixFile(file) {
    if (!fs.existsSync(file)) return;
    let code = fs.readFileSync(file, 'utf8');
    let changed = false;
    
    // Replace exact "o.source === 'glovo'"
    if (code.includes("o.source === 'glovo'")) {
        code = code.replace(/o\.source === 'glovo'/g, "(o.source === 'glovo' || o.source === 'glovo_api')");
        changed = true;
    }
    
    // Replace "source === 'glovo'"
    if (code.includes("source === 'glovo'")) {
        // Need to be careful here to not replace inside "(o.source === 'glovo' || o.source === 'glovo_api')"
        // So we use a regex with negative lookbehind, or just simple replace and fix later.
        // Actually, we replaced o.source === 'glovo' above. What's left is source === 'glovo'.
        code = code.replace(/(?<!\.)source === 'glovo'/g, "(source === 'glovo' || source === 'glovo_api')");
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(file, code);
        console.log(`Updated ${file}`);
    }
}

const files = [
    'src/views/AdminDashboard.jsx',
    'src/views/PosDashboard.jsx',
    'src/views/pos/modals/OnlineOrdersModal.jsx',
    'src/components/admin/AdminActiveOrders.jsx',
    'src/components/admin/AdminClients.jsx',
    'src/components/admin/AdminHistory.jsx',
    'src/components/admin/KitchenDashboard.jsx',
    'src/components/admin/AdminProblemOrders.jsx',
    'src/components/admin/AdminGlovoReport.jsx',
    'src/App.jsx',
    'src/AdminApp.jsx'
];

files.forEach(f => fixFile(path.join(__dirname, f)));
