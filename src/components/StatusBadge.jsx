import React from 'react';

export default function StatusBadge({ status }) {
    const statusStr = String(status || 'pending');
    const s = { 
        pending: { l: 'En attente', c: 'bg-gray-100 text-gray-500' }, 
        preparing: { l: 'En Cuisine 🥣', c: 'bg-orange-100 text-orange-700' }, 
        ready: { l: 'Prêt 🥡', c: 'bg-[#ffbc0d] text-black' }, 
        out_for_delivery: { l: 'En Route 🛵', c: 'bg-blue-100 text-blue-700' }, 
        delivered: { l: 'Livré ✅', c: 'bg-green-100 text-green-700' }, 
        rejected: { l: 'Annulé ❌', c: 'bg-red-100 text-red-700' } 
    }[statusStr] || { l: statusStr, c: 'bg-gray-100 text-gray-500' };
    
    return (
        <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${s.c} inline-block text-center whitespace-nowrap`}>
            {String(s.l)}
        </span>
    );
}