import { useState } from 'react';

export function usePosModalsState(settings) {
    const [selectedCategory, setSelectedCategory] = useState('');
    const [orderType, setOrderType] = useState(settings?.hidePosSurPlace ? 'a_emporter' : 'sur_place');
    const [editCartItem, setEditCartItem] = useState(null);
    const [selectedItemForOptions, setSelectedItemForOptions] = useState(null);
    const [selectedChoiceForOptions, setSelectedChoiceForOptions] = useState(null);
    const [selectedVariationForOptions, setSelectedVariationForOptions] = useState(null);
    const [comboSelectionsForOptions, setComboSelectionsForOptions] = useState({});
    const [showPosSans, setShowPosSans] = useState(false);
    const [showPosExtras, setShowPosExtras] = useState(false);
    const [showHeldCarts, setShowHeldCarts] = useState(false);
    const [showUnpaidModal, setShowUnpaidModal] = useState(false);
    const [showReadyPosModal, setShowReadyPosModal] = useState(false);
    const [showGlovoModal, setShowGlovoModal] = useState(false);
    const [showConfirmToutDonner, setShowConfirmToutDonner] = useState(false);
    const [glovoConfirmPaymentOrder, setGlovoConfirmPaymentOrder] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState(null);
    const [printCuisine, setPrintCuisine] = useState(true);
    const [printAddition, setPrintAddition] = useState(true);
    const [showStandardModal, setShowStandardModal] = useState(false);
    const [showTelNumpad, setShowTelNumpad] = useState(false);
    const [showPendingModal, setShowPendingModal] = useState(false);
    const [showOnlineOrdersModal, setShowOnlineOrdersModal] = useState(false);
    const [telInfo, setTelInfo] = useState({ phone: '', deliveryFee: 0 });
    const [defaultPosDriver, setDefaultPosDriver] = useState(() => localStorage.getItem('pos_default_driver') || '');
    const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [showXZModal, setShowXZModal] = useState(false);
    const [showAchatsModal, setShowAchatsModal] = useState(false);
    const [isVerifyingGlovo, setIsVerifyingGlovo] = useState(false);

    return {
        selectedCategory, setSelectedCategory,
        orderType, setOrderType,
        editCartItem, setEditCartItem,
        selectedItemForOptions, setSelectedItemForOptions,
        selectedChoiceForOptions, setSelectedChoiceForOptions,
        selectedVariationForOptions, setSelectedVariationForOptions,
        comboSelectionsForOptions, setComboSelectionsForOptions,
        showPosSans, setShowPosSans,
        showPosExtras, setShowPosExtras,
        showHeldCarts, setShowHeldCarts,
        showUnpaidModal, setShowUnpaidModal,
        showReadyPosModal, setShowReadyPosModal,
        showGlovoModal, setShowGlovoModal,
        showConfirmToutDonner, setShowConfirmToutDonner,
        glovoConfirmPaymentOrder, setGlovoConfirmPaymentOrder,
        confirmDialog, setConfirmDialog,
        printCuisine, setPrintCuisine,
        printAddition, setPrintAddition,
        showStandardModal, setShowStandardModal,
        showTelNumpad, setShowTelNumpad,
        showPendingModal, setShowPendingModal,
        showOnlineOrdersModal, setShowOnlineOrdersModal,
        telInfo, setTelInfo,
        defaultPosDriver, setDefaultPosDriver,
        isMobileCartOpen, setIsMobileCartOpen,
        showHistoryModal, setShowHistoryModal,
        showXZModal, setShowXZModal,
        showAchatsModal, setShowAchatsModal,
        isVerifyingGlovo, setIsVerifyingGlovo
    };
}
