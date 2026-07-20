import React from 'react';
import { FileText, X } from 'lucide-react';
import { usePosContext } from '../PosContext';
import AchatInventaire from '../../AchatInventaire';

export default function AchatsModal() {
    const { showAchatsModal, setShowAchatsModal, db, appId, activeBranchId, brand, showNotify } = usePosContext();

    if (!showAchatsModal) return null;

    return (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex flex-col animate-in fade-in">
            <div className="bg-white p-4 flex justify-between items-center border-b border-gray-100 shadow-sm z-[201]">
                <h2 className="text-lg font-black text-gray-900 flex items-center gap-2"><FileText size={24} className="text-blue-500"/> Achats & Dépenses (Caisse)</h2>
                <button onClick={() => setShowAchatsModal(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-auto bg-gray-50 relative z-[200]">
                <AchatInventaire db={db} appId={appId} profile={{ id: 'pos', managerBranchId: activeBranchId }} brand={brand} showNotify={showNotify} />
            </div>
        </div>
    );
}
