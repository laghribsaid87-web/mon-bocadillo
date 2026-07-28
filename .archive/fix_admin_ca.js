import fs from 'fs';

let code = fs.readFileSync('src/views/AdminDashboard.jsx', 'utf8');

const regex1 = /let filtered = allOrders\.filter\(o => \(o\.source === 'glovo' \|\| o\.source === 'glovo_api'\) && o\.status !== 'rejected' && o\.status !== 'cancelled'\);\s*if \(glovoBranch !== 'ALL'\) \{\s*filtered = filtered\.filter\(o => o\.nearestBranch\?\.id === glovoBranch\);\s*\}\s*setGlovoData\(filtered\);\s*\/\/\s*Fetch cancellations/g;

const replacement1 = `let filtered = allOrders.filter(o => (o.source === 'glovo' || o.source === 'glovo_api') && o.status !== 'rejected' && o.status !== 'cancelled');
let cancelledApiOrders = allOrders.filter(o => (o.source === 'glovo' || o.source === 'glovo_api') && o.status === 'cancelled');

if (glovoBranch !== 'ALL') {
    filtered = filtered.filter(o => o.nearestBranch?.id === glovoBranch);
    cancelledApiOrders = cancelledApiOrders.filter(o => o.nearestBranch?.id === glovoBranch);
}
setGlovoData(filtered);

// Fetch cancellations`;

code = code.replace(regex1, replacement1);

const regex2 = /const snapCancel = await getDocs\(qCancel\);\s*setGlovoCancellations\(snapCancel\.docs\.map\(d => \(\{id: d\.id, \.\.\.d\.data\(\)\}\)\)\);/g;

const replacement2 = `const snapCancel = await getDocs(qCancel);
let oldCancellations = snapCancel.docs.map(d => ({id: d.id, ...d.data()}));

const formattedApiCancellations = cancelledApiOrders.map(o => ({
    id: o.id,
    orderNumber: o.id.slice(-4),
    createdAt: o.createdAt,
    reasonText: \`⚠️ COMMANDE ANNULÉE (API) \\nMontant Perdu : \${o.total || 0} DH \\nPaiement : \${o.paymentMethod || 'Inconnu'} \\nAgence : \${o.nearestBranch?.name || 'Inconnue'}\`
}));

setGlovoCancellations([...oldCancellations, ...formattedApiCancellations]);`;

code = code.replace(regex2, replacement2);

fs.writeFileSync('src/views/AdminDashboard.jsx', code);
console.log('Fixed AdminDashboard CA Cancel Logic');
