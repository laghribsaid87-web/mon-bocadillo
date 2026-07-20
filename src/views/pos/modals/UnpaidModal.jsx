import React from 'react';
import { Banknote, X } from 'lucide-react';
import { usePosContext } from '../PosContext';

export default function UnpaidModal({ unpaidOrders, handlePayUnpaidTicket }) {
    const { showUnpaidModal, setShowUnpaidModal } = usePosContext();

    if (!showUnpaidModal) return null;

    return (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowUnpaidModal(false)}>
            <div className="bg-white rounded-3xl w-full max-w-md flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-red-50">
                    <h2 className="text-lg font-black text-red-800 flex items-center gap-2"><Banknote size={20}/> Tickets Non Payés</h2>
                    <button onClick={() => setShowUnpaidModal(false)} className="p-2 bg-white rounded-full hover:bg-gray-100"><X size={20}/></button>
                </div>
                <div className="p-4 flex-1 overflow-y-auto max-h-[60dvh] bg-gray-50 space-y-3">
                    {unpaidOrders?.length === 0 ? (
                        <div className="text-center text-gray-400 py-6 font-bold">Aucun ticket en attente de paiement.</div>
                    ) : (
                        unpaidOrders?.map(o => (
                            <div key={o.id} className="bg-white p-4 rounded-2xl border border-red-200 shadow-sm flex flex-col gap-2">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-black text-gray-900 text-xl">#{o.orderNumber || o.id.slice(-4).toUpperCase()}</p>
                                        <p className="text-[10px] font-bold text-gray-500 mt-0.5">{o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000).toLocaleTimeString() : ''}</p>
                                    </div>
                                    <span className="font-black text-red-600 text-xl">{o.total} DH</span>
                                </div>
                                <div className="text-xs font-bold text-gray-600 bg-gray-50 p-2 rounded-xl border border-gray-100 mt-1">
                                    {(o.items||[]).map((i, idx) => (
                                        <div key={idx}>{i.qty}x {(i.name || '').split(' (Sans')[0]}</div>
                                    ))}
                                </div>
                                <button onClick={() => handlePayUnpaidTicket(o)} className="mt-2 w-full bg-green-500 text-white py-3 rounded-xl font-black text-sm hover:bg-green-600 transition-colors shadow-md flex items-center justify-center gap-2">
                                    <Banknote size={18}/> Payer le tichet
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
