import React from 'react';
import { X, Trash2 } from 'lucide-react';
import { usePosContext } from '../PosContext';

export default function EditCartItemModal({ updateCartItemQty, deleteFromCart, handleEditCartItemOptions, menuItems }) {
    const { editCartItem, setEditCartItem, hasAccess } = usePosContext();

    if (!editCartItem) return null;

    return (
        <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setEditCartItem(null)}>
            <div className="bg-white rounded-[2rem] w-full max-w-sm flex flex-col overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white">
                    <h2 className="text-xl font-black text-gray-900 tracking-tight">{editCartItem.name.split(' (Sans')[0]}</h2>
                    <button onClick={() => setEditCartItem(null)} className="p-2.5 bg-gray-50 text-gray-400 rounded-full hover:bg-gray-100 hover:text-gray-600 transition-colors"><X size={20}/></button>
                </div>
                <div className="p-6 flex flex-col items-center gap-5 bg-[#f8fafc]">
                    <div className="flex items-center gap-6 bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
                        <button onClick={() => updateCartItemQty(editCartItem, -1)} className="w-14 h-14 bg-gray-50 rounded-xl flex items-center justify-center text-3xl font-black text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition-colors">-</button>
                        <span className="text-4xl font-black w-12 text-center text-gray-900 tracking-tighter">{editCartItem.qty}</span>
                        <button onClick={() => updateCartItemQty(editCartItem, 1)} className="w-14 h-14 bg-gray-50 rounded-xl flex items-center justify-center text-3xl font-black text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition-colors">+</button>
                    </div>
                    {(() => {
                        const originalItem = menuItems?.find(i => i.id === editCartItem.id);
                        const showBtn = originalItem && (
                            originalItem.removableIngredients || 
                            (originalItem.extras && originalItem.extras.length > 0) ||
                            originalItem.hasVariations ||
                            originalItem.choices
                        );
                        if (!showBtn) return null;
                        return (
                            <button onClick={() => handleEditCartItemOptions(editCartItem)} className="w-full py-4 mt-2 bg-white border border-blue-200 hover:border-blue-300 hover:bg-blue-50/50 text-blue-600 font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm">
                                ⚙️ Modifier Options / Sans
                            </button>
                        );
                    })()}
                    {(!hasAccess || hasAccess('pos_delete')) && (
                        <button onClick={() => { deleteFromCart(editCartItem.id, editCartItem.name); setEditCartItem(null); }} className="w-full py-4 mt-1 bg-red-50/50 border border-red-200 hover:bg-red-50 hover:border-red-300 text-red-600 font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm"><Trash2 size={20}/> Supprimer du panier</button>
                    )}
                </div>
            </div>
        </div>
    );
}
