import React from 'react';
import { ShoppingBag, Truck, X, CheckCircle, ChefHat } from 'lucide-react';
import { usePosContext } from '../PosContext';

export default function OnlineOrdersModal({
    onlineOrders, validOnlineDrivers, handleReassignOrder, updateStatus, printTicket, getDriverAssignmentData
}) {
    const { showOnlineOrdersModal, setShowOnlineOrdersModal, brand, showNotify, setConfirmDialog, orders, defaultPosDriver } = usePosContext();

    if (!showOnlineOrdersModal) return null;

    return (
        <div className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowOnlineOrdersModal(false)}>
            <div className="bg-white rounded-[2.5rem] w-full max-w-2xl max-h-[85dvh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-purple-50">
                    <div>
                        <h2 className="text-lg font-black text-purple-800 flex items-center gap-2">
                            <ShoppingBag size={20}/> Commandes Web & Téléphone ({onlineOrders?.length || 0})
                        </h2>
                        <p className="text-xs font-bold text-purple-600 mt-1 flex items-center gap-1">
                            <Truck size={14}/> {validOnlineDrivers?.filter(d => d.isOnline).length || 0} livreur(s) en ligne ({validOnlineDrivers?.filter(d => d.isOnline && d.isAvailable).length || 0} dispo)
                        </p>
                    </div>
                    <button onClick={() => setShowOnlineOrdersModal(false)} className="p-2 bg-white rounded-full hover:bg-gray-100"><X size={20}/></button>
                </div>
                <div className="p-4 flex-1 overflow-y-auto bg-gray-50 space-y-3">
                    {onlineOrders?.length === 0 ? (
                        <div className="text-center text-gray-400 py-6 font-bold">Aucune commande web ou téléphone en cours.</div>
                    ) : (
                        onlineOrders?.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).map(o => (
                            <div key={o.id} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-black text-gray-900 text-lg">#{o.orderNumber || o.id.slice(-4).toUpperCase()}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${o.source === 'telephone' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                {o.source === 'telephone' ? '📞 Téléphone' : '📱 App Web'}
                                            </span>
                                            <span className="text-xs font-bold text-gray-500">{o.customerName || o.name || o.phone}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1.5">
                                        <span className="font-black text-purple-600 text-lg">{o.total} DH</span>
                                        <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md text-white ${o.status === 'pending' ? 'bg-red-500 animate-pulse' : o.status === 'preparing' ? 'bg-orange-500' : o.status === 'ready' ? 'bg-green-500' : 'bg-blue-500'}`}>
                                            {o.status === 'pending' ? 'En attente' : o.status === 'preparing' ? 'En Cuisine' : o.status === 'ready' ? 'Prête (Attente Livreur)' : 'En Route'}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-xs font-bold text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-100">
                                    {(o.items||[]).map((i, idx) => (
                                        <div key={idx}>{i.qty}x {(i.name || '').split(' (Sans')[0]}</div>
                                    ))}
                                    {o.orderNote && <div className="mt-2 pt-2 border-t border-gray-200 text-[10px] text-red-500">📝 Note: {o.orderNote}</div>}
                                </div>
                                
                                {/* GESTION CAISSIER: LIVRAISON & STATUTS */}
                                <div className="mt-1 flex flex-col gap-2 border-t border-gray-100 pt-3">
                                    {/* Affichage du Livreur */}
                                    <div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-200">
                                        <div className="flex items-center gap-2">
                                            <Truck size={16} className={o.driverId ? "text-green-500" : "text-gray-400"} />
                                            <span className="text-xs font-bold text-gray-700">
                                                Livreur: {o.driverId ? (o.driverName || 'Assigné') : 'Non assigné'}
                                                {o.driverId && !o.driverAccepted && <span className="text-[10px] text-orange-500 ml-1">(En attente...)</span>}
                                            </span>
                                        </div>
                                        
                                        {/* Dropdown d'assignation manuelle */}
                                        {o.status !== 'pending' && o.status !== 'delivered' && (
                                            <select
                                                className="bg-white border border-gray-300 text-xs font-bold text-gray-700 py-1.5 px-2 rounded-md outline-none max-w-[140px] truncate"
                                                value={o.driverId || ''}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === 'ROBOT') {
                                                        if (defaultPosDriver) {
                                                            const defaultDriverOrdersCount = (orders || []).filter(ord => ord.driverId === defaultPosDriver && !['delivered', 'rejected'].includes(ord.status)).length;
                                                            if (defaultDriverOrdersCount >= 3) {
                                                                setConfirmDialog({
                                                                    message: `⚠️ Le livreur salarié a déjà ${defaultDriverOrdersCount} commandes en cours.\nVoulez-vous lancer l'alerte aux livreurs Freelances ?`,
                                                                    onConfirm: () => {
                                                                        handleReassignOrder(o, null, true, true);
                                                                        showNotify("Recherche automatique lancée (Freelance)", "info");
                                                                    }
                                                                });
                                                                return;
                                                            } else {
                                                                handleReassignOrder(o, null, false, false, defaultPosDriver);
                                                                showNotify("Assigné automatiquement au livreur salarié", "success");
                                                                return;
                                                            }
                                                        }
                                                        handleReassignOrder(o, null, true, true);
                                                        showNotify("Recherche automatique lancée", "info");
                                                    } else if (val) {
                                                        handleReassignOrder(o, null, false, false, val);
                                                    }
                                                }}
                                            >
                                                <option value="" disabled>Assigner...</option>
                                                <option value="ROBOT">🤖 Auto (Robot)</option>
                                                {(validOnlineDrivers || []).filter(d => d.isOnline).map(d => (
                                                    <option key={d.uid} value={d.uid}>
                                                        🛵 {d.name || d.phone} {d.isAvailable ? '✅' : '⏳'}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </div>

                                    {/* Boutons d'actions selon le statut */}
                                    <div className="flex gap-2">
                                        {o.status === 'pending' && (
                                            <button onClick={() => {
                                                updateStatus(o.id, 'preparing', getDriverAssignmentData());
                                                printTicket(o, brand);
                                                showNotify("Commande acceptée w mchat l'KDS! ✅", "success");
                                            }} className="flex-1 bg-green-500 text-white py-2.5 rounded-xl font-black text-xs hover:bg-green-600 transition-colors shadow-sm flex items-center justify-center gap-2">
                                                <CheckCircle size={16}/> Accepter & Imprimer
                                            </button>
                                        )}
                                        
                                        {o.status === 'preparing' && (
                                            <button onClick={() => {
                                                updateStatus(o.id, 'ready');
                                                showNotify("Commande marquée prête! ✅", "success");
                                            }} className="flex-1 bg-orange-500 text-white py-2.5 rounded-xl font-black text-xs hover:bg-orange-600 transition-colors shadow-sm flex items-center justify-center gap-2">
                                                <ChefHat size={16}/> 
                                                {(o.source === 'glovo' || o.source === 'glovo_api') && (o.paymentMethod?.toLowerCase() === 'espece' || o.paymentMethod?.toLowerCase() === 'cash') ? 'Prête (💶 À ENCAISSER CASH)' : 'Marquer Prête'}
                                            </button>
                                        )}

                                        <button onClick={() => {
                                            setConfirmDialog({
                                                message: "Annuler cette commande ?",
                                                onConfirm: () => updateStatus(o.id, 'rejected', {reason: 'Annulée par la caisse', driverPaid: false})
                                            });
                                        }} className="px-3 bg-red-100 text-red-600 rounded-xl font-black hover:bg-red-200 transition-colors flex items-center justify-center">
                                            <X size={16}/>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
