import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
    Store, Phone, History, Truck, Map as MapIcon, Users, Star, Palette, LogOut, 
    X, Menu, Check, CheckCircle, Minus, Clock, Printer, AlertTriangle, ChevronRight, Search, Mic, MicOff,
    Download, Ban, Trash2, User, Edit3, Settings, Zap, ImageIcon, Type, AlignLeft, 
    MessageCircle, Utensils, MousePointer2, Plus, ShoppingBag, Home, MapPin, Navigation, ChefHat, Monitor,
    TrendingUp, DollarSign, Award, BarChart3, Database, Activity, Calculator, FileText, BookOpen
} from 'lucide-react';
import { collection, query, limit, startAfter } from 'firebase/firestore';

export default function AdminProblemOrders(props) {
    const {
        role, db, appId, settings, brand, showNotify, 
        managerBranchId, adminSelectedBranch, 
        lazyHistory, isLoadMore, lastHistoryDoc, 
        analyticsPeriod, setAnalyticsPeriod, analyticsBranch, setAnalyticsBranch,
        getL, today, yesterday, handleFetchAnalytics,
        problemOrders, handleUpdateStatus,
        extOrder, setExtOrder, extCart, setExtCart, showExtMenu, setShowExtMenu,
        selectedExtItem, setSelectedExtItem, extItemOptions, setExtItemOptions,
        extSelectedVariation, setExtSelectedVariation, extSelectedChoice, setExtSelectedChoice,
        extSelectedExtras, setExtSelectedExtras, addExtCart, removeExtCart, extTotal,
        handleStandardOrder, formatSansIngredient, DEFAULT_MENU_ITEMS,
        liveOnlineDrivers, showAddDriver, setShowAddDriver, newDriver, setNewDriver,
        handleAddDriverSubmit, handleHardResetOrders, handleWakeUpDrivers, 
        clientsList, formatPhoneNumber,
        ...rest
    } = props;

    return (

                    <div className="space-y-6 animate-in fade-in pb-4">
                        <div className="bg-red-50 p-6 md:p-8 rounded-[2rem] border border-red-200 shadow-sm">
                            <h2 className="text-xl md:text-2xl font-black text-red-600 mb-6 flex items-center gap-3"><AlertTriangle size={28}/> Problèmes Commandes À Gérer ({problemOrders.length})</h2>
                            {problemOrders.length === 0 ? (
                                <p className="text-gray-500 font-bold">Aucun problème à gérer.</p>
                            ) : (
                                <div className="space-y-4">
                                    {problemOrders.map(o => (
                                        <div key={o.id} className="bg-white p-5 rounded-2xl shadow-sm border border-red-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div>
                                                <div className="flex items-center gap-3 mb-1">
                                                    <span className="font-black text-gray-900 text-lg">#{o.orderNumber || o.id.slice(-4).toUpperCase()}</span>
                                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${o.source === 'pos' ? 'bg-blue-100 text-blue-700' : o.source === 'telephone' ? 'bg-purple-100 text-purple-700' : o.source === 'glovo' ? ((o.paymentMethod === 'espece' || o.paymentMethod === 'cash') ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-yellow-100 text-yellow-800') : 'bg-emerald-100 text-emerald-700'}`}>
                                                        {o.source === 'pos' ? 'Caisse (POS)' : o.source === 'telephone' ? 'Téléphone' : o.source === 'glovo' ? ((o.paymentMethod === 'espece' || o.paymentMethod === 'cash') ? 'Glovo (ESPECE 💵 $)' : 'Glovo') : 'App Client'}
                                                    </span>
                                                    {o.source === 'pos' && o.orderType && (
                                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${o.orderType === 'sur_place' ? 'bg-indigo-100 text-indigo-700' : 'bg-pink-100 text-pink-700'}`}>
                                                            {o.orderType === 'sur_place' ? '🍽️ Sur Place (Plateau)' : '🛍️ À Emporter (Emballage)'}
                                                        </span>
                                                    )}
                                                    <span className="text-sm font-bold text-gray-500">{o.customerName || o.name || o.phone}</span>
                                                </div>
                                                <p className="text-sm text-red-600 font-bold flex items-center gap-1.5 bg-red-100/50 w-fit px-3 py-1 rounded-lg">
                                            🚨 {o.adminMessage || (o.clientUnreachable ? "Client Injoignable" : ((Date.now() - (o.createdAt?.seconds ? o.createdAt.seconds * 1000 : Date.now())) > 12*60*60*1000 ? "Commande Bloquée (M3el9a kter mn 12h)" : "Problème signalé"))}
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <button onClick={() => handleUpdateStatus(o.id, o.status, {clientUnreachable: false, adminMessage: null})} className="px-5 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-black text-xs uppercase shadow-sm active:scale-95 transition-all">
                                                    ✅ Résolu (Retour Normal)
                                                </button>
                                                <button onClick={() => setConfirmDialog({
                                                    message: 'Annuler cette commande ?',
                                                    onConfirm: () => handleUpdateStatus(o.id, 'rejected', {reason: o.adminMessage || 'Problème de livraison', driverPaid: true, deliveredAtLocal: Date.now(), clientUnreachable: false, adminMessage: null})
                                                })} className="px-5 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-black text-xs uppercase shadow-sm active:scale-95 transition-all">
                                                    ❌ Annuler
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                
);
}
