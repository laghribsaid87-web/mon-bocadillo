import React from 'react';
import { CheckCircle } from 'lucide-react';
import { usePosContext } from '../PosContext';

export default function ConfirmToutDonnerModal({ readyPosOrders, updateStatus }) {
    const { showConfirmToutDonner, setShowConfirmToutDonner, setShowReadyPosModal, showNotify } = usePosContext();

    if (!showConfirmToutDonner) return null;

    return (
        <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] p-6 max-w-sm w-full shadow-2xl text-center">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={32}/></div>
                <h3 className="text-xl font-black text-gray-900 mb-2">Tout donner ?</h3>
                <p className="text-gray-500 font-bold mb-6 text-sm">Wach m2ked bghiti t3ti ga3 l-commandes ({readyPosOrders?.length || 0}) l-malihom ?</p>
                <div className="flex gap-3">
                    <button onClick={() => setShowConfirmToutDonner(false)} className="flex-1 py-3 font-black text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Annuler</button>
                    <button onClick={() => {
                        readyPosOrders?.forEach(o => {
                            updateStatus(o.id, 'delivered', { deliveredAtLocal: Date.now() });
                        });
                        showNotify("Ga3 l-commandes t3taw! ✅", "success");
                        setShowReadyPosModal(false);
                        setShowConfirmToutDonner(false);
                    }} className="flex-[2] py-3 font-black text-white bg-green-500 rounded-xl shadow-md active:scale-95 transition-all hover:bg-green-600">Oui, Tout donner</button>
                </div>
            </div>
        </div>
    );
}
