import { useState, useEffect } from 'react';

export function usePosGlovoVerification(db, appId, activeBranchId, triggerGlovoVerificationAction, showNotify) {
    const [isVerifyingGlovo, setIsVerifyingGlovo] = useState(false);

    const triggerGlovoVerification = async (isAuto = false) => {
        if (isVerifyingGlovo) return;
        setIsVerifyingGlovo(true);
        try {
            await triggerGlovoVerificationAction(db, appId, activeBranchId);
            if (!isAuto) {
                if (showNotify) showNotify("Vérification rapide lancée sur la tablette Glovo !", "success");
            } else {
                console.log("Vérification automatique Glovo lancée (chaque 2h).");
            }
            setTimeout(() => {
                setIsVerifyingGlovo(false);
            }, 2000);
        } catch (error) {
            console.error("Error triggering glovo:", error);
            if (!isAuto && showNotify) showNotify("Erreur de lancement de vérification", "error");
            setIsVerifyingGlovo(false);
        }
    };

    // 🔥 Déclenchement automatique chaque 3 heures à partir de 14h
    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date();
            const hours = now.getHours();
            
            // Plage horaire de travail: de 14h00 à 23h30
            const isWithinTimeWindow = (hours >= 14 && hours < 23) || (hours === 23 && now.getMinutes() <= 30);
            
            if (isWithinTimeWindow) {
                const lastAutoStr = localStorage.getItem('last_glovo_auto_verify');
                const lastAuto = lastAutoStr ? parseInt(lastAutoStr, 10) : 0;
                const timeSinceLast = now.getTime() - lastAuto;
                
                // 3 heures = 3 * 60 * 60 * 1000 = 10800000 ms
                if (timeSinceLast >= 10800000) {
                    triggerGlovoVerification(true);
                    localStorage.setItem('last_glovo_auto_verify', now.getTime().toString());
                }
            }
        }, 60000); // Vérification chaque minute
        
        return () => clearInterval(interval);
    }, [activeBranchId]); // Dependency on activeBranchId

    return { isVerifyingGlovo, triggerGlovoVerification };
}
