const fs = require('fs');

function replaceSafely(filePath, searchLines, replacementLines) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Create clean versions ignoring spaces
    const searchClean = searchLines.join('').replace(/\s+/g, '');
    let found = false;
    
    // Simple fast search first
    if (content.includes(searchLines.join('\n'))) {
        content = content.replace(searchLines.join('\n'), replacementLines.join('\n'));
        found = true;
    } 
    // Fallback if line endings differ
    else if (content.includes(searchLines.join('\r\n'))) {
        content = content.replace(searchLines.join('\r\n'), replacementLines.join('\r\n'));
        found = true;
    }
    // Deep fallback ignoring whitespaces
    else {
        // Build regex that ignores whitespace
        const regexStr = searchLines.map(line => line.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
        const regex = new RegExp(regexStr);
        if (regex.test(content)) {
            content = content.replace(regex, replacementLines.join('\n'));
            found = true;
        }
    }
    
    if (found) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Patched ' + filePath);
    } else {
        console.log('Not found in ' + filePath);
    }
}

// 1. AdminDashboard.jsx
replaceSafely('src/views/AdminDashboard.jsx',
    [
        '// \uD83D\uDD25 N7iydou l-Commandes dyal POS (Caisse) mn Idara bach yb9aw ghi dyal l-Livraison (App/T\u00E9l)',
        '        const idaraActiveOrders = bOrders.filter(o => o.source !== \'pos\');'
    ],
    [
        '// \uD83D\uDD25 N7iydou l-Commandes dyal POS (Caisse) w Glovo mn Idara bach yb9aw ghi dyal l-Livraison (App/T\u00E9l)',
        '        const idaraActiveOrders = bOrders.filter(o => o.source !== \'pos\' && o.source !== \'glovo\');'
    ]
);

// 2. AdminActiveOrders.jsx
replaceSafely('src/components/admin/AdminActiveOrders.jsx',
    [
        '{!o.driverId && o.status !== \'pending\' && (',
        '                                    <button onClick={(e)=>{ e.stopPropagation(); handleReassignOrder(o, null, true); }}'
    ],
    [
        '{!o.driverId && o.status !== \'pending\' && o.source !== \'glovo\' && (',
        '                                    <button onClick={(e)=>{ e.stopPropagation(); handleReassignOrder(o, null, true); }}'
    ]
);

replaceSafely('src/components/admin/AdminActiveOrders.jsx',
    [
        '{!o.driverId && o.status !== \'pending\' && (onlineDrivers||[]).filter(d => isDriverOnline(d)).length > 0 && (',
        '                                    <select '
    ],
    [
        '{!o.driverId && o.status !== \'pending\' && o.source !== \'glovo\' && (onlineDrivers||[]).filter(d => isDriverOnline(d)).length > 0 && (',
        '                                    <select '
    ]
);

// 3. AdminConfig.jsx
replaceSafely('src/components/admin/AdminConfig.jsx',
    [
        '{ id: \'commandes_web\', label: \'Commandes Web\' },',
        '                                            { id: \'problemes\', label: \'Probl\u00E8mes\' },'
    ],
    [
        '{ id: \'commandes_web\', label: \'Commandes Web\' },',
        '                                            { id: \'glovo\', label: \'Bouton Glovo\' },',
        '                                            { id: \'problemes\', label: \'Probl\u00E8mes\' },'
    ]
);

replaceSafely('src/components/admin/AdminConfig.jsx',
    [
        'let branchPosBtns = b[idx].posButtons || [\'commandes_web\', \'problemes\', \'suivi\', \'pretes\', \'tv\', \'standard\', \'kds\', \'quitter\'];'
    ],
    [
        'let branchPosBtns = b[idx].posButtons || [\'commandes_web\', \'glovo\', \'problemes\', \'suivi\', \'pretes\', \'tv\', \'standard\', \'kds\', \'quitter\'];'
    ]
);

