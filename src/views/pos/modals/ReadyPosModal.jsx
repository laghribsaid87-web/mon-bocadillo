import React from 'react';
import { CheckCircle, X } from 'lucide-react';
import { usePosContext } from '../PosContext';

export default function ReadyPosModal({ readyPosOrders, updateStatus }) {
    const { 
        showReadyPosModal, setShowReadyPosModal, 
        setShowConfirmToutDonner, showNotify, brand 
    } = usePosContext();

    if (!showReadyPosModal) return null;

    return (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowReadyPosModal(false)}>
            <div className="bg-white rounded-3xl w-full max-w-md flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-green-50">
                    <h2 className="text-lg font-black text-green-800 flex items-center gap-2"><CheckCircle size={20}/> Commandes Prêtes (TV)</h2>
                    <div className="flex items-center gap-2">
                        {readyPosOrders?.length > 1 && (
                        <button onClick={() => setShowConfirmToutDonner(true)} className="bg-green-600 text-white px-3 py-1.5 rounded-xl text-xs font-black shadow-sm active:scale-95 transition-all">
                                Tout donner
                            </button>
                        )}
                        <button onClick={() => setShowReadyPosModal(false)} className="p-2 bg-white rounded-full hover:bg-gray-100"><X size={20}/></button>
                    </div>
                </div>
                <div className="p-4 flex-1 overflow-y-auto max-h-[60dvh] bg-gray-50 space-y-3">
                    {readyPosOrders?.length === 0 ? (
                        <div className="text-center text-gray-400 py-6 font-bold">Aucune commande prête à servir.</div>
                    ) : (
                        readyPosOrders?.map(o => (
                            <div key={o.id} className="bg-white p-4 rounded-2xl border border-green-200 shadow-sm flex justify-between items-center">
                                <div>
                                    <p className="font-black text-gray-900 text-2xl">#{o.orderNumber || o.id.slice(-4).toUpperCase()}</p>
                                    <p className={`text-[10px] font-black uppercase mt-1 px-2 py-1 rounded-md w-fit text-white`} style={{ backgroundColor: o.orderType === 'sur_place' ? (brand?.btnPosSurPlaceColor || '#3b82f6') : (brand?.btnPosAEmporterColor || '#ec4899') }}>
                                        {o.orderType === 'sur_place' ? (brand?.texts?.posBtnSurPlace || '🍽️ SUR PLACE (PLATEAUX)') : (brand?.texts?.posBtnAEmporter || '🛍️ À EMPORTER (EMBALLAGE)')}
                                    </p>
                                </div>
                                <button onClick={() => { updateStatus(o.id, 'delivered', { deliveredAtLocal: Date.now() }); showNotify("Remis au client ! ✅", "success"); if (readyPosOrders?.length === 1) setShowReadyPosModal(false); }} className="bg-green-500 text-white px-5 py-3 rounded-xl font-black text-sm hover:bg-green-600 transition-colors shadow-md">Remis au client</button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
