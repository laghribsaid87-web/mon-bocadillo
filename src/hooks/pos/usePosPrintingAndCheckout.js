import { formatSansIngredient } from '../../utils/helpers';
import { createPosOrder } from '../../services/orderService';
import { generateOrderNumber } from '../../utils/helpers';

export function usePosPrintingAndCheckout(ctx) {
    const {
        printAddition, printCuisine, btCharacteristic, sendBluetoothData,
        brand, cart, activeBranchId, total, orderType, settings,
        getDriverAssignmentData, isNetOnline, saveOfflineOrder, localSocket,
        db, appId, showNotify, setCart, setOrderType, unpaidOrders,
        setShowUnpaidModal, dailyItemsList, caPos, caGlovoEspece, caGlovoEnLigne,
        caApp, caTel, totalAchats, completedOrdersToday, isAdmin, dailyCA, setShowXZModal, updateStatus
    } = ctx;

const printTicketsPos = async (order, brandInfo, isPaid = true, printClientOnly = false) => {
        const doPrintAddition = printAddition && isPaid;
        const doPrintCuisine = printCuisine && !printClientOnly;
        
        if (!doPrintAddition && !doPrintCuisine) {
            if (isPaid) openDrawer();
            return; 
        }
        
        // 🔥 Si une imprimante Bluetooth est connectée, on imprime directement via BT et on coupe !
        if (btCharacteristic) {
            try {
                const dateStr = new Date().toLocaleString('fr-FR');
                const orderTypeStr = order.orderType === 'a_emporter' ? 'A EMPORTER' : 'SUR PLACE';
                
                let text = "\x1B\x40"; // Initialize printer
                
                if (doPrintAddition) {
                    text += "\x1B\x61\x01"; // Center align
                    text += `${brandInfo?.name?.toUpperCase() || 'RESTAURANT'}\n`;
                    text += `--------------------------------\n`;
                    text += `TICKET CLIENT\n`;
                    text += `${dateStr}\n`;
                    text += `COMMANDE #${order.orderNumber}\n`;
                    text += `*** ${orderTypeStr} ***\n`;
                    text += `--------------------------------\n`;
                    text += "\x1B\x61\x00"; // Left align
                    
                    order.items.forEach(item => {
                        text += `${item.qty}x ${item.name.split(' (Sans')[0]}    ${item.price * item.qty} DH\n`;
                        if (item.name.includes(' (Sans')) {
                            const sansList = item.name.split(' (Sans ')[1].replace(')', '').split(', ');
                            sansList.forEach(opt => { text += `  - ${formatSansIngredient(opt)}\n`; });
                        }
                        if (item.isCombo && item.comboChoices) {
                            item.comboChoices.forEach(c => {
                                text += `  🔹 ${c.name}\n`;
                                if (c.removables?.length > 0) text += `    - Sans ${c.removables.join(', ')}\n`;
                                if (c.selectedOption) text += `    - ${c.selectedOption}\n`;
                            });
                        }
                    });
                    
                    text += `--------------------------------\n`;
                    text += `TOTAL: ${order.total} DH\n\n`;
                    text += "\x1B\x61\x01"; // Center align
                    text += `Merci de votre visite !\n\n\n\n`;
                    text += "\x1D\x56\x00"; // Cut
                }

                if (doPrintCuisine) {
                    text += "\x1B\x61\x01"; // Center align
                    text += `BON CUISINE\n`;
                    text += `${dateStr}\n`;
                    text += `COMMANDE #${order.orderNumber}\n`;
                    text += `*** ${orderTypeStr} ***\n`;
                    text += `--------------------------------\n`;
                    text += "\x1B\x61\x00"; // Left align
                    
                    order.items.forEach(item => {
                        text += `${item.qty}x ${item.name.split(' (Sans')[0]}\n`;
                        if (item.name.includes(' (Sans')) {
                            const sansList = item.name.split(' (Sans ')[1].replace(')', '').split(', ');
                            sansList.forEach(opt => { text += `  *** ${formatSansIngredient(opt)} ***\n`; });
                        }
                        if (item.isCombo && item.comboChoices) {
                            item.comboChoices.forEach(c => {
                                text += `  🔹 ${c.name}\n`;
                                if (c.removables?.length > 0) text += `    *** ${c.removables.map(r => formatSansIngredient(r)).join(' ***\n    *** ')} ***\n`;
                                if (c.selectedOption) text += `    *** ${c.selectedOption.toUpperCase()} ***\n`;
                            });
                        }
                    });
                    text += `\n\n\n\n`;
                    text += "\x1D\x56\x00"; // Cut
                }
                
                // Code pour ouvrir le tiroir
                text += "\x1B\x70\x00\x19\xFA";
                if (isPaid) text += "\x1B\x70\x00\x19\xFA";

                await sendBluetoothData(text);
                return; // Sortir de la fonction pour ne pas ouvrir la fenêtre Web normale
            } catch (err) {
                console.error("Erreur lors de l'impression Bluetooth:", err);
                showNotify("Erreur d'impression Bluetooth, passage en mode web...", "warning");
            }
        }
        
        const itemsHtml = order.items.map(item => `
            <div style="display:flex; justify-content:space-between; margin-bottom: 5px; font-weight: bold; font-size: 14px;">
                <span>${item.qty}x ${item.name.split(' (Sans')[0]}</span>
                <span>${item.price * item.qty} DH</span>
            </div>
            ${item.name.includes(' (Sans') ? `<div style="font-size:12px; color:#da291c; margin-top:-3px; margin-bottom:5px; font-weight: bold;">- ${item.name.split(' (Sans ')[1].replace(')', '').split(', ').map(opt => formatSansIngredient(opt)).join('<br>- ')}</div>` : ''}
            ${item.isCombo && item.comboChoices ? item.comboChoices.map(c => `
                <div style="font-size:12px; color:#555; margin-left:10px; font-weight: bold;">
                    🔹 ${c.name}
                    ${c.removables?.length ? `<span style="color:#da291c;">(${c.removables.map(r => formatSansIngredient(r)).join(', ')})</span>` : ''}
                    ${c.selectedOption ? `<span style="color:#2563eb;">(${c.selectedOption})</span>` : ''}
                </div>
            `).join('') : ''}
        `).join('');

        const kitchenItemsHtml = order.items.map(item => `
            <div style="margin-bottom: 8px; font-size: 20px; font-weight: 900;">
                ${item.qty}x ${item.name.split(' (Sans')[0]}
            </div>
            ${item.name.includes(' (Sans') ? `<div style="font-size:16px; margin-top:-5px; margin-bottom:8px; font-weight: 900;">*** ${item.name.split(' (Sans ')[1].replace(')', '').split(', ').map(opt => formatSansIngredient(opt)).join(' ***<br>*** ')} ***</div>` : ''}
            ${item.isCombo && item.comboChoices ? item.comboChoices.map(c => `
                <div style="font-size:16px; margin-top:5px; font-weight: bold; padding-left: 15px; border-left: 2px solid #000;">
                    🔹 ${c.name}
                    ${c.removables?.length ? `<br><span style="color:#000;">*** ${c.removables.map(r => formatSansIngredient(r)).join(' ***<br>*** ')} ***</span>` : ''}
                    ${c.selectedOption ? `<br><span style="color:#000;">*** ${c.selectedOption} ***</span>` : ''}
                </div>
            `).join('') : ''}
        `).join('');

        const dateStr = new Date().toLocaleString('fr-FR');
        const orderTypeStr = order.orderType === 'a_emporter' ? 'À EMPORTER' : 'SUR PLACE';

        const clientHtmlStr = `
        <html>
        <head><title>Ticket Client</title></head>
        <body style="font-family: monospace; padding: 10px; color: #000; width: 300px; margin: 0 auto;">
            <div style="text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 20px;">
                ${brandInfo?.ticketLogoUrl ? `<img src="${brandInfo.ticketLogoUrl}" style="max-width: 150px; max-height: 80px; object-fit: contain; margin-bottom: 10px;" /><br/>` : ''}
                <h2 style="margin: 0; font-size: 24px; font-weight: 900;">${brandInfo?.name?.toUpperCase() || 'RESTAURANT'}</h2>
                ${brandInfo?.ticketHeader ? `<p style="margin: 5px 0; font-size: 14px;">${brandInfo.ticketHeader}</p>` : ''}
                ${brandInfo?.ticketPhone ? `<p style="margin: 5px 0; font-size: 14px;">Tél: ${brandInfo.ticketPhone}</p>` : ''}
                ${brandInfo?.ticketWebsite ? `<p style="margin: 5px 0; font-size: 14px;">${brandInfo.ticketWebsite}</p>` : ''}
                
                <p style="margin: 15px 0 5px 0; font-weight: bold; border-top: 1px dashed #000; padding-top: 10px;">TICKET CLIENT</p>
                <p style="margin: 5px 0; font-size: 12px;">${dateStr}</p>
                <h1 style="margin: 10px 0; font-size: 32px;">#${order.orderNumber}</h1>
                <h2 style="margin: 5px 0; padding: 5px; border: 2px solid #000;">${orderTypeStr}</h2>
                <div style="margin-top: 15px; text-align: left;">
                    ${itemsHtml}
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 20px; font-weight: 900; margin-top: 15px; border-top: 1px solid #000; padding-top: 10px;">
                    <span>TOTAL:</span>
                    <span>${order.total} DH</span>
                </div>
                <p style="font-size: 14px; margin-top: 15px; font-weight: bold;">${brandInfo?.ticketFooter || 'Merci de votre visite !'}</p>
            </div>
        </body>
        </html>
        `;

        const cuisineHtmlStr = `
        <html>
        <head><title>Ticket Cuisine</title></head>
        <body style="font-family: monospace; padding: 10px; color: #000; width: 300px; margin: 0 auto;">
            <div style="text-align: center; padding-top: 10px;">
                <h2 style="margin: 0; font-size: 28px; font-weight: 900;">BON CUISINE</h2>
                <p style="margin: 5px 0; font-size: 12px; font-weight: bold;">${dateStr}</p>
                <h1 style="margin: 10px 0; font-size: 45px; font-weight: 900;">#${order.orderNumber}</h1>
                <h2 style="margin: 5px 0; padding: 5px; border: 3px solid #000; font-size: 22px;">${orderTypeStr}</h2>
                <div style="margin-top: 20px; text-align: left; border-top: 2px solid #000; padding-top: 10px;">
                    ${kitchenItemsHtml}
                </div>
            </div>
        </body>
        </html>
        `;

        // 🔥 ZEDNA HAD L-CODE: Impression Electron ola Web
        if (typeof window !== 'undefined' && window.require) {
            const { ipcRenderer } = window.require('electron');
            if (doPrintAddition) ipcRenderer.send('print-ticket', clientHtmlStr, brand?.selectedPrinter);
            if (doPrintCuisine) {
                setTimeout(() => { ipcRenderer.send('print-ticket', cuisineHtmlStr, brand?.selectedPrinter); }, 1000);
            }
            if (isPaid && !doPrintAddition) openDrawer();
        } else {
            const printHtml = (htmlContent) => {
                const printWindow = window.open('', '', 'width=400,height=800');
                if (printWindow) {
                    printWindow.document.open();
                    const htmlWithScript = htmlContent.replace('</body>', `
                    <script>
                        window.onload = function() { setTimeout(function() { window.print(); }, 500); };
                        window.onafterprint = function() { window.close(); };
                    </script>
                    </body>`);
                    printWindow.document.write(htmlWithScript);
                    printWindow.document.close();
                }
            };
            if (doPrintAddition) printHtml(clientHtmlStr);
            if (doPrintCuisine) setTimeout(() => { printHtml(cuisineHtmlStr); }, doPrintAddition ? 1500 : 0);
            if (isPaid && !doPrintAddition) openDrawer();
        }
    };

    const handleEncaissement = async (isPaid = true) => {
        if (cart.length === 0) return showNotify("L-panier khawi!", "error");
        if (activeBranchId === 'ALL') return showNotify("Khtar agence mnin ghat-encaisser l-commande!", "error");

        try {
            const orderNum = generateOrderNumber();
            const branch = (settings?.branches || []).find(b => b.id === activeBranchId) || null;

            const newOrder = {
                orderNumber: orderNum,
                items: cart,
                total: total,
                subtotal: total,
                deliveryFee: 0,
                status: 'preparing', // 🚀 POS orders kaymchiw l-Cuisine (KDS)
                paymentStatus: isPaid ? 'paye' : 'en_attente',
                deliveredAtLocal: Date.now(),
                source: 'pos',
                orderType: orderType,
                paymentMethod: 'espece',
                nearestBranch: branch,
                customerName: orderType === 'a_emporter' ? 'Client Emporter' : 'Client Sur Place',
                offlineCreatedAt: Date.now(),
                ...getDriverAssignmentData()
            };

            // 🚀 1. IMPRESSION ET RESET INSTANTANÉS (0 SECONDE D'ATTENTE)
            const orderToPrint = { ...newOrder, id: orderNum };
            printTicketsPos(orderToPrint, brand, isPaid); 
            setCart([]); // Nkhwiw l-panier f l-blassa
            setOrderType(settings?.hidePosSurPlace ? 'a_emporter' : 'sur_place'); 

            // 🚀 2. SAUVEGARDE FIREBASE EN ARRIÈRE-PLAN (Sans bloquer la caisse)
            const sanitizedOrder = JSON.parse(JSON.stringify(newOrder));
            if (isNetOnline) {
                createPosOrder(db, appId, sanitizedOrder).catch((error) => {
                    console.error("Firebase AddDoc Error:", error);
                    saveOfflineOrder(sanitizedOrder);
                });
            } else {
                saveOfflineOrder(sanitizedOrder);
            }

            // 🚀 3. EMIT VERS KDS LOCAL (WIFI HORS LIGNE)
            if (localSocket) {
                localSocket.emit('new_local_order', sanitizedOrder);
            }
        } catch (error) {
            showNotify("W9e3 mochkil f tsjal dyal l-commande", "error");
        }
    };
    
    const handlePayUnpaidTicket = (order) => {
        try {
            // 🚀 UI INSTANTANÉE
            if (unpaidOrders.length === 1) setShowUnpaidModal(false);
            showNotify("Ticket payé w t'imprima ! ✅", "success");
            
            const orderToPrint = { ...order, paymentMethod: 'espece', paymentStatus: 'paye' };
            printTicketsPos(orderToPrint, brand, true, true);

            // 🚀 FIREBASE EN ARRIÈRE-PLAN
            updateStatus(order.id, order.status, { paymentStatus: 'paye', paymentMethod: 'espece' }).catch(()=>{});
        } catch (error) {
            showNotify("Erreur lors du paiement", "error");
        }
    };

    // 🔥 Fonction pour ouvrir le tiroir (Bluetooth, Electron, ou Manuel)
    const openDrawer = async () => {
        if (btCharacteristic) {
            try {
                // Code ESC/POS pour ouvrir le tiroir-caisse connecté au port RJ11 de l'imprimante
                const escPosDrawer = "\x1B\x70\x00\x19\xFA";
                await sendBluetoothData(escPosDrawer);
                showNotify("Tiroir ouvert b-Bluetooth 🔓", "success");
            } catch (e) {
                showNotify("Erreur d'ouverture du tiroir BT", "error");
            }
        } else if (typeof window !== 'undefined' && window.require) {
            // 🔥 Mode EXE (Electron) : Nsifto un ticket khawi bach y-déclencher le tiroir f Windows
            try {
                const { ipcRenderer } = window.require('electron');
                const emptyHtml = `<html><head><title>Tiroir</title></head><body style="margin:0;padding:0;font-size:1px;color:white;">.</body></html>`;
                ipcRenderer.send('print-ticket', emptyHtml, brand?.selectedPrinter);
                showNotify("Signal envoyé l-Tiroir (EXE) 🔓", "success");
            } catch (e) {
                showNotify("Erreur Electron pour le tiroir", "error");
            }
        } else {
            showNotify("Tiroir ouvert (Simulation Web) 🔓", "success");
        }
    };

    // 🔥 Impression des Rapports X / Z
    const printReport = (type) => {
        if (activeBranchId === 'ALL') {
            showNotify("Veuillez sélectionner une agence spécifique pour imprimer le rapport.", "error");
            return;
        }
        const branch = (settings?.branches || []).find(b => b.id === activeBranchId);
        const itemsHtml = dailyItemsList.map(([name, qty]) => `<div style="display:flex; justify-content:space-between;"><span>${qty}x ${name}</span><span></span></div>`).join('');
        
        const repartitionHtml = `\n
            <p style="text-align:left; font-weight:bold; margin:5px 0;">Répartition C.A :</p>
            ${isAdmin ? `<div style="display:flex; justify-content:space-between; font-size:12px;"><span>Sur Place (Caisse):</span><span>${caPos} DH</span></div>` : ''}
            <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:bold; color:#16a34a;"><span>Glovo (Espèce):</span><span>${caGlovoEspece} DH</span></div>
            <div style="display:flex; justify-content:space-between; font-size:12px;"><span>Glovo (En Ligne):</span><span>${caGlovoEnLigne} DH</span></div>
            ${isAdmin ? `<div style="display:flex; justify-content:space-between; font-size:12px;"><span>Web App:</span><span>${caApp} DH</span></div>
            <div style="display:flex; justify-content:space-between; font-size:12px;"><span>Standard (Tél):</span><span>${caTel} DH</span></div>
            <div style="display:flex; justify-content:space-between; font-size:12px;"><span>Achats (Dépenses):</span><span>-${totalAchats} DH</span></div>
            <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:bold;"><span>Net (Espèce Caisse + Glovo - Achats):</span><span>${(caPos + caGlovoEspece) - totalAchats} DH</span></div>` : ''}
            <hr style="border-top:1px dashed #000; margin:10px 0;"/>\n`;
        
        const html = `<html><head><title>Rapport ${type}</title></head>
        <body style="font-family:monospace; padding:10px; font-size:14px; color:#000; text-align:center;">
            ${brand?.ticketLogoUrl ? `<img src="${brand.ticketLogoUrl}" style="max-width: 150px; max-height: 80px; object-fit: contain; margin-bottom: 10px;" /><br/>` : ''}
            <h2 style="margin:0;">RAPPORT ${type}</h2>
            <p style="margin:5px 0;">${branch?.name?.toUpperCase() || brand?.name?.toUpperCase() || 'CAISSE'}<br>Date: ${new Date().toLocaleString('fr-FR')}</p>
            <hr style="border-top:1px dashed #000; margin:10px 0;"/><div style="display:flex; justify-content:space-between;"><span>Total Tickets:</span><span>${completedOrdersToday.length}</span></div><hr style="border-top:1px dashed #000; margin:10px 0;"/>
            ${repartitionHtml}<p style="text-align:left; font-weight:bold; margin:5px 0;">Détails des ventes :</p>${itemsHtml || '<p style="text-align:left;">Aucun article</p>'}
            <hr style="border-top:1px dashed #000; margin:10px 0;"/><div style="display:flex; justify-content:space-between; font-weight:bold; font-size:18px; margin-top:10px;"><span>C.A TOTAL:</span><span>${isAdmin ? dailyCA + ' DH' : '*** DH'}</span></div>
            <p style="margin-top:20px; font-size:12px;">${type === 'Z' ? '*** CLOTURE Z ***' : '*** BILAN PROVISOIRE X ***'}</p>
        </body></html>`;

        // 🔥 ZEDNA HAD L-CODE: Impression Electron ola Web
        if (typeof window !== 'undefined' && window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('print-ticket', html, brand?.selectedPrinter);
        } else {
            const printWindow = window.open('', '', 'width=400,height=800');
            if (printWindow) {
                printWindow.document.open();
                const htmlWithScript = html.replace('</body>', `
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                        }, 500);
                    };
                    window.onafterprint = function() {
                        window.close();
                    };
                </script>
                </body>`);
                printWindow.document.write(htmlWithScript);
                printWindow.document.close();
            }
        }

        // Ouvrir le tiroir caisse automatiquement
        openDrawer();

        if (type === 'Z') { showNotify("Journée clôturée avec succès ✅", "success"); setShowXZModal(false); }
    };


    return {
        printTicketsPos,
        handleEncaissement,
        handlePayUnpaidTicket,
        openDrawer,
        printReport
    };
}
