import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { usePosContext } from '../PosContext';
import { openWhatsAppDirect } from '../../../utils/helpers';

export default function ProblemOrdersModal({ problemOrders, handleReassignOrder, updateStatus }) {
    const { showProblemModal, setShowProblemModal, showNotify, setConfirmDialog } = usePosContext();

    if (!showProblemModal || !problemOrders || problemOrders.length === 0) return null;

    return (
        <div className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowProblemModal(false)}>
            <div className="bg-white rounded-[2.5rem] w-full max-w-2xl flex flex-col overflow-hidden shadow-[0_0_80px_rgba(220,38,38,0.4)] border-4 border-red-500 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-red-50">
                    <h2 className="text-xl font-black text-red-800 flex items-center gap-2 animate-pulse">
                        <AlertTriangle size={24} className="animate-bounce text-red-600"/> PROBLÈMES COMMANDES ({problemOrders.length})
                    </h2>
                    <button onClick={() => setShowProblemModal(false)} className="p-2 bg-white rounded-full hover:bg-gray-100"><X size={20}/></button>
                </div>
                <div className="p-4 flex-1 overflow-y-auto max-h-[60dvh] bg-gray-50 space-y-3">
                    {problemOrders.map(o => (
                        <div key={o.id} className="bg-white p-5 rounded-2xl shadow-sm border border-red-200 flex flex-col gap-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-3">
                                    <span className="font-black text-gray-900 text-lg">#{o.orderNumber || o.id.slice(-4).toUpperCase()}</span>
                                    <span className="text-sm font-bold text-gray-500">{o.customerName || o.name || o.phone}</span>
                                </div>
                                <span className="font-black text-red-600 text-lg">{o.total || '???'} DH</span>
                            </div>
                            <p className="text-sm text-red-600 font-bold bg-red-100/50 w-fit px-3 py-1 rounded-lg">
                                🚨 {o.adminMessage ? o.adminMessage : 
                                   o.clientUnreachable ? "Client Injoignable" : 
                                   (o.driverId && !o.driverAccepted) ? (o.isManualAssignment ? "Livreur n'a pas accepté la commande" : "Livreur n'a pas accepté (> 45s)") : 
                                   "Aucun livreur disponible !"}
                            </p>
                            {o.phone && (
                                <div className="flex items-center gap-2 mt-1">
                                    <a href={`tel:${o.phone}`} className="flex-1 sm:flex-none bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors border border-gray-200">
                                        📞 Appeler {o.phone}
                                    </a>
                                    <button onClick={() => openWhatsAppDirect(o.phone, `Salam, bkhoussous l-commande dyalak #${o.orderNumber || o.id.slice(-4).toUpperCase()}...`)} className="flex-1 sm:flex-none bg-green-100 hover:bg-green-200 text-green-800 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors border border-green-200">
                                        💬 WhatsApp
                                    </button>
                                </div>
                            )}
                            <div className="flex flex-wrap gap-2 mt-2">
                                {((o.driverId && !o.driverAccepted) || (!o.driverId && ['preparing', 'ready'].includes(o.status))) && (
                                    <button onClick={() => {
                                        handleReassignOrder(o, null, true, true);
                                        showNotify("Recherche d'un autre livreur lancée", "info");
                                    }} className="w-full px-5 py-3 bg-orange-100 text-orange-700 hover:bg-orange-200 rounded-xl font-black text-xs uppercase shadow-sm active:scale-95 transition-all border border-orange-200">
                                        🔄 Chercher un autre livreur (Robot)
                                    </button>
                                )}
                                <button onClick={() => {
                                    updateStatus(o.id, o.status, {clientUnreachable: false, adminMessage: null});
                                    showNotify("Commande marquée comme résolue ✅", "success");
                                }} className="flex-1 px-5 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-black text-xs uppercase shadow-sm active:scale-95 transition-all">
                                    ✅ Résolu (Retour Normal)
                                </button>
                                <button onClick={() => {
                                    setConfirmDialog({
                                        message: "Annuler définitivement cette commande ?",
                                        onConfirm: () => {
                                            updateStatus(o.id, 'rejected', {reason: o.adminMessage || 'Problème de livraison', driverPaid: true, deliveredAtLocal: Date.now(), clientUnreachable: false, adminMessage: null});
                                            showNotify("Commande annulée ❌", "info");
                                        }
                                    });
                                }} className="flex-1 px-5 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-black text-xs uppercase shadow-sm active:scale-95 transition-all">
                                    ❌ Annuler
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
