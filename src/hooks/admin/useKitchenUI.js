import { useState, useRef, useEffect } from 'react';

export function useKitchenUI(profile) {
    const [checkedItems, setCheckedItems] = useState({});
    const [showHistory, setShowHistory] = useState(false);
    const [alertedOrders, setAlertedOrders] = useState(new Set());
    const [confirmReturn, setConfirmReturn] = useState(null);
    const [newOrderNotify, setNewOrderNotify] = useState(false);
    const [showTotals, setShowTotals] = useState(false);
    const [isSoundEnabled, setIsSoundEnabled] = useState(false);
    const prevOrdersRef = useRef(new Set());
    
    const [stationFilter, setStationFilter] = useState('ALL');
    const [compactMode, setCompactMode] = useState(false);
    const [showStockModal, setShowStockModal] = useState(false);
    const [selectedBranchId, setSelectedBranchId] = useState('');
    const [glovoGroupedOrders, setGlovoGroupedOrders] = useState({});

    const [showIpConfig, setShowIpConfig] = useState(false);
    const [showFontConfig, setShowFontConfig] = useState(false);
    const [isHeaderVisible, setIsHeaderVisible] = useState(true);
    
    const [kdsFontSizes, setKdsFontSizes] = useState(() => {
        const saved = localStorage.getItem('kdsFontSizes');
        const parsed = saved ? JSON.parse(saved) : {};
        return { 
            principal: parsed.principal || 16, 
            sans: parsed.sans || 11, 
            extra: parsed.extra || 11,
            headerNum: parsed.headerNum || 30,
            headerTags: parsed.headerTags || 11,
            btnReady: parsed.btnReady || 12
        };
    });

    const updateKdsFontSize = (type, delta) => {
        setKdsFontSizes(prev => {
            const newVal = Math.max(8, Math.min(48, prev[type] + delta));
            const updated = { ...prev, [type]: newVal };
            localStorage.setItem('kdsFontSizes', JSON.stringify(updated));
            return updated;
        });
    };

    useEffect(() => {
        if (!selectedBranchId) {
            if (profile?.isAdmin) {
                setSelectedBranchId('ALL');
            } else if (profile?.managerBranchId) {
                setSelectedBranchId(profile.managerBranchId);
            } else {
                setSelectedBranchId('ALL');
            }
        }
    }, [profile, selectedBranchId]);

    return {
        checkedItems, setCheckedItems,
        showHistory, setShowHistory,
        alertedOrders, setAlertedOrders,
        confirmReturn, setConfirmReturn,
        newOrderNotify, setNewOrderNotify,
        showTotals, setShowTotals,
        isSoundEnabled, setIsSoundEnabled,
        prevOrdersRef,
        stationFilter, setStationFilter,
        compactMode, setCompactMode,
        showStockModal, setShowStockModal,
        selectedBranchId, setSelectedBranchId,
        glovoGroupedOrders, setGlovoGroupedOrders,
        showIpConfig, setShowIpConfig,
        showFontConfig, setShowFontConfig,
        isHeaderVisible, setIsHeaderVisible,
        kdsFontSizes, updateKdsFontSize
    };
}
