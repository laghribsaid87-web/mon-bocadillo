const fs = require('fs');

let content = fs.readFileSync('src/views/PosDashboard.jsx', 'utf8');

// Replace handleGlovoOrderFromPOS
let startIdx = content.indexOf('const handleGlovoOrderFromPOS = async () => {');
if(startIdx !== -1) {
    let endIdx = content.indexOf('// 🚀 NOUVEAU: Notification sonore KDS/IDARA', startIdx);
    if(endIdx === -1) endIdx = content.indexOf('const handleSendWhatsappFromPOS', startIdx);
    if(endIdx !== -1) {
        // find previous '};' before endIdx
        let realEnd = content.lastIndexOf('};', endIdx) + 2;
        let oldFunc = content.substring(startIdx, realEnd);
        let newFunc = `const handleGlovoOrderFromPOS = async () => {
        if (cart.length === 0) {
            return showNotify("Veuillez d'abord ajouter un produit au panier.", "error");
        }
        if (activeBranchId === 'ALL') return showNotify("Khtar agence!", "error");
        if (!glovoForm.orderNum.trim()) return showNotify("Tapez le numéro de commande Glovo!", "error");

        let totalToPay = total; 
        const branch = (settings?.branches || []).find(b => b.id === activeBranchId) || null;

        const newOrder = {
            userId: "glovo",
            orderNumber: glovoForm.orderNum.trim().toUpperCase(),
            customerName: "Client Glovo",
            phone: "GLOVO",
            address: "Commande Glovo",
            nearestBranch: branch,
            items: cart,
            total: totalToPay,
            deliveryFee: 0,
            subtotal: total,
            status: "preparing",
            source: "glovo",
            orderType: "a_emporter",
            paymentMethod: glovoForm.payment,
            etaMinutes: 15,
            offlineCreatedAt: Date.now(),
            ...getDriverAssignmentData()
        };

        try {
            if (isNetOnline) {
                await addDoc(collection(db, "artifacts", appId, "public", "data", "orders"), { ...newOrder, createdAt: serverTimestamp() });
                showNotify("Commande Glovo ajoutée et envoyée à la cuisine! 🚀", "success");
            } else {
                saveOfflineOrder(newOrder);
            }
            if (localSocket) localSocket.emit('new_local_order', newOrder);
            
            printTicketsPos(newOrder, brand); 
            setShowCreateGlovoModal(false);
            setShowGlovoModal(false);
            setCart([]);
            setGlovoForm({ orderNum: '', payment: 'espece' });
        } catch (error) {
            showNotify("W9e3 mochkil f tsjal dyal l-commande Glovo", "error");
        }
    };`;
        content = content.replace(oldFunc, newFunc);
        console.log('Replaced handleGlovoOrderFromPOS');
    }
}

// Replace button in Tel Modal
content = content.replace(/onClick=\{handleGlovoOrderFromPOS\}\s+className="w-full mt-3 bg-yellow-400/, `onClick={() => { if(cart.length===0) return showNotify("Panier vide", "error"); setShowTelNumpad(false); setShowCreateGlovoModal(true); }}\n                                className="w-full mt-3 bg-yellow-400`);

// Replace showGlovoModal block
let modalStart = content.indexOf('{/* MODAL COMMANDES PRÊTES GLOVO */}');
let modalEnd = content.indexOf('{/* MODAL COMMANDES PRÊTES CAISSE */}');
if(modalStart !== -1 && modalEnd !== -1) {
    let oldModal = content.substring(modalStart, modalEnd);
    let newModal = `{/* MODAL CREER COMMANDE GLOVO */}
            {showCreateGlovoModal && (
                <div className="fixed inset-0 z-[250] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowCreateGlovoModal(false)}>
                    <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-black text-yellow-600 flex items-center gap-2">
                                <img src="https://upload.wikimedia.org/wikipedia/en/8/82/Glovo_logo.svg" alt="Glovo" className="h-6" />
                                Nouvelle Commande
                            </h2>
                            <button onClick={() => setShowCreateGlovoModal(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"><X size={20}/></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Numéro de Commande Glovo</label>
                                <input type="text" autoFocus value={glovoForm.orderNum} onChange={e => setGlovoForm({...glovoForm, orderNum: e.target.value})} placeholder="Ex: GH-1234" className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-lg font-black uppercase text-center focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/20 outline-none transition-all" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Mode de Paiement (Livreur)</label>
                                <div className="flex gap-2">
                                    <button onClick={() => setGlovoForm({...glovoForm, payment: 'espece'})} className={\`flex-1 py-3 rounded-xl font-black text-sm border-2 transition-all \${glovoForm.payment === 'espece' ? 'border-green-500 bg-green-50 text-green-700 shadow-md scale-105' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}\`}>🟢 💰 ESPÈCES</button>
                                    <button onClick={() => setGlovoForm({...glovoForm, payment: 'en_ligne'})} className={\`flex-1 py-3 rounded-xl font-black text-sm border-2 transition-all \${glovoForm.payment === 'en_ligne' ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md scale-105' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}\`}>🔵 💳 EN LIGNE</button>
                                </div>
                            </div>
                            <button onClick={handleGlovoOrderFromPOS} className="w-full mt-4 bg-yellow-400 hover:bg-yellow-500 text-black py-4 rounded-xl font-black text-lg uppercase tracking-widest shadow-lg active:scale-95 transition-all">
                                Valider & Envoyer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL COMMANDES PRÊTES GLOVO */}
            {showGlovoModal && (
                <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowGlovoModal(false)}>
                    <div className="bg-white rounded-[2.5rem] w-full max-w-2xl max-h-[85dvh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-[#FFC244]/20 flex justify-between items-center bg-[#FFC244]/10">
                            <div>
                                <h2 className="text-lg font-black text-yellow-800 flex items-center gap-2">
                                    <img src="https://upload.wikimedia.org/wikipedia/en/8/82/Glovo_logo.svg" alt="Glovo" className="h-5" /> Commandes Prêtes
                                </h2>
                            </div>
                            <button onClick={() => setShowGlovoModal(false)} className="p-2 bg-white rounded-full hover:bg-yellow-50"><X size={20}/></button>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto bg-gray-50 space-y-3">
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
                            <button onClick={() => { if(cart.length===0) return showNotify("Ajoutez des articles au panier!", "error"); setShowGlovoModal(false); setShowCreateGlovoModal(true); }} className="w-full mt-4 border-2 border-dashed border-[#FFC244] bg-[#FFC244]/10 text-yellow-800 hover:bg-[#FFC244]/20 py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2">➕ Saisir une Commande Glovo</button>
                        </div>
                    </div>
                </div>
            )}

            `;
    content = content.replace(oldModal, newModal);
    console.log('Replaced showGlovoModal');
}

fs.writeFileSync('src/views/PosDashboard.jsx', content);
