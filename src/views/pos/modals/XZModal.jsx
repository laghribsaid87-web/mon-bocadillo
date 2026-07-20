import React from 'react';
import { ClipboardList, X, Printer, Power } from 'lucide-react';
import { usePosContext } from '../PosContext';

export default function XZModal({ 
    dailyCA, completedOrdersToday, caPos, caGlovoEspece, caGlovoEnLigne, caApp, caTel, totalAchats, dailyItemsList, printReport
}) {
    const { isAdmin, showXZModal, setShowXZModal } = usePosContext();

    if (!showXZModal) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={() => setShowXZModal(false)}>
            <div className="bg-white rounded-3xl w-full max-w-sm flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <div className="bg-purple-600 text-white p-4 flex justify-between items-center">
                    <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2"><ClipboardList size={20}/> Rapports Caisse</h2>
                    <button onClick={() => setShowXZModal(false)} className="hover:bg-purple-700 p-1 rounded-full"><X size={24}/></button>
                </div>
                <div className="p-5 sm:p-6 bg-gray-50 flex flex-col gap-4">
                    <div className="bg-white p-4 rounded-2xl border border-gray-200 text-center shadow-sm">
                        <p className="text-gray-500 text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-1">Recette Globale du jour</p>
                        <h3 className="text-3xl font-black text-purple-600">{isAdmin ? `${dailyCA} MAD` : '*** MAD'}</h3>
                        <p className="text-xs text-gray-400 mt-1 font-medium mb-3">{completedOrdersToday?.length || 0} commandes au total</p>
                        
                        <div className="grid grid-cols-5 gap-1 border-t border-gray-100 pt-3">
                            <div className="flex flex-col items-center">
                                <span className="text-[8px] text-gray-400 uppercase font-bold text-center">Sur Place</span>
                                <span className="text-xs font-black text-indigo-600">{isAdmin ? `${caPos} DH` : '***'}</span>
                            </div>
                            <div className="flex flex-col items-center border-l border-gray-100">
                                <span className="text-[8px] text-gray-400 uppercase font-bold text-center">Glovo<br/>Espèce</span>
                                <span className="text-xs font-black text-green-600">{caGlovoEspece} DH</span>
                            </div>
                            <div className="flex flex-col items-center border-l border-gray-100">
                                <span className="text-[8px] text-gray-400 uppercase font-bold text-center">Glovo<br/>En Ligne</span>
                                <span className="text-xs font-black text-green-600">{caGlovoEnLigne} DH</span>
                            </div>
                            <div className="flex flex-col items-center border-l border-gray-100">
                                <span className="text-[8px] text-gray-400 uppercase font-bold text-center">Web App</span>
                                <span className="text-xs font-black text-blue-600">{isAdmin ? `${caApp} DH` : '***'}</span>
                            </div>
                            <div className="flex flex-col items-center border-l border-gray-100">
                                <span className="text-[8px] text-gray-400 uppercase font-bold text-center">Téléphone</span>
                                <span className="text-xs font-black text-orange-600">{isAdmin ? `${caTel} DH` : '***'}</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 border-t border-gray-100 mt-2 pt-2">
                            <div className="flex flex-col items-center bg-red-50 p-2 rounded-xl">
                                <span className="text-[10px] text-red-500 uppercase font-bold">Achats (Dépenses)</span>
                                <span className="text-sm font-black text-red-600">{isAdmin ? `-${totalAchats || 0} DH` : '***'}</span>
                            </div>
                            <div className="flex flex-col items-center bg-green-50 p-2 rounded-xl">
                                <span className="text-[10px] text-green-600 uppercase font-bold text-center leading-tight">Net (Espèce + Glovo Esp - Achats)</span>
                                <span className="text-sm font-black text-green-700">{isAdmin ? `${(caPos + caGlovoEspece) - (totalAchats || 0)} DH` : '***'}</span>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border border-gray-200 max-h-48 overflow-y-auto shadow-sm">
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Détails des ventes</h4>
                        {dailyItemsList?.length === 0 ? ( <p className="text-xs text-gray-400 text-center">Aucun article vendu.</p> ) : (
                            <div className="space-y-2">
                                {dailyItemsList?.map(([name, qty]) => (
                                    <div key={name} className="flex justify-between items-center py-1 border-b border-gray-50 last:border-0"><span className="text-xs text-gray-600 font-medium">{name}</span><span className="font-bold text-gray-800 text-xs bg-gray-100 px-2 py-0.5 rounded-md">{qty}</span></div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                        <button onClick={() => printReport('X')} className="w-full py-3 bg-blue-100 text-blue-700 font-bold rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-blue-200 text-sm shadow-sm"><Printer size={18}/> Bilan X</button>
                        <button onClick={() => printReport('Z')} className="w-full py-3 bg-red-100 text-red-600 font-bold rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-red-200 text-sm shadow-sm"><Power size={18}/> Clôture Z</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
