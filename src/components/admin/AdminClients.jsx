import React from 'react';
import { Search, Truck, Download, Ban, User, Trash2, X } from 'lucide-react';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';

export default function AdminClients({
    f, setF,
    role,
    clientSubTab, setClientSubTab,
    clientsList,
    safeOrders,
    showAddDriver, setShowAddDriver,
    newDriver, setNewDriver,
    handleAddDriverSubmit,
    handleExportCSV,
    db, appId,
    showNotify
}) {
    return (
        <div className="space-y-8 animate-in fade-in pb-10">
           
           <div className="flex flex-col md:flex-row gap-4 mb-8">
              <div className="relative flex-1 md:max-w-md"><Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={20}/><input className="w-full bg-white p-5 pl-14 rounded-[2rem] text-sm font-bold text-gray-900 border-2 border-gray-100 shadow-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all" placeholder="Rechercher un compte..." onChange={e=>setF({...f,search:e.target.value})}/></div>
              
              <button onClick={() => setShowAddDriver(true)} className="bg-black hover:bg-gray-800 text-white px-8 py-5 rounded-[2rem] font-black text-xs uppercase tracking-wider shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 md:w-auto"><Truck size={18}/> Ajouter Livreur</button>
              
              {role === 'admin' && <button onClick={handleExportCSV} className="bg-green-500 hover:bg-green-600 text-white px-8 py-5 rounded-[2rem] font-black text-xs uppercase tracking-wider shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 md:w-auto"><Download size={18}/> Exporter CSV</button>}
           </div>
           
           {role === 'admin' && (
               <div className="flex gap-4 bg-gray-100 p-2 rounded-[2rem] mb-8 w-fit">
                   <button onClick={()=>setClientSubTab('nouveaux')} className={`px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-wider transition-all ${clientSubTab==='nouveaux' ? 'bg-white text-black shadow-lg scale-105' : 'text-gray-500 hover:text-gray-800 hover:bg-white/50'}`}>Utilisateurs</button>
                   <button onClick={()=>setClientSubTab('livreurs')} className={`px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-wider transition-all ${clientSubTab==='livreurs' ? 'bg-white text-black shadow-lg scale-105' : 'text-gray-500 hover:text-gray-800 hover:bg-white/50'}`}>Livreurs</button>
               </div>
           )}

           <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl overflow-hidden">
               <div className="overflow-x-auto">
                   <table className="w-full text-left border-collapse min-w-[800px]">
                       <thead>
                           <tr className="bg-gray-50 border-b-2 border-gray-100 text-[11px] font-black uppercase tracking-widest text-gray-500">
                               <th className="px-8 py-6">Utilisateur</th>
                               <th className="px-8 py-6">Contact</th>
                               <th className="px-8 py-6">Rôle / Statut</th>
                               <th className="px-8 py-6">Statistiques</th>
                               <th className="px-8 py-6 text-right">Actions</th>
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-gray-100 text-sm">
                           {(clientsList||[]).filter(c => (role === 'manager' ? c.isDriver : (clientSubTab==='livreurs' ? c.isDriver : !c.isDriver)) && ((c.name || '').toLowerCase().includes((f.search || '').toLowerCase()) || (c.phone || '').includes(f.search || ''))).map(c=>{
                               const clientOrders = safeOrders.filter(o => (c.uid && o.userId === c.uid) || (c.phone && o.phone === c.phone)); 
                               const driverOrders = safeOrders.filter(o => o.status === 'delivered' && ((c.uid && o.driverId === c.uid) || (c.id && o.driverId === c.id))); 
                               const totalOrders = clientOrders.length; 
                               const totalLivraisons = driverOrders.length; 
                               const lastAddress = clientOrders[0]?.address || "---";
                               
                               return (
                                   <tr key={c.id} className={`hover:bg-gray-50/80 transition-colors ${c.blocked ? 'bg-red-50/30' : ''}`}>
                                       <td className="px-8 py-5">
                                           <div className="flex items-center gap-3">
                                               <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-xl text-white shrink-0 shadow-md ${c.blocked ? 'bg-red-400' : c.isDriver ? (c.isFreelance ? 'bg-blue-500' : 'bg-green-500') : 'bg-gray-800'}`}>
                                                   {c.name ? c.name[0].toUpperCase() : <User size={16}/>}
                                               </div>
                                               <div>
                                                   <p className="font-black text-gray-900 text-base uppercase">{c.name || 'Inconnu'}</p>
                                                   {c.blocked && <span className="inline-flex mt-1 items-center gap-1 text-[9px] font-black uppercase text-red-600 bg-red-100 px-2 py-0.5 rounded-lg border border-red-200"><Ban size={10}/> Bloqué</span>}
                                               </div>
                                           </div>
                                       </td>
                                       <td className="px-8 py-5">
                                           <span className="font-bold text-gray-600 font-mono">{c.phone || '---'}</span>
                                       </td>
                                       <td className="px-8 py-5">
                                           {!c.isDriver ? (
                                               <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-[10px] font-black uppercase bg-gray-100 text-gray-600 border border-gray-200">Client</span>
                                           ) : (
                                               <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border ${c.isFreelance ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                                                   {c.isFreelance ? 'Livreur Freelance' : 'Livreur Officiel'}
                                               </span>
                                           )}
                                       </td>
                                       <td className="px-8 py-5">
                                           {!c.isDriver ? (
                                               <div className="flex flex-col">
                                                   <span className="text-base font-black text-gray-900">{totalOrders} <span className="text-[10px] uppercase text-gray-400">Cmds</span></span>
                                                   <span className="text-[10px] font-bold text-gray-500 truncate max-w-[180px]" title={lastAddress}>{lastAddress}</span>
                                               </div>
                                           ) : (
                                               <span className="text-base font-black text-green-600">{totalLivraisons} <span className="text-[10px] uppercase text-green-700/60">Livraisons</span></span>
                                           )}
                                       </td>
                                       <td className="px-8 py-5">
                                           <div className="flex items-center justify-end gap-2">
                                               {!c.isDriver ? (
                                                   <>
                                                       {role === 'admin' && <button onClick={async()=>{await setDoc(doc(db,'artifacts',appId,'public','data','clients',c.id), {blocked: !c.blocked}, {merge:true}); showNotify(c.blocked ? "Débloqué ✅" : "Bloqué 🚫", "success");}} className={`p-3 rounded-xl transition-all shadow-sm ${c.blocked ? 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200' : 'bg-gray-50 text-gray-400 hover:text-orange-500 hover:bg-orange-50 border border-gray-200'}`} title={c.blocked ? 'Débloquer' : 'Bloquer'}><Ban size={18}/></button>}
                                                       <button onClick={async()=>{await setDoc(doc(db,'artifacts',appId,'public','data','clients',c.id), {isDriver: true, isFreelance: false}, {merge:true}); if(c.uid) await setDoc(doc(db,'artifacts',appId,'users',c.uid,'profile','data'), {isDriver: true, isFreelance: false}, {merge:true}); showNotify("Wella Livreur! 🛵", "success");}} className="p-3 bg-gray-50 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all shadow-sm border border-gray-200" title="Rendre Livreur"><Truck size={18}/></button>
                                                       {role === 'admin' && <button onClick={async()=>{if(window.confirm('Msa7 Client?')){await deleteDoc(doc(db,'artifacts',appId,'public','data','clients',c.id)); showNotify("Tmsa7 ✅", "success");}}} className="p-3 bg-gray-50 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all shadow-sm border border-gray-200" title="Supprimer"><Trash2 size={18}/></button>}
                                                   </>
                                               ) : (
                                                   <>
                                                       <button onClick={async()=>{ await setDoc(doc(db,'artifacts',appId,'public','data','clients',c.id), {isFreelance: !c.isFreelance}, {merge:true}); if(c.uid) await setDoc(doc(db,'artifacts',appId,'users',c.uid,'profile','data'), {isFreelance: !c.isFreelance}, {merge:true}); showNotify(c.isFreelance ? "Rje3 Livreur Officiel ✅" : "Wella Freelance ✅", "success"); }} className="px-4 py-3 text-[10px] font-black uppercase rounded-xl border-2 border-gray-200 text-gray-600 hover:bg-gray-50 transition-all active:scale-95 shadow-sm">Rendre {c.isFreelance ? 'Officiel' : 'Freelance'}</button>
                                                       {role === 'admin' && <button onClick={async()=>{ await setDoc(doc(db,'artifacts',appId,'public','data','clients',c.id), {isDriver: false}, {merge:true}); if(c.uid) await setDoc(doc(db,'artifacts',appId,'users',c.uid,'profile','data'), {isDriver: false}, {merge:true}); showNotify("Rje3 Kliyan! 👤", "success"); }} className="p-3 bg-gray-50 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all shadow-sm border border-gray-200" title="Rétrograder en Client"><User size={18}/></button>}
                                                   </>
                                               )}
                                           </div>
                                       </td>
                                   </tr>
                               )
                           })}
                       </tbody>
                   </table>
                   {(clientsList||[]).filter(c => role === 'manager' ? c.isDriver : (clientSubTab==='livreurs' ? c.isDriver : !c.isDriver)).length === 0 && (
                       <div className="py-16 text-center text-gray-400 flex flex-col items-center">
                           <User size={40} className="mb-3 opacity-20"/>
                           <p className="font-semibold text-sm">Aucun compte trouvé</p>
                       </div>
                   )}
               </div>
           </div>
           
           {showAddDriver && (
                <div className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white p-8 md:p-10 rounded-[3rem] w-full max-w-md text-gray-900 shadow-2xl relative animate-in zoom-in-95 text-left">
                        <button onClick={() => setShowAddDriver(false)} className="absolute top-6 right-6 text-gray-400 hover:text-red-500 bg-gray-100 hover:bg-red-50 rounded-full p-2 transition-colors"><X size={24}/></button>
                        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6 border-4 border-blue-100"><Truck size={32} className="text-blue-600" /></div>
                        <h2 className="font-black text-2xl mb-8 uppercase tracking-tight text-gray-900">Nouveau Livreur</h2>
                        
                        <div className="space-y-5 mb-8">
                            <label className="block">
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block ml-2">Nom Complet</span>
                            <input type="text" className="w-full bg-gray-50 border-2 border-gray-100 p-4 rounded-2xl text-sm font-bold text-gray-900 outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-inner" value={newDriver.name} onChange={e => setNewDriver({...newDriver, name: e.target.value})} placeholder="Smit l-livreur" />
                            </label>
                            <label className="block">
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block ml-2">Numéro de Téléphone</span>
                            <input type="tel" className="w-full bg-gray-50 border-2 border-gray-100 p-4 rounded-2xl text-sm font-bold font-mono text-gray-900 outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-inner" value={newDriver.phone} onChange={e => setNewDriver({...newDriver, phone: e.target.value.replace(/[^\d\s\+\-]/g, '')})} placeholder="06..." />
                            </label>
                            <div className="flex gap-3 mt-4">
                                <button onClick={() => setNewDriver({...newDriver, isFreelance: false})} className={`flex-1 py-4 rounded-2xl text-xs font-black uppercase tracking-wider border-2 transition-all shadow-sm ${!newDriver.isFreelance ? 'border-green-500 bg-green-50 text-green-700 scale-105' : 'border-gray-100 text-gray-500 bg-white hover:bg-gray-50'}`}>Officiel</button>
                                <button onClick={() => setNewDriver({...newDriver, isFreelance: true})} className={`flex-1 py-4 rounded-2xl text-xs font-black uppercase tracking-wider border-2 transition-all shadow-sm ${newDriver.isFreelance ? 'border-blue-500 bg-blue-50 text-blue-700 scale-105' : 'border-gray-100 text-gray-500 bg-white hover:bg-gray-50'}`}>Freelance</button>
                            </div>
                        </div>

                        <button onClick={handleAddDriverSubmit} className="w-full bg-black hover:bg-gray-800 text-white font-black uppercase tracking-wider py-5 rounded-2xl shadow-xl active:scale-95 transition-all text-sm">Ajouter Livreur</button>
                    </div>
                </div>
            )}

        </div>
    );
}