import { useState, useEffect, useRef } from 'react';

export function useAdminSounds(orders, onlineDrivers, isDriverOnline) {
    const [isAppLoaded, setIsAppLoaded] = useState(false);
    const [isSoundEnabled, setIsSoundEnabled] = useState(false);
    const knownOrdersRef = useRef(new Set());
    
    const [isDriversLoaded, setIsDriversLoaded] = useState(false);
    const prevOnlineDriversRef = useRef(new Set());

    const enableSound = () => {
        setIsSoundEnabled(true);
        try {
            const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
            audio.volume = 0.01;
            audio.play().catch(() => {});
        } catch (e) {}
    };

    // 🔥 Zidna had l-useEffect bach t-sonner mnin t-ti7 commande jdida (Pending)
    useEffect(() => {
        if (!orders || orders.length === 0) return;

        // Mnin kat-charger l'Idara l-merra l-wla, kankhbiw ga3 les commandes bach may-sonniwch
        if (!isAppLoaded) {
            const initialOrders = new Set();
            orders.forEach(o => initialOrders.add(o.id));
            knownOrdersRef.current = initialOrders;
            setIsAppLoaded(true);
            return;
        }

        let hasNewOrder = false;
        orders.forEach(order => {
            // Ila kant jdida w f status pending w mazal ma-3rfnahach
            if (order.status === 'pending' && !knownOrdersRef.current.has(order.id)) {
                hasNewOrder = true;
                knownOrdersRef.current.add(order.id);
            }
        });

        // Ila l9ina commande jdida (awla ktr mn whda f nfs l-we9t), n-l3bo sonnette
        if (hasNewOrder && isSoundEnabled) {
            try {
                const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
                audio.play().catch(e => console.log("Audio bloqué par le navigateur (Autoplay Policy). L'utilisateur doit interagir avec la page.", e));
            } catch (e) { console.log("Erreur audio", e); }
        }
    }, [orders, isAppLoaded, isSoundEnabled]);

    // 🔥 Notification mnin kayt-connecta chi livreur jdid
    useEffect(() => {
        if (!onlineDrivers) return;
        if (!isDriversLoaded) {
            const initial = new Set();
            onlineDrivers.forEach(d => { if (isDriverOnline(d)) initial.add(d.uid || d.phone); });
            prevOnlineDriversRef.current = initial;
            setIsDriversLoaded(true);
            return;
        }

        let hasNewOnline = false;
        onlineDrivers.forEach(d => {
            const uid = d.uid || d.phone;
            if (isDriverOnline(d) && !prevOnlineDriversRef.current.has(uid)) {
                hasNewOnline = true;
                prevOnlineDriversRef.current.add(uid);
            }
        });

        if (hasNewOnline && isSoundEnabled) {
            try {
                // 🔔 L3ab sonnette (Audio)
                const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
                audio.play().catch(e => console.log("Audio bloqué par le navigateur (Autoplay Policy)", e));
            } catch(e) {}
        }
    }, [onlineDrivers, isDriversLoaded, isSoundEnabled, isDriverOnline]);

    return {
        isSoundEnabled,
        enableSound
    };
}
