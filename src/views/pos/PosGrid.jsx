import React from 'react';
import { AlertTriangle, Phone, CheckCircle } from 'lucide-react';
import { usePosContext } from './PosContext';
import { doc, updateDoc } from 'firebase/firestore';

export default function PosGrid({ 
    idleOtherDrivers, 
    activeHelpers, 
    filteredMenu, 
    dragItemRef, 
    dropItemRef, 
    handleItemDragEnd, 
    handleProductClick, 
    cardBg, 
    cardImgBg, 
    titleColor, 
    priceColor, 
    posUI 
}) {
    const { 
        isAdmin, 
        activeBranchId, 
        settings, 
        db, 
        appId, 
        showNotify,
        isDark
    } = usePosContext();

    return (
        <main className="flex-1 p-3 sm:p-4 md:p-8 overflow-y-auto w-full">
            {idleOtherDrivers?.length > 0 && (
                <div className="bg-orange-100 border-l-4 border-orange-500 p-4 mb-6 rounded-r-xl shadow-sm flex items-start gap-3 animate-in fade-in">
                    <AlertTriangle className="text-orange-600 shrink-0 mt-0.5" size={24} />
                    <div className="flex-1">
                        <h4 className="text-orange-800 font-black text-sm uppercase tracking-wide">🚨 Livreur Surchargé !</h4>
                        <p className="text-orange-700 text-xs font-bold mt-1">
                            Votre livreur a déjà plusieurs commandes en cours. Voici des livreurs d'autres agences qui sont libres :
                        </p>
                        <div className="flex flex-col gap-2 mt-3">
                            {idleOtherDrivers.map(d => (
                                <div key={d.uid} className="flex items-center justify-between bg-white border border-orange-200 px-3 py-2 rounded-lg shadow-sm">
                                    <a href={`tel:${d.phone}`} className="flex items-center gap-2 hover:opacity-70 transition-opacity" title="Appeler ce livreur">
                                        <Phone size={14} className="text-orange-500" />
                                        <span className="text-xs font-black text-orange-900 underline">{d.name} ({d.phone})</span>
                                    </a>
                                    <button 
                                        onClick={() => {
                                            if (db && appId && d.uid) {
                                                updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'drivers', d.uid), {
                                                    helpRequest: {
                                                        branchId: activeBranchId,
                                                        branchName: (settings?.branches || []).find(b => b.id === activeBranchId)?.name || 'Caisse',
                                                        timestamp: Date.now()
                                                    }
                                                });
                                                if (showNotify) showNotify(`Demande d'aide envoyée à ${d.name} !`, "success");
                                            }
                                        }}
                                        className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-md text-[10px] font-black uppercase transition-colors shadow-sm"
                                    >
                                        Demander Aide
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeHelpers?.length > 0 && (
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded-r-xl shadow-sm flex items-start gap-3 animate-in fade-in">
                    <CheckCircle className="text-blue-600 shrink-0 mt-0.5" size={24} />
                    <div className="flex-1">
                        <h4 className="text-blue-800 font-black text-sm uppercase tracking-wide">🤝 Livreurs en Aide</h4>
                        <p className="text-blue-700 text-xs font-bold mt-1">Vous pouvez maintenant leur assigner des commandes :</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {activeHelpers.map(h => (
                                <span key={h.uid} className="bg-blue-200 text-blue-900 px-3 py-1.5 rounded-md text-xs font-bold shadow-sm">
                                    🛵 {h.name}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${posUI?.cardWidth || 150}px, 1fr))`, gap: '18px', paddingBottom: '32px' }}>
                {filteredMenu?.map((item, idx) => (
                <div 
                    key={item.id} 
                    draggable={isAdmin}
                    onDragStart={() => { if(dragItemRef) dragItemRef.current = idx; }}
                    onDragEnter={() => { if(dropItemRef) dropItemRef.current = idx; }}
                    onDragEnd={handleItemDragEnd}
                    onDragOver={e => e.preventDefault()}
                    onClick={() => {
                        if (item.outOfStock) {
                            if(showNotify) showNotify("Rupture de stock validé man kds li daro repture", "error");
                            return;
                        }
                        handleProductClick(item, false);
                    }} 
                    className={`group relative rounded-3xl p-3 sm:p-4 flex flex-col items-center justify-between gap-3 sm:gap-4 border overflow-hidden transition-all duration-300 ${cardBg} ${item.outOfStock ? 'opacity-60 grayscale cursor-not-allowed border-red-200' : 'cursor-pointer hover:-translate-y-1'} ${isAdmin ? 'cursor-move' : ''}`}
                    style={{ minHeight: `${posUI?.cardHeight || 180}px` }}
                >
                    <div className={`w-full flex items-center justify-center rounded-2xl overflow-hidden relative transition-transform duration-300 group-hover:scale-105 ${cardImgBg}`} style={{ height: `${posUI?.imgHeight || 100}px` }}>

                        {typeof item.img === 'string' && (item.img.startsWith('http') || item.img.startsWith('data:image')) ? (
                            <img src={item.img} loading="lazy" className={`w-full h-full object-contain drop-shadow-sm ${isDark ? '' : 'mix-blend-multiply'}`} alt={item.name}/>
                        ) : (
                            <span className="text-6xl sm:text-7xl">{item.img}</span>
                        )}
                    </div>
                    <div className="w-full text-left space-y-1 px-1">
                        <h3 className={`font-bold text-sm sm:text-base leading-tight line-clamp-2 tracking-tight ${titleColor}`}>{item.name}</h3>
                        <p className="font-black text-lg sm:text-xl tracking-tighter" style={{ color: item.outOfStock ? '#9ca3af' : priceColor }}>
                            {item.price} <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-widest ${isDark ? 'text-neutral-400' : 'text-gray-400'}`}>DH</span>
                        </p>
                    </div>
                </div>
                ))}
            </div>
        </main>
    );
}
