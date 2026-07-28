import React, { useState, useEffect, useRef } from 'react';
import { Clock, Timer } from 'lucide-react';

export default function LiveTimer({ startTime, targetTime, maxTime = 20, variant = 'default', compact = false }) {
    const [elapsed, setElapsed] = useState(0);
    const [remaining, setRemaining] = useState(null);
    const hasPlayedSound = useRef(false);
    
    useEffect(() => {
        const calc = () => {
            const now = Date.now();
            if (targetTime) {
                const diff = Math.ceil((targetTime - now) / 60000);
                setRemaining(diff);
                // Also calculate elapsed just in case
                if (startTime) setElapsed(Math.floor((now - startTime) / 60000));
            } else if (startTime) {
                const diff = Math.floor((now - startTime) / 60000);
                setElapsed(diff >= 0 ? diff : 0);
            }
        };
        calc();
        const interval = setInterval(calc, 60000);
        return () => clearInterval(interval);
    }, [startTime, targetTime]);
    
    const isLate = targetTime ? (remaining <= 0) : (elapsed >= maxTime);
    const isWarning = targetTime ? (remaining > 0 && remaining <= 2) : (elapsed >= maxTime - 2 && elapsed < maxTime);
    
    useEffect(() => {
        if (variant === 'kitchen' && (isLate || isWarning) && !hasPlayedSound.current) {
            hasPlayedSound.current = true;
            try {
                const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
                audio.play().catch(() => {});
            } catch(e) {}
        }
    }, [isLate, isWarning, variant]);

    const displayValue = targetTime ? remaining : elapsed;
    const isNegative = displayValue < 0;
    const absValue = Math.abs(displayValue);

    if (variant === 'kitchen') {
        if (compact) {
            const bgCompact = isLate ? 'bg-red-500 text-white animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]' : isWarning ? 'bg-orange-500 text-white animate-pulse shadow-[0_0_10px_rgba(249,115,22,0.5)]' : 'bg-neutral-800 text-neutral-300';
            return <span className={`font-black text-xs px-2 py-1 rounded-md ${bgCompact}`}>{isNegative ? '-' : ''}{absValue}m</span>;
        }
        const bgNormal = isLate ? 'bg-red-500/20 text-red-400 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : isWarning ? 'bg-orange-500/20 text-orange-400 border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.2)] animate-pulse' : 'bg-neutral-800 text-neutral-300 border-neutral-700';
        return (
            <div className="flex flex-col items-end gap-1">
                {isLate && <span className="text-[10px] font-black uppercase text-red-500 tracking-widest flex items-center gap-1 animate-pulse"><Timer size={12}/> En Retard</span>}
                {isWarning && <span className="text-[10px] font-black uppercase text-orange-500 tracking-widest flex items-center gap-1 animate-pulse"><Timer size={12}/> Vite !</span>}
                <span className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-black border-2 transition-colors ${bgNormal}`}><Timer size={16} /> {isNegative ? '-' : ''}{absValue} min</span>
            </div>
        );
    }
    if (variant === 'admin') return (<span className={`flex items-center gap-1.5 text-sm font-black px-3 py-1.5 rounded-lg border-2 shadow-sm ${isLate ? 'bg-red-100 text-red-700 border-red-300 animate-pulse' : isWarning ? 'bg-orange-100 text-orange-700 border-orange-300 animate-pulse' : 'bg-white text-gray-800 border-gray-200'}`}><Clock size={16}/> {isNegative ? '-' : ''}{absValue} min</span>);
    return (<span className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-md border shadow-sm ${isLate ? 'bg-red-100 text-red-600 border-red-200 animate-pulse' : isWarning ? 'bg-orange-100 text-orange-600 border-orange-200 animate-pulse' : 'bg-white text-gray-600 border-gray-200'}`}><Clock size={12}/> {isNegative ? '-' : ''}{absValue} min</span>);
}