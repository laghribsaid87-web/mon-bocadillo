export function usePosCartActions({
    cart, setCart, setEditCartItem, setSelectedItemForOptions,
    setSelectedVariationForOptions, setSelectedChoiceForOptions,
    setShowPosSans, setShowPosExtras, setComboSelectionsForOptions,
    setConfirmDialog, showNotify, settings, menuItems,
    telInfo, activeBranchId, total, brand, db, appId,
    getDriverAssignmentData, isNetOnline, saveOfflineOrder,
    setShowStandardModal, setTelInfo, setShowTelNumpad, comboSelectionsForOptions, selectedItemForOptions, selectedVariationForOptions, selectedChoiceForOptions
}) {
const addToCart = (item, note = "") => {
        const finalName = note ? item.name + note : item.name;
        
        setCart(prev => {
            const existing = prev.find(i => i.id === item.id && i.name === finalName);
            if (existing) return prev.map(i => i.id === item.id && i.name === finalName ? { ...i, qty: i.qty + 1 } : i);
            return [...prev, { ...item, name: finalName, qty: 1 }];
        });
    };

    const handleSendWhatsappFromPOS = async () => {
        if (!telInfo.phone || cart.length === 0) {
            return showNotify("Numéro de Téléphone et Commande sont obligatoires!", "error");
        }
        if (activeBranchId === 'ALL') return showNotify("Khtar agence!", "error");

        let phoneNum = telInfo.phone.replace(/[^\d]/g, "").slice(0, 10);
        if (!/^(06|07)\d{8}$/.test(phoneNum)) {
            return showNotify("Numéro invalide (doit commencer par 06 ou 07)", "error");
        }

        let waPhone = phoneNum.startsWith("0") ? "212" + phoneNum.substring(1) : phoneNum;
        let deliveryCost = Number(telInfo.deliveryFee) || 0;
        let totalToPay = total + deliveryCost; 
        let orderNum = generateOrderNumber();

        let itemsText = cart.map(item => {
            let parts = (item.name || "").split(" (Sans ");
            let name = parts[0];
            let sans = parts.length > 1 
                ? parts[1].replace(")", "").split(", ").map(s => `\n   - ${formatSansIngredient(s)}`).join("") 
                : "";
            return `${item.qty}x ${name}${sans}`;
        }).join("\n");

        const appUrl = window.location.origin + window.location.pathname; 
        const etaMins = 30;
        const msgTemplate = brand?.messages?.standardOrder || DEFAULT_BRAND.messages.standardOrder; 
        const msgBody = buildMessage(msgTemplate, { 
            brandName: (brand?.name || '').toUpperCase(), 
            items: itemsText, 
            subtotal: total, 
            deliveryFee: deliveryCost, 
            total: totalToPay, 
            appUrl: appUrl, 
            eta: etaMins 
        });

        const branch = (settings?.branches || []).find(b => b.id === activeBranchId) || null;

        const newOrder = {
            userId: phoneNum,
            orderNumber: orderNum,
            customerName: "Client Tél (Caisse)",
            phone: phoneNum,
            address: "Commande par Téléphone",
            nearestBranch: branch,
            items: cart,
            total: totalToPay,
            deliveryFee: deliveryCost,
            subtotal: total,
            status: "pending",
            source: "telephone",
            etaMinutes: etaMins,
            offlineCreatedAt: Date.now(),
            ...getDriverAssignmentData()
        };

        try {
            if (isNetOnline) {
                try {
                    await createPosOrder(db, appId, newOrder);
                    showNotify("Commande ajoutée w WhatsApp t7el! ✅", "success");
                    openWhatsAppDirect(waPhone, msgBody);
                } catch (error) {
                    console.log("Erreur réseau/Firestore, sauvegarde locale...", error);
                    saveOfflineOrder(newOrder);
                    openWhatsAppDirect(waPhone, msgBody);
                }
            } else {
                saveOfflineOrder(newOrder);
                openWhatsAppDirect(waPhone, msgBody);
            }

            setShowStandardModal(false);
            setTelInfo({ phone: '', deliveryFee: 0 });
            setShowTelNumpad(false);
            setCart([]); 

        } catch (error) {
            console.error(error);
            showNotify("W9e3 mochkil f tsjal dyal l-commande", "error");
        }
    };

    const handleEditCartItemOptions = (cartItem) => {
        const originalItem = menuItems.find(i => i.id === cartItem.id);
        if (!originalItem) {
            showNotify("Produit introuvable dans le menu actuel", "error");
            return;
        }

        const ingredients = originalItem.removableIngredients ? String(originalItem.removableIngredients).split(',').map(i => i.trim()).filter(Boolean) : [];
        let choicesList = [];
        if (originalItem.choices) {
            const choicesStr = String(originalItem.choices).trim();
            if (choicesStr.toUpperCase().startsWith('CAT:')) {
                const catName = choicesStr.split(':')[1].trim();
                const matchedItems = menuItems.filter(i => i.category === catName && !i.outOfStock && !(settings?.disabledItems || []).includes(i.id));
                matchedItems.forEach(i => {
                    if (i.hasVariations && i.variations?.length > 0) {
                        i.variations.forEach(v => choicesList.push(`${i.name} (${v.name})` + (i.img ? ` | ${i.img}` : '')));
                    } else {
                        choicesList.push(i.name + (i.img ? ` | ${i.img}` : ''));
                    }
                });
            } else if (choicesStr.toUpperCase().startsWith('PROD:')) {
                const prodNames = choicesStr.substring(5).split(',').map(n => n.trim().toLowerCase());
                const matchedItems = menuItems.filter(i => prodNames.includes((i.name || '').trim().toLowerCase()) && !i.outOfStock && !(settings?.disabledItems || []).includes(i.id));
                matchedItems.forEach(i => {
                    if (i.hasVariations && i.variations?.length > 0) {
                        i.variations.forEach(v => choicesList.push(`${i.name} (${v.name})` + (i.img ? ` | ${i.img}` : '')));
                    } else {
                        choicesList.push(i.name + (i.img ? ` | ${i.img}` : ''));
                    }
                });
            } else {
                choicesList = choicesStr.split(',').map(i => i.trim()).filter(Boolean);
            }
        }

        let guessedVariation = cartItem.selectedVariation;
        if (!guessedVariation && originalItem.hasVariations && originalItem.variations?.length > 0) {
            guessedVariation = originalItem.variations.find(v => cartItem.name.includes(`(${v.name})`)) || originalItem.variations[0];
        }

        let guessedChoice = cartItem.selectedChoice;
        if (!guessedChoice && choicesList.length > 0) {
            guessedChoice = choicesList.find(c => {
                const choiceName = c.split('|')[0].trim();
                return cartItem.name.includes(`(${choiceName})`);
            }) || null;
            if (guessedChoice) {
                guessedChoice = guessedChoice.split('|')[0].trim();
            }
        }

        let guessedSans = cartItem.selectedSans;
        if (!guessedSans) {
            const sansMatch = cartItem.name.match(/\(Sans ([^)]+)\)/);
            if (sansMatch) {
                guessedSans = sansMatch[1].split(',').map(s => s.trim());
            } else {
                guessedSans = [];
            }
        }

        let guessedExtras = cartItem.selectedExtras;
        if (!guessedExtras) {
            const avecMatch = cartItem.name.match(/\(Avec ([^)]+)\)/);
            if (avecMatch) {
                guessedExtras = avecMatch[1].split(',').map(s => ({ name: s.trim(), price: 0 }));
            } else {
                guessedExtras = [];
            }
        }

        setSelectedItemForOptions({
            ...originalItem,
            ingredients,
            choices: choicesList,
            selectedSans: guessedSans,
            selectedExtras: guessedExtras,
            isEditingCartItemName: cartItem.name,
            editingCartItemQty: cartItem.qty
        });

        setSelectedVariationForOptions(guessedVariation);
        setSelectedChoiceForOptions(guessedChoice);
        setShowPosSans(ingredients.length > 0);
        setShowPosExtras(originalItem.extras && originalItem.extras.length > 0);
        setEditCartItem(null);
    };

    const togglePosComboRemovable = (itemIndex, ing) => {
        setComboSelectionsForOptions(prev => {
            const current = prev[itemIndex]?.removables || [];
            const newRemovables = current.includes(ing) ? current.filter(x => x !== ing) : [...current, ing];
            return { ...prev, [itemIndex]: { ...prev[itemIndex], removables: newRemovables } };
        });
    };

    const handleProductClick = (item, forceOptions = false) => {
        // Les choix w les tailles homa obligatoires, khassna dima n7ello l-modal fihom
        const needsOptions = (item.hasVariations && item.variations?.length > 0) || (item.choices && item.choices.length > 0) || item.isCombo;

        if (forceOptions || needsOptions) {
            const ingredients = item.removableIngredients ? String(item.removableIngredients).split(',').map(i => i.trim()).filter(Boolean) : [];
            let choicesList = [];
            if (item.choices) {
                const choicesStr = String(item.choices).trim();
                if (choicesStr.toUpperCase().startsWith('CAT:')) {
                    const catName = choicesStr.split(':')[1].trim();
                    const matchedItems = menuItems.filter(i => i.category === catName && !i.outOfStock && !(settings?.disabledItems || []).includes(i.id));
                    matchedItems.forEach(i => {
                        if (i.hasVariations && i.variations?.length > 0) {
                            i.variations.forEach(v => choicesList.push(`${i.name} (${v.name})` + (i.img ? ` | ${i.img}` : '')));
                        } else {
                            choicesList.push(i.name + (i.img ? ` | ${i.img}` : ''));
                        }
                    });
                } else if (choicesStr.toUpperCase().startsWith('PROD:')) {
                    const prodNames = choicesStr.substring(5).split(',').map(n => n.trim().toLowerCase());
                    const matchedItems = menuItems.filter(i => prodNames.includes((i.name || '').trim().toLowerCase()) && !i.outOfStock && !(settings?.disabledItems || []).includes(i.id));
                    matchedItems.forEach(i => {
                        if (i.hasVariations && i.variations?.length > 0) {
                            i.variations.forEach(v => choicesList.push(`${i.name} (${v.name})` + (i.img ? ` | ${i.img}` : '')));
                        } else {
                            choicesList.push(i.name + (i.img ? ` | ${i.img}` : ''));
                        }
                    });
                } else {
                    choicesList = choicesStr.split(',').map(i => i.trim()).filter(Boolean);
                }
            }
            
            setSelectedItemForOptions({ ...item, ingredients, choices: choicesList, selectedSans: [], selectedExtras: [] });
            setSelectedChoiceForOptions(null);
            setSelectedVariationForOptions(item.hasVariations && item.variations?.length > 0 ? item.variations[0] : null);
            setComboSelectionsForOptions({});
            setShowPosSans(false);
            setShowPosExtras(false);
            setShowPosSans(ingredients.length > 0);
            setShowPosExtras(item.extras && item.extras.length > 0);
        } else {
            addToCart(item);
        }
    };

    const confirmOptionsAndAdd = () => {
        if (!selectedItemForOptions) return;
        
        if (selectedItemForOptions.isCombo) {
            const missingDrink = selectedItemForOptions.comboItems?.findIndex((c, i) => c.type === 'drink' && !comboSelectionsForOptions[i]?.selectedOption);
            if (missingDrink !== -1) return showNotify(`Veuillez choisir une option pour: ${selectedItemForOptions.comboItems[missingDrink].name}`, "error");
            let comboChoices = selectedItemForOptions.comboItems?.map((c, i) => ({
                name: c.name,
                removables: comboSelectionsForOptions[i]?.removables || [],
                selectedOption: comboSelectionsForOptions[i]?.selectedOption || null
            }));
            const cartItemId = selectedItemForOptions.id + '_combo_' + Date.now();
            setCart(prev => {
                let newCart = prev;
                if (selectedItemForOptions.isEditingCartItemName) {
                    newCart = prev.filter(i => !(i.id === selectedItemForOptions.id && (i.cartItemId === selectedItemForOptions.cartItemId || i.name === selectedItemForOptions.isEditingCartItemName)));
                }
                return [...newCart, { ...selectedItemForOptions, qty: 1, cartItemId, comboChoices }];
            });
            setSelectedItemForOptions(null);
            return;
        }

        if (selectedItemForOptions.hasVariations && !selectedVariationForOptions) {
            return showNotify("Veuillez choisir une taille !", "error");
        }
        if (selectedItemForOptions.choices?.length > 0 && !selectedChoiceForOptions) {
            return showNotify("Veuillez choisir une option (ex: Coca, Sprite...) !", "error");
        }
        let note = "";
        let finalPrice = selectedVariationForOptions ? Number(selectedVariationForOptions.price || 0) : Number(selectedItemForOptions.price || 0);
        if (selectedVariationForOptions) note += ` (${selectedVariationForOptions.name})`;
        if (selectedChoiceForOptions) note += ` (${selectedChoiceForOptions})`;
        if (selectedItemForOptions.selectedExtras?.length > 0) {
            note += ` (Avec ${selectedItemForOptions.selectedExtras.map(e => e.name).join(', ')})`;
            finalPrice += selectedItemForOptions.selectedExtras.reduce((s, e) => s + Number(e.price), 0);
        }
        if (selectedItemForOptions.selectedSans.length > 0) {
            note += ` (Sans ${selectedItemForOptions.selectedSans.join(', ')})`;
        }
        const itemToAdd = { 
            ...selectedItemForOptions, 
            price: finalPrice,
            selectedVariation: selectedVariationForOptions,
            selectedChoice: selectedChoiceForOptions,
            selectedSans: selectedItemForOptions.selectedSans,
            selectedExtras: selectedItemForOptions.selectedExtras
        };
        
        if (selectedItemForOptions.isEditingCartItemName) {
            const finalName = note ? selectedItemForOptions.name + note : selectedItemForOptions.name;
            setCart(prev => {
                const oldItem = prev.find(i => i.id === selectedItemForOptions.id && i.name === selectedItemForOptions.isEditingCartItemName);
                if (!oldItem) return prev;
                
                const isNameChanged = finalName !== oldItem.name;
                
                // Si l'utilisateur modifie un produit avec une quantité > 1, on le sépare du groupe
                if (isNameChanged && oldItem.qty > 1) {
                    let newCart = prev.map(i => {
                        if (i.id === oldItem.id && i.name === oldItem.name) return { ...i, qty: i.qty - 1 };
                        return i;
                    });
                    
                    const existingNew = newCart.find(i => i.id === itemToAdd.id && i.name === finalName);
                    if (existingNew) return newCart.map(i => i.id === itemToAdd.id && i.name === finalName ? { ...i, qty: i.qty + 1 } : i);
                    return [...newCart, { ...itemToAdd, name: finalName, qty: 1 }];
                } else {
                    let filtered = prev.filter(i => !(i.id === selectedItemForOptions.id && i.name === selectedItemForOptions.isEditingCartItemName));
                    const existing = filtered.find(i => i.id === selectedItemForOptions.id && i.name === finalName);
                    if (existing) {
                        return filtered.map(i => i.id === selectedItemForOptions.id && i.name === finalName ? { ...i, qty: i.qty + oldItem.qty } : i);
                    } else {
                        return [...filtered, { ...itemToAdd, name: finalName, qty: oldItem.qty }];
                    }
                }
            });
        } else {
            addToCart(itemToAdd, note);
        }
        setSelectedItemForOptions(null);
    };

    const toggleOption = (opt) => {
        setSelectedItemForOptions(prev => {
            if (!prev) return prev;
            const alreadySelected = prev.selectedSans.includes(opt);
            const newSelected = alreadySelected 
                ? prev.selectedSans.filter(o => o !== opt)
                : [...prev.selectedSans, opt];
            return { ...prev, selectedSans: newSelected };
        });
    };

    const toggleExtra = (ext) => {
        setSelectedItemForOptions(prev => {
            if (!prev) return prev;
            const alreadySelected = prev.selectedExtras.some(e => e.name === ext.name);
            const newSelected = alreadySelected 
                ? prev.selectedExtras.filter(o => o.name !== ext.name)
                : [...prev.selectedExtras, ext];
            return { ...prev, selectedExtras: newSelected };
        });
    };

    const deleteFromCart = (itemId, itemName) => {
        setCart(prev => prev.filter(i => !(i.id === itemId && i.name === itemName)));
    };

    const updateCartItemQty = (item, delta) => {
        setCart(prev => {
            return prev.map(i => {
                if (i.id === item.id && i.name === item.name) {
                    const newQty = i.qty + delta;
                    if (newQty > 0) {
                        setEditCartItem({...i, qty: newQty}); 
                        return { ...i, qty: newQty };
                    }
                    return i; 
                }
                return i;
            });
        });
    };

    const clearCart = () => {
        if (cart.length > 0) {
            setConfirmDialog({
                message: "Wach m2ked bghiti tsme7 f had l-commande?",
                onConfirm: () => setCart([])
            });
        }
    };

    
    return {
        addToCart,
        handleSendWhatsappFromPOS,
        handleEditCartItemOptions,
        togglePosComboRemovable,
        handleProductClick,
        confirmOptionsAndAdd,
        toggleOption,
        toggleExtra,
        deleteFromCart,
        updateCartItemQty,
        clearCart
    };
}
