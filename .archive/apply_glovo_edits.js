const fs = require('fs');

function replaceSafely(filePath, target, replacement) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (!content.includes(target)) {
        console.error('Target not found in ' + filePath);
        // Try substring search
        return;
    }
    content = content.replace(target, replacement);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Successfully patched ' + filePath);
}

// 1. AdminDashboard.jsx
replaceSafely(
    'src/views/AdminDashboard.jsx',
    // 🔥 N7iydou l-Commandes dyal POS (Caisse) mn Idara bach yb9aw ghi dyal l-Livraison (App/Tél)\n        const idaraActiveOrders = bOrders.filter(o => o.source !== \\'pos\\');,
    // 🔥 N7iydou l-Commandes dyal POS (Caisse) w Glovo mn Idara bach yb9aw ghi dyal l-Livraison (App/Tél)\n        const idaraActiveOrders = bOrders.filter(o => o.source !== \\'pos\\' && o.source !== \\'glovo\\');
);

// 2. AdminActiveOrders.jsx
replaceSafely(
    'src/components/admin/AdminActiveOrders.jsx',
    {!o.driverId && o.status !== \\'pending\\' && (\n                                    <button onClick={(e)=>{ e.stopPropagation(); handleReassignOrder(o, null, true); }},
    {!o.driverId && o.status !== \\'pending\\' && o.source !== \\'glovo\\' && (\n                                    <button onClick={(e)=>{ e.stopPropagation(); handleReassignOrder(o, null, true); }}
);
replaceSafely(
    'src/components/admin/AdminActiveOrders.jsx',
    {!o.driverId && o.status !== \\'pending\\' && (onlineDrivers||[]).filter(d => isDriverOnline(d)).length > 0 && (\n                                    <select ,
    {!o.driverId && o.status !== \\'pending\\' && o.source !== \\'glovo\\' && (onlineDrivers||[]).filter(d => isDriverOnline(d)).length > 0 && (\n                                    <select 
);

// 3. AdminConfig.jsx
replaceSafely(
    'src/components/admin/AdminConfig.jsx',
                                                { id: \\'commandes_web\\', label: \\'Commandes Web\\' },\n                                            { id: \\'problemes\\', label: \\'Problèmes\\' },,
                                                { id: \\'commandes_web\\', label: \\'Commandes Web\\' },\n                                            { id: \\'glovo\\', label: \\'Bouton Glovo\\' },\n                                            { id: \\'problemes\\', label: \\'Problèmes\\' },
);
replaceSafely(
    'src/components/admin/AdminConfig.jsx',
    let branchPosBtns = b[idx].posButtons || [\\'commandes_web\\', \\'problemes\\', \\'suivi\\', \\'pretes\\', \\'tv\\', \\'standard\\', \\'kds\\', \\'quitter\\'];,
    let branchPosBtns = b[idx].posButtons || [\\'commandes_web\\', \\'glovo\\', \\'problemes\\', \\'suivi\\', \\'pretes\\', \\'tv\\', \\'standard\\', \\'kds\\', \\'quitter\\'];
);

// 4. KitchenDashboard.jsx
replaceSafely(
    'src/components/admin/KitchenDashboard.jsx',
    if (source === \\'livreur\\') return {,
    if (source === \\'glovo\\') return {
            cardClass: \order-2 \\,
            cardStyle: { backgroundColor: \\'#FFFDF8\\' },
            topClass: \\'bg-[#FFC244]\\',
            topStyle: { color: \\'#000\\' },
            headerClass: \\'bg-[#FFF9EA]\\',
            headerStyle: {},
            tagClass: \\'bg-[#FFFDF8] text-[#B8860B] border-[#FFE199]\\',
            tagStyle: {}
        };
        if (source === \\'livreur\\') return {
);

replaceSafely(
    'src/components/admin/KitchenDashboard.jsx',
    <h3 className="font-black text-xl truncate">{o.customerName || (o.source === \\'table\\' ? \\'Table \\' + (o.tableNumber||\\'\\') : \\'Client \\' + o.source)}</h3>,
    <h3 className="font-black text-xl truncate flex items-center gap-2">
                                            {o.customerName || (o.source === \\'table\\' ? \\'Table \\' + (o.tableNumber||\\'\\') : \\'Client \\' + o.source)}
                                            {o.source === \\'glovo\\' && (
                                                <img src="https://upload.wikimedia.org/wikipedia/en/8/82/Glovo_logo.svg" alt="Glovo" className="h-4 object-contain ml-1 drop-shadow-sm" />
                                            )}
                                        </h3>
);

replaceSafely(
    'src/components/admin/KitchenDashboard.jsx',
    {o.customerName || (o.source === \\'table\\' ? \\'Table \\' + (o.tableNumber||\\'\\') : \\'Client \\' + o.source)},
    {o.customerName || (o.source === \\'table\\' ? \\'Table \\' + (o.tableNumber||\\'\\') : \\'Client \\' + o.source)}
                                                {o.source === \\'glovo\\' && (
                                                    <img src="https://upload.wikimedia.org/wikipedia/en/8/82/Glovo_logo.svg" alt="Glovo" className="h-3 object-contain ml-1" />
                                                )}
);

console.log("Done");
