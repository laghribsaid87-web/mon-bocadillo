import React from 'react';
import { Bike, X, CheckCircle } from 'lucide-react';
import { usePosContext } from '../PosContext';

export default function GlovoModal({ readyGlovoOrders, updateStatus, printTicket }) {
    const { brand, showGlovoModal, setShowGlovoModal, glovoGroupedOrders, glovoConfirmPaymentOrder, setGlovoConfirmPaymentOrder, showNotify } = usePosContext();

    if (!showGlovoModal && !glovoConfirmPaymentOrder) return null;

    return (
        <>
            {/* MODAL COMMANDES PRÊTES GLOVO */}
            {showGlovoModal && (
                <div className="fixed inset-0 z-[250] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowGlovoModal(false)}>
                    <div className="bg-gray-50 rounded-3xl w-full max-w-3xl p-6 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-black flex items-center gap-2" style={{color: brand?.color || '#FFC244'}}>
                                <Bike size={24} />
                                Prêtes (Glovo)
                            </h2>
                            <button onClick={() => setShowGlovoModal(false)} className="p-2 bg-gray-200 rounded-full hover:bg-gray-300 text-gray-700"><X size={20}/></button>
                        </div>
                        
                        <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto no-scrollbar pr-2 pb-2">
                            {readyGlovoOrders?.length === 0 ? (
                                <div className="text-center text-gray-400 py-6 font-bold flex flex-col items-center gap-4">
                                    <span>Aucune commande Glovo prête.</span>
                                </div>
                            ) : (
                                readyGlovoOrders?.map(o => {
                                    const oNum = o.orderNumber || o.id.slice(-4).toUpperCase();
                                    const groupedWith = glovoGroupedOrders ? glovoGroupedOrders[`#${oNum}`] : null;
                                    const isGrouped = !!groupedWith && groupedWith.length > 0;
                                    
                                    return (
                                    <div key={o.id} className={`p-3 rounded-2xl border-2 shadow-sm flex flex-wrap items-center justify-between gap-3 transition-all ${isGrouped ? 'bg-blue-50 border-blue-500 animate-pulse' : 'bg-white border-[#FFC244]/30'}`}>
                                        <div className="flex items-center flex-wrap gap-2">
                                            <span className={`font-black text-2xl uppercase ${isGrouped ? 'text-blue-700' : 'text-yellow-600'}`}>#{oNum}</span>
                                            
                                            {isGrouped && (
                                                <span className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-xs font-black ml-2 border border-blue-200">
                                                    🔗 + {groupedWith.join(', ')}
                                                </span>
                                            )}
                                            {(o.paymentMethod?.toLowerCase() === 'espece' || o.paymentMethod?.toLowerCase() === 'cash') ? (
                                                <span className="text-xs text-green-700 bg-green-100 px-2 py-1 rounded-md border border-green-300 font-black shadow-sm">
                                                    ESPECE 💵: {o.total || '???'} DH
                                                </span>
                                            ) : (
                                                <span className="text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded-md border border-blue-300 font-black shadow-sm">
                                                    EN LIGNE 💳
                                                </span>
                                            )}

                                            {o.pickupCode && (
                                                <span className="text-sm text-purple-800 bg-purple-100 px-3 py-1 rounded-md border border-purple-400 font-black tracking-widest uppercase shadow-sm">
                                                    PIN: {o.pickupCode}
                                                </span>
                                            )}
                                        </div>

                                        <button onClick={() => { 
                                            if (o.paymentMethod?.toLowerCase() === 'espece' || o.paymentMethod?.toLowerCase() === 'cash') {
                                                setGlovoConfirmPaymentOrder(o);
                                            } else {
                                                updateStatus(o.id, 'delivered', { deliveredAtLocal: Date.now() }); 
                                                printTicket(o, brand);
                                                showNotify("Remis au Livreur Glovo !", "success"); 
                                                if (readyGlovoOrders?.length === 1) setShowGlovoModal(false); 
                                            }
                                        }} className="bg-[#FFC244] hover:bg-yellow-500 text-black px-4 py-2 rounded-xl font-black text-sm transition-colors shadow-md flex items-center gap-2 whitespace-nowrap">
                                            <CheckCircle size={18}/> Remis
                                        </button>
                                    </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL CONFIRMATION PAIEMENT GLOVO ESPECE */}
            {glovoConfirmPaymentOrder && (
                <div className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl flex flex-col items-center animate-in zoom-in-95 text-center">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 text-green-600">
                            <span className="text-3xl">💵</span>
                        </div>
                        <h2 className="text-2xl font-black text-gray-800 mb-2">Paiement Espèce</h2>
                        <p className="text-gray-600 mb-6 text-lg font-medium">
                            Wach khditi <span className="font-black text-green-600 text-xl">{glovoConfirmPaymentOrder.total} DH</span> mn 3nd le livreur Glovo ?
                        </p>
                        <div className="flex gap-3 w-full">
                            <button onClick={() => setGlovoConfirmPaymentOrder(null)} className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-xl font-bold hover:bg-gray-300">
                                Non, pas encore
                            </button>
                            <button onClick={() => {
                                updateStatus(glovoConfirmPaymentOrder.id, 'delivered', { deliveredAtLocal: Date.now() }); 
                                printTicket(glovoConfirmPaymentOrder, brand);
                                showNotify("Paiement confirmé et remis !", "success");
                                setGlovoConfirmPaymentOrder(null);
                                if (readyGlovoOrders?.length === 1) setShowGlovoModal(false);
                            }} className="flex-1 bg-green-500 text-white py-3 rounded-xl font-black hover:bg-green-600 shadow-lg flex items-center justify-center gap-2">
                                <CheckCircle size={20}/> Oui, Khdit'ha
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
