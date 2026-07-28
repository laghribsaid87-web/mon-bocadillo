const fs = require('fs');
const path = 'C:/Users/pc/Desktop/mon-bocadillo/functions/index.js';
let content = fs.readFileSync(path, 'utf8');

const oldBlock = `exports.syncStatusToGlovo = functions.firestore
    .document('artifacts/{appId}/public/data/orders/{orderId}')
    .onWrite(async (change, context) => {
        const newData = change.after.data();
        const oldData = change.before.data();

        // Vérifier wach l-commande dyal Glovo w wach l-Statut tbeddel
        if (newData.source !== 'glovo' || newData.status === oldData.status) return null;`;

const newBlock = `exports.syncStatusToGlovo = functions.firestore
    .document('artifacts/{appId}/public/data/orders/{orderId}')
    .onWrite(async (change, context) => {
        const newData = change.after.exists ? change.after.data() : null;
        const oldData = change.before.exists ? change.before.data() : null;

        // Vérifier wach l-commande dyal Glovo w wach l-Statut tbeddel
        if (!newData || newData.source !== 'glovo') return null;
        if (oldData && newData.status === oldData.status) return null;`;

content = content.replace(oldBlock, newBlock);
fs.writeFileSync(path, content);
console.log('Fixed index.js');
