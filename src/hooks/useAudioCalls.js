import { useEffect } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';

export const useAudioCalls = (db, appId, targetId, showNotify) => {
    useEffect(() => {
        if (!db || !appId || !targetId) return;

        const unsub = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'audio_calls', targetId), async (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                if (data.isRinging && data.callerId) {
                    // Try playing sound
                    try {
                        const audio = new Audio('/ringtone.mp3'); // Assumes ringtone exists
                        audio.play().catch(e => console.error("Audio play failed:", e));
                    } catch (e) {
                        console.error("Audio error:", e);
                    }
                    
                    showNotify(`📞 Appel entrant de ${data.callerName || 'Client'}`, "info");
                    
                    setTimeout(() => {
                        try {
                            updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'audio_calls', targetId), {
                                isRinging: false,
                                callerId: null,
                                callerName: null,
                                answered: false,
                                timestamp: Date.now()
                            });
                        } catch (e) {
                            console.error(e);
                        }
                    }, 30000);
                }
            }
        });
        return () => unsub();
    }, [db, appId, targetId, showNotify]);
};
