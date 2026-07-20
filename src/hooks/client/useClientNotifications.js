import { useState, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';

export function useClientNotifications({ db, appId, user, info }) {
    const [deferredPrompt, setDeferredPrompt] = useState(null); // Jdid: PWA Install Prompt
    const [showInstallBtn, setShowInstallBtn] = useState(false);
    const [notifPerm, setNotifPerm] = useState(typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied');
    const [editPhoneMode, setEditPhoneMode] = useState(false);
    const [newPhone, setNewPhone] = useState('');
    const [trackDrivers, setTrackDrivers] = useState([]); // 🔥 Jdid: Suivi dyal livreur direct l-client
    const [deviceType, setDeviceType] = useState('desktop');
    const [showIosPrompt, setShowIosPrompt] = useState(false);

        const ua = navigator.userAgent.toLowerCase();
        let dt = 'desktop';
        if (/iphone|ipad|ipod/.test(ua)) dt = 'ios';
        else if (/android/.test(ua)) dt = 'android';
        setDeviceType(dt);

        const checkStandalone = () => window.matchMedia('(display-mode: standalone)').matches || 
                                      window.matchMedia('(display-mode: fullscreen)').matches ||
                                      window.matchMedia('(display-mode: minimal-ui)').matches ||
                                      window.navigator.standalone || 
                                      document.referrer.includes('android-app://');

        if (user?.uid && info?.phone) {
            setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'clients', info.phone), {
                isAppInstalled: checkStandalone(),
                deviceType: dt
            }, { merge: true }).catch(() => {});
        }
    }, [user?.uid, info?.phone, db, appId]);

    useEffect(() => {
    
    return {
        deferredPrompt,
        showInstallBtn,
        setShowInstallBtn,
        notifPerm,
        setNotifPerm,
        showIosPrompt,
        setShowIosPrompt
    };
}
