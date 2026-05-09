import React, { useState, useEffect, useRef } from 'react';
import { Clock, Timer } from 'lucide-react';

export default function LiveTimer({ startTime, maxTime = 20, variant = 'default', compact = false }) {
    const [elapsed, setElapsed] = useState(0);
    const hasPlayedSound = useRef(false);
    
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
    
    const isLate = elapsed >= maxTime;
    
    useEffect(() => {
        if (variant === 'kitchen' && isLate && !hasPlayedSound.current) {
            hasPlayedSound.current = true;
            try {
                const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
                audio.play().catch(() => {});
            } catch(e) {}
        }
    }, [isLate, variant]);

    if (variant === 'kitchen') {
        if (compact) return <span className={`font-black text-xs px-2 py-1 rounded-md ${isLate ? 'bg-red-500 text-white animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-neutral-800 text-neutral-300'}`}>{elapsed}m</span>;
        return (
            <div className="flex flex-col items-end gap-1">
                {isLate && <span className="text-[10px] font-black uppercase text-red-500 tracking-widest flex items-center gap-1 animate-pulse"><Timer size={12}/> En Retard</span>}
                <span className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-black border-2 transition-colors ${isLate ? 'bg-red-500/20 text-red-400 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'bg-neutral-800 text-neutral-300 border-neutral-700'}`}><Timer size={16} /> {elapsed} min</span>
            </div>
        );
    }
    if (variant === 'admin') return (<span className={`flex items-center gap-1.5 text-sm font-black px-3 py-1.5 rounded-lg border-2 shadow-sm ${isLate ? 'bg-red-100 text-red-700 border-red-300 animate-pulse' : 'bg-white text-gray-800 border-gray-200'}`}><Clock size={16}/> {elapsed} min</span>);
    return (<span className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-md border shadow-sm ${isLate ? 'bg-red-100 text-red-600 border-red-200 animate-pulse' : 'bg-white text-gray-600 border-gray-200'}`}><Clock size={12}/> {elapsed} min</span>);
}