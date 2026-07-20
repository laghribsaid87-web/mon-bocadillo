import { useState, useEffect } from 'react';
import { getDatabase, ref as rtdbRef, onValue } from 'firebase/database';

export function useAdminLiveTracking(role, appId) {
    const [latestGithubVersion, setLatestGithubVersion] = useState(null);
    const [rtdbDrivers, setRtdbDrivers] = useState({});
    const [isRtdbConnected, setIsRtdbConnected] = useState(true);

    // 🔥 RTDB Listener pour Live Tracking (Idara)
    useEffect(() => {
        if (role !== 'admin' && role !== 'manager') return;
        try {
            const rtdb = getDatabase();
            
            // 🔥 NOUVEAU : Suivre l'état de la connexion RTDB
            const connectedRef = rtdbRef(rtdb, '.info/connected');
            const unsubConnected = onValue(connectedRef, (snap) => {
                setIsRtdbConnected(snap.val() === true);
            });

            const trackingRef = rtdbRef(rtdb, `tracking/${appId}/drivers`);
            const unsubTracking = onValue(trackingRef, (snapshot) => {
                if (snapshot.exists()) {
                    setRtdbDrivers(snapshot.val());
                }
            });
            return () => {
                unsubConnected();
                unsubTracking();
            };
        } catch (e) {
            console.error("RTDB Admin Error:", e);
        }
    }, [role, appId]);

    // 🔥 Github Version Check
    useEffect(() => {
        const checkVersions = async () => {
            try {
                const response = await fetch('https://api.github.com/repos/laghribsaid87-web/mon-bocadillo/releases/latest');
                const data = await response.json();
                if (data && data.tag_name) {
                    setLatestGithubVersion(data.tag_name.replace('v', ''));
                }
            } catch (err) {}
        };
        checkVersions();
    }, []);

    return {
        latestGithubVersion,
        rtdbDrivers,
        isRtdbConnected
    };
}
