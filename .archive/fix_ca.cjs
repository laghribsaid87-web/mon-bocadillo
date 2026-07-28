const fs = require('fs');

function fixFile(file, regex, replacement) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(regex, replacement);
    fs.writeFileSync(file, content);
    console.log('Fixed ' + file);
}

fixFile('src/views/PosDashboard.jsx', 
    /if \(o\.status === 'rejected' \|\| o\.paymentStatus === 'en_attente'\) return false;/g, 
    "if (o.status === 'rejected' || o.status === 'cancelled' || o.paymentStatus === 'en_attente') return false;"
);

fixFile('src/views/AdminDashboard.jsx',
    /let filtered = allOrders\.filter\(o => \(o\.source === 'glovo' \|\| o\.source === 'glovo_api'\) && o\.status !== 'rejected'\);/g,
    "let filtered = allOrders.filter(o => (o.source === 'glovo' || o.source === 'glovo_api') && o.status !== 'rejected' && o.status !== 'cancelled');"
);
