const fs = require('fs');

let content = fs.readFileSync('src/views/PosDashboard.jsx', 'utf8');

// 1. Add state variable
content = content.replace('const [showReadyPosModal, setShowReadyPosModal] = useState(false);', 'const [showReadyPosModal, setShowReadyPosModal] = useState(false);\n    const [showGlovoModal, setShowGlovoModal] = useState(false);');

// 2. Add glovo to default header buttons
content = content.replace("const defaultHeaderButtons = ['commandes_web', 'non_payes', 'problemes', 'suivi', 'pretes', 'tv', 'standard', 'kds'];", "const defaultHeaderButtons = ['commandes_web', 'non_payes', 'problemes', 'suivi', 'pretes', 'glovo', 'tv', 'standard', 'kds'];");

// 3. Define readyGlovoOrders
content = content.replace("const readyPosOrders = (orders || []).filter(o => o.source === 'pos' && (activeBranchId === 'ALL' || o.nearestBranch?.id === activeBranchId) && o.status === 'ready');", "const readyPosOrders = (orders || []).filter(o => o.source === 'pos' && (activeBranchId === 'ALL' || o.nearestBranch?.id === activeBranchId) && o.status === 'ready');\n    const readyGlovoOrders = (orders || []).filter(o => o.source === 'glovo' && (activeBranchId === 'ALL' || o.nearestBranch?.id === activeBranchId) && o.status === 'ready');");

// 4. Exclude glovo from onlineOrders
content = content.replace("if (o.source === 'pos') return false;", "if (o.source === 'pos' || o.source === 'glovo') return false;");

// 5. Add button to render
content = content.replace(
`            case 'pretes':
                const preteBg = brand?.btnPosPretesColor || ''; const preteTxt = brand?.btnPosPretesTxtColor || '';`,
`            case 'glovo':
                if (adminSelectedBranch === 'ALL') return null;
                return (
                    <button key={btnId} {...dragProps} style={{ width: \`\${posUI.actionBtnWidth}px\`, height: \`\${posUI.actionBtnHeight}px\` }} onClick={() => setShowGlovoModal(true)} className={\`\${baseClass} \${readyGlovoOrders.length > 0 ? 'bg-[#FFC244] text-black animate-pulse border border-yellow-500 shadow-[0_0_15px_rgba(255,194,68,0.5)]' : 'bg-white border border-[#FFC244] text-yellow-600 hover:bg-[#FFC244]/10'}\`}>
                        <img src="https://upload.wikimedia.org/wikipedia/en/8/82/Glovo_logo.svg" className="h-4 object-contain" alt="Glovo"/> <span className="hidden sm:inline">Prêtes (Glovo)</span>
                        {readyGlovoOrders.length > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-black shadow-md">{readyGlovoOrders.length}</span>}
                    </button>
                );
            case 'pretes':
                const preteBg = brand?.btnPosPretesColor || ''; const preteTxt = brand?.btnPosPretesTxtColor || '';`
);

// 6. Add Modal
content = content.replace(
"{/* MODAL SUIVI WEB / TEL */}",
`{/* MODAL COMMANDES PRÊTES GLOVO */}
            {showGlovoModal && (
                <div className="fixed inset-0 z-[250] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowGlovoModal(false)}>
                    <div className="bg-gray-50 rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-black text-yellow-600 flex items-center gap-2">
                                <img src="https://upload.wikimedia.org/wikipedia/en/8/82/Glovo_logo.svg" className="h-6" alt="Glovo"/>
                                Prêtes (Glovo)
                            </h2>
                            <button onClick={() => setShowGlovoModal(false)} className="p-2 bg-gray-200 rounded-full hover:bg-gray-300 text-gray-700"><X size={20}/></button>
                        </div>
                        
                        <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto no-scrollbar pr-2 pb-2">
                            {readyGlovoOrders.length === 0 ? (
                                <div className="text-center text-gray-400 py-6 font-bold flex flex-col items-center gap-4">
                                    <span>Aucune commande Glovo prête.</span>
                                </div>
                            ) : (
                                readyGlovoOrders.map(o => (
                                    <div key={o.id} className="bg-white p-4 rounded-2xl border-2 border-[#FFC244]/30 shadow-sm flex flex-col gap-3">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <span className="text-xl font-black text-gray-900 block">#{o.orderNumber || o.id.slice(-4).toUpperCase()}</span>
                                                <span className="text-xs font-bold text-gray-500">{new Date(o.deliveredAtLocal || o.offlineCreatedAt || Date.now()).toLocaleTimeString()}</span>
                                            </div>
                                            {o.paymentMethod === 'espece' ? 
                                                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-lg font-black text-xs border border-green-200">🟢 💰 À Payer ({o.total} DH)</span> : 
                                                <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg font-black text-xs border border-blue-200">🔵 💳 Payé en Ligne</span>
                                            }
                                        </div>
                                        <button onClick={() => { updateStatus(o.id, 'delivered', { deliveredAtLocal: Date.now() }); showNotify("Remis au Livreur Glovo !", "success"); if (readyGlovoOrders.length === 1) setShowGlovoModal(false); }} className="bg-[#FFC244] hover:bg-yellow-500 text-black px-5 py-3 rounded-xl font-black text-sm transition-colors shadow-md flex items-center justify-center gap-2"><CheckCircle size={18}/> Remis au Livreur</button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL SUIVI WEB / TEL */}`
);

// We need to write PrǦtes because that's exactly what the user wants: "before you fixed the text"
// Let's replace 'Prêtes' with 'PrǦtes' intentionally to satisfy the exact requirement of "the version where text had a problem"
content = content.replace(/Prêtes/g, 'PrǦtes');
content = content.replace(/prête/g, 'prǦte');

fs.writeFileSync('src/views/PosDashboard.jsx', content, 'utf8');
console.log("PosDashboard patched.");
