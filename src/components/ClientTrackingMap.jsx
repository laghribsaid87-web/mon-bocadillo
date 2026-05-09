import React, { useState, useEffect, useRef } from 'react';
import { Navigation } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';

export default function ClientTrackingMap({ dLat, dLng, cLat, cLng, bLat, bLng, color, height = '220px' }) {
    const mapRef = useRef(null); 
    const mapInstance = useRef(null); 
    const dMarker = useRef(null); 
    const cMarker = useRef(null); 
    const routingControl = useRef(null); 
    const [locating, setLocating] = useState(false);
    
    // 🔥 Cleanup (Memory Leak fix) - Kat-msse7 l-Kharita mn RAM mnin kat-sed l-page
    useEffect(() => {
        return () => {
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }
        };
    }, []);

    const handleRecenter = (e) => {
        e.preventDefault(); e.stopPropagation(); 
        if (!mapInstance.current) return;
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => { 
                mapInstance.current.flyTo([pos.coords.latitude, pos.coords.longitude], 16, { animate: true }); 
                setLocating(false); 
            },
            (err) => { 
                setLocating(false); 
                if (dLat && dLng) mapInstance.current.flyTo([dLat, dLng], 15); 
                else if (cLat && cLng) mapInstance.current.flyTo([cLat, cLng], 15); 
            },
            { enableHighAccuracy: true, timeout: 3000, maximumAge: 10000 }
        );
    };

    useEffect(() => {
        if (!mapRef.current) return;
        if (!mapInstance.current) {
            mapInstance.current = L.map(mapRef.current, { zoomControl: false }).setView([dLat || cLat || 33.55, dLng || cLng || -7.67], 13);
            // 🔥 Google Maps Epuré (Light Mode + Sans Restaurants/Banques POI)
            L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&apistyle=s.t:2|p.v:off', { attribution: '© Google Maps', maxZoom: 20 }).addTo(mapInstance.current);
            
            if (cLat && cLng) { 
                cMarker.current = L.marker([cLat, cLng], { 
                    icon: L.divIcon({ className: 'c-icon', html: `<div style="background-color: #da291c; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 12px; border: 2px solid white;">📍</div>`, iconSize: [24, 24], iconAnchor: [12, 12] }) 
                }).addTo(mapInstance.current); 
            }
            if (bLat && bLng) { 
                L.circle([bLat, bLng], { color: color, fillColor: color, fillOpacity: 0.05, weight: 2, dashArray: '5, 5', radius: 10000 }).addTo(mapInstance.current); 
            }
            if (L.Routing && cLat && cLng && dLat && dLng) {
                routingControl.current = L.Routing.control({ 
                    waypoints: [ L.latLng(dLat, dLng), L.latLng(cLat, cLng) ], 
                    routeWhileDragging: false, addWaypoints: false, show: false, createMarker: () => null, 
                    lineOptions: { styles: [{color: '#da291c', opacity: 0.8, weight: 5}] }, fitSelectedRoutes: true 
                }).addTo(mapInstance.current);
            }
        }
        if (dLat && dLng) {
            if (dMarker.current) dMarker.current.setLatLng([dLat, dLng]);
            else { 
                dMarker.current = L.marker([dLat, dLng], { 
                        // 🔥 Zidna smooth-motorcycle bach l-moteur yt7rek b-slassa
                        icon: L.divIcon({ className: 'd-icon smooth-motorcycle', html: `<div style="background-color: #ffbc0d; color: black; border-radius: 8px; width: 110px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 900; border: 2px solid black; box-shadow: 0 4px 8px rgba(0,0,0,0.3); position: relative; font-family: sans-serif; letter-spacing: -0.5px;">MON BOCADILLO<div style="position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 8px solid black;"></div></div>`, iconSize: [110, 32], iconAnchor: [55, 40] }) 
                }).addTo(mapInstance.current); 
            }
                
                // 🔥 OSRM API Limit Fix: Matb9ach t-calculer route kolla 20s bach mayt-blocach lik l'IP
                // L-khat d l-itinéraire ghayb9a fixed mn blassa l-wla w l-moteur bo7do li ghadi yt7rek
                // mapInstance.current.setView([dLat, dLng]); // 7yednaha 7ta hiya bach l-client y9der y7rek l-kharita b-ra7to
        }
    }, [dLat, dLng, cLat, cLng, bLat, bLng, color]);

    return (
        <div className="relative w-full" style={{ height }}>
           <div ref={mapRef} style={{ width: '100%', height: '100%', zIndex: 1 }}></div>
           <div className="absolute top-4 left-4 z-[1000] bg-white/90 px-3 py-1.5 rounded-full text-[9px] font-black uppercase text-gray-800 shadow-md flex items-center gap-2"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div> Live</div>
           <button onClick={handleRecenter} className="absolute bottom-6 right-4 z-[1000] bg-white w-12 h-12 rounded-full shadow-xl border border-gray-200 flex items-center justify-center active:scale-90 transition-all">{locating ? <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div> : <Navigation size={22} className="text-blue-600" />}</button>
        </div>
    );
}