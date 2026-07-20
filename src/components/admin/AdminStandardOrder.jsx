import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
    Store, Phone, History, Truck, Map as MapIcon, Users, Star, Palette, LogOut, 
    X, Menu, Check, CheckCircle, Minus, Clock, Printer, AlertTriangle, ChevronRight, Search, Mic, MicOff,
    Download, Ban, Trash2, User, Edit3, Settings, Zap, ImageIcon, Type, AlignLeft, 
    MessageCircle, Utensils, MousePointer2, Plus, ShoppingBag, Home, MapPin, Navigation, ChefHat, Monitor,
    TrendingUp, DollarSign, Award, BarChart3, Database, Activity, Calculator, FileText, BookOpen
} from 'lucide-react';
import { collection, query, limit, startAfter } from 'firebase/firestore';

export default function AdminStandardOrder(props) {
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

                    <div className="space-y-6 animate-in fade-in pb-4 max-w-4xl">
                        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-xl border border-gray-100 border-t-4 border-t-blue-500 flex flex-col gap-5">
                           <h3 className="font-bold text-gray-900 text-lg mb-2 flex items-center gap-3 border-b border-gray-100 pb-4"><div className="p-2 bg-blue-100 rounded-lg text-blue-600"><Phone size={20}/></div> Saisir une nouvelle commande</h3>
                           <div className="grid grid-cols-1 gap-4">
                               <label className="block"><span className="text-xs font-medium text-gray-700 mb-1.5 block">Numéro de Téléphone <span className="text-red-500">*</span></span><input className="w-full bg-white border border-gray-300 p-2.5 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm" placeholder="06XXXXXXXX ou 07XXXXXXXX" type="tel" value={extOrder.phone} onChange={e=>setExtOrder({...extOrder, phone: e.target.value.replace(/[^\d]/g, '').slice(0, 10)})} /></label>
                           </div>
                           <label className="block">
                               <span className="text-xs font-medium text-gray-700 mb-1.5 block">Frais de Livraison (DH)</span>
                               <div className="flex gap-2">
                                   {[0, 5, 10, 15, 20].map((fee) => (
                                       <button 
                                           key={fee} 
                                           onClick={() => setExtOrder({...extOrder, deliveryFee: fee})}
                                           className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all border ${Number(extOrder.deliveryFee) === fee ? 'bg-blue-500 text-white border-blue-600 shadow-md' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                                       >
                                           {fee} DH
                                       </button>
                                   ))}
                               </div>
                           </label>
                           <label className="block"><span className="text-xs font-medium text-gray-700 mb-1.5 block">Agence / Point de Vente <span className="text-red-500">*</span></span><select disabled={role === 'manager'} className="w-full bg-white border border-gray-300 p-2.5 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none cursor-pointer disabled:opacity-50 shadow-sm" value={extOrder.branchId} onChange={e=>setExtOrder({...extOrder, branchId: e.target.value})}><option value="">Sélectionner une agence...</option>{(settings?.branches || DEFAULT_BRANCHES).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
                           
                           <div className="block mt-2">
                              <div className="flex justify-between items-center mb-3"><span className="text-xs font-medium text-gray-700 block">Détails de la Commande <span className="text-red-500">*</span></span><button onClick={()=>setShowExtMenu(!showExtMenu)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border border-gray-200">{showExtMenu ? 'Cacher le Menu' : 'Ajouter un produit'}</button></div>
                              <div className={`transition-all overflow-hidden ${showExtMenu ? 'max-h-96 opacity-100 mb-4' : 'max-h-0 opacity-0'}`}><div className="bg-white p-3 rounded-lg border border-gray-200 flex flex-wrap gap-2 overflow-y-auto max-h-60 no-scrollbar shadow-sm">{(settings?.menuItems || DEFAULT_MENU_ITEMS).map(item => (<button key={item.id} disabled={item.outOfStock} onClick={() => { if (item.removableIngredients || item.hasVariations || item.choices || (item.extras && item.extras.length > 0)) { setSelectedExtItem(item); setExtItemOptions([]); setExtSelectedVariation(item.hasVariations && item.variations?.length > 0 ? item.variations[0] : null); setExtSelectedChoice(null); setExtSelectedExtras([]); } else { addExtCart({...item, cartItemId: item.id + '_default'}); } }} className={`bg-gray-50 px-3 py-2 rounded-md border border-gray-200 shadow-sm text-xs font-medium text-gray-700 hover:bg-white hover:border-gray-300 transition-all flex items-center gap-2 ${item.outOfStock ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}><span>{item.img?.startsWith('http') || item.img?.startsWith('data:image') ? '🍔' : item.img}</span> {item.name || ''} {item.hasVariations && <span className="text-[9px] text-blue-500 font-bold ml-1">(Tailles)</span>} <span className="text-gray-900 font-semibold ml-auto">{item.price} DH</span></button>))}</div></div>
                              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 min-h-[100px] shadow-inner">{extCart.length === 0 ? (<p className="text-sm font-medium text-blue-400 flex items-center justify-center h-full min-h-[80px]">Le panier est vide pour le moment.</p>) : (<div className="space-y-3">{extCart.map(item => (<div key={item.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-blue-100 shadow-sm hover:shadow-md transition-shadow"><div className="flex flex-col"><span className="text-sm font-bold text-gray-900">{(item.name || '').split(' (Sans ')[0] || ''}</span>{(item.name || '').includes(' (Sans ') && (item.name || '').split(' (Sans ')[1].replace(')','').split(', ').map((opt, idx) => <span key={idx} className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-md font-bold mt-1 w-fit">- {formatSansIngredient(opt)}</span>)}</div><div className="flex items-center gap-4"><span className="text-base font-black text-blue-600">{item.price * item.qty} DH</span><div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1 border border-gray-200"><button onClick={() => removeExtCart(item)} className="w-7 h-7 bg-white hover:bg-gray-100 rounded-md text-gray-600 shadow-sm flex items-center justify-center font-bold">-</button><span className="text-sm font-black w-5 text-center">{item.qty}</span><button onClick={() => addExtCart(item)} className="w-7 h-7 bg-white hover:bg-gray-100 rounded-md text-gray-600 shadow-sm flex items-center justify-center font-bold">+</button></div></div></div>))}</div>)}</div>
                           </div>
                           <div className="flex items-center justify-between mt-6 p-5 bg-gradient-to-r from-gray-50 to-blue-50/30 rounded-xl border border-gray-200 shadow-sm">
                              <span className="text-sm font-bold text-gray-600 uppercase tracking-widest">Total à Payer</span>
                              <span className="text-3xl font-black text-gray-900">{extTotal + (Number(extOrder.deliveryFee) || 0)} <span className="text-lg text-gray-500">DH</span></span>
                           </div>
                           <button onClick={handleStandardOrder} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-4 rounded-xl font-bold text-base shadow-lg shadow-blue-500/30 mt-4 flex items-center justify-center gap-3 transition-all hover:-translate-y-0.5 active:translate-y-0"><MessageCircle size={20}/> Créer & Envoyer WhatsApp</button>
                           
                           {/* Modal Options "Sans" pour Standard Tél */}
                           {selectedExtItem && (
                             <div className="fixed inset-0 bg-black/60 z-[300] flex items-end md:items-center justify-center animate-in fade-in" onClick={() => setSelectedExtItem(null)}>
                               <div className="bg-white w-full md:w-[400px] rounded-t-2xl md:rounded-xl p-6 flex flex-col max-h-[80vh] animate-in slide-in-from-bottom-10 shadow-2xl" onClick={e => e.stopPropagation()}>
                                 <div className="flex justify-between items-center mb-4"><h3 className="font-semibold text-lg text-gray-900">Personnaliser</h3><button onClick={() => setSelectedExtItem(null)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-md transition-colors"><X size={18}/></button></div>
                                 
                                 <div className="flex-1 overflow-y-auto mb-6">
                                   {selectedExtItem.hasVariations && selectedExtItem.variations?.length > 0 && (
                                     <div className="mb-6">
                                       <p className="text-sm font-medium text-gray-600 mb-3">Taille / Variante <span className="text-red-500">*</span></p>
                                       <div className="space-y-2">
                                         {selectedExtItem.variations.map((v, idx) => (
                                           <label key={idx} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${extSelectedVariation?.name === v.name ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                                               <div className="flex items-center gap-3">
                                                   <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${extSelectedVariation?.name === v.name ? 'border-blue-500' : 'border-gray-300'}`}>{extSelectedVariation?.name === v.name && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full"></div>}</div>
                                                   <span className="font-medium text-sm text-gray-900">{v.name}</span>
                                               </div>
                                               <span className="font-semibold text-blue-600">{v.price} DH</span>
                                               <input type="radio" className="hidden" name="extvariation" checked={extSelectedVariation?.name === v.name} onChange={() => setExtSelectedVariation(v)} />
                                           </label>
                                         ))}
                                       </div>
                                     </div>
                                   )}

                                   {selectedExtItem.choices && (() => {
                                       let choiceList = [];
                                       const choicesStr = String(selectedExtItem.choices).trim();
                                       if (choicesStr.toUpperCase().startsWith('CAT:')) {
                                           const catName = choicesStr.split(':')[1].trim();
                                           const matchedItems = (settings?.menuItems || DEFAULT_MENU_ITEMS).filter(i => i.category === catName && !i.outOfStock && !(settings?.disabledItems || []).includes(i.id));
                                           matchedItems.forEach(i => {
                                               if (i.hasVariations && i.variations?.length > 0) {
                                                   i.variations.forEach(v => choiceList.push({ name: `${i.name} (${v.name})`, img: i.img }));
                                               } else {
                                                   choiceList.push({ name: i.name, img: i.img });
                                               }
                                           });
                                       } else if (choicesStr.toUpperCase().startsWith('PROD:')) {
                                           const prodNames = choicesStr.substring(5).split(',').map(n => n.trim().toLowerCase());
                                           const matchedItems = (settings?.menuItems || DEFAULT_MENU_ITEMS).filter(i => prodNames.includes((i.name || '').trim().toLowerCase()) && !i.outOfStock && !(settings?.disabledItems || []).includes(i.id));
                                           matchedItems.forEach(i => {
                                               if (i.hasVariations && i.variations?.length > 0) {
                                                   i.variations.forEach(v => choiceList.push({ name: `${i.name} (${v.name})`, img: i.img }));
                                               } else {
                                                   choiceList.push({ name: i.name, img: i.img });
                                               }
                                           });
                                       } else {
                                           choiceList = choicesStr.split(',').map(choice => {
                                               const parts = choice.trim().split('|');
                                               return { name: parts[0].trim(), img: parts.length > 1 ? parts[1].trim() : null };
                                           }).filter(c => c.name);
                                       }

                                       return (
                                     <div className="mb-6">
                                       <p className="text-sm font-medium text-gray-600 mb-3">Choix / Parfum <span className="text-red-500">*</span></p>
                                      <div className={`${choiceList.some(c => c.img) ? 'grid grid-cols-2 gap-2' : 'space-y-2'}`}>
                                         {choiceList.map(c => (
                                            <label key={c.name} className={`flex ${c.img ? 'flex-col items-center text-center' : 'items-center justify-between'} p-3 rounded-lg border cursor-pointer transition-all ${extSelectedChoice === c.name ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                                                {c.img && (
                                                    <div className="w-12 h-12 mb-2 rounded-md overflow-hidden flex items-center justify-center">
                                                        {c.img.startsWith('http') || c.img.startsWith('data:image') ? <img src={c.img} className="w-full h-full object-contain" alt={c.name} /> : <span className="text-3xl">{c.img}</span>}
                                                    </div>
                                                )}
                                                <div className={`flex items-center gap-3 ${c.img ? 'w-full justify-center' : ''}`}>
                                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${extSelectedChoice === c.name ? 'border-blue-500' : 'border-gray-300'}`}>{extSelectedChoice === c.name && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full"></div>}</div>
                                                    <span className="font-medium text-sm text-gray-900 leading-tight">{c.name}</span>
                                                 </div>
                                                 <input type="radio" className="hidden" name="extchoice" checked={extSelectedChoice === c.name} onChange={() => setExtSelectedChoice(c.name)} />
                                             </label>
                                           ))}
                                       </div>
                                     </div>
                                       );
                                   })()}
                                   {selectedExtItem.extras?.length > 0 && (
                                       (() => {
                                         const activeGlobalDrinks = settings?.globalDrinks !== undefined ? settings.globalDrinks : PREDEFINED_DRINKS;
                                         const drinkNames = new Set(activeGlobalDrinks.map(d => d.name));
                                         const pureExtras = (selectedExtItem.extras || []).filter(e => !drinkNames.has(e.name));
                                         const pureDrinks = (selectedExtItem.extras || []).filter(e => drinkNames.has(e.name));
                                         
                                         return (
                                             <>
                                               {pureExtras.length > 0 && (
                                                 <div className="mb-6">
                                                   <p className="text-sm font-medium text-gray-600 mb-3">➕ Extras & Suppléments :</p>
                                                   <div className="space-y-2">
                                                     {pureExtras.map(ext => {
                                                       const isAdded = extSelectedExtras.some(e => e.name === ext.name);
                                                       return ( 
                                                           <button key={ext.name} onClick={() => { if (isAdded) setExtSelectedExtras(extSelectedExtras.filter(e => e.name !== ext.name)); else setExtSelectedExtras([...extSelectedExtras, ext]); }} className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-sm font-medium ${isAdded ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}>
                                                               <span>Avec {ext.name} (+{ext.price} DH)</span>
                                                               <div className={`w-6 h-6 rounded-md flex items-center justify-center border-2 ${isAdded ? 'border-green-500 bg-green-500' : 'border-gray-300'}`}>{isAdded && <Check size={14} color="white" strokeWidth={4} />}</div>
                                                           </button> 
                                                       );
                                                     })}
                                                   </div>
                                                 </div>
                                               )}
                                               {pureDrinks.length > 0 && (
                                                 <div className="mb-6">
                                                   <p className="text-sm font-medium text-gray-600 mb-3">🥤 Boissons :</p>
                                                   <div className="space-y-2">
                                                     {pureDrinks.map(ext => {
                                                       const isAdded = extSelectedExtras.some(e => e.name === ext.name);
                                                       return ( 
                                                           <button key={ext.name} onClick={() => { if (isAdded) setExtSelectedExtras(extSelectedExtras.filter(e => e.name !== ext.name)); else setExtSelectedExtras([...extSelectedExtras, ext]); }} className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-sm font-medium ${isAdded ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}>
                                                               <span>{ext.name} (+{ext.price} DH)</span>
                                                               <div className={`w-6 h-6 rounded-md flex items-center justify-center border-2 ${isAdded ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>{isAdded && <Check size={14} color="white" strokeWidth={4} />}</div>
                                                           </button> 
                                                       );
                                                     })}
                                                   </div>
                                                 </div>
                                               )}
                                             </>
                                         );
                                       })()
                                   )}

                                   {selectedExtItem.removableIngredients && (
                                     <div>
                                       <p className="text-sm font-medium text-gray-600 mb-3">Ingrédients à retirer :</p>
                                       <div className="space-y-2">
                                         {(selectedExtItem.removableIngredients || '').split(',').map(ing => {
                                     const ingredient = ing.trim(); if (!ingredient) return null;
                                     const isRemoved = extItemOptions.includes(ingredient);
                                     return ( <button key={ingredient} onClick={() => { if (isRemoved) setExtItemOptions(extItemOptions.filter(o => o !== ingredient)); else setExtItemOptions([...extItemOptions, ingredient]); }} className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-sm font-medium ${isRemoved ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}><span>{formatSansIngredient(ingredient)}</span><div className={`w-6 h-6 rounded-md flex items-center justify-center border-2 ${isRemoved ? 'border-red-500 bg-red-500' : 'border-gray-300'}`}>{isRemoved && <Check size={14} color="white" strokeWidth={4} />}</div></button> );
                                   })}
                                       </div>
                                     </div>
                                   )}
                                 </div>
                                 <button onClick={() => { if (selectedExtItem.hasVariations && !extSelectedVariation) return showNotify("Veuillez choisir une taille !", "error"); if (selectedExtItem.choices && !extSelectedChoice) return showNotify("Veuillez choisir une option (Choix/Parfum) !", "error"); const optionsSuffix = extItemOptions.length > 0 ? '_' + extItemOptions.join('_') : '_default'; const varSuffix = extSelectedVariation ? '_' + extSelectedVariation.name.replace(/\s+/g, '') : ''; const choiceSuffix = extSelectedChoice ? '_' + extSelectedChoice.replace(/\s+/g, '') : ''; const extrasSuffix = extSelectedExtras.length > 0 ? '_' + extSelectedExtras.map(e => e.name.replace(/\s+/g, '')).join('_') : ''; const cartItemId = selectedExtItem.id + varSuffix + choiceSuffix + optionsSuffix + extrasSuffix; let finalPrice = extSelectedVariation ? Number(extSelectedVariation.price || 0) : Number(selectedExtItem.price || 0); finalPrice += extSelectedExtras.reduce((s, e) => s + Number(e.price), 0); const varNamePart = extSelectedVariation ? ` (${extSelectedVariation.name})` : ''; const choiceNamePart = extSelectedChoice ? ` (${extSelectedChoice})` : ''; const avecNamePart = extSelectedExtras.length > 0 ? ` (Avec ${extSelectedExtras.map(e => e.name).join(', ')})` : ''; const sansNamePart = extItemOptions.length > 0 ? ` (Sans ${extItemOptions.join(', ')})` : ''; const finalName = selectedExtItem.name + varNamePart + choiceNamePart + avecNamePart + sansNamePart; const existingItem = extCart.find(c => (c.cartItemId || c.id) === cartItemId); if (existingItem) { setExtCart(extCart.map(c => (c.cartItemId || c.id) === cartItemId ? { ...c, qty: c.qty + 1 } : c)); } else { setExtCart([...extCart, { ...selectedExtItem, qty: 1, cartItemId, name: finalName, price: finalPrice }]); } setSelectedExtItem(null); showNotify("Produit ajouté ! 🍔", "success"); }} className="w-full py-3 rounded-lg font-medium text-sm text-white shadow-sm bg-blue-600 hover:bg-blue-700 mt-4">Valider • {(extSelectedVariation ? Number(extSelectedVariation.price || 0) : Number(selectedExtItem.price || 0)) + extSelectedExtras.reduce((s,e)=>s+Number(e.price),0)} DH</button>
                               </div>
                             </div>
                           )}
                        </div>
                    </div>
                
);
}