// 4. KitchenDashboard.jsx
replaceSafely('src/components/admin/KitchenDashboard.jsx',
    [
        'if (source === \'livreur\') return {'
    ],
    [
        'if (source === \'glovo\') return {',
        '            cardClass: \'border-2 \' + (index === 0 ? \'border-[#FFC244] ring-4 ring-[#FFF3D6] ring-offset-4 scale-[1.02]\' : \'border-[#FFE199]\'),',
        '            cardStyle: { backgroundColor: \'#FFFDF8\' },',
        '            topClass: \'bg-[#FFC244]\',',
        '            topStyle: { color: \'#000\' },',
        '            headerClass: \'bg-[#FFF9EA]\',',
        '            headerStyle: {},',
        '            tagClass: \'bg-[#FFFDF8] text-[#B8860B] border-[#FFE199]\',',
        '            tagStyle: {}',
        '        };',
        '        if (source === \'livreur\') return {'
    ]
);

replaceSafely('src/components/admin/KitchenDashboard.jsx',
    [
        '<h3 className="font-black text-xl truncate">{o.customerName || (o.source === \'table\' ? \'Table \' + (o.tableNumber||\'\') : \'Client \' + o.source)}</h3>'
    ],
    [
        '<h3 className="font-black text-xl truncate flex items-center gap-2">',
        '                                            {o.customerName || (o.source === \'table\' ? \'Table \' + (o.tableNumber||\'\') : \'Client \' + o.source)}',
        '                                            {o.source === \'glovo\' && (',
        '                                                <img src="https://upload.wikimedia.org/wikipedia/en/8/82/Glovo_logo.svg" alt="Glovo" className="h-4 object-contain ml-1 drop-shadow-sm" />',
        '                                            )}',
        '                                        </h3>'
    ]
);

replaceSafely('src/components/admin/KitchenDashboard.jsx',
    [
        '{o.customerName || (o.source === \'table\' ? \'Table \' + (o.tableNumber||\'\') : \'Client \' + o.source)}',
        '                                                {o.source === \'pos\' && <div className="text-[10px] bg-white text-blue-600 px-2 py-0.5 rounded shadow-sm border border-blue-100 ml-2 font-black uppercase inline-block">Caisse</div>}'
    ],
    [
        '{o.customerName || (o.source === \'table\' ? \'Table \' + (o.tableNumber||\'\') : \'Client \' + o.source)}',
        '                                                {o.source === \'pos\' && <div className="text-[10px] bg-white text-blue-600 px-2 py-0.5 rounded shadow-sm border border-blue-100 ml-2 font-black uppercase inline-block">Caisse</div>}',
        '                                                {o.source === \'glovo\' && (',
        '                                                    <img src="https://upload.wikimedia.org/wikipedia/en/8/82/Glovo_logo.svg" alt="Glovo" className="h-3 object-contain ml-1" />',
        '                                                )}'
    ]
);

// 5. PosDashboard.jsx
replaceSafely('src/views/PosDashboard.jsx',
    [
        'const onlineOrders = (orders || []).filter(o => {'
    ],
    [
        'const onlineOrders = (orders || []).filter(o => {',
        '          if (o.source === \'glovo\') return false;'
    ]
);

replaceSafely('src/views/PosDashboard.jsx',
    [
        'const readyPosOrders = (orders || []).filter(o => o.source === \'pos\' && (activeBranchId === \'ALL\' || o.nearestBranch?.id === activeBranchId) && o.status === \'ready\');'
    ],
    [
        'const readyPosOrders = (orders || []).filter(o => o.source === \'pos\' && (activeBranchId === \'ALL\' || o.nearestBranch?.id === activeBranchId) && o.status === \'ready\');',
        '    const readyGlovoOrders = (orders || []).filter(o => o.source === \'glovo\' && (activeBranchId === \'ALL\' || o.nearestBranch?.id === activeBranchId) && o.status === \'ready\');'
    ]
);

replaceSafely('src/views/PosDashboard.jsx',
    [
        'const [showOnlineOrdersModal, setShowOnlineOrdersModal] = useState(false);'
    ],
    [
        'const [showOnlineOrdersModal, setShowOnlineOrdersModal] = useState(false);',
        '    const [showGlovoModal, setShowGlovoModal] = useState(false);'
    ]
);

