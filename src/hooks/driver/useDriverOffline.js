import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export function useDriverOffline({ db, appId, user, profile, settings }) {
    // 🔥 Jdid: State l-GPS on-demand
    const [gpsActive, setGpsActive] = useState(false);
    const [gpsTimeoutId, setGpsTimeoutId] = useState(null);
    const lastGpsUpdateRef = useRef(0);
    const [deferredPrompt, setDeferredPrompt] = useState(null); // Jdid: PWA Install
    const [showInstallBtn, setShowInstallBtn] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState(null);
    const [isStandalone, setIsStandalone] = useState(false);
    const [deviceType, setDeviceType] = useState('desktop');
    const [forceBypassInstall, setForceBypassInstall] = useState(localStorage.getItem('bypass_install') === 'true');
    const [showSetupModal, setShowSetupModal] = useState(localStorage.getItem('driver_setup_done') !== 'true');
    const [gpsPermissionDenied, setGpsPermissionDenied] = useState(false);
    const [isScreenFlashing, setIsScreenFlashing] = useState(false);
    const [appVersion, setAppVersion] = useState("1.0.0");
    const [latestGithubVersion, setLatestGithubVersion] = useState(null);
    const [isRtdbConnected, setIsRtdbConnected] = useState(true);


    // 🔥 NOUVEAU: Listen to driver doc for help requests & return messages
    const [driverDoc, setDriverDoc] = useState(null);
    useEffect(() => {
        if (!user?.uid) return;
        const unsub = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'drivers', user.uid), (docSnap) => {
            if (docSnap.exists()) {
                setDriverDoc(docSnap.data());
            }
        });
        return () => unsub();
    }, [user?.uid, db, appId]);

    // 🔥 Détection automatique de la version APK (Capacitor) et comparaison avec Github
    useEffect(() => {
        const checkVersions = async () => {
            let githubVer = null;
            // Fetch depuis Github
            try {
                const response = await fetch('https://api.github.com/repos/laghribsaid87-web/mon-bocadillo/releases/latest');
                const data = await response.json();
                if (data && data.tag_name) {
                    githubVer = data.tag_name.replace('v', '');
                    setLatestGithubVersion(githubVer);
                }
            } catch (err) {
                console.error("Erreur check update Github:", err);
            }

            if (Capacitor.isNativePlatform()) {
                try {
                    const info = await App.getInfo();
                    setAppVersion(info.version); // Récupère la version native (ex: 1.0.1)
                } catch (e) {
                    console.log("Erreur de récupération de la version locale:", e);
                }
            } else {
                // Sur Web (PC/Navigateur), on synchronise avec Github pour ne pas bloquer le testeur
                if (githubVer) setAppVersion(githubVer);
            }
        };
        // S'exécute au démarrage (Mount) ET quand l'Admin clique sur le bouton "Forcer la vérification"
        checkVersions();
    }, [settings?.forceDriverUpdateCheck]);

    useEffect(() => {
        // Zoom global de l'interface (Ajusté pour être un peu plus grand)
        document.documentElement.style.fontSize = '13px';
    }, []);


    // 🔥 NOUVEAU: Écouter l'événement pour installer la PWA (Livreur)
    useEffect(() => {
        // Nchoufo wach l-event deja wsel f main.jsx
        if (window.deferredPWAInstall) {
            setDeferredPrompt(window.deferredPWAInstall);
            setShowInstallBtn(true);
        }

        const handler = (e) => {
            e.preventDefault();
            window.deferredPWAInstall = e;
            setDeferredPrompt(e);
            setShowInstallBtn(true);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    // 🔥 Track PWA Install Status & Device Type
    useEffect(() => {
        const checkStandalone = () => window.matchMedia('(display-mode: standalone)').matches || 
                                      window.matchMedia('(display-mode: fullscreen)').matches ||
                                      window.matchMedia('(display-mode: minimal-ui)').matches ||
                                      window.navigator.standalone || 
                                      document.referrer.includes('android-app://');
        const isStand = checkStandalone();
        setIsStandalone(isStand);

        const ua = navigator.userAgent.toLowerCase();
        let dt = 'desktop';
        if (/iphone|ipad|ipod/.test(ua)) dt = 'ios';
        else if (/android/.test(ua)) dt = 'android';
        setDeviceType(dt);

        const mediaQuery = window.matchMedia('(display-mode: standalone)');
        const handleChange = (e) => setIsStandalone(e.matches);
        mediaQuery.addEventListener('change', handleChange);

        // Update Firestore if installed
        if (user?.uid || profile?.phone) {
            setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'clients', profile?.phone || profile?.id || user?.uid), {
                isAppInstalled: isStand,
                deviceType: dt
            }, { merge: true }).catch(() => {});
        }

        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [user?.uid, profile?.phone, profile?.id, db, appId]);

    useEffect(() => {
        if (brand?.logoUrl) {
            const addOrUpdateIcon = (relType) => {
                let link = document.querySelector(`link[rel='${relType}']`);
                if (!link) {
                    link = document.createElement('link');
                    link.rel = relType;
                    document.head.appendChild(link);
                }
                link.href = brand.logoUrl;
            };
            addOrUpdateIcon('apple-touch-icon');
            addOrUpdateIcon('apple-touch-icon-precomposed');
            addOrUpdateIcon('icon');
            addOrUpdateIcon('shortcut icon');
        }
    }, [brand?.logoUrl]);

    const handleInstallApp = async () => {
        if (!deferredPrompt) return;
        localStorage.setItem('pwa_mode', 'livreur');
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            window.deferredPWAInstall = null;
            setShowInstallBtn(false);
        }
        setDeferredPrompt(null);
    };


    return {
        gpsActive, setGpsActive, gpsTimeoutId, setGpsTimeoutId, lastGpsUpdateRef,
        deferredPrompt, setDeferredPrompt, showInstallBtn, setShowInstallBtn,
        confirmDialog, setConfirmDialog, isStandalone, setIsStandalone, deviceType, setDeviceType,
        forceBypassInstall, setForceBypassInstall, showSetupModal, setShowSetupModal,
        gpsPermissionDenied, setGpsPermissionDenied, isScreenFlashing, setIsScreenFlashing,
        appVersion, setAppVersion, latestGithubVersion, setLatestGithubVersion,
        driverDoc, setDriverDoc,
        handleInstallApp
    };
}
