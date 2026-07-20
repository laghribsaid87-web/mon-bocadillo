import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { usePosContext } from '../PosContext';

export default function ConfirmDialogModal() {
    const { confirmDialog, setConfirmDialog } = usePosContext();

    if (!confirmDialog) return null;

    return (
        <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setConfirmDialog(null)}>
            <div className="bg-white rounded-3xl w-full max-w-sm flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-orange-50">
                    <h2 className="text-lg font-black text-orange-800 flex items-center gap-2"><AlertTriangle size={20}/> Confirmation</h2>
                    <button onClick={() => setConfirmDialog(null)} className="p-2 bg-white rounded-full hover:bg-gray-100"><X size={20}/></button>
                </div>
                <div className="p-6 bg-gray-50 text-center space-y-5">
                    <p className="font-bold text-gray-800 text-base whitespace-pre-wrap">{confirmDialog.message}</p>
                    <div className="flex gap-3">
                        <button onClick={() => setConfirmDialog(null)} className="flex-1 py-3 font-bold text-gray-600 bg-gray-200 rounded-xl hover:bg-gray-300 transition-colors shadow-sm">Non (Annuler)</button>
                        <button onClick={() => {
                            confirmDialog.onConfirm();
                            setConfirmDialog(null);
                        }} className="flex-[2] py-3 font-black text-white bg-green-500 rounded-xl shadow-md active:scale-95 transition-all hover:bg-green-600">Oui, Confirmer</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
