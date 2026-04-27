import React, { useState, useEffect } from 'react';

export default function OrderTimer({ assignedAtLocal, updatedAt, onExpire }) {
    const [timeLeft, setTimeLeft] = useState(30);
    
    useEffect(() => {
        const start = assignedAtLocal || (updatedAt?.seconds * 1000) || Date.now();
        const interval = setInterval(() => {
            const remaining = Math.max(0, 30 - Math.floor((Date.now() - start) / 1000));
            setTimeLeft(remaining); 
            if (remaining <= 0 && onExpire) { 
                onExpire(); 
                clearInterval(interval); 
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [assignedAtLocal, updatedAt, onExpire]);
    
    return <span className="font-mono">{timeLeft}s</span>;
}