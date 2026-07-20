import React from 'react';
import { Clock, X } from 'lucide-react';
import { usePosContext } from '../PosContext';

export default function HeldCartsModal() {
    const { 
        showHeldCarts, setShowHeldCarts, 
        heldCarts, setHeldCarts,
        cart, setCart,
        orderType, setOrderType,
        brand, setConfirmDialog
    } = usePosContext();

    if (!showHeldCarts) return null;

    return (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowHeldCarts(false)}>
            <div className="bg-white rounded-3xl w-full max-w-md flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="text-lg font-black text-gray-900 flex items-center gap-2"><Clock size={20} className="text-orange-500"/> En attente</h2>
                    <button onClick={() => setShowHeldCarts(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"><X size={20}/></button>
                </div>
                <div className="p-4 flex-1 overflow-y-auto max-h-[60dvh] bg-gray-50 space-y-3">
                    {heldCarts?.length === 0 ? (
                        <div className="text-center text-gray-400 py-6 font-bold">Aucune commande en attente.</div>
                    ) : (
                        heldCarts?.map(held => (
                            <div key={held.id} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex justify-between items-center">
                                <div>
                                    <p className="font-black text-gray-800 text-sm">Panier {held.time}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <p className="text-xs text-gray-500 font-bold">{held.cart.reduce((s,i)=>s+i.qty,0)} articles</p>
                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md text-white`} style={{ backgroundColor: held.orderType === 'sur_place' ? (brand?.btnPosSurPlaceColor || '#3b82f6') : (brand?.btnPosAEmporterColor || '#ec4899') }}>
                                            {held.orderType === 'sur_place' ? (brand?.texts?.posBtnSurPlace || '🍽️ SUR PLACE (PLATEAUX)') : (brand?.texts?.posBtnAEmporter || '🛍️ À EMPORTER (EMBALLAGE)')}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-black text-blue-600">{held.total} DH</span>
                                    <button onClick={() => { 
                                        if (cart && cart.length > 0) {
                                            setConfirmDialog({
                                                message: "Le panier actuel n'est pas vide. L'écraser ?",
                                                onConfirm: () => {
                                                    setCart(held.cart); setOrderType(held.orderType); setHeldCarts(prev => prev.filter(c => c.id !== held.id)); setShowHeldCarts(false);
                                                }
                                            });
                                        } else {
                                            setCart(held.cart); 
                                            setOrderType(held.orderType); 
                                            setHeldCarts(prev => prev.filter(c => c.id !== held.id)); 
                                            setShowHeldCarts(false);
                                        }
                                    }} className="bg-orange-100 text-orange-700 px-3 py-2 rounded-lg font-black text-xs hover:bg-orange-200 transition-colors shadow-sm">Reprendre</button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
