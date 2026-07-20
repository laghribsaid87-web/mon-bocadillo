import React from 'react';
import { History, X, Printer } from 'lucide-react';
import { usePosContext } from '../PosContext';

export default function HistoryModal({ completedOrdersToday, printTicket }) {
    const { brand, showHistoryModal, setShowHistoryModal } = usePosContext();

    if (!showHistoryModal) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={() => setShowHistoryModal(false)}>
            <div className="bg-white rounded-3xl w-full max-w-md max-h-[85dvh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
                    <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                        <History size={20}/> Historique (Aujourd'hui)
                    </h2>
                    <button onClick={() => setShowHistoryModal(false)} className="hover:bg-blue-700 p-1 rounded-full"><X size={24}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3">
                    {completedOrdersToday?.filter(o => o.source === 'pos').length === 0 ? ( 
                        <p className="text-center text-gray-500 py-10 font-medium">Aucun ticket aujourd'hui.</p> 
                    ) : (
                        completedOrdersToday?.filter(o => o.source === 'pos')
                        .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0))
                        .map(sale => (
                            <div key={sale.id} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                                <div className="flex justify-between border-b border-gray-100 pb-2 mb-2">
                                    <span className="font-bold text-blue-600">#{sale.orderNumber || sale.id.slice(-4).toUpperCase()}</span>
                                    <span className="text-xs text-gray-500">{sale.createdAt?.seconds ? new Date(sale.createdAt.seconds * 1000).toLocaleTimeString() : ''}</span>
                                </div>
                                <div className="space-y-1 mb-3">
                                    {(sale.items || []).map((item, idx) => (
                                        <div key={idx} className="flex justify-between text-xs text-gray-700">
                                            <span>{item.qty}x {(item.name || '').split(' (Sans')[0]}</span>
                                            <span className="font-medium">{item.price * item.qty} DH</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                                    <span className="font-black text-gray-800">Total: <span className="text-blue-600">{sale.total} DH</span></span>
                                    <button onClick={() => printTicket(sale, brand)} className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-blue-100">
                                        <Printer size={14}/> Imprimer
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
