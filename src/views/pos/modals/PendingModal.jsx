import React from 'react';
import { BellRing, X, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePosContext } from '../PosContext';

export default function PendingModal({
    pendingOnline, updateStatus, getDriverAssignmentData, printTicket, setTab
}) {
    const { showPendingModal, setShowPendingModal, brand, showNotify, defaultPosDriver, orders, setConfirmDialog } = usePosContext();
    const navigate = useNavigate();

    if (!showPendingModal) return null;

    return (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={() => setShowPendingModal(false)}>
            <div className="bg-white rounded-[2.5rem] w-full max-w-lg flex flex-col overflow-hidden shadow-[0_0_80px_rgba(220,38,38,0.4)] border-4 border-red-500 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-red-50">
                    <h2 className="text-lg font-black text-red-800 flex items-center gap-2 animate-pulse">
                        <BellRing size={24} className="animate-bounce"/> Nouvelles Commandes Web ({pendingOnline?.length || 0})
                    </h2>
                    <div className="flex gap-2">
                        <button onClick={() => {
                            if (setTab) setTab('active');
                            else navigate('/idara');
                        }} className="text-xs font-bold text-gray-600 hover:text-gray-900 bg-gray-200 px-3 py-1.5 rounded-lg transition-colors">
                            Ouvrir Idara
                        </button>
                        <button onClick={() => setShowPendingModal(false)} className="p-1.5 bg-white rounded-full hover:bg-gray-100 text-gray-500">
                            <X size={20} />
                        </button>
                    </div>
                </div>
                <div className="p-4 flex-1 overflow-y-auto max-h-[60dvh] bg-gray-50 space-y-3">
                    {pendingOnline?.map(o => (
                        <div key={o.id} className="bg-white p-4 rounded-2xl border border-red-200 shadow-sm flex flex-col gap-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-black text-gray-900 text-xl">#{o.orderNumber || o.id.slice(-4).toUpperCase()}</p>
                                    <p className="text-xs font-bold text-gray-500">{o.customerName || o.name || o.phone}</p>
                                </div>
                                <span className="font-black text-red-600 text-lg">{o.total} DH</span>
                            </div>
                            <div className="text-sm font-bold text-gray-700 bg-gray-50 p-2 rounded-xl">
                                {(o.items||[]).map((i, idx) => (
                                    <div key={idx}>{i.qty}x {(i.name || '').split(' (Sans')[0]}</div>
                                ))}
                            </div>
                            <div className="flex gap-2 mt-2">
                                <button onClick={() => {
                                    if (defaultPosDriver) {
                                        const defaultDriverOrdersCount = (orders || []).filter(ord => ord.driverId === defaultPosDriver && !['delivered', 'rejected'].includes(ord.status)).length;
                                        if (defaultDriverOrdersCount >= 3) {
                                            setConfirmDialog({
                                                message: `⚠️ Le livreur salarié a déjà ${defaultDriverOrdersCount} commandes en cours.\nVoulez-vous lancer l'alerte aux livreurs Freelances ?`,
                                                confirmText: "Oui, utiliser Freelance",
                                                cancelText: "Non, forcer au Salarié",
                                                onConfirm: () => {
                                                    updateStatus(o.id, 'preparing', {
                                                        isFreelanceDriver: true,
                                                        driverId: null,
                                                        driverName: null,
                                                        driverAccepted: false,
                                                        assignedAtLocal: Date.now()
                                                    });
                                                    printTicket(o, brand);
                                                    showNotify("Commande acceptée et envoyée aux Freelances! ✅", "success");
                                                },
                                                onCancel: () => {
                                                    updateStatus(o.id, 'preparing', getDriverAssignmentData());
                                                    printTicket(o, brand);
                                                    showNotify("Commande acceptée w mchat l'KDS! ✅", "success");
                                                }
                                            });
                                            return;
                                        }
                                    }
                                    updateStatus(o.id, 'preparing', getDriverAssignmentData());
                                    printTicket(o, brand);
                                    showNotify(defaultPosDriver ? "Commande acceptée w mchat l-livreur! 🛵" : "Commande acceptée w mchat l'KDS! ✅", "success");
                                }} className="flex-1 bg-green-500 text-white py-3 rounded-xl font-black text-sm hover:bg-green-600 transition-colors shadow-md flex items-center justify-center gap-2">
                                    <CheckCircle size={18}/> Accepter & Imprimer
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
                {(pendingOnline?.length || 0) > 1 && (
                    <div className="p-4 bg-white border-t border-gray-100">
                        <button onClick={() => {
                            pendingOnline.forEach(o => {
                                updateStatus(o.id, 'preparing', getDriverAssignmentData());
                                printTicket(o, brand);
                            });
                            showNotify(defaultPosDriver ? "Ga3 l-commandes mchaw l-livreur! 🛵" : "Ga3 l-commandes t'acceptaw! ✅", "success");
                        }} className="w-full bg-red-600 text-white py-4 rounded-xl font-black text-sm hover:bg-red-700 transition-colors shadow-md uppercase flex items-center justify-center gap-2">
                            <CheckCircle size={20}/> Tout Accepter & Imprimer
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
