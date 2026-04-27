import React, { useState, useEffect } from 'react';
import { MapPin, Phone, Printer, Clock, CheckCircle, AlertTriangle, Truck, Map as MapIcon, X } from 'lucide-react';
import OrderTimer from '../OrderTimer';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { isDriverOnline } from '../../utils/helpers';

// 🔥 Jdid: Composant dyal l-wa9t (Timer)
const LiveTimer = ({ startTime }) => {
    const [elapsed, setElapsed] = useState(0);
    useEffect(() => {
        if (!startTime) return;
        const calc = () => {
            const diff = Math.floor((Date.now() - startTime) / 60000);
            setElapsed(diff >= 0 ? diff : 0);
        };
        calc();
        const interval = setInterval(calc, 60000);
        return () => clearInterval(interval);
    }, [startTime]);
    
    const isLate = elapsed >= 40;
    return (<span className={`flex items-center gap-1.5 text-sm font-black px-3 py-1.5 rounded-lg border-2 shadow-sm ${isLate ? 'bg-red-100 text-red-700 border-red-300 animate-pulse' : 'bg-white text-gray-800 border-gray-200'}`}><Clock size={16}/> {elapsed} min</span>);
};

export default function AdminActiveOrders({
    pending,
    actives,
    brand,
    clientsList,
    updateStatus,
    printTicket,
    handleReassignOrder,
    onlineDrivers,
    db,
    appId,
    showNotify
}) {
    const [cancelModal, setCancelModal] = useState({ show: false, order: null });

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 mb-10">
                <div className="bg-red-50 p-8 rounded-[2.5rem] border-4 border-red-100 shadow-xl flex flex-col justify-center items-center relative overflow-hidden"><p className="text-sm font-black text-red-800 uppercase tracking-widest mb-2">En Attente</p><p className="text-6xl font-black text-red-600 tracking-tighter">{pending.length}</p></div>
                <div className="bg-orange-50 p-8 rounded-[2.5rem] border-4 border-orange-100 shadow-xl flex flex-col justify-center items-center"><p className="text-sm font-black text-orange-800 uppercase tracking-widest mb-2">En Cuisine</p><p className="text-6xl font-black text-orange-600 tracking-tighter">{actives.filter(o=>o.status==='preparing').length}</p></div>
                <div className="bg-blue-50 p-8 rounded-[2.5rem] border-4 border-blue-100 shadow-xl flex flex-col justify-center items-center"><p className="text-sm font-black text-blue-800 uppercase tracking-widest mb-2">En Route</p><p className="text-6xl font-black text-blue-600 tracking-tighter">{actives.filter(o=>o.status==='out_for_delivery').length}</p></div>
            </div>

            <div className="flex flex-col md:grid md:grid-cols-2 xl:grid-cols-3 gap-8 md:gap-10">
                {actives.sort((a,b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)).map((o, index) => {
                    const dName = o.driverName || (clientsList||[]).find(c => c.uid === o.driverId || c.phone === o.driverId)?.name || 'Inconnu';
                    const dPhone = (clientsList||[]).find(c => c.uid === o.driverId || c.phone === o.driverId)?.phone || '';

                    return (
                        <div key={o.id} className={`bg-white rounded-[2.5rem] border-2 shadow-xl relative overflow-hidden flex flex-col hover:shadow-2xl transition-all ${index === 0 ? 'scale-[1.02] ring-4 ring-offset-4' : ''}`} style={index === 0 ? {borderColor: brand.color, ringColor: brand.color} : {borderColor: '#f3f4f6'}}>
                            {/* Top Border Indicator */}
                            <div className="h-3 w-full" style={{backgroundColor: index === 0 ? brand.color : '#e5e7eb'}}></div>
                            
                            {/* Header */}
                            <div className="p-6 md:p-8 border-b-2 border-gray-50 bg-gray-50/30">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex flex-col">
                                        <span className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-2">Cmd #{o.orderNumber || o.id.slice(-4).toUpperCase()}</span>
                                        <span className="font-black text-gray-900 text-3xl uppercase italic tracking-tighter leading-none pr-2">{o.name || o.customerName || o.phone}</span>
                                    </div>
                                    <div className="flex flex-col items-end gap-2 shrink-0">
                                        <span className="text-4xl font-black tracking-tighter" style={{color: brand.color || '#000'}}>{o.total} <span className="text-xl text-gray-500">DH</span></span>
                                        <div className="flex gap-2 mt-1">
                                             <div className={`text-xs font-black uppercase px-4 py-1.5 rounded-xl shadow-md text-white ${index === 0 ? 'bg-red-600 animate-pulse shadow-red-500/40' : 'bg-gray-800'}`}>N° {index + 1}</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between mt-6 pt-4 border-t-2 border-dashed border-gray-200/50">
                                    <span className="text-xs font-black text-gray-500 flex items-center gap-2"><Clock size={16}/> {o.createdAt?.seconds ? new Date(o.createdAt.seconds*1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}</span>
                                    <LiveTimer startTime={o.createdAt?.seconds ? o.createdAt.seconds * 1000 : Date.now()} />
                                </div>
                            </div>

                            {/* Body */}
                            <div className="p-6 md:p-8 flex-1 space-y-6 bg-white">
                                {/* Info Contact */}
                                <div className="flex justify-between items-start gap-4">
                                    <div className="space-y-3 flex-1">
                                        <p className="text-base text-gray-800 flex items-start gap-3 font-bold"><MapPin size={20} className="text-gray-400 shrink-0 mt-0.5"/> <span className="line-clamp-3 leading-snug">{o.address}</span></p>
                                        <p className="text-xl text-green-700 font-black flex items-center gap-3 bg-green-50 w-fit px-4 py-2 rounded-2xl border border-green-200 shadow-sm"><Phone size={20} className="text-green-500 shrink-0 animate-pulse"/> {o.phone}</p>
                                        <p className="text-xs font-black text-gray-500 flex items-center gap-2 mt-3 uppercase tracking-widest"><MapIcon size={16} className="text-gray-400 shrink-0"/> {o.nearestBranch?.name}</p>
                                    </div>
                                    <button onClick={()=>printTicket(o, brand)} className="p-5 bg-white rounded-[1.5rem] text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-all border-2 border-gray-200 shadow-md shrink-0 active:scale-95" title="Imprimer"><Printer size={28}/></button>
                                </div>

                                {/* Items */}
                                <div className="bg-gray-50 p-6 rounded-[2rem] border-2 border-gray-100 text-gray-900 shadow-inner">
                                    <div className="space-y-4">{(o.items||[]).map((i, idx) => <div key={idx} className="leading-tight"><span className="font-black text-lg">{i.qty}x {(i.name || '').split(' (Sans ')[0]}</span>{(i.name || '').includes(' (Sans ') && (i.name || '').split(' (Sans ')[1].replace(')','').split(', ').map((opt, oIdx) => <span key={oIdx} className="block text-[11px] font-black text-red-500 ml-8 mt-1.5 uppercase">- Sans {opt}</span>)}</div>)}</div>
                                    {o.orderNote && (
                                        <div className="mt-5 pt-4 border-t-2 border-gray-200 border-dashed">
                                            <p className="text-[10px] font-black text-red-500 uppercase mb-2 tracking-widest">📝 Note du client :</p>
                                            <p className="text-sm font-bold text-gray-800 bg-white p-4 rounded-2xl border border-red-100 shadow-sm">"{o.orderNote}"</p>
                                        </div>
                                    )}
                                </div>

                                {/* Preparing Timer */}
                                {o.status === 'preparing' && (
                                    <div className="flex items-center justify-between bg-orange-50 p-5 rounded-[1.5rem] border-2 border-orange-200 shadow-sm">
                                        <span className="text-sm font-black text-orange-800 flex items-center gap-2 uppercase tracking-widest"><Clock size={20}/> Préparation</span>
                                        <div className="flex items-center gap-4">
                                            <button onClick={()=>updateStatus(o.id, o.status, {prepTime: Math.max(1, (o.prepTime||10)-1)})} className="bg-white text-orange-600 w-10 h-10 rounded-xl flex items-center justify-center font-black text-xl shadow-sm border border-orange-200 hover:bg-orange-100 transition-colors active:scale-95">-</button>
                                            <span className="font-black text-2xl text-orange-700 w-10 text-center">{o.prepTime || 10}m</span>
                                            <button onClick={()=>updateStatus(o.id, o.status, {prepTime: (o.prepTime||10)+1})} className="bg-white text-orange-600 w-10 h-10 rounded-xl flex items-center justify-center font-black text-xl shadow-sm border border-orange-200 hover:bg-orange-100 transition-colors active:scale-95">+</button>
                                        </div>
                                    </div>
                                )}

                                {/* Driver Assignment Info */}
                                {o.driverId && (
                                    <div className={`p-5 rounded-[1.5rem] border-2 flex flex-col gap-4 shadow-sm ${(!o.driverAccepted && o.status === 'preparing') ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'}`}>
                                        {(!o.driverAccepted && o.status === 'preparing') ? ( <span className="text-orange-700 font-black text-[11px] uppercase tracking-widest flex items-center gap-2"><div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div> Attente Confirmation (<OrderTimer assignedAtLocal={o.assignedAtLocal} updatedAt={o.updatedAt} />)</span> ) : ( <span className="text-blue-700 font-black text-[11px] uppercase tracking-widest flex items-center gap-2"><CheckCircle size={18}/> Livreur Confirmé</span> )}
                                        <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                                            <div className="flex flex-col"><span className="text-gray-900 font-black text-lg uppercase tracking-tight">{dName}</span>{dPhone && <a href={`tel:${dPhone}`} className="font-mono text-gray-500 font-bold hover:text-blue-600 flex items-center gap-1.5 mt-1 text-sm"><Phone size={14}/> {dPhone}</a>}</div>
                                            {(o.lat && o.lng) ? ( <a href={`https://maps.google.com/?q=${o.lat},${o.lng}`} target="_blank" rel="noopener noreferrer" className="bg-blue-600 text-white border border-blue-700 px-5 py-3 rounded-xl flex items-center gap-2 shadow-md hover:bg-blue-700 transition-colors active:scale-95"><MapIcon size={18}/> <span className="text-[10px] font-black uppercase tracking-widest">Maps</span></a> ) : (<span className="text-red-600 text-[10px] bg-red-100 px-3 py-1.5 rounded-lg font-black border border-red-200 uppercase tracking-widest">Sans GPS</span>)}
                                        </div>
                                    </div>
                                )}

                                {/* Unreachable Client Alert */}
                                {o.clientUnreachable && (
                                    <div className="pt-5 border-t-2 border-red-100 border-dashed space-y-4">
                                        <p className="text-red-600 font-black text-sm uppercase tracking-widest flex items-center gap-2 animate-pulse"><AlertTriangle size={20}/> Client injoignable !</p>
                                        <div className="bg-red-50 p-5 rounded-[1.5rem] border-2 border-red-200 space-y-4 shadow-inner">
                                            <a href={`tel:${o.phone}`} className="w-full bg-white border-2 border-gray-200 text-gray-900 py-4 rounded-xl text-sm font-black uppercase flex justify-center items-center gap-2 shadow-sm hover:bg-gray-50 active:scale-95 transition-all"><Phone size={20}/> Appeler le client</a>
                                            <div className="flex gap-4">
                                                <button onClick={() => updateStatus(o.id, o.status, { clientUnreachable: false, unreachableAt: null, adminMessage: 'jawbak' })} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-4 rounded-xl text-xs font-black uppercase shadow-lg transition-all active:scale-95">✅ J'ai eu le client</button>
                                                <button onClick={() => { if(window.confirm('Annuler w nkhllsso livreur?')) updateStatus(o.id, 'rejected', { reason: 'Client injoignable', driverPaid: true, deliveredAtLocal: Date.now(), clientUnreachable: false }) }} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-4 rounded-xl text-xs font-black uppercase shadow-lg transition-all active:scale-95">❌ Annuler</button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer Actions */}
                            <div className="p-6 bg-gray-50 border-t-2 border-gray-100 flex gap-3 flex-wrap items-center rounded-b-[2.5rem]">
                                {o.status==='pending' && <button onClick={()=>handleReassignOrder(o, null, false)} className="flex-[2] py-5 rounded-2xl text-white font-black text-sm uppercase tracking-wider shadow-xl active:scale-95 transition-all" style={{backgroundColor: brand.color || '#000'}}>{brand.texts?.btnAdminOfficial || '1. Officiel'}</button>}
                                {o.status==='preparing' && <button onClick={()=>updateStatus(o.id,'ready')} className="flex-[2] py-5 rounded-2xl text-white font-black text-sm uppercase tracking-wider shadow-xl active:scale-95 transition-all bg-green-500 hover:bg-green-600">{brand.texts?.btnReady || 'Prêt (Wajad)'}</button>}
                                
                                {!o.driverId && <button onClick={()=>handleReassignOrder(o, null, true)} className="flex-[2] bg-blue-600 text-white py-5 rounded-2xl font-black text-[11px] md:text-sm uppercase tracking-wider shadow-xl hover:bg-blue-700 flex items-center justify-center gap-2 transition-all active:scale-95"><Truck size={20}/> {o.status === 'pending' ? (brand.texts?.btnAdminTous || '2. Tous (Free)') : (brand.texts?.btnAdminAskDriver || 'Demander Livreur')}</button>}
                                
                                {!o.driverId && (onlineDrivers||[]).filter(d => isDriverOnline(d) && !d.isAvailable).length > 0 && (
                                    <select 
                                        className="flex-[2] bg-purple-100 text-purple-800 py-5 px-4 rounded-2xl font-black text-xs uppercase tracking-wider shadow-md border-2 border-purple-200 outline-none focus:ring-4 focus:ring-purple-500/20 transition-all cursor-pointer truncate appearance-none text-center"
                                        onChange={(e) => {
                                            if(e.target.value) {
                                                const dInfo = (clientsList||[]).find(c => c.uid === e.target.value);
                                                updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', o.id), { 
                                                    driverId: e.target.value, 
                                                    driverName: dInfo ? dInfo.name : 'Inconnu', 
                                                    isFreelanceDriver: dInfo ? dInfo.isFreelance : false, 
                                                    driverAccepted: false, 
                                                    assignedAtLocal: Date.now(), 
                                                    updatedAt: serverTimestamp(), 
                                                    status: o.status === 'pending' ? 'preparing' : o.status 
                                                });
                                                showNotify("Commande assignée! 📦📦", "success");
                                                e.target.value = ""; 
                                            }
                                        }}
                                    >
                                        <option value="">Regrouper 📦</option>
                                        {(onlineDrivers||[]).filter(d => isDriverOnline(d) && !d.isAvailable).map(d => (
                                            <option key={d.uid} value={d.uid}>{d.name} ({d.activeOrdersCount || 1})</option>
                                        ))}
                                    </select>
                                )}

                                {o.status==='ready' && o.driverId && <div className="flex-[3] py-5 text-center rounded-2xl font-black text-sm uppercase tracking-wider text-gray-500 bg-gray-200 border-2 border-gray-300 shadow-inner">Attente Livreur...</div>}
                                {o.status==='out_for_delivery' && <div className="flex-[3] py-5 text-center rounded-2xl font-black text-sm uppercase tracking-wider text-blue-700 bg-blue-100 border-2 border-blue-200 shadow-inner">{brand.texts?.btnOutDelivery || 'En route 🛵'}</div>}
                                
                                <button onClick={()=>setCancelModal({show: true, order: o})} className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl hover:bg-red-200 border-2 border-red-200 shadow-sm transition-all active:scale-95 flex items-center justify-center shrink-0"><X size={28}/></button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {cancelModal.show && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in zoom-in-95">
                    <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl border-2 border-red-100 flex flex-col gap-6 relative">
                        <div className="flex justify-between items-center border-b-2 border-gray-50 pb-4">
                            <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Annuler Commande</h3>
                            <button onClick={() => setCancelModal({ show: false, order: null })} className="text-gray-400 hover:text-red-500 bg-gray-100 hover:bg-red-50 rounded-full p-2 transition-all"><X size={24}/></button>
                        </div>
                        <p className="text-sm font-bold text-gray-500">Choisissez la raison de l'annulation pour <br/><span className="font-black text-xl text-black mt-2 inline-block uppercase tracking-tight">{cancelModal.order?.name || cancelModal.order?.phone}</span></p>
                        <div className="flex flex-col gap-4">
                            <button onClick={() => { updateStatus(cancelModal.order.id, 'rejected', { reason: 'Problème de livraison', cancelledBy: 'admin', deliveredAtLocal: Date.now() }); setCancelModal({ show: false, order: null }); }} className="w-full bg-gray-50 p-5 rounded-2xl text-left border-2 border-gray-100 hover:bg-red-50 hover:border-red-300 shadow-sm font-black transition-all text-sm text-gray-800 flex items-center gap-3">🚚 Problème de livraison</button>
                            <button onClick={() => { updateStatus(cancelModal.order.id, 'rejected', { reason: 'Rupture de produit', cancelledBy: 'admin', deliveredAtLocal: Date.now() }); setCancelModal({ show: false, order: null }); }} className="w-full bg-gray-50 p-5 rounded-2xl text-left border-2 border-gray-100 hover:bg-red-50 hover:border-red-300 shadow-sm font-black transition-all text-sm text-gray-800 flex items-center gap-3">📦 Rupture de produit</button>
                            <button onClick={() => { updateStatus(cancelModal.order.id, 'rejected', { reason: 'Client injoignable', cancelledBy: 'admin', deliveredAtLocal: Date.now() }); setCancelModal({ show: false, order: null }); }} className="w-full bg-gray-50 p-5 rounded-2xl text-left border-2 border-gray-100 hover:bg-red-50 hover:border-red-300 shadow-sm font-black transition-all text-sm text-gray-800 flex items-center gap-3">📵 Client injoignable</button>
                            <button onClick={() => {
                                const custom = window.prompt("Autre raison:");
                                if (custom) {
                                    updateStatus(cancelModal.order.id, 'rejected', { reason: custom, cancelledBy: 'admin', deliveredAtLocal: Date.now() });
                                    setCancelModal({ show: false, order: null });
                                }
                            }} className="w-full bg-gray-50 p-5 rounded-2xl text-left border-2 border-gray-100 hover:bg-red-50 hover:border-red-300 shadow-sm font-black transition-all text-sm text-gray-800 flex items-center gap-3">✍️ Autre raison</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}