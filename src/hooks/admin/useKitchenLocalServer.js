import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export function useKitchenLocalServer() {
    const [posLocalIp, setPosLocalIp] = useState(() => localStorage.getItem('posLocalIp') || 'localhost');
    const [localOrders, setLocalOrders] = useState([]);
    const [wsConnected, setWsConnected] = useState(false);
    const localSocketRef = useRef(null);

    useEffect(() => {
        if (!posLocalIp) return;
        
        const socket = io(`http://${posLocalIp}:3001`, { transports: ['websocket', 'polling'] });
        localSocketRef.current = socket;

        socket.on('connect', () => setWsConnected(true));
        socket.on('disconnect', () => setWsConnected(false));
        
        socket.on('kds_new_order', (order) => {
            setLocalOrders(prev => {
                if (prev.some(o => o.id === order.id || o.orderNumber === order.orderNumber)) return prev;
                return [...prev, order];
            });
        });

        socket.on('kds_status_updated', (data) => {
            if (data.status === 'ready' || data.status === 'delivered') {
                setLocalOrders(prev => prev.filter(o => o.id !== data.id && o.orderNumber !== data.orderNumber));
            } else {
                setLocalOrders(prev => prev.map(o => (o.id === data.id || o.orderNumber === data.orderNumber) ? { ...o, status: data.status } : o));
            }
        });

        return () => {
            socket.disconnect();
            localSocketRef.current = null;
        };
    }, [posLocalIp]);

    return { posLocalIp, setPosLocalIp, localOrders, setLocalOrders, wsConnected, setWsConnected, localSocketRef };
}
