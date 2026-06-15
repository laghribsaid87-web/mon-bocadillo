const fs = require('fs');

function applyRegexSafe(filePath, patternStr, replacementStr) {
    let content = fs.readFileSync(filePath, 'utf8');
    const rx = new RegExp(patternStr, 'g');
    if (!rx.test(content)) {
        console.error('Target not found in ' + filePath + ': ' + patternStr.slice(0, 50));
        return;
    }
    content = content.replace(rx, replacementStr);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Successfully patched ' + filePath);
}

// AdminDashboard.jsx
applyRegexSafe('src/views/AdminDashboard.jsx', 
    '\\/\\/ 🔥 N7iydou l-Commandes dyal POS \\(Caisse\\) mn Idara bach yb9aw ghi dyal l-Livraison \\(App\\/Tél\\)\\s*const idaraActiveOrders = bOrders\\.filter\\(o => o\\.source !== \\\'pos\\\'\\);',
    '// 🔥 N7iydou l-Commandes dyal POS (Caisse) w Glovo mn Idara bach yb9aw ghi dyal l-Livraison (App/Tél)\n        const idaraActiveOrders = bOrders.filter(o => o.source !== \'pos\' && o.source !== \'glovo\');'
);

// AdminActiveOrders.jsx
applyRegexSafe('src/components/admin/AdminActiveOrders.jsx',
    '\\{!o\\.driverId && o\\.status !== \\\'pending\\\' && \\(\\s*<button onClick=\\{\\(e\\)=>\\{\\s*e\\.stopPropagation\\(\\);\\s*handleReassignOrder\\(o, null, true\\);\\s*\\}\\}',
    '{!o.driverId && o.status !== \'pending\' && o.source !== \'glovo\' && (\n                                    <button onClick={(e)=>{ e.stopPropagation(); handleReassignOrder(o, null, true); }}'
);

applyRegexSafe('src/components/admin/AdminActiveOrders.jsx',
    '\\{!o\\.driverId && o\\.status !== \\\'pending\\\' && \\(onlineDrivers\\|\\|\\[\\]\\)\\.filter\\(d => isDriverOnline\\(d\\)\\)\\.length > 0 && \\(\\s*<select ',
    '{!o.driverId && o.status !== \'pending\' && o.source !== \'glovo\' && (onlineDrivers||[]).filter(d => isDriverOnline(d)).length > 0 && (\n                                    <select '
);

// AdminConfig.jsx
applyRegexSafe('src/components/admin/AdminConfig.jsx',
    '\\{\\s*id:\\s*\\\'commandes_web\\\',\\s*label:\\s*\\\'Commandes Web\\\'\\s*\\},\\s*\\{\\s*id:\\s*\\\'problemes\\\',\\s*label:\\s*\\\'Problèmes\\\'\\s*\\},',
    '{ id: \'commandes_web\', label: \'Commandes Web\' },\n                                            { id: \'glovo\', label: \'Bouton Glovo\' },\n                                            { id: \'problemes\', label: \'Problèmes\' },'
);

applyRegexSafe('src/components/admin/AdminConfig.jsx',
    'let branchPosBtns = b\\[idx\\]\\.posButtons \\|\\| \\[\\\'commandes_web\\\', \\\'problemes\\\', \\\'suivi\\\', \\\'pretes\\\', \\\'tv\\\', \\\'standard\\\', \\\'kds\\\', \\\'quitter\\\'\\];',
    'let branchPosBtns = b[idx].posButtons || [\'commandes_web\', \'glovo\', \'problemes\', \'suivi\', \'pretes\', \'tv\', \'standard\', \'kds\', \'quitter\'];'
);

// KitchenDashboard.jsx
applyRegexSafe('src/components/admin/KitchenDashboard.jsx',
    'if \\(source === \\\'livreur\\\'\\) return \\{',
    'if (source === \'glovo\') return {\n            cardClass: \'border-2 \' + (index === 0 ? \'border-[#FFC244] ring-4 ring-[#FFF3D6] ring-offset-4 scale-[1.02]\' : \'border-[#FFE199]\'),\n            cardStyle: { backgroundColor: \'#FFFDF8\' },\n            topClass: \'bg-[#FFC244]\',\n            topStyle: { color: \'#000\' },\n            headerClass: \'bg-[#FFF9EA]\',\n            headerStyle: {},\n            tagClass: \'bg-[#FFFDF8] text-[#B8860B] border-[#FFE199]\',\n            tagStyle: {}\n        };\n        if (source === \'livreur\') return {'
);

applyRegexSafe('src/components/admin/KitchenDashboard.jsx',
    '<h3 className=\"font-black text-xl truncate\">\\{o\\.customerName \\|\\| \\(o\\.source === \\\'table\\\' \\? \\\'Table \\\' \\+ \\(o\\.tableNumber\\|\\|\\\'\\\'\\) : \\\'Client \\\' \\+ o\\.source\\)\\}<\\/h3>',
    '<h3 className="font-black text-xl truncate flex items-center gap-2">\n                                            {o.customerName || (o.source === \'table\' ? \'Table \' + (o.tableNumber||\'\') : \'Client \' + o.source)}\n                                            {o.source === \'glovo\' && (\n                                                <img src="https://upload.wikimedia.org/wikipedia/en/8/82/Glovo_logo.svg" alt="Glovo" className="h-4 object-contain ml-1 drop-shadow-sm" />\n                                            )}\n                                        </h3>'
);

