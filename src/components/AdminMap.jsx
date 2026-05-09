import React, { useState, useEffect, useRef } from 'react';
import { Navigation } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { isDriverOnline } from '../utils/helpers';

export default function AdminMap({ onlineDrivers, branches }) {
    const mapRef = useRef(null); 
    const mapInstance = useRef(null); 
    const markers = useRef({}); 
    const [locating, setLocating] = useState(false);
    
    const handleRecenter = (e) => {
        e.preventDefault(); e.stopPropagation(); 
        if (!mapInstance.current) return;
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => { 
                mapInstance.current.flyTo([pos.coords.latitude, pos.coords.longitude], 15, { animate: true }); 
                setLocating(false); 
            },
            (err) => { 
                setLocating(false); 
                if (branches?.length) mapInstance.current.fitBounds(L.latLngBounds(branches.map(b => [b.lat, b.lng])), { padding: [30, 30] }); 
            },
            { enableHighAccuracy: true, timeout: 3000, maximumAge: 10000 }
        );
    };

    // 🔥 Cleanup (Memory Leak fix) - Kat-mne3 l-PC dyal l-Idara yt-bloca b9owet r-RAM
    useEffect(() => {
        return () => {
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (!mapRef.current) return;
        if (!mapInstance.current) {
            mapInstance.current = L.map(mapRef.current).setView([33.55, -7.67], 13);
            // 🔥 Google Maps Epuré (Light Mode + Sans Restaurants/Banques POI) 7ta f L'Idara
            L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&apistyle=s.t:2|p.v:off', { attribution: '© Google Maps', maxZoom: 20 }).addTo(mapInstance.current);
            
            branches.forEach(b => {
                L.marker([b.lat, b.lng], { 
                    icon: L.divIcon({ className: 'branch-icon', html: `<div style="background-color: #da291c; color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 14px; border: 2px solid white;">🏢</div>`, iconSize: [28, 28] }) 
                }).addTo(mapInstance.current).bindPopup(`<b>${b.name}</b>`);
                
                L.circle([b.lat, b.lng], { color: '#da291c', fillColor: '#da291c', fillOpacity: 0.05, weight: 2, dashArray: '5, 5', radius: (b.radius || 5) * 1000 }).addTo(mapInstance.current);
            });
        }
        
        const currentUids = [];
        onlineDrivers.forEach(d => {
            if (d.lat && d.lng && isDriverOnline(d)) {
                currentUids.push(d.uid);
                const color = d.isFreelance ? '#3b82f6' : '#ffbc0d';
                if (markers.current[d.uid]) markers.current[d.uid].setLatLng([d.lat, d.lng]);
                else {
                    markers.current[d.uid] = L.marker([d.lat, d.lng], { 
                        icon: L.divIcon({ className: 'driver-icon smooth-motorcycle', html: `<div style="background-color: ${color}; color: black; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 2px solid white;">🛵</div>`, iconSize: [32, 32] }) 
                    }).addTo(mapInstance.current).bindPopup(`<b>${d.name||'Livreur'}</b><br>${d.phone||''}`);
                }
            }
        });
        
        Object.keys(markers.current).forEach(uid => { 
            if (!currentUids.includes(uid)) { 
                mapInstance.current.removeLayer(markers.current[uid]); 
                delete markers.current[uid]; 
            } 
        });
    }, [onlineDrivers, branches]);

    return (
        <div className="bg-white p-2 rounded-[2rem] shadow-sm border border-gray-200 mt-4 relative">
           <div ref={mapRef} style={{ width: '100%', height: '500px', borderRadius: '1.5rem', zIndex: 1 }}></div>
           <button onClick={handleRecenter} className="absolute bottom-8 right-6 z-[1000] bg-white w-14 h-14 rounded-full shadow-2xl border-2 flex items-center justify-center active:scale-90 transition-all">{locating ? <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div> : <Navigation size={26} className="text-blue-600" />}</button>
        </div>
    );
}