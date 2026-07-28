import React from 'react';
import { ShoppingBag, X, Clock, Trash2, Banknote, Unlock, History, ClipboardList, FileText, Bluetooth } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { validateManagerPin } from '../../utils/helpers';
import { usePosContext } from './PosContext';
import { formatSansIngredient } from '../../utils/helpers';

export default function PosCart({ 
    clearCart, 
    handleEncaissement, 
    openDrawer, 
    handleBluetoothConnect, 
    total, 
    btCharacteristic, 
    isBtConnecting, 
    posUI, 
    cartSidebarClasses, 
    cartHeaderClasses, 
    iconColor, 
    cartItemBg, 
    cartQtyBg, 
    titleColor, 
    cartTotalBg 
}) {
    const { 
        cart, 
        setCart, 
        heldCarts, 
        setHeldCarts, 
        orderType, 
        setOrderType, 
        isMobileCartOpen, 
        setIsMobileCartOpen, 
        showNotify, 
        brand, 
        hasAccess, 
        settings, 
        setShowHistoryModal, 
        setShowXZModal, 
        setShowAchatsModal,
        setShowHeldCarts,
        setEditCartItem
    } = usePosContext();

    const theme = brand?.posTheme || 'light';
    const isDark = theme === 'dark';

    return (
        <aside className={`${isMobileCartOpen ? 'fixed inset-0 z-[100] flex w-full' : 'hidden md:flex'} flex-col h-full md:z-20 shrink-0 relative ${cartSidebarClasses}`} style={{ width: isMobileCartOpen ? '100%' : `${posUI?.cartWidth || 380}px` }}>
            <div className={`p-5 sm:p-7 md:p-8 flex justify-between items-center border-b sticky top-0 z-10 backdrop-blur-xl ${cartHeaderClasses}`}>
                <div className="font-black text-xl sm:text-2xl flex items-center gap-3 tracking-tight">
                    <ShoppingBag size={26} className={iconColor} /> 
                    <span className="hidden xl:inline tracking-tighter">Commande</span>
                </div>
                <div className="flex items-center gap-2">
                    {(!settings?.hidePosSurPlace || !settings?.hidePosAEmporter) && (
                        <button
                            onClick={() => setOrderType(prev => prev === 'sur_place' ? 'a_emporter' : 'sur_place')}
                            className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-wider transition-all shadow-sm flex items-center gap-1.5 ${orderType === 'a_emporter' ? 'bg-pink-500 text-white border-pink-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                        >
                            {orderType === 'a_emporter' ? '🛍️ À EMPORTER' : '🍽️ SUR PLACE'}
                        </button>
                    )}
                    {/* Bouton fermer sur Mobile */}
                    <button onClick={() => setIsMobileCartOpen(false)} className="md:hidden p-2.5 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors mr-1">
                        <X size={20}/>
                    </button>
                    {heldCarts?.length > 0 && (
                        <button onClick={() => setShowHeldCarts(true)} className="p-2.5 bg-orange-50/80 text-orange-500 rounded-full hover:bg-orange-100 transition-colors relative" title="Commandes en attente">
                            <Clock size={20}/>
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-black shadow-sm">{heldCarts.length}</span>
                        </button>
                    )}
                {cart?.length > 0 && (!hasAccess || hasAccess('pos_delete')) && <button onClick={clearCart} className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"><Trash2 size={20}/></button>}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 no-scrollbar" style={{ zoom: cart?.length > 6 ? Math.max(0.7, 1 - (cart.length - 6) * 0.05) : 1 }}>
                <AnimatePresence>
                    {cart?.length === 0 ? (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col items-center justify-center h-full mt-20 gap-4" style={{ color: isDark ? '#525252' : '#d1d5db' }}>
                            <ShoppingBag size={64} strokeWidth={1} className="opacity-20"/>
                            <p className="font-bold text-sm tracking-widest uppercase opacity-60">Panier vide</p>
                        </motion.div>
                    ) : (
                        cart?.map((item, idx) => (
                            <motion.div key={`${item.id}-${idx}`} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }} onClick={() => setEditCartItem(item)} className={`p-4 rounded-2xl border flex items-center gap-4 cursor-pointer transition-all duration-300 group ${cartItemBg}`}>
                                <div className={`flex items-center justify-center rounded-xl px-3 py-2 shrink-0 border transition-colors ${cartQtyBg}`}>
                                    <span className={`font-black text-sm tracking-tight ${titleColor}`}>{item.qty}x</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className={`font-bold text-sm leading-tight truncate tracking-tight ${titleColor}`}>{item.name.split(' (Sans')[0]}</h4>
                                    {item.name.includes(' (Sans') && (
                                        <div className="flex flex-col gap-1 mt-1">
                                            {item.name.split(' (Sans ')[1].replace(')', '').split(', ').map((opt, oIdx) => (
                                                <span key={oIdx} className="text-[10px] text-red-500 font-bold tracking-wide">- {formatSansIngredient(opt)}</span>
                                            ))}
                                        </div>
                                    )}
                                    {item.isCombo && item.comboChoices && item.comboChoices.map((c, cIdx) => (
                                        <div key={cIdx} className="text-[10px] text-gray-500 font-bold mt-1.5 pl-2.5 border-l-[3px] border-orange-400/60">
                                            🔹 {c.name}
                                            {c.removables?.length > 0 && <span className="text-red-500 ml-1">({c.removables.map(r => formatSansIngredient(r)).join(', ')})</span>}
                                            {c.selectedOption && <span className="text-blue-600 ml-1">({c.selectedOption})</span>}
                                        </div>
                                    ))}
                                </div>
                                <div className="font-black text-base tracking-tighter shrink-0" style={{ color: brand?.posColor || brand?.color || '#0f172a' }}>
                                    {item.price * item.qty}
                                </div>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>

            {/* CONTROLES DU BAS */}
            <div className={`p-5 sm:p-6 backdrop-blur-xl border-t shadow-[0_-20px_40px_-20px_rgba(0,0,0,0.05)] shrink-0 z-20 overflow-y-auto max-h-[50dvh] ${cartTotalBg}`}>
                <div className="flex justify-between items-end mb-4">
                    <span className={`font-bold uppercase tracking-widest text-xs ${isDark ? 'text-neutral-400' : 'text-gray-400'}`}>{brand?.texts?.posTotal || 'Total à payer'}</span>
                    <span className={`text-4xl sm:text-5xl font-black tracking-tighter leading-none ${titleColor}`}>{total} <span className={`text-xl sm:text-2xl tracking-tight font-bold ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>DH</span></span>
                </div>

                <div className="flex gap-3 mb-4">
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => {
                        if (cart?.length === 0) return;
                        setHeldCarts(prev => [...prev, { id: Date.now(), time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), cart: [...cart], orderType, total }]);
                        setCart([]);
                        if(showNotify) showNotify("Commande mise en attente 🕒", "info");
                    }} disabled={cart?.length === 0} className={`w-16 h-16 rounded-2xl font-black disabled:opacity-40 flex flex-col items-center justify-center gap-1 shadow-sm shrink-0 transition-colors ${cartQtyBg} border`} style={{ borderColor: isDark ? '#404040' : '#e5e7eb' }}>
                        <Clock size={22}/>
                    </motion.button>
                    
                    <div className="flex-1 flex gap-3">
                        <motion.button whileHover={cart?.length > 0 ? { scale: 1.02 } : {}} whileTap={cart?.length > 0 ? { scale: 0.98 } : {}} onClick={() => handleEncaissement(true)} disabled={cart?.length === 0} className="flex-1 rounded-2xl font-black text-xl md:text-2xl text-white disabled:opacity-30 disabled:shadow-none flex items-center justify-center gap-2 shadow-[0_8px_20px_-8px_rgba(34,197,94,0.5)] transition-all hover:opacity-90 bg-gradient-to-r from-green-500 to-green-600 py-4">
                            <Banknote size={26}/> PAYER
                        </motion.button>
                        <motion.button whileHover={cart?.length > 0 ? { scale: 1.02 } : {}} whileTap={cart?.length > 0 ? { scale: 0.98 } : {}} onClick={() => handleEncaissement(false)} disabled={cart?.length === 0} className="flex-[0.8] rounded-2xl font-black text-lg md:text-xl text-white disabled:opacity-30 disabled:shadow-none flex items-center justify-center gap-2 shadow-[0_8px_20px_-8px_rgba(249,115,22,0.5)] transition-all hover:opacity-90 bg-gradient-to-r from-orange-400 to-orange-500 py-4">
                            NON PAYÉ
                        </motion.button>
                    </div>
                </div>

                <div className="flex gap-2">
                    {!settings?.hidePosTiroir && (!hasAccess || hasAccess('pos_drawer')) && (
                        <button onClick={openDrawer} className="flex-1 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-lg flex flex-col items-center justify-center gap-1 font-bold text-[9px] transition-colors"><Unlock size={16} className="text-green-500"/><span>Tiroir</span></button>
                    )}
                    {!settings?.hidePosHistory && (!hasAccess || hasAccess('pos_history')) && (
                        <button onClick={() => if (validateManagerPin(settings, brand)) { setShowHistoryModal(true); }} className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-100 text-blue-700 rounded-lg flex flex-col items-center justify-center gap-1 font-bold text-[9px] transition-colors"><History size={16}/><span>Historique</span></button>
                    )}
                    {!settings?.hidePosReports && (!hasAccess || hasAccess('pos_reports')) && (
                        <button onClick={() => setShowXZModal(true)} className="flex-1 py-2 bg-purple-50 hover:bg-purple-100 border border-purple-100 text-purple-700 rounded-lg flex flex-col items-center justify-center gap-1 font-bold text-[9px] transition-colors"><ClipboardList size={16}/><span>Rapports</span></button>
                    )}
                    {(!hasAccess || hasAccess('achat_inventaire')) && (
                        <button onClick={() => setShowAchatsModal(true)} className="flex-1 py-2 bg-green-50 hover:bg-green-100 border border-green-100 text-green-700 rounded-lg flex flex-col items-center justify-center gap-1 font-bold text-[9px] transition-colors"><FileText size={16}/><span>Achats</span></button>
                    )}
                </div>
                {!settings?.hidePosBluetooth && (
                    <div className="flex gap-2 mt-2">
                        <button onClick={handleBluetoothConnect} disabled={isBtConnecting} className={`flex-1 py-2 border rounded-lg flex items-center justify-center gap-1.5 font-bold text-[9px] transition-colors ${btCharacteristic ? 'bg-green-50 hover:bg-green-100 border-green-200 text-green-700' : (isBtConnecting ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700')}`}>
                            <Bluetooth size={14} className={`${btCharacteristic ? "text-green-500" : "text-blue-500"} ${isBtConnecting ? "animate-pulse" : ""}`}/>
                            <span>{isBtConnecting ? "Connexion en cours..." : (btCharacteristic ? "Imprimante BT Connectée" : "Connecter Imprimante BT")}</span>
                        </button>
                    </div>
                )}
            </div>
        </aside>
    );
}