applyRegexSafe('src/components/admin/KitchenDashboard.jsx',
    '\\{o\\.customerName \\|\\| \\(o\\.source === \\\'table\\\' \\? \\\'Table \\\' \\+ \\(o\\.tableNumber\\|\\|\\\'\\\'\\) : \\\'Client \\\' \\+ o\\.source\\)\\}\\s*\\{o\\.source === \\\'pos\\\' && <div className=\"text-\\[10px\\] bg-white text-blue-600 px-2 py-0\\.5 rounded shadow-sm border border-blue-100 ml-2 font-black uppercase inline-block\">Caisse<\\/div>\\}',
    '{o.customerName || (o.source === \'table\' ? \'Table \' + (o.tableNumber||\'\') : \'Client \' + o.source)}\n                                                {o.source === \'pos\' && <div className="text-[10px] bg-white text-blue-600 px-2 py-0.5 rounded shadow-sm border border-blue-100 ml-2 font-black uppercase inline-block">Caisse</div>}\n                                                {o.source === \'glovo\' && (\n                                                    <img src="https://upload.wikimedia.org/wikipedia/en/8/82/Glovo_logo.svg" alt="Glovo" className="h-3 object-contain ml-1" />\n                                                )}'
);

// PosDashboard.jsx
applyRegexSafe('src/views/PosDashboard.jsx',
    'const readyWebOrders = onlineOrders\\.filter\\(o => o\\.status === \\\'ready\\\'\\);',
    'const readyWebOrders = onlineOrders.filter(o => o.status === \'ready\' && o.source !== \'glovo\');\n    const readyGlovoOrders = onlineOrders.filter(o => o.status === \'ready\' && o.source === \'glovo\');'
);

applyRegexSafe('src/views/PosDashboard.jsx',
    'const filteredOnlineOrders = onlineOrders\\.filter\\(o => o\\.status !== \\\'ready\\\'\\);',
    'const filteredOnlineOrders = onlineOrders.filter(o => o.status !== \'ready\' && o.source !== \'glovo\');'
);

applyRegexSafe('src/views/PosDashboard.jsx',
    'const \\[showReadyModal, setShowReadyModal\\] = useState\\(false\\);',
    'const [showReadyModal, setShowReadyModal] = useState(false);\n    const [showGlovoModal, setShowGlovoModal] = useState(false);'
);

applyRegexSafe('src/views/PosDashboard.jsx',
    '\\{renderHeaderButton\\(\\\'pretes\\\', <CheckCircle size=\\{20\\}\\/>, brand\\.texts\\?\\.btnReady \\|\\| \\\'Prêtes \\(Servir\\)\\\', readyWebOrders\\.length > 0 \\? \\\'bg-green-500 text-white animate-pulse\\\' : \\\'bg-gray-100 text-gray-400\\\', \\(\\) => readyWebOrders\\.length > 0 && setShowReadyModal\\(true\\), readyWebOrders\\.length\\)\\}',
    '{renderHeaderButton(\'pretes\', <CheckCircle size={20}/>, brand.texts?.btnReady || \'Prêtes (Servir)\', readyWebOrders.length > 0 ? \'bg-green-500 text-white animate-pulse\' : \'bg-gray-100 text-gray-400\', () => readyWebOrders.length > 0 && setShowReadyModal(true), readyWebOrders.length)}\n                    {renderHeaderButton(\'glovo\', <img src="https://upload.wikimedia.org/wikipedia/en/8/82/Glovo_logo.svg" alt="Glovo" className="h-5 object-contain" />, \'Glovo Prêtes\', readyGlovoOrders.length > 0 ? \'bg-[#FFC244] text-black animate-pulse border-2 border-black/10\' : \'bg-gray-100 text-gray-400\', () => readyGlovoOrders.length > 0 && setShowGlovoModal(true), readyGlovoOrders.length)}'
);

applyRegexSafe('src/views/PosDashboard.jsx',
    '\\{\\/\\* MODAL COMMANDES PRÊTES \\(WEB\\/APP\\) \\*\\/\\}',
    `{/* MODAL COMMANDES PRÊTES GLOVO */}
        {showGlovoModal && (
            <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={() => setShowGlovoModal(false)}>
                <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="bg-[#FFC244] p-5 flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="bg-white p-2 rounded-xl">
                                <img src="https://upload.wikimedia.org/wikipedia/en/8/82/Glovo_logo.svg" alt="Glovo" className="h-6 object-contain" />
                            </div>
                            <h2 className="text-2xl font-black text-black uppercase tracking-tight">Commandes Glovo Prêtes ({readyGlovoOrders.length})</h2>
                        </div>
                        <button onClick={() => setShowGlovoModal(false)} className="bg-black/10 text-black hover:bg-black/20 p-2 rounded-xl transition-colors">
                            <X size={28} strokeWidth={2.5}/>
                        </button>
                    </div>
                    <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {readyGlovoOrders.length === 0 ? (
                                <div className="col-span-full py-12 text-center text-gray-400 font-bold">Aucune commande Glovo prête</div>
                            ) : (
                                readyGlovoOrders.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).map(o => (
                                    <div key={o.id} className="bg-white p-5 rounded-2xl border-2 border-[#FFC244] shadow-sm flex flex-col gap-2 items-center text-center">
                                        <span className="text-xs font-black text-gray-400 uppercase tracking-widest">N° de Commande</span>
                                        <span className="text-4xl font-black text-black tracking-tighter">#{o.orderNumber || o.id.slice(-4).toUpperCase()}</span>
                                        {o.paymentMethod === 'espece' || o.paymentMethod === 'cash' ? (
                                            <span className="mt-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border border-green-200 shadow-sm">
                                                💰 À payer en Espèces ({(o.total || 0).toFixed(2)} DH)
                                            </span>
                                        ) : (
                                            <span className="mt-1 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border border-blue-200 shadow-sm">
                                                💳 Payé en Ligne
                                            </span>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL COMMANDES PRÊTES (WEB/APP) */}`
);
