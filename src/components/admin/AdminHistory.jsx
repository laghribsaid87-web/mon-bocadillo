import React from 'react';
import { History, ChevronRight, Database, Download } from 'lucide-react';
import StatusBadge from '../StatusBadge';

export default function AdminHistory({
    f, setF,
    historyDriverFilter, setHistoryDriverFilter,
    totalCollecte, totalGainsLivreur, aRendre,
    filteredHistory,
    clientsList,
    expandedOrder, setExpandedOrder,
    brand,
    role,
    handleFetchArchive,
    handleDownloadAndDeleteArchive,
    archiveDates,
    setArchiveDates,
    isFetchingHistory,
    fullHistoryFetched,
    olderOrders
}) {
    return (
        <div className="space-y-8 animate-in fade-in pb-10">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
               <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-gray-100 shadow-2xl flex flex-col justify-center relative overflow-hidden">
                   <div className="absolute -right-4 -bottom-4 opacity-[0.03] text-black"><History size={150}/></div>
                   <span className="text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Recette {f.type==='today'?"Aujourd'hui":f.type==='yesterday'?"Hier":f.date||"Total"}</span>
                   <span className="text-5xl md:text-6xl font-black text-gray-900 tracking-tighter">{totalCollecte} <span className="text-2xl text-gray-400">DH</span></span>
               </div>
               {historyDriverFilter !== 'ALL' && (
                   <>
                       <div className="bg-orange-50 p-8 md:p-10 rounded-[2.5rem] border-2 border-orange-100 shadow-xl flex flex-col justify-center">
                           <span className="text-sm font-black text-orange-800 uppercase tracking-widest mb-2">Gains Livreur</span>
                           <span className="text-5xl font-black text-orange-600 tracking-tighter">- {totalGainsLivreur} <span className="text-2xl">DH</span></span>
                       </div>
                       <div className="bg-black text-white p-8 md:p-10 rounded-[2.5rem] shadow-2xl flex flex-col justify-center">
                           <span className="text-sm font-black uppercase tracking-widest mb-2 opacity-80">À Rendre (Net)</span>
                           <span className="text-5xl font-black text-green-400 tracking-tighter">{aRendre} <span className="text-2xl text-white">DH</span></span>
                       </div>
                   </>
               )}
           </div>

           {/* 🔥 Panel Archive & Nettoyage Firebase (Réservé à l'Admin) */}
           {role === 'admin' && (
               <div className="bg-indigo-50 border border-indigo-200 p-5 md:p-6 rounded-[2rem] mb-8 flex flex-col md:flex-row items-center gap-4 justify-between shadow-inner">
                   <div>
                       <h3 className="text-indigo-800 font-black flex items-center gap-2 text-lg"><Database size={20}/> Archives & Nettoyage</h3>
                       <p className="text-xs font-bold text-indigo-600 mt-1">Télécharger et supprimer l'historique pour libérer de l'espace sur Firebase.</p>
                   </div>
                   <div className="flex items-center gap-3 w-full md:w-auto flex-wrap md:flex-nowrap">
                       <input type="date" className="px-4 py-3 rounded-xl text-sm font-bold border border-indigo-200 outline-none text-indigo-900 bg-white w-full md:w-auto" value={archiveDates.start} onChange={e => setArchiveDates({...archiveDates, start: e.target.value})} />
                       <span className="font-black text-indigo-400 hidden md:block">à</span>
                       <input type="date" className="px-4 py-3 rounded-xl text-sm font-bold border border-indigo-200 outline-none text-indigo-900 bg-white w-full md:w-auto" value={archiveDates.end} onChange={e => setArchiveDates({...archiveDates, end: e.target.value})} />
                       
                       <button onClick={handleFetchArchive} disabled={isFetchingHistory} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3.5 rounded-xl font-black text-xs uppercase shadow-md transition-all flex items-center justify-center gap-2 flex-1 md:flex-none">
                           {isFetchingHistory ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : "Charger"}
                       </button>

                       {fullHistoryFetched && olderOrders && olderOrders.length > 0 && (
                           <button onClick={handleDownloadAndDeleteArchive} disabled={isFetchingHistory} className="bg-red-500 hover:bg-red-600 text-white px-6 py-3.5 rounded-xl font-black text-xs uppercase shadow-md transition-all flex items-center justify-center gap-2 flex-1 md:flex-none animate-in zoom-in">
                               <Download size={16}/> Sauvegarder & Supprimer
                           </button>
                       )}
                   </div>
               </div>
           )}

           <div className="flex flex-col md:flex-row gap-4 mb-8 bg-white p-4 rounded-[2rem] shadow-lg border border-gray-100">
              <div className="flex gap-3 flex-1">
                  <button onClick={()=>setF({...f,type:'today'})} className={`flex-1 py-4 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${f.type==='today'?'bg-black text-white shadow-xl scale-105':'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>Aujourd'hui</button>
                  {role === 'admin' && <button onClick={()=>setF({...f,type:'yesterday'})} className={`flex-1 py-4 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${f.type==='yesterday'?'bg-black text-white shadow-xl scale-105':'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>Hier</button>}
                  {role === 'admin' && <input type="date" value={f.date || ''} onChange={e=>setF({...f,type:'custom',date:e.target.value})} className="flex-[2] bg-gray-50 px-5 py-4 rounded-2xl text-gray-800 outline-none border-2 border-transparent focus:border-blue-500 text-sm font-bold shadow-inner transition-all" />}
                  {role === 'admin' && f.type === 'archive' && <div className="flex-[2] bg-indigo-100 text-indigo-700 px-5 py-4 rounded-2xl font-black text-xs uppercase flex items-center justify-center border border-indigo-200">Archive Affichée</div>}
              </div>
              <select className="flex-1 bg-blue-50 px-5 py-4 rounded-2xl text-blue-800 outline-none border-2 border-transparent focus:border-blue-500 font-black text-xs uppercase tracking-wider shadow-inner transition-all appearance-none cursor-pointer" value={historyDriverFilter} onChange={(e) => setHistoryDriverFilter(e.target.value)}><option value="ALL">👉 Tous les Livreurs</option>{(clientsList||[]).filter(c => c.isDriver === true).map(d => <option key={d.id} value={d.uid || d.id}>{d.name || d.phone || 'Inconnu'} {d.isFreelance ? '(Freelance)' : '(Officiel)'}</option>)}</select>
           </div>

           <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl overflow-hidden">
               <div className="overflow-x-auto">
                   <table className="w-full text-left border-collapse min-w-[800px]">
                       <thead>
                           <tr className="bg-gray-50 border-b-2 border-gray-100 text-[11px] font-black uppercase tracking-widest text-gray-500">
                               <th className="px-8 py-6">Heure & Cmd</th>
                               <th className="px-8 py-6">Client</th>
                               <th className="px-8 py-6">Montant</th>
                               <th className="px-8 py-6">Statut</th>
                               <th className="px-8 py-6 text-right">Détails</th>
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-gray-100 text-sm">
                           {filteredHistory.map(o => {
                               const duration = (o.deliveredAtLocal && o.assignedAtLocal) ? Math.round((o.deliveredAtLocal - o.assignedAtLocal) / 60000) : null;
                               const isFreelance = o.isFreelanceDriver !== undefined ? o.isFreelanceDriver : (clientsList||[]).find(c => c.uid === o.driverId)?.isFreelance;
                               const isExpanded = expandedOrder === o.id;

                               return (
                                   <React.Fragment key={o.id}>
                                       <tr onClick={() => setExpandedOrder(isExpanded ? null : o.id)} className={`cursor-pointer transition-all ${isExpanded ? 'bg-gray-50 shadow-inner' : 'hover:bg-gray-50/80'}`}>
                                           <td className="px-8 py-5">
                                               <div className="flex flex-col gap-1">
                                                   <span className="font-black text-gray-900 text-sm">{o.createdAt?.seconds ? new Date(o.createdAt.seconds*1000).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '--:--'}</span>
                                                   <span className="font-mono font-bold text-gray-400 text-[10px]">#{o.orderNumber || o.id.slice(-4).toUpperCase()}</span>
                                               </div>
                                           </td>
                                           <td className="px-8 py-5">
                                               <span className="font-black text-gray-800 uppercase italic">{String(o.customerName || o.name || o.phone)}</span>
                                               <div className="flex items-center gap-1 mt-1">
                                                   <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${o.source === 'pos' ? 'bg-blue-50 text-blue-600 border-blue-200' : o.source === 'telephone' ? 'bg-purple-50 text-purple-600 border-purple-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                                       {o.source === 'pos' ? 'Caisse (POS)' : o.source === 'telephone' ? 'Tél' : 'App'}
                                                   </span>
                                                   {o.source === 'pos' && o.orderType && (
                                                       <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${o.orderType === 'sur_place' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-pink-50 text-pink-600 border-pink-200'}`}>
                                                           {o.orderType === 'sur_place' ? 'Sur place' : 'À emporter'}
                                                       </span>
                                                   )}
                                               </div>
                                           </td>
                                           <td className="px-8 py-5">
                                               <span className={`font-black text-lg ${o.status === 'rejected' ? 'text-red-400 line-through' : 'text-[#da291c]'}`}>{o.total} DH</span>
                                           </td>
                                           <td className="px-8 py-5">
                                               <div className="flex items-center gap-2">
                                                   <StatusBadge status={o.status} brand={brand}/>
                                                   {duration && <span className="text-[10px] text-gray-600 font-black bg-gray-100 px-2 py-1 rounded-lg border border-gray-200">⏱ {duration} min</span>}
                                                   {o.status === 'rejected' && o.driverPaid && isFreelance && <span className="text-[9px] text-purple-700 bg-purple-100 border border-purple-200 px-2 py-1 rounded-lg font-black uppercase tracking-wider">Payé (+10)</span>}
                                               </div>
                                           </td>
                                           <td className="px-8 py-5 text-right text-gray-400">
                                               <ChevronRight size={20} className={`inline transition-transform ${isExpanded ? 'rotate-90 text-black' : ''}`}/>
                                           </td>
                                       </tr>
                                       {isExpanded && (
                                           <tr>
                                               <td colSpan="5" className="bg-gray-50/80 px-8 py-6 border-t border-gray-100 shadow-inner">
                                                   <div className="max-w-3xl mx-auto bg-white border border-gray-100 rounded-[2rem] p-8 shadow-xl">
                                                       <div className="space-y-3 mb-6 pb-6 border-b-2 border-gray-50">
                                                           {(o.items||[]).map((i, idx) => (
                                                               <div key={idx} className="flex justify-between items-start text-sm font-bold">
                                                                   <div className="flex flex-col">
                                                                       <span className={`font-black text-gray-900 ${o.status === 'rejected' ? 'opacity-50 line-through' : ''}`}>{i.qty}x {(i.name || '').split(' (Sans ')[0]}</span>
                                                                       {(i.name || '').includes(' (Sans ') && (i.name || '').split(' (Sans ')[1].replace(')','').split(', ').map((opt, oIdx) => <span key={oIdx} className="text-[10px] text-red-500 font-black ml-4 uppercase">- Sans {opt}</span>)}
                                                                   </div>
                                                                   <span className={`font-black ${o.status === 'rejected' ? 'opacity-50 line-through text-gray-400' : 'text-gray-700'}`}>{i.price * i.qty} DH</span>
                                                               </div>
                                                           ))}
                                                           {o.orderNote && <div className="mt-4 p-4 bg-red-50 text-red-800 text-xs rounded-xl border border-red-100 font-bold"><span className="uppercase tracking-widest text-[9px] block mb-1 text-red-500">📝 Note du client :</span>"{o.orderNote}"</div>}
                                                       </div>
                                                       <div className="space-y-2.5 text-xs text-gray-500 font-bold">
                                                           <div className="flex justify-between"><span>Sous-total:</span><span className="font-black text-gray-800">{o.subtotal || 0} DH</span></div>
                                                           <div className="flex justify-between"><span>Livraison:</span><span className="font-black text-gray-800">{o.deliveryFee || 0} DH</span></div>
                                                           {o.discount > 0 && <div className="flex justify-between text-green-600"><span>Remise Promo:</span><span className="font-black">-{o.discount} DH</span></div>}
                                                           {o.pointsUsed > 0 && <div className="flex justify-between text-yellow-600"><span>Fidélité:</span><span className="font-black">-{o.pointsUsed} DH</span></div>}
                                                           
                                                           {o.status === 'rejected' && o.driverPaid && (
                                                               <div className="flex justify-between text-purple-700 bg-purple-50 p-3 rounded-xl mt-3 border border-purple-100 font-black">
                                                                   <span>🛵 Ta3wid l-Freelance (Retour) :</span>
                                                                   <span>+10 DH</span>
                                                               </div>
                                                           )}
                                                           
                                                           <div className="flex justify-between font-black text-xl text-gray-900 border-t-2 border-dashed border-gray-200 pt-4 mt-4">
                                                               <span className="uppercase">Total Caisse:</span>
                                                               <span className={o.status === 'rejected' ? 'text-red-500' : 'text-[#da291c]'}>{o.status === 'rejected' ? '0 DH (Annulée)' : `${o.total} DH`}</span>
                                                           </div>
                                                       </div>
                                                   </div>
                                               </td>
                                           </tr>
                                       )}
                                   </React.Fragment>
                               );
                           })}
                       </tbody>
                   </table>
                   {filteredHistory.length===0 && (
                       <div className="py-16 text-center text-gray-400 flex flex-col items-center">
                           <History size={40} className="mb-3 opacity-20"/>
                           <p className="font-semibold text-sm">Aucun historique trouvé</p>
                       </div>
                   )}
               </div>
           </div>
        </div>
    );
}