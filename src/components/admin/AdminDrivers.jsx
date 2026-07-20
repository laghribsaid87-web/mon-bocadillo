import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
    Store, Phone, History, Truck, Map as MapIcon, Users, Star, Palette, LogOut, 
    X, Menu, Check, CheckCircle, Minus, Clock, Printer, AlertTriangle, ChevronRight, Search, Mic, MicOff,
    Download, Ban, Trash2, User, Edit3, Settings, Zap, ImageIcon, Type, AlignLeft, 
    MessageCircle, Utensils, MousePointer2, Plus, ShoppingBag, Home, MapPin, Navigation, ChefHat, Monitor,
    TrendingUp, DollarSign, Award, BarChart3, Database, Activity, Calculator, FileText, BookOpen
} from 'lucide-react';
import { collection, query, limit, startAfter } from 'firebase/firestore';

export default function AdminDrivers(props) {
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
                       <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4"><Truck size={16} className="text-blue-500"/> Suivi Détaillé des Livreurs en Ligne</h3>
                       
                       <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                           <div className="overflow-x-auto">
                               <table className="w-full text-left border-collapse min-w-[800px]">
                                   <thead>
                                       <tr className="bg-gray-50/50 border-b border-gray-100 text-[10px] uppercase tracking-widest text-gray-500">
                                           <th className="px-6 py-4 font-bold">Livreur</th>
                                           <th className="px-6 py-4 font-bold">Statut & Activité</th>
                                           <th className="px-6 py-4 font-bold">Dernière Position (GPS)</th>
                                           <th className="px-6 py-4 font-bold">Total Livraisons</th>
                                           <th className="px-6 py-4 font-bold text-right">Actions</th>
                                       </tr>
                                   </thead>
                                   <tbody className="divide-y divide-gray-100 text-sm">
                                   {(clientsList||[]).filter(c => c.isDriver === true && (liveOnlineDrivers||[]).some(od => ((c.uid && od.uid === c.uid) || (od.phone && c.id && od.phone === c.id)) && isDriverOnline(od))).length === 0 ? (
                                           <tr>
                                               <td colSpan="5" className="py-16 text-center text-gray-400">
                                                   <Truck size={40} className="mx-auto mb-3 opacity-20"/>
                                                   <p className="font-semibold text-sm">Aucun livreur n'est en ligne pour le moment 😴</p>
                                               </td>
                                           </tr>
                                   ) : (clientsList||[]).filter(c => c.isDriver === true).map(c => {
                                       const onlineData = (liveOnlineDrivers||[]).find(od => ((c.uid && od.uid === c.uid) || (od.phone && c.id && od.phone === c.id)) && isDriverOnline(od)); 
                                           if (!onlineData) return null;
                                           const isOnline = true; 
                                           const isAvailable = onlineData.isAvailable; 
                                           const driverTotalOrders = safeOrders.filter(o => c.uid && o.driverId === c.uid && o.status === 'delivered').length;
                                           const activeCount = actives.filter(o => c.uid && o.driverId === c.uid).length;
                                           
                                           let isGpsOutdated = false;
                                           if (isOnline) {
                                               const lastUpdate = onlineData.updatedAt?.seconds ? onlineData.updatedAt.seconds * 1000 : now;
                                               isGpsOutdated = (!onlineData.lat || !onlineData.lng) || (now - lastUpdate > 5 * 60 * 1000);
                                           }
                                           
                                           let locationText = "Mamsajlach f l'GPS"; 
                                           let mapLink = null; 
                                           if (isOnline && onlineData.lat && onlineData.lng) { 
                                               const nearest = getClosestBranch(onlineData.lat, onlineData.lng, settings?.branches || DEFAULT_BRANCHES); 
                                               locationText = `${nearest.distance} km mn ${nearest.name || ''}`; 
                                               mapLink = `https://maps.google.com/?q=${onlineData.lat},${onlineData.lng}`; 
                                           }
                                           
                                           const joinDate = c.createdAt?.seconds ? new Date(c.createdAt.seconds * 1000) : null;
                                           const isNewDriver = joinDate ? (Date.now() - joinDate.getTime()) < 48 * 60 * 60 * 1000 : false;
                                           
                                           return (
                                               <tr key={c.id} className={`hover:bg-gray-50/50 transition-colors ${isNewDriver ? 'bg-purple-50/30' : ''}`}>
                                                   <td className="px-6 py-4">
                                                       <div className="flex items-center gap-3">
                                                           <div className="relative">
                                                               <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white bg-gray-800 shrink-0 shadow-sm">
                                                                   {c.name ? c.name[0].toUpperCase() : <User size={16}/>}
                                                               </div>
                                                               <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm ${isOnline ? (isAvailable ? 'bg-green-500' : 'bg-orange-500') : 'bg-red-500'}`}></div>
                                                           </div>
                                                           <div className="flex flex-col">
                                                               <span className="font-bold text-gray-900 flex items-center gap-1.5">{c.name || 'Inconnu'} {isGpsOutdated && <span title="Mochkil f l'GPS" className="cursor-help text-xs">⚠️</span>}</span>
                                                               <a href={`tel:${c.phone}`} className="text-[10px] text-blue-500 font-mono underline hover:text-blue-700 w-fit">
                                                                   {c.phone || ''}
                                                               </a>
                                                               {onlineData.appVersion && (
                                                                   <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border w-fit mt-0.5 ${onlineData.appVersion === latestGithubVersion ? 'text-green-600 bg-green-50 border-green-200' : 'text-orange-600 bg-orange-50 border-orange-200'}`}>
                                                                       v{onlineData.appVersion} {onlineData.appVersion !== latestGithubVersion && '(Maj dispo)'}
                                                                   </span>
                                                               )}
                                                               <div className="flex flex-wrap gap-1 mt-1">
                                                                   {c.isAppInstalled ? <span className="text-[9px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded border border-green-200 font-bold">📲 App Installée</span> : <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded border border-gray-200 font-bold">🌐 Navigateur</span>}
                                                                   {c.deviceType === 'ios' ? <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded border border-gray-300 font-bold">🍎 iOS</span> : c.deviceType === 'android' ? <span className="text-[9px] px-1.5 py-0.5 bg-green-50 text-green-700 rounded border border-green-200 font-bold">🤖 Android</span> : <span className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200 font-bold">💻 PC</span>}
                                                               </div>
                                                               <span className="text-[9px] text-gray-400 mt-1 font-medium">Inscrit le: {c.createdAt?.seconds ? new Date(c.createdAt.seconds * 1000).toLocaleString('fr-FR', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '--/--/----'}</span>
                                                           </div>
                                                       </div>
                                                   </td>
                                                   <td className="px-6 py-4">
                                                       <div className="flex flex-col gap-1.5 items-start">
                                                           <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${c.isFreelance ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                                                               {c.isFreelance ? 'Freelance' : 'Officiel'}
                                                           </span>
                                                           {isOnline ? (
                                                               activeCount === 0 ? <span className="text-[10px] font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-md border border-green-100">✅ Disponible (Kitsenna)</span> : <span className="text-[10px] font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-100">🛵 Occupé ({activeCount} cmd{activeCount > 1 ? 's' : ''} en cours)</span>
                                                           ) : <span className="text-[10px] font-semibold text-red-500">❌ Hors Ligne</span>}
                                                           
                                                           {c.otp && (
                                                               <span className="mt-1 bg-yellow-50 text-yellow-800 border border-yellow-200 px-2 py-1 rounded-md text-[11px] font-black shadow-sm">
                                                                   🔑 Code: {c.otp}
                                                               </span>
                                                           )}
                                                           
                                                           {c.otp && !c.otpVerified && (
                                                               <button 
                                                                   onClick={() => {
                                                                       const msg = `Salam ${c.name}, mar7ba bik m3ana! L-code de confirmation dyalek bach tdkhol l'application howa: *${c.otp}*`;
                                                                   openWhatsAppDirect(c.phone.replace(/^0/, '212'), msg);
                                                                   }}
                                                                   className="mt-1 bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded-md text-[9px] font-bold shadow-sm"
                                                               >
                                                                   📱 Envoyer Code : {c.otp}
                                                               </button>
                                                           )}
                                                       </div>
                                                   </td>
                                                   <td className="px-6 py-4">
                                                       <span className="text-xs font-medium text-gray-700 flex items-center gap-1.5"><MapIcon size={14} className="text-gray-400"/> {locationText}</span>
                                                   </td>
                                                   <td className="px-6 py-4">
                                                       <span className="text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-md border border-green-100">{driverTotalOrders} Livraisons</span>
                                                   </td>
                                                   <td className="px-6 py-4 text-right">
                                                       {mapLink ? (
                                                           <a href={mapLink} target="_blank" rel="noopener noreferrer" className="inline-flex p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200" title="Voir sur Maps">
                                                               <MapIcon size={16}/>
                                                           </a>
                                                       ) : (
                                                           <span className="text-xs text-gray-400 italic">Pas de GPS</span>
                                                       )}
                                                   </td>
                                               </tr>
                                           );
                                       })}
                                   </tbody>
                               </table>
                           </div>
                       </div>
                   </div>
                
);
}
