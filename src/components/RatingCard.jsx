import React, { useState } from 'react';

export default function RatingCard({ onSubmit, brand }) {
    const [restStars, setRestStars] = useState(0); 
    const [driverStars, setDriverStars] = useState(0); 
    const [hoverRest, setHoverRest] = useState(0);
    const [hoverDriver, setHoverDriver] = useState(0);
    const [comment, setComment] = useState("");
    
    return (
        <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-200 mt-3 text-right" dir="rtl">
            <p className="font-black text-[11px] uppercase text-yellow-800 mb-3 border-b border-yellow-200/50 pb-2">ما رأيك في الخدمة؟ ⭐</p>
            <div className="mb-3 flex justify-between items-center">
                <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">الطعام (المطعم)</span>
                <div className="flex gap-1 text-xl">
                    {[1,2,3,4,5].map(s => (
                        <span 
                            key={s} 
                            onClick={()=>setRestStars(s)} 
                            onMouseEnter={()=>setHoverRest(s)}
                            onMouseLeave={()=>setHoverRest(0)}
                            className={`cursor-pointer transition-colors ${s <= (hoverRest || restStars) ? "text-yellow-500" : "text-gray-300"}`}
                        >
                            ★
                        </span>
                    ))}
                </div>
            </div>
            <div className="mb-3 flex justify-between items-center">
                <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">عامل التوصيل 🛵</span>
                <div className="flex gap-1 text-xl">
                    {[1,2,3,4,5].map(s => (
                        <span 
                            key={s} 
                            onClick={()=>setDriverStars(s)} 
                            onMouseEnter={()=>setHoverDriver(s)}
                            onMouseLeave={()=>setHoverDriver(0)}
                            className={`cursor-pointer transition-colors ${s <= (hoverDriver || driverStars) ? "text-yellow-500" : "text-gray-300"}`}
                        >
                            ★
                        </span>
                    ))}
                </div>
            </div>
            <textarea placeholder="أخبرنا برأيك (اختياري)..." className="w-full text-[11px] font-bold p-3 rounded-xl border border-yellow-200/50 mt-1 bg-white outline-none focus:border-yellow-400" value={comment} onChange={e=>setComment(e.target.value)}></textarea>
            <button onClick={()=>onSubmit({restaurant: restStars, driver: driverStars, comment})} disabled={!restStars || !driverStars} className="mt-3 text-black w-full py-3 rounded-xl text-[10px] font-black uppercase disabled:opacity-50 shadow-sm transition-all active:scale-95" style={{backgroundColor: brand?.color || '#ffbc0d'}}>
                إرسال التقييم ✅
            </button>
        </div>
    );
}