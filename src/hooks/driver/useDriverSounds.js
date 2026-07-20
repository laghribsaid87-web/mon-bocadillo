import { useState, useEffect, useRef } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getMessaging, onMessage, getToken } from 'firebase/messaging';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { VAPID_KEY } from '../../config/firebase';

export function useDriverSounds({ isOnline, activeOrders, newMissions, showSetupModal, setGpsActive, setGpsTimeoutId, gpsTimeoutId, setIsScreenFlashing, user, db, appId }) {
    const [isAppLoaded, setIsAppLoaded] = useState(false);
    const knownMissionsRef = useRef(new Set());
    const [isSoundEnabled, setIsSoundEnabled] = useState(false);
    const prevMissionCountRef = useRef(0);
    const lastBeepTimeRef = useRef(0);
    const lastAlarmTimeRef = useRef(0);
    const shortBeepPlayedRef = useRef(false);

    // 🔥 Jdid: Khli l-Ecran dima cha3el (Dow / Wake Lock) bach t-tilifon may-tFach
    useEffect(() => {
        let wakeLock = null;
        const requestWakeLock = async () => {
            try {
                // 🔥 Optimisation Batterie : L'écran reste forcé allumé UNIQUEMENT s'il y a une commande
                if ('wakeLock' in navigator && isOnline && activeOrders.length > 0 && document.visibilityState === 'visible') {
                    wakeLock = await navigator.wakeLock.request('screen');
                }
            } catch (err) {}
        };
        requestWakeLock();
        document.addEventListener('visibilitychange', requestWakeLock);
        return () => { 
            document.removeEventListener('visibilitychange', requestWakeLock); 
            if (wakeLock) wakeLock.release(); 
        };
    }, [isOnline, activeOrders.length]);

    // 🔥 Astuce: Ref pour le son silencieux
    const silentAudioRef = useRef(null);

    const enableSound = () => {
        setIsSoundEnabled(true);
        try {
            const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
            audio.volume = 0.01;
            audio.play().catch(() => {});
            
            // 🔥 NOUVEAU: Garder l'audio context actif avec un silence en boucle
            if (!silentAudioRef.current) {
                const silentSrc = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
                const silentAudio = new Audio(silentSrc);
                silentAudio.loop = true;
                silentAudio.volume = 0.01;
                silentAudio.play().catch(e => console.log("Silent audio blocked", e));
                silentAudioRef.current = silentAudio;
            }

            if (navigator.vibrate) navigator.vibrate([1]);
        } catch (e) {}
    };

    // 🔥 Jdid: Sonnette w Vibreur mnin katjih commande jdida (En boucle ta y-accepter)
    // 🔥 Jdid: Sonnette w Vibreur mnin katjih commande jdida (Sda3 f jibo, Khfif f yddo)
    useEffect(() => {
        if (showSetupModal) return;

        let alarmInterval;
        
        // 🔥 Demander la permission des notifications natives au démarrage
        if (Capacitor.isNativePlatform()) {
            LocalNotifications.requestPermissions();
            
            // 🔥 NOUVEAU: Créer un canal d'alerte maximale pour forcer le son et bypasser le mode "silencieux"
            LocalNotifications.createChannel({
                id: 'loud_alarm',
                name: 'Alarmes de Commande',
                description: 'Sonne très fort pour les nouvelles commandes',
                importance: 5, // 5 = MAX (Force l'affichage et le son sur Android)
                visibility: 1, // 1 = PUBLIC (Affiche sur l'écran de verrouillage)
                vibration: true
            });
        }

        if (isSoundEnabled && isOnline && newMissions && newMissions.length > 0) {
            // Ila tzadet commande jdida, n-remettrou l-compteur l zero bach nl3bo sot khfif
            if (newMissions.length > prevMissionCountRef.current) {
                shortBeepPlayedRef.current = false;
            }
            prevMissionCountRef.current = newMissions.length;

            const playAlarm = async () => {
                try {
                    // 🔥 N-tcheckiw wach l-livreur kaychouf f l'application daba
                    const isVisible = document.visibilityState === 'visible';
                    
                    // Ila kan m7el l'app (Visible) -> Sot khfif. Ila kan tilifon tafi (Hidden) -> Alarme b jhd
                    if (isVisible) {
                        // L'application m7loula f wjeh l-livreur -> Nl3bo sot khfif MERRA WE7DA
                        if (!shortBeepPlayedRef.current) {
                            const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
                            audio.volume = 0.3;
                            audio.play().catch(e => console.log("Audio bloqué", e));
                            if (navigator.vibrate) navigator.vibrate([200]);
                            shortBeepPlayedRef.current = true;
                        }
                    } else {
                        // Tilifon f jibo awla tafi -> Sda3 en boucle 🚨
                        
                        // 🔥 NOUVEAU: Forcer le son natif via Capacitor Local Notifications (Technique Glovo)
                        if (Capacitor.isNativePlatform()) {
                            await LocalNotifications.schedule({
                                notifications: [{
                                    title: "🚨 COMMANDE WAJDA !",
                                    body: "Zreb 7el l'application w accepte l-commande !",
                                    id: 1987, // On utilise le même ID pour écraser la notif au lieu de spammer
                                    schedule: { at: new Date(Date.now() + 100) }, // Déclencher immédiatement
                                    actionTypeId: "",
                                    extra: null,
                                    channelId: 'loud_alarm' // 🔥 Utiliser le canal très fort
                                }]
                            });
                        }

                        const audio = new Audio('https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg');
                        audio.volume = 1.0;
                        audio.play().catch(e => console.log("Audio bloqué", e));
                        if (navigator.vibrate) navigator.vibrate([800, 400, 800, 400, 800]); 
                        
                        setIsScreenFlashing(true);
                        setTimeout(() => setIsScreenFlashing(false), 500);
                        shortBeepPlayedRef.current = false;
                    }
                } catch (e) { console.log("Erreur son/vibreur", e); }
            };
            
            // Nl3boha l-merra l-wla
            playAlarm();
            
            // 🔥 NOUVEAU: N3awdoha kola 4 tewani l-les freelances (Glovo), w kola 10 tewani (10000ms) l-livreur Manuel
            const hasStandardMissions = newMissions.some(o => !o.isManualAssignment);
            const intervalTime = hasStandardMissions ? 4000 : 10000;
            alarmInterval = setInterval(playAlarm, intervalTime);
        } else {
            prevMissionCountRef.current = 0;
            shortBeepPlayedRef.current = false;
        }

        return () => {
            if (alarmInterval) clearInterval(alarmInterval);
        };
    }, [newMissions, isOnline, isSoundEnabled]);

    // 🔥 Jdid: Listen FCM notifications silencieuses bach ych3el GPS
    useEffect(() => {
        if (showSetupModal) return;

        const setupFCM = async () => {
            try {
                const messaging = getMessaging();
                
                try {
                    const permission = await Notification.requestPermission();
                    if (permission === 'granted') {
                        const token = await getToken(messaging, { 
                            vapidKey: VAPID_KEY
                        });
                        if (token && user?.uid) {
                            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'drivers', user.uid), {
                                fcmToken: token,
                                fcmUpdatedAt: serverTimestamp()
                            }, { merge: true });
                            console.log("🔔 FCM Token enregistré b-naja7 !");
                        }
                    }
                } catch(err) {
                    console.log("Erreur Notification permission / token:", err);
                }

                const unsubscribe = onMessage(messaging, (payload) => {
                    if (payload.data?.type === 'WAKE_UP_GPS') {
                        console.log("🔔 Réception FCM (Silent) : Wake Up GPS !");
                        setGpsActive(true);
                        
                        if (gpsTimeoutId) clearTimeout(gpsTimeoutId);
                        
                        // Auto-Stop ba3d 5 d9ay9
                        const id = setTimeout(() => {
                            console.log("🛑 Auto-stop GPS après 5 min (Économie Batterie)");
                            setGpsActive(false);
                        }, parseInt(payload.data.duration) || 300000);
                        
                        setGpsTimeoutId(id);
                    }

                    // 🔥 L3eb s-sot ila jat notification w l'app m7loula f wjeh l-livreur
                    if (payload.notification) {
                        try {
                            const isVisible = document.visibilityState === 'visible';
                            // Ila kan l-livreur makhdamch f l'app, l3eb alarme b jhd
                            const audioSrc = isVisible 
                                ? 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg'
                                : 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg';
                            
                            if (!isVisible && Capacitor.isNativePlatform()) {
                                LocalNotifications.schedule({
                                    notifications: [{
                                        title: payload.notification.title || "🚨 COMMANDE !",
                                        body: payload.notification.body || "Nouvelle commande à accepter",
                                        id: new Date().getTime(),
                                        schedule: { at: new Date(Date.now() + 100) },
                                        channelId: 'loud_alarm' // 🔥 Utiliser le canal très fort
                                    }]
                                });
                            }

                            const notifAudio = new Audio(audioSrc);
                            notifAudio.volume = isVisible ? 0.3 : 1.0;
                            notifAudio.play().catch(e => {});
                            if (navigator.vibrate) {
                                isVisible ? navigator.vibrate([200]) : navigator.vibrate([800, 400, 800, 400, 800]);
                            }
                        } catch(e) {}
                    }
                });
                return () => unsubscribe();
            } catch(e) {
                console.log("FCM non supporté (Service Worker manquante ou pas setup)", e);
            }
        };
        setupFCM();
    }, [user?.uid, db, appId, showSetupModal]);


    return {
        isAppLoaded, setIsAppLoaded,
        knownMissionsRef,
        isSoundEnabled, setIsSoundEnabled,
        prevMissionCountRef,
        lastBeepTimeRef,
        lastAlarmTimeRef,
        shortBeepPlayedRef,
        silentAudioRef,
        enableSound
    };
}
