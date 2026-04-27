import React from 'react';
import { Star, MessageSquare, Trash2, User } from 'lucide-react';

export default function AdminReviews({ reviews = [], handleDeleteReview, role }) {
    // Calcul dyal la moyenne d'évaluation
    const average = reviews.length > 0 
        ? (reviews.reduce((acc, r) => acc + (r.rating || 5), 0) / reviews.length).toFixed(1)
        : 0;

    return (
        <div className="space-y-8 animate-in fade-in pb-10">
           {/* Dashboard Stats SaaS */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
               <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl flex flex-col justify-center relative overflow-hidden">
                   <div className="absolute -right-4 -bottom-4 opacity-[0.03] text-black"><MessageSquare size={100}/></div>
                   <span className="text-sm font-black uppercase tracking-widest text-gray-400 mb-2">Total des Avis</span>
                   <span className="text-6xl font-black text-gray-900 tracking-tighter">{reviews.length}</span>
               </div>
               <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl flex flex-col justify-center">
                   <span className="text-sm font-black uppercase tracking-widest text-gray-400 mb-2">Note Moyenne</span>
                   <div className="flex items-center gap-4">
                       <span className="text-6xl font-black text-yellow-500 tracking-tighter">{average}</span>
                       <div className="flex text-yellow-400 mb-2">
                           {[1, 2, 3, 4, 5].map(star => (
                               <Star key={star} size={28} fill={star <= Math.round(average) ? "currentColor" : "none"} className={star > Math.round(average) ? "text-gray-200" : ""} />
                           ))}
                       </div>
                   </div>
               </div>
           </div>

           {/* Data Table SaaS dyal les Avis */}
           <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl overflow-hidden">
               <div className="overflow-x-auto">
                   <table className="w-full text-left border-collapse min-w-[800px]">
                       <thead>
                           <tr className="bg-gray-50 border-b-2 border-gray-100 text-[11px] font-black uppercase tracking-widest text-gray-500">
                               <th className="px-8 py-6">Client</th>
                               <th className="px-8 py-6">Note</th>
                               <th className="px-8 py-6">Commentaire</th>
                               <th className="px-8 py-6">Date</th>
                               <th className="px-8 py-6 text-right">Actions</th>
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-gray-100 text-sm">
                           {reviews.map((r) => (
                               <tr key={r.id} className="hover:bg-gray-50/80 transition-colors">
                                   <td className="px-8 py-5">
                                       <div className="flex items-center gap-4">
                                           <div className="w-12 h-12 rounded-full flex items-center justify-center font-black text-xl text-gray-600 bg-gray-100 shrink-0 border-2 border-gray-200 shadow-sm">
                                               {r.clientName ? r.clientName[0].toUpperCase() : <User size={16}/>}
                                           </div>
                                           <div>
                                               <p className="font-black text-gray-900 text-base uppercase">{r.clientName || 'Inconnu'}</p>
                                               <p className="text-xs font-bold text-gray-500 font-mono mt-0.5">{r.clientPhone || '---'}</p>
                                           </div>
                                       </div>
                                   </td>
                                   <td className="px-8 py-5">
                                       <div className="flex items-center gap-1.5 text-yellow-500">
                                           {[1, 2, 3, 4, 5].map(star => (
                                               <Star key={star} size={18} fill={star <= (r.rating || 5) ? "currentColor" : "none"} className={star > (r.rating || 5) ? "text-gray-200" : ""} />
                                           ))}
                                       </div>
                                   </td>
                                   <td className="px-8 py-5">
                                       <p className="text-sm font-bold text-gray-600 max-w-xs truncate" title={r.comment}>{r.comment || <span className="italic text-gray-400 font-normal">Aucun commentaire</span>}</p>
                                   </td>
                                   <td className="px-8 py-5">
                                       <span className="text-sm font-bold text-gray-500">{r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000).toLocaleDateString('fr-FR') : '---'}</span>
                                   </td>
                                   <td className="px-8 py-5">
                                       <div className="flex items-center justify-end gap-2">
                                           {role === 'admin' && (
                                               <button onClick={() => { if(window.confirm('Wach m2ked bghiti tmsse7 had l-avis ?')) handleDeleteReview(r.id) }} className="p-3 text-gray-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-xl transition-all shadow-sm" title="Supprimer">
                                                   <Trash2 size={18}/>
                                               </button>
                                           )}
                                       </div>
                                   </td>
                               </tr>
                           ))}
                       </tbody>
                   </table>
                   {(!reviews || reviews.length === 0) && (
                       <div className="py-16 text-center text-gray-400 flex flex-col items-center">
                           <MessageSquare size={40} className="mb-3 opacity-50"/>
                           <p className="font-medium text-sm">Aucun avis trouvé.</p>
                       </div>
                   )}
               </div>
           </div>
        </div>
    );
}