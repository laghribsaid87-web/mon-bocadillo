import { useState, useEffect } from 'react';

export function usePosBluetooth(showNotify) {
    const [btCharacteristic, setBtCharacteristic] = useState(null);
    const [isBtConnecting, setIsBtConnecting] = useState(false);

// 🔥 NOUVEAU: Auto-reconnexion au démarrage (Web Bluetooth getDevices)
    useEffect(() => {
        const tryAutoConnectBT = async () => {
            if (localStorage.getItem('use_bt_printer') === 'true' && navigator.bluetooth && navigator.bluetooth.getDevices) {
                try {
                    setIsBtConnecting(true);
                    const devices = await navigator.bluetooth.getDevices();
                    if (devices.length > 0) {
                        // Prendre le premier appareil Bluetooth préalablement autorisé
                        const device = devices[0];
                        const server = await device.gatt.connect();
                        
                        const services = await server.getPrimaryServices();
                        let targetCharacteristic = null;
                        for (const service of services) {
                            try {
                                const characteristics = await service.getCharacteristics();
                                targetCharacteristic = characteristics.find(c => c.properties.write || c.properties.writeWithoutResponse);
                                if (targetCharacteristic) break;
                            } catch(e) {}
                        }
                        
                        if (targetCharacteristic) {
                            setBtCharacteristic(targetCharacteristic);
                            showNotify("Imprimante BT Auto-Connectée ✅", "success");
                        }
                    }
                } catch (err) {
                    console.log("Erreur auto-connect BT:", err);
                } finally {
                    setIsBtConnecting(false);
                }
            }
        };
        tryAutoConnectBT();
    }, []);

   
// 🔥 Fonction pour connecter l'imprimante Bluetooth
    const handleBluetoothConnect = async () => {
        if (!navigator.bluetooth) {
            showNotify("Bluetooth bloqué : Utilisez Chrome et vérifiez que vous êtes bien sur HTTPS ou Localhost.", "error");
            return;
        }
        try {
            setIsBtConnecting(true);
            const device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: [
                    '000018f0-0000-1000-8000-00805f9b34fb', 
                    'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
                    '49535343-fe7d-4ae5-8fa9-9fafd205e455',
                    '0000fee7-0000-1000-8000-00805f9b34fb',
                    '0000ff00-0000-1000-8000-00805f9b34fb'
                ]
            });
            
            device.addEventListener('gattserverdisconnected', () => {
                setBtCharacteristic(null);
            });
            
            const server = await device.gatt.connect();
            
            const services = await server.getPrimaryServices();
            let targetCharacteristic = null;
            for (const service of services) {
                try {
                    const characteristics = await service.getCharacteristics();
                    targetCharacteristic = characteristics.find(c => c.properties.write || c.properties.writeWithoutResponse);
                    if (targetCharacteristic) break;
                } catch(e) {}
            }
            
            if (targetCharacteristic) {
                setBtCharacteristic(targetCharacteristic);
                localStorage.setItem('use_bt_printer', 'true'); // 🔥 Sauvegarder le fait qu'on utilise le BT
                showNotify("Imprimante Bluetooth Connectée ✅", "success");
            } else {
                showNotify("Aucun port d'écriture (Write) n'a été trouvé sur cette imprimante", "error");
            }
        } catch (error) {
            console.error("Erreur BT:", error);
            showNotify(error.message || "Erreur de connexion Bluetooth ou annulée", "error");
        } finally {
            setIsBtConnecting(false);
        }
    };

    // 🔥 Fonction pour envoyer des données au Bluetooth par paquets (Chunks)
    const sendBluetoothData = async (text) => {
        if (!btCharacteristic) return;
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const chunkSize = 256; // 256 octets par paquet pour éviter les erreurs de taille MTU
        for (let i = 0; i < data.length; i += chunkSize) {
            const chunk = data.slice(i, i + chunkSize);
            await btCharacteristic.writeValue(chunk);
        }
    };

   
    return {
        btCharacteristic,
        isBtConnecting,
        handleBluetoothConnect,
        sendBluetoothData
    };
}
