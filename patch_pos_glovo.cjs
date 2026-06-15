const fs = require('fs');

function replaceSafely(filePath, searchLines, replacementLines) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Simple fast search first
    if (content.includes(searchLines.join('\n'))) {
        content = content.replace(searchLines.join('\n'), replacementLines.join('\n'));
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Patched ' + filePath + ' (LF)');
        return;
    } 
    if (content.includes(searchLines.join('\r\n'))) {
        content = content.replace(searchLines.join('\r\n'), replacementLines.join('\r\n'));
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Patched ' + filePath + ' (CRLF)');
        return;
    }
    
    // Deep fallback ignoring whitespaces
    const regexStr = searchLines.map(line => line.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
    const regex = new RegExp(regexStr);
    if (regex.test(content)) {
        content = content.replace(regex, replacementLines.join('\n'));
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Patched ' + filePath + ' (Regex)');
    } else {
        console.log('Not found in ' + filePath);
    }
}

const file = 'src/views/PosDashboard.jsx';

// 1. Add state variable
replaceSafely(file,
    [
        'const [showReadyPosModal, setShowReadyPosModal] = useState(false);'
    ],
    [
        'const [showReadyPosModal, setShowReadyPosModal] = useState(false);',
        '    const [showGlovoModal, setShowGlovoModal] = useState(false);'
    ]
);

// 2. Add glovo case to header buttons
replaceSafely(file,
    [
        'case \'pretes\':',
        '                const preteBg = brand?.btnPosPretesColor || \'\';'
    ],
    [
        'case \'glovo\':',
        '                return (',
        '                    <button key={btnId} {...dragProps} style={{ width: `${posUI.actionBtnWidth}px`, height: `${posUI.actionBtnHeight}px` }} onClick={() => setShowGlovoModal(true)} className={`${baseClass} ${readyGlovoOrders.length > 0 ? \'bg-[#FFC244] text-black animate-pulse border-2 border-black/10\' : \'bg-gray-50 border border-gray-200 text-gray-500 hover:bg-gray-100\'}`}>',
        '                        <img src="https://upload.wikimedia.org/wikipedia/en/8/82/Glovo_logo.svg" alt="Glovo" className="h-4 object-contain" /> <span className="hidden sm:inline">Glovo</span>',
        '                        {readyGlovoOrders.length > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-black shadow-md">{readyGlovoOrders.length}</span>}',
        '                    </button>',
        '                );',
        '            case \'pretes\':',
        '                const preteBg = brand?.btnPosPretesColor || \'\';'
    ]
);

// 3. Add Glovo Modal
replaceSafely(file,
    [
        '{/* MODAL COMMANDES PR',
        'TES (',
        ' SERVIR) */}'
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
        '            {/* MODAL COMMANDES PR\u00CATES (\u00C0 SERVIR) */}'
    ]
);
