import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Trash2, CheckCircle, ChefHat, AlertTriangle, Phone, ExternalLink, RefreshCw, Printer, Clock, FileText, Lock, Unlock, Zap, Bluetooth, Search, Ban } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import GlovoModal from './modals/GlovoModal';
import HistoryModal from './modals/HistoryModal';
import XZModal from './modals/XZModal';
import UnpaidModal from './modals/UnpaidModal';
import StandardOrderModal from './modals/StandardOrderModal';
import OnlineOrdersModal from './modals/OnlineOrdersModal';
import PendingModal from './modals/PendingModal';
import HeldCartsModal from './modals/HeldCartsModal';
import ProblemOrdersModal from './modals/ProblemOrdersModal';
import ReadyPosModal from './modals/ReadyPosModal';
import AchatsModal from './modals/AchatsModal';
import ConfirmToutDonnerModal from './modals/ConfirmToutDonnerModal';
import ConfirmDialogModal from './modals/ConfirmDialogModal';
import OptionsModal from './modals/OptionsModal';
import UISettingsModal from './modals/UISettingsModal';
import EditCartItemModal from './modals/EditCartItemModal';

import { usePosContext } from './PosContext';
import { PREDEFINED_DRINKS } from '../../config/constants';
import { doc, updateDoc, writeBatch } from 'firebase/firestore';

export default function PosModals({ 
    updateCartItemQty, handleEditCartItemOptions, deleteFromCart,
    selectedItemForOptions, setSelectedItemForOptions,
    showPosSans, setShowPosSans,
    showPosExtras, setShowPosExtras,
    comboSelectionsForOptions, setComboSelectionsForOptions,
    togglePosComboRemovable,
    selectedVariationForOptions, setSelectedVariationForOptions,
    selectedChoiceForOptions, setSelectedChoiceForOptions,
    toggleExtra, handleConfirmOptions,
    formatSansIngredient, toggleOption,
    unpaidOrders, readyPosOrders, pendingOrders, onlineOrders, hasNewOnlineOrder,
    pendingGlovoOrders, handleAcceptGlovo, handleRejectGlovo,
    readyGlovoOrders, completedOrdersToday, totalAchats, dailyCA, caPos, caApp, caTel, caGlovoEspece, caGlovoEnLigne, dailyItemsList, printReport,
    handleGiveAllToDriver, availableDeliveryDrivers,
    updateStatus, printTicket, getDriverAssignmentData, handleReassignOrder,
    validOnlineDrivers,
    handleSearchClientTel, handleClientTelSubmit,
    restoreHeldCart, deleteHeldCart,
    cashDrawer, checkBluetoothImprimante, reconnectBluetoothImprimante,
    orders, menuItems,
    handlePayUnpaidTicket, posUI, setPosUI, defaultPosUI,
    handleResetPositions, settings, saveSettings,
    clientsList, headerBtnsOrder, setTab
}) {
    const navigate = useNavigate();

    const { 
        isAdmin, activeBranchId, db, appId, showNotify,
        brand, hasAccess,
        editCartItem, setEditCartItem,
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
        showHeldCarts, setShowHeldCarts,
        showXZModal, setShowXZModal,
        showAchatsModal, setShowAchatsModal,
        showHistoryModal, setShowHistoryModal,
        showUISettings, setShowUISettings,
        heldCarts, setHeldCarts,
        cart, setCart,
        total, orderType, setOrderType,
        achatsToday, glovoCancellationsToday, problemOrders, pendingOnline
    } = usePosContext();

    return (
        <AnimatePresence>
            <EditCartItemModal updateCartItemQty={updateCartItemQty} deleteFromCart={deleteFromCart} handleEditCartItemOptions={handleEditCartItemOptions} menuItems={menuItems} />
            
            <OptionsModal 
                selectedItemForOptions={selectedItemForOptions} setSelectedItemForOptions={setSelectedItemForOptions}
                showPosSans={showPosSans} setShowPosSans={setShowPosSans}
                showPosExtras={showPosExtras} setShowPosExtras={setShowPosExtras}
                comboSelectionsForOptions={comboSelectionsForOptions} setComboSelectionsForOptions={setComboSelectionsForOptions}
                togglePosComboRemovable={togglePosComboRemovable}
                selectedVariationForOptions={selectedVariationForOptions} setSelectedVariationForOptions={setSelectedVariationForOptions}
                selectedChoiceForOptions={selectedChoiceForOptions} setSelectedChoiceForOptions={setSelectedChoiceForOptions}
                toggleExtra={toggleExtra} handleConfirmOptions={handleConfirmOptions} formatSansIngredient={formatSansIngredient} toggleOption={toggleOption}
            />

            <UISettingsModal 
                posUI={posUI} setPosUI={setPosUI} defaultPosUI={defaultPosUI} 
                handleResetPositions={handleResetPositions} settings={settings} saveSettings={saveSettings} 
                defaultPosDriver={defaultPosDriver} setDefaultPosDriver={setDefaultPosDriver} 
                clientsList={clientsList} headerBtnsOrder={headerBtnsOrder} 
            />

            <UnpaidModal unpaidOrders={unpaidOrders} handlePayUnpaidTicket={handlePayUnpaidTicket} />

            <HeldCartsModal />

            <ProblemOrdersModal problemOrders={problemOrders} handleReassignOrder={handleReassignOrder} updateStatus={updateStatus} />

            <ReadyPosModal readyPosOrders={readyPosOrders} updateStatus={updateStatus} />

            <ConfirmToutDonnerModal readyPosOrders={readyPosOrders} updateStatus={updateStatus} />

            <GlovoModal readyGlovoOrders={readyGlovoOrders} updateStatus={updateStatus} printTicket={printTicket} />

            <HistoryModal completedOrdersToday={completedOrdersToday} printTicket={printTicket} />

            <XZModal dailyCA={dailyCA} completedOrdersToday={completedOrdersToday} caPos={caPos} caGlovoEspece={caGlovoEspece} caGlovoEnLigne={caGlovoEnLigne} caApp={caApp} caTel={caTel} totalAchats={totalAchats} dailyItemsList={dailyItemsList} printReport={printReport} />

            <AchatsModal />

            <ConfirmDialogModal />

            <PendingModal pendingOnline={pendingOnline} updateStatus={updateStatus} getDriverAssignmentData={getDriverAssignmentData} printTicket={printTicket} setTab={setTab} />

            <StandardOrderModal />

            <OnlineOrdersModal onlineOrders={onlineOrders} validOnlineDrivers={validOnlineDrivers} handleReassignOrder={handleReassignOrder} updateStatus={updateStatus} printTicket={printTicket} getDriverAssignmentData={getDriverAssignmentData} />
        </AnimatePresence>
    );
}