replaceSafely('src/views/PosDashboard.jsx',
    [
        '{renderHeaderButton(\'pretes\', <CheckCircle size={18} />, brand?.texts?.btnPretes || \'Pr\u00EAtes (Servir)\', readyPosOrders.length > 0 ? \'bg-green-500 text-white animate-pulse border border-green-600\' : (preteBg ? \'\' : \'bg-green-50 border border-green-200 text-green-700 hover:bg-green-100\'), () => setShowReadyPosModal(true), readyPosOrders.length, preteBg, preteTxt)}'
    ],
    [
        '{renderHeaderButton(\'pretes\', <CheckCircle size={18} />, brand?.texts?.btnPretes || \'Pr\u00EAtes (Servir)\', readyPosOrders.length > 0 ? \'bg-green-500 text-white animate-pulse border border-green-600\' : (preteBg ? \'\' : \'bg-green-50 border border-green-200 text-green-700 hover:bg-green-100\'), () => setShowReadyPosModal(true), readyPosOrders.length, preteBg, preteTxt)}',
        '                    {renderHeaderButton(\'glovo\', <img src="https://upload.wikimedia.org/wikipedia/en/8/82/Glovo_logo.svg" alt="Glovo" className="h-5 object-contain" />, \'Glovo Pr\u00EAtes\', readyGlovoOrders.length > 0 ? \'bg-[#FFC244] text-black animate-pulse border-2 border-black/10\' : \'bg-gray-100 text-gray-400\', () => readyGlovoOrders.length > 0 && setShowGlovoModal(true), readyGlovoOrders.length)}'
    ]
);

replaceSafely('src/views/PosDashboard.jsx',
    [
        '{/* MODAL DE SUIVI DES COMMANDES DU POS */}'
    ],
    [
        '{/* MODAL COMMANDES PR\u00CATES GLOVO */}',
        '            {showGlovoModal && (',
        '                <div className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={() => setShowGlovoModal(false)}>',
        '                    <div className="bg-white rounded-[2.5rem] w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>',
        '                        <div className="bg-[#FFC244] p-5 flex justify-between items-center shrink-0">',
        '                            <div className="flex items-center gap-3">',
        '                                <div className="bg-white p-2 rounded-xl">',
        '                                    <img src="https://upload.wikimedia.org/wikipedia/en/8/82/Glovo_logo.svg" alt="Glovo" className="h-6 object-contain" />',
        '                                </div>',
        '                                <h2 className="text-2xl font-black text-black uppercase tracking-tight">Commandes Glovo Pr\u00EAtes ({readyGlovoOrders.length})</h2>',
        '                            </div>',
        '                            <button onClick={() => setShowGlovoModal(false)} className="bg-black/10 text-black hover:bg-black/20 p-2 rounded-xl transition-colors">',
        '                                <X size={28} strokeWidth={2.5}/>',
        '                            </button>',
        '                        </div>',
        '                        <div className="p-6 overflow-y-auto flex-1 bg-gray-50">',
        '                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">',
        '                                {readyGlovoOrders.length === 0 ? (',
        '                                    <div className="col-span-full py-12 text-center text-gray-400 font-bold">Aucune commande Glovo pr\u00EAte</div>',
        '                                ) : (',
        '                                    readyGlovoOrders.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).map(o => (',
        '                                        <div key={o.id} className="bg-white p-5 rounded-2xl border-2 border-[#FFC244] shadow-sm flex flex-col gap-2 items-center text-center">',
        '                                            <span className="text-xs font-black text-gray-400 uppercase tracking-widest">N\u00B0 de Commande</span>',
        '                                            <span className="text-4xl font-black text-black tracking-tighter">#{o.orderNumber || o.id.slice(-4).toUpperCase()}</span>',
        '                                            {o.paymentMethod === \'espece\' || o.paymentMethod === \'cash\' ? (',
        '                                                <span className="mt-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border border-green-200 shadow-sm">',
        '                                                    \uD83D\uDCB0 \u00C0 payer en Esp\u00E8ces ({(o.total || 0).toFixed(2)} DH)',
        '                                                </span>',
        '                                            ) : (',
        '                                                <span className="mt-1 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border border-blue-200 shadow-sm">',
        '                                                    \uD83D\uDCB3 Pay\u00E9 en Ligne',
        '                                                </span>',
        '                                            )}',
        '                                        </div>',
        '                                    ))',
        '                                )}',
        '                            </div>',
        '                        </div>',
        '                    </div>',
        '                </div>',
        '            )}',
        '',
        '            {/* MODAL DE SUIVI DES COMMANDES DU POS */}'
    ]
);
