package com.bocadillo.godroidautomator

import android.accessibilityservice.AccessibilityService
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.withLock

class AutomatorAccessibilityService : AccessibilityService() {

    private val coroutineScope = CoroutineScope(Dispatchers.Default + Job())
    private var isSequenceRunning = false
    private val sequenceMutex = kotlinx.coroutines.sync.Mutex()
    private val processedReadyOrders = mutableSetOf<String>()

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == "com.bocadillo.godroidautomator.START_SEQUENCE") {
                Journal.log("Broadcast reçu: START_SEQUENCE (Mise en file d'attente)")
                
                coroutineScope.launch {
                    // Wake up screen and unlock
                    wakeUpScreenAndUnlock()
                    
                    sequenceMutex.withLock {
                        if (!isSequenceRunning) {
                            startAutomationSequence()
                        }
                    }
                }
            }
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.d("AutoService", "Accessibility Service Connected")
        val filter = IntentFilter("com.bocadillo.godroidautomator.START_SEQUENCE")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(receiver, filter, RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(receiver, filter)
        }
        
        startPollingForReadyOrders()
    }

    private suspend fun wakeUpScreenAndUnlock() {
        try {
            val powerManager = getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
            val isScreenOn = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT_WATCH) {
                powerManager.isInteractive
            } else {
                powerManager.isScreenOn
            }
            if (!isScreenOn) {
                Journal.log("Réveil de l'écran en cours...")
                @Suppress("DEPRECATION")
                val wakeLock = powerManager.newWakeLock(
                    android.os.PowerManager.FULL_WAKE_LOCK or
                    android.os.PowerManager.ACQUIRE_CAUSES_WAKEUP or
                    android.os.PowerManager.ON_AFTER_RELEASE,
                    "GoDroidAutomator::WakeLock"
                )
                wakeLock.acquire(10000)
            }
            val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as android.app.KeyguardManager
            if (keyguardManager.isKeyguardLocked) {
                Journal.log("Déverrouillage de l'écran...")
                @Suppress("DEPRECATION")
                val keyguardLock = keyguardManager.newKeyguardLock("GoDroidAutomator::KeyguardLock")
                keyguardLock.disableKeyguard()
                
                // Attendre 1 seconde que l'écran s'allume bien avant de glisser
                delay(1000)
                
                // Forcer le Swipe Up (Glisser l'écran vers le haut)
                performSwipeUp()
            }
        } catch (e: Exception) {
            Journal.log("Erreur WakeUp: ${e.message}")
        }
    }

    private fun performSwipeUp() {
        try {
            val displayMetrics = resources.displayMetrics
            val middleX = displayMetrics.widthPixels / 2f
            val startY = displayMetrics.heightPixels * 0.8f // Commencer en bas (80%)
            val endY = displayMetrics.heightPixels * 0.1f   // Finir en haut (10%)

            val path = android.graphics.Path()
            path.moveTo(middleX, startY)
            path.lineTo(middleX, endY)

            val gestureBuilder = android.accessibilityservice.GestureDescription.Builder()
            // Stroke de 500ms pour simuler un vrai glissement du doigt
            gestureBuilder.addStroke(android.accessibilityservice.GestureDescription.StrokeDescription(path, 0, 500))

            val result = dispatchGesture(gestureBuilder.build(), object : android.accessibilityservice.AccessibilityService.GestureResultCallback() {
                override fun onCompleted(gestureDescription: android.accessibilityservice.GestureDescription?) {
                    super.onCompleted(gestureDescription)
                    Journal.log("Glissement (Swipe Up) réussi pour déverrouiller.")
                }
                override fun onCancelled(gestureDescription: android.accessibilityservice.GestureDescription?) {
                    super.onCancelled(gestureDescription)
                    Journal.log("Glissement (Swipe Up) annulé.")
                }
            }, null)
            
            if (!result) {
                Journal.log("Impossible de lancer le glissement (Swipe Up).")
            }
        } catch (e: Exception) {
            Journal.log("Erreur lors du Swipe Up: ${e.message}")
        }
    }

    private fun startPollingForReadyOrders() {
        coroutineScope.launch {
            while (true) {
                try {
                    delay(5000) // Poll every 5 seconds
                    if (!sequenceMutex.isLocked && !isSequenceRunning) {
                        
                        // 1. Check for Manual Trigger from POS to verify Cancellations
                        val shouldVerifyCancellations = NetworkClient.checkCancellationTrigger()
                        if (shouldVerifyCancellations) {
                            sequenceMutex.withLock {
                                startCancellationCheckSequence()
                            }
                            continue // skip ready orders check in this tick
                        }
                        // 2. Check for Rupture de Stock trigger from KDS
                        val ruptureGlovoName = NetworkClient.checkRuptureTrigger()
                        if (ruptureGlovoName != null) {
                            sequenceMutex.withLock {
                                startRuptureSequence(ruptureGlovoName)
                            }
                            continue
                        }

                        // 3. Normal check for Ready Orders
                        val readyOrders = NetworkClient.checkReadyOrders()
                        for (order in readyOrders) {
                            if (!processedReadyOrders.contains(order.documentId)) {
                                processedReadyOrders.add(order.documentId)
                                sequenceMutex.withLock {
                                    startReadySequence(order.orderNumber, order.documentId)
                                }
                            }
                        }

                        // 4. Check Visually for "mins" on screen (Fallback for missed notifications)
                        triggerFallbackVisualCheck()
                    }
                } catch (e: Exception) {
                    Log.e("AutoService", "Polling error", e)
                }
            }
        }
    }

    private fun triggerFallbackVisualCheck() {
        val root = rootInActiveWindow
        if (root != null && !isSequenceRunning) {
            val labelMins = getLabel("btn_mins", "mins")
            val node = findNodeWithTextRecursively(labelMins, root)
            if (node != null && isNodeClickable(node)) {
                Journal.log("Suite de commande: '$labelMins' détecté !")
                coroutineScope.launch {
                    sequenceMutex.withLock {
                        if (!isSequenceRunning) {
                            startAutomationSequence()
                        }
                    }
                }
            }
        }
    }

    private suspend fun startReadySequence(orderNumber: String, documentId: String) {
        isSequenceRunning = true
        val labelAcceptee = getLabel("btn_acceptee", "Acceptée")
        val labelPret = getLabel("btn_pret", "Prêt pour la livraison")
        val labelConfirmer = getLabel("btn_confirmer", "Confirmer")

        try {
            Journal.log("=== DEBUT SÉQUENCE PRÊT POUR LA LIVRAISON ===")
            Journal.log("Commande détectée: $orderNumber")
            
            wakeUpScreenAndUnlock()
            delay(1000) // Donner le temps à l'écran de s'allumer

            // 1. Launch goDroid
            var targetPackage = "com.deliveryhero.rps.restaurantandroidapp"
            val pm = packageManager
            val packages = pm.getInstalledApplications(android.content.pm.PackageManager.GET_META_DATA)
            for (app in packages) {
                val appName = pm.getApplicationLabel(app).toString()
                if (appName.equals("goDroid", ignoreCase = true) || appName.equals("Glovo Partner", ignoreCase = true)) {
                    targetPackage = app.packageName
                    break
                }
            }

            kotlinx.coroutines.withContext(Dispatchers.Main) {
                android.widget.Toast.makeText(applicationContext, "Validation Commande $orderNumber !", android.widget.Toast.LENGTH_LONG).show()
            }

            val currentPackage = rootInActiveWindow?.packageName?.toString()
            if (currentPackage != targetPackage) {
                val launchIntent = packageManager.getLaunchIntentForPackage(targetPackage)
                if (launchIntent != null) {
                    launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    startActivity(launchIntent)
                    Journal.log("Ouverture de l'app: $targetPackage")
                    delay(1000)
                }
            }

            delay(1500)

            // 1.5 Open Menu (Drawer) and click "Aperçu des commandes"
            Journal.log("Ouverture du menu")
            val root = rootInActiveWindow
            if (root != null) {
                if (!clickByText("Ouvrir le tiroir de navigation")) {
                    val drawerNodes = root.findAccessibilityNodeInfosByViewId("com.deliveryhero.rps.restaurantandroidapp:id/toolbar")
                    if (drawerNodes.isNotEmpty()) {
                        val toolbar = drawerNodes[0]
                        if (toolbar.childCount > 0) {
                            val firstChild = toolbar.getChild(0)
                            if (firstChild != null && firstChild.isClickable) {
                                firstChild.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                            }
                        }
                    } else {
                        clickByText("Menu")
                    }
                }
            }
            delay(500)
            Journal.log("Clic sur 'Aperçu des commandes'")
            clickByText("Aperçu des commandes")
            delay(1000)

            // 2. Click on "Acceptée" tab
            Journal.log("Clic sur l'onglet '$labelAcceptee'")
            clickByText(labelAcceptee)
            delay(1000)

            // 3. Find the order on the screen
            val orderTextToFind = orderNumber.replace("#", "")
            Journal.log("Recherche de la commande $orderTextToFind")
            
            // If we can click the exact order number
            if (clickByText(orderTextToFind)) {
                delay(500)
                Journal.log("Clic sur '$labelPret' pour $orderTextToFind")
                
                val clickedInSameContainer = clickButtonInSameContainer(orderTextToFind, labelPret)
                if (!clickedInSameContainer) {
                    Journal.log("Bouton non trouvé près de $orderTextToFind, essai par défaut")
                    clickByText(labelPret)
                }
                
                delay(1000)
                
                // Handle Dialogs
                val screenText = extractAllText(rootInActiveWindow)
                
                // Grouped Orders Dialog: "Sélectionnez les commandes qui sont prêtes"
                if (screenText.contains("Sélectionnez les commandes", ignoreCase = true)) {
                    Journal.log("Commandes groupées détectées, sélection de $orderTextToFind")
                    // Usually the checkbox has text next to it like "Commande n° 32"
                    val checkboxText = "Commande n° $orderTextToFind"
                    clickByText(checkboxText)
                    delay(1000)
                    Journal.log("Clic sur '$labelConfirmer'")
                    clickByText(labelConfirmer)
                } 
                // Early Ready Dialog: "est-elle prête pour la livraison ?"
                else if (screenText.contains("est-elle prête", ignoreCase = true)) {
                    Journal.log("Confirmation d'avance demandée par Glovo")
                    Journal.log("Clic sur '$labelConfirmer'")
                    clickByText(labelConfirmer)
                }
                
                delay(500)
                // Mark as clicked in Firestore
                NetworkClient.markOrderAsGlovoReady(documentId)
                Journal.log("=== SÉQUENCE PRÊT TERMINÉE ===")
            } else {
                Journal.log("Commande $orderTextToFind introuvable : Probablement déjà traitée manuellement.")
                // Mark as handled to prevent endless retries
                NetworkClient.markOrderAsGlovoReady(documentId)
            }

        } catch (e: Exception) {
            Journal.log("ERREUR FATALE: ${e.message}")
        } finally {
            coroutineScope.launch { returnToNewOrdersTab() }
            isSequenceRunning = false
            triggerFallbackVisualCheck()
        }
    }

    private var lastTriggerTime = 0L

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        
        // 1. Déclenchement par Notification (Ultra-rapide)
        if (event.eventType == AccessibilityEvent.TYPE_NOTIFICATION_STATE_CHANGED) {
            val packageName = event.packageName?.toString() ?: ""
            if (packageName.contains("deliveryhero", ignoreCase = true) || packageName.contains("glovo", ignoreCase = true)) {
                
                val currentTime = System.currentTimeMillis()
                if (currentTime - lastTriggerTime < 10000) return // Debounce 10 seconds
                lastTriggerTime = currentTime
                
                Journal.log("🔔 Notification reçue ! Déclenchement IMMÉDIAT !")
                coroutineScope.launch {
                    sequenceMutex.withLock {
                        if (!isSequenceRunning) {
                            startAutomationSequence()
                        }
                    }
                }
                return
            }
        }
        
        // 2. Déclenchement par Visuel (Si l'app est déjà ouverte)
        if (event.eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED || event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            val labelMins = getLabel("btn_mins", "mins")
            val root = rootInActiveWindow ?: return
            
            if (isSequenceRunning) return
            
            val currentTime = System.currentTimeMillis()
            if (currentTime - lastTriggerTime < 10000) return // Debounce 10 seconds
            
            val node = findNodeWithTextRecursively(labelMins, root)
            
            if (node != null && isNodeClickable(node)) {
                Journal.log("Détection visuelle (Carré vert) avec '$labelMins'")
                lastTriggerTime = currentTime
                coroutineScope.launch {
                    sequenceMutex.withLock {
                        if (!isSequenceRunning) {
                            startAutomationSequence()
                        }
                    }
                }
            }
        }
    }

    private fun isNodeClickable(node: AccessibilityNodeInfo?): Boolean {
        var current = node
        while (current != null) {
            if (current.isClickable) return true
            current = current.parent
        }
        return false
    }

    private fun findNodeWithTextRecursively(text: String, node: AccessibilityNodeInfo?): AccessibilityNodeInfo? {
        if (node == null) return null
        
        val nodeText = node.text?.toString() ?: ""
        val nodeDesc = node.contentDescription?.toString() ?: ""
        
        // Exact match or ends with to avoid partial matches
        if (nodeText.equals(text, ignoreCase = true) || nodeText.endsWith(" " + text, ignoreCase = true) || 
            nodeDesc.equals(text, ignoreCase = true) || nodeDesc.endsWith(" " + text, ignoreCase = true)) {
            return node
        }

        for (i in 0 until node.childCount) {
            val childNode = findNodeWithTextRecursively(text, node.getChild(i))
            if (childNode != null) return childNode
        }
        return null
    }

    private fun clickButtonInSameContainer(textReference: String, buttonText: String): Boolean {
        val root = rootInActiveWindow ?: return false
        val referenceNodes = mutableListOf<AccessibilityNodeInfo>()
        findAllNodesWithTextRecursively(textReference, root, referenceNodes)
        
        for (refNode in referenceNodes) {
            var currentContainer: AccessibilityNodeInfo? = refNode
            // Remonter jusqu'à 15 niveaux pour trouver un conteneur commun (utile pour tablette)
            for (i in 0..15) {
                if (currentContainer == null) break
                
                val btnNode = findNodeWithTextRecursively(buttonText, currentContainer)
                if (btnNode != null) {
                    var clickable: AccessibilityNodeInfo? = btnNode
                    while (clickable != null) {
                        if (clickable.isClickable) {
                            clickable.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                            return true
                        }
                        clickable = clickable.parent
                    }
                }
                currentContainer = currentContainer.parent
            }
        }
        return false
    }

    private fun findAllNodesWithTextRecursively(text: String, node: AccessibilityNodeInfo?, result: MutableList<AccessibilityNodeInfo>) {
        if (node == null) return
        
        val nodeText = node.text?.toString() ?: ""
        val nodeDesc = node.contentDescription?.toString() ?: ""
        
        if (nodeText.equals(text, ignoreCase = true) || nodeText.endsWith(" " + text, ignoreCase = true) || 
            nodeDesc.equals(text, ignoreCase = true) || nodeDesc.endsWith(" " + text, ignoreCase = true)) {
            result.add(node)
        }

        for (i in 0 until node.childCount) {
            findAllNodesWithTextRecursively(text, node.getChild(i), result)
        }
    }

    override fun onInterrupt() {
        Log.e("AutoService", "Service Interrupted")
    }

    override fun onDestroy() {
        super.onDestroy()
        unregisterReceiver(receiver)
    }

    private fun getLabel(key: String, defaultValue: String): String {
        val prefs = getSharedPreferences("AutomatorPrefs", Context.MODE_PRIVATE)
        return prefs.getString(key, defaultValue) ?: defaultValue
    }

    private suspend fun waitUntilTextAppears(text: String, timeoutMs: Long = 5000): Boolean {
        val startTime = System.currentTimeMillis()
        while (System.currentTimeMillis() - startTime < timeoutMs) {
            val root = rootInActiveWindow
            if (root != null) {
                if (findNodeWithTextRecursively(text, root) != null) {
                    return true
                }
            }
            delay(100)
        }
        return false
    }

    private suspend fun waitUntilIdAppears(id: String, timeoutMs: Long = 5000): Boolean {
        val startTime = System.currentTimeMillis()
        while (System.currentTimeMillis() - startTime < timeoutMs) {
            val root = rootInActiveWindow
            if (root != null) {
                val nodes = root.findAccessibilityNodeInfosByViewId(id)
                if (nodes != null && nodes.isNotEmpty()) {
                    return true
                }
            }
            delay(100)
        }
        return false
    }

    private suspend fun startAutomationSequence() {
        isSequenceRunning = true
        
        wakeUpScreenAndUnlock()
        delay(1000)

        val labelMins = getLabel("btn_mins", "mins")
        val labelModifier = getLabel("btn_modifier", "Modifier")
        val labelContinuer = getLabel("btn_continuer", "Continuer")
        val labelAnnuler = getLabel("btn_annuler", "Annuler")
        val labelAccepter = getLabel("btn_accepter", "Accepter la commande")
        val labelCompris = getLabel("btn_compris", "Compris")

        try {
            Journal.log("=== DEBUT DE L'AUTOMATISATION ===")

            // 1. Launch goDroid
            var targetPackage = "com.deliveryhero.rps.restaurantandroidapp"
            val pm = packageManager
            val packages = pm.getInstalledApplications(android.content.pm.PackageManager.GET_META_DATA)
            for (app in packages) {
                val appName = pm.getApplicationLabel(app).toString()
                if (appName.equals("goDroid", ignoreCase = true) || appName.equals("Glovo Partner", ignoreCase = true)) {
                    targetPackage = app.packageName
                    break
                }
            }
            
            kotlinx.coroutines.withContext(Dispatchers.Main) {
                android.widget.Toast.makeText(applicationContext, "GoDroid Automator déclenché !", android.widget.Toast.LENGTH_SHORT).show()
            }

            val currentPackage = rootInActiveWindow?.packageName?.toString()
            if (currentPackage != targetPackage) {
                val launchIntent = packageManager.getLaunchIntentForPackage(targetPackage)
                if (launchIntent != null) {
                    launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    startActivity(launchIntent)
                    Journal.log("Ouverture de l'app: $targetPackage")
                    delay(2000)
                } else {
                    Journal.log("ERREUR: App goDroid introuvable !")
                }
            }

            // 2. Wait until "mins" appears dynamically
            Journal.log("Attente de '$labelMins'...")
            if (waitUntilTextAppears(labelMins, 10000)) {
                Journal.log("Clic sur '$labelMins'")
                clickByText(labelMins)
            } else {
                Journal.log("Attention: '$labelMins' introuvable")
                clickByText(labelMins) // Try anyway
            }

            // 3. Wait until "Modifier" appears (indicates order details loaded)
            Journal.log("Attente de '$labelModifier'...")
            val orderOpened = waitUntilTextAppears(labelModifier, 4000)
            
            if (!orderOpened) {
                Journal.log("La commande ne s'est pas ouverte ! Deuxième essai...")
                clickByText(labelMins)
                if (!waitUntilTextAppears(labelModifier, 4000)) {
                    Journal.log("ERREUR: Impossible d'ouvrir la commande. Annulation pour éviter les erreurs.")
                    returnToNewOrdersTab()
                    return // Stop sequence to avoid sending garbage data
                }
            }
            
            // Wait extra time for the transition animation and list to fully load
            delay(2500)

            // 4. Read full details (Items, Price, Order Num)
            Journal.log("Lecture détails de la commande...")
            
            val prefs = getSharedPreferences("AutomatorPrefs", Context.MODE_PRIVATE)
            val numLeft = prefs.getInt("cropNumLeft", 0)
            val numTop = prefs.getInt("cropNumTop", 0)
            val numRight = prefs.getInt("cropNumRight", 0)
            val numBottom = prefs.getInt("cropNumBottom", 0)
            val rectNum = if (numRight > numLeft && numBottom > numTop) android.graphics.Rect(numLeft, numTop, numRight, numBottom) else null

            val detLeft = prefs.getInt("cropDetLeft", 0)
            val detTop = prefs.getInt("cropDetTop", 0)
            val detRight = prefs.getInt("cropDetRight", 0)
            val detBottom = prefs.getInt("cropDetBottom", 0)
            val rectDet = if (detRight > detLeft && detBottom > detTop) android.graphics.Rect(detLeft, detTop, detRight, detBottom) else null

            var contenuEcran = "{}"
            var useOcr = false
            
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
                Journal.log("Capture d'écran (OCR) en cours...")
                val bitmap = OcrHelper.captureScreenBitmap(this@AutomatorAccessibilityService)
                if (bitmap != null) {
                    useOcr = true
                    Journal.log("Analyse d'image par Intelligence Artificielle...")
                    val fullText = OcrHelper.extractTextFromBitmap(bitmap, null)
                    // We now use the full text for items to avoid the crop rectangle cutting off the top items
                    val textItems = fullText
                    val textNum = OcrHelper.extractTextFromBitmap(bitmap, rectNum)
                    
                    contenuEcran = OrderParser.parseOcrScreen(textItems, textNum, fullText)
                } else {
                    Journal.log("Échec capture d'écran, utilisation méthode classique.")
                }
            } else {
                Journal.log("Android < 11. Utilisation méthode classique.")
            }
            
            if (!useOcr) {
                val nodesList = mutableListOf<Pair<android.graphics.Rect, String>>()
                collectTextNodes(rootInActiveWindow, nodesList, rectNum, rectDet)
                
                // SCROLL DOWN TO READ PAYMENT METHOD & LONG ORDERS
                Journal.log("Défilement vers le bas pour lire la suite...")
                val rootForScroll = rootInActiveWindow
                if (rootForScroll != null) {
                    val scrollableNode = findScrollableNode(rootForScroll)
                    if (scrollableNode != null) {
                        scrollableNode.performAction(4096) // 4096 = ACTION_SCROLL_FORWARD
                    } else {
                        performSwipeUp()
                    }
                }
                delay(1500) // Wait for scroll animation
                
                collectTextNodes(rootInActiveWindow, nodesList, rectNum, rectDet)
                
                // Remove approximate duplicates (same text and similar Y position)
                val distinctNodes = mutableListOf<Pair<android.graphics.Rect, String>>()
                for (node in nodesList) {
                    val isDuplicate = distinctNodes.any { 
                        it.second == node.second && kotlin.math.abs(it.first.top - node.first.top) < 30 
                    }
                    if (!isDuplicate) {
                        distinctNodes.add(node)
                    }
                }
                
                contenuEcran = OrderParser.parseOrderScreen(distinctNodes)
            }
            
            // Log prominently for debugging
            try {
                val jsonResult = org.json.JSONObject(contenuEcran)
                val readId = jsonResult.optString("orderId", "N/A")
                val readItems = jsonResult.optString("rawItemsText", "")
                Journal.log("===========================")
                Journal.log("✅ COMMANDE LUE : $readId")
                Journal.log("---------------------------")
                Journal.log(if (readItems.isNotEmpty()) readItems else "(Aucun détail trouvé)")
                Journal.log("===========================")
            } catch (e: Exception) {
                Journal.log("JSON généré: ${contenuEcran.take(200)}...")
            }

            // NO FAST KDS PUSH: We wait until we have the phone number to send everything at once

            delay(500)

            // 5. Click "Modifier"
            Journal.log("Clic sur '$labelModifier'")
            clickByText(labelModifier)

            // 6. Wait for Checkbox
            Journal.log("Attente Checkbox...")
            if (waitUntilIdAppears("com.deliveryhero.rps.restaurantandroidapp:id/checkbox", 3000)) {
                Journal.log("Clic sur Checkbox")
                clickById("com.deliveryhero.rps.restaurantandroidapp:id/checkbox")
            } else {
                delay(500) // Fallback
            }

            // 7. Click "Continuer"
            Journal.log("Clic sur '$labelContinuer'")
            clickByText(labelContinuer)

            // 8. Wait for QR Code / Phone screen ("Annuler" should appear)
            Journal.log("Attente de '$labelAnnuler'...")
            waitUntilTextAppears(labelAnnuler, 4000)
            
            // Attendre un peu que la page charge complètement le numéro et le nom
            delay(800)

            // 9. Read Phone number from this screen
            Journal.log("Lecture du numéro de téléphone...")
            val telephoneEcran = extractAllText(rootInActiveWindow)
            Journal.log("Extraction num téléphone terminée.")

            // 10. Send the complete order data to Firestore
            Journal.log("Envoi données réseau vers Firestore...")
            NetworkClient.sendOrderData(this@AutomatorAccessibilityService, telephoneEcran, contenuEcran)

            // 11. Click "Annuler"
            Journal.log("Clic sur '$labelAnnuler'")
            clickByText(labelAnnuler)

            // 12. Wait for "Accepter la commande"
            Journal.log("Attente de '$labelAccepter'...")
            waitUntilTextAppears(labelAccepter, 3000)
            Journal.log("Clic sur '$labelAccepter'")
            clickByText(labelAccepter)

            // 13. Wait briefly for "Compris" (Cash payment dialog)
            if (waitUntilTextAppears(labelCompris, 1500)) {
                Journal.log("Alerte Espèces Glovo détectée, clic sur '$labelCompris'")
                clickByText(labelCompris)
            }
            
            delay(500)
            
            // 14. Return to New Orders Tab
            returnToNewOrdersTab()
            delay(500)
            Journal.log("=== AUTOMATISATION TERMINEE ===")
        } catch (e: Exception) {
            Journal.log("ERREUR FATALE: ${e.message}")
            Log.e("AutoService", "Error in sequence", e)
        } finally {
            isSequenceRunning = false
            triggerFallbackVisualCheck()
        }
    }

    private fun clickByText(text: String): Boolean {
        return findAndClickTextRecursively(text, rootInActiveWindow)
    }

    private fun findAndClickTextRecursively(text: String, node: AccessibilityNodeInfo?): Boolean {
        if (node == null) return false
        
        val nodeText = node.text?.toString() ?: ""
        val nodeDesc = node.contentDescription?.toString() ?: ""
        
        if (nodeText.contains(text, ignoreCase = true) || nodeDesc.contains(text, ignoreCase = true)) {
            var clickableNode: AccessibilityNodeInfo? = node
            while (clickableNode != null && !clickableNode.isClickable) {
                clickableNode = clickableNode.parent
            }
            if (clickableNode != null && clickableNode.isClickable) {
                clickableNode.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                return true
            }
        }

        for (i in 0 until node.childCount) {
            if (findAndClickTextRecursively(text, node.getChild(i))) return true
        }
        return false
    }

    private fun clickById(id: String): Boolean {
        val root = rootInActiveWindow ?: return false
        val nodes = root.findAccessibilityNodeInfosByViewId(id)
        for (n in nodes) {
            var clickableNode: AccessibilityNodeInfo? = n
            while (clickableNode != null && !clickableNode.isClickable) {
                clickableNode = clickableNode.parent
            }
            if (clickableNode != null && clickableNode.isClickable) {
                clickableNode.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                return true
            }
        }
        return false
    }

    private fun extractAllText(node: AccessibilityNodeInfo?): String {
        if (node == null) return ""
        val sb = java.lang.StringBuilder()
        val text = node.text?.toString()?.trim()
        if (!text.isNullOrEmpty()) {
            sb.append(text).append("\n")
        }
        val desc = node.contentDescription?.toString()?.trim()
        if (!desc.isNullOrEmpty()) {
            sb.append(desc).append("\n")
        }
        for (i in 0 until node.childCount) {
            sb.append(extractAllText(node.getChild(i)))
        }
        return sb.toString()
    }
    

    
    private fun collectTextNodes(node: AccessibilityNodeInfo?, list: MutableList<Pair<android.graphics.Rect, String>>, rectNum: android.graphics.Rect? = null, rectDet: android.graphics.Rect? = null) {
        if (node == null) return
        
        val rect = android.graphics.Rect()
        node.getBoundsInScreen(rect)
        
        val isInsideCrop = (rectNum == null && rectDet == null) || 
                           (rectNum != null && android.graphics.Rect.intersects(rectNum, rect)) || 
                           (rectDet != null && android.graphics.Rect.intersects(rectDet, rect))
        
        if (isInsideCrop) {
            val text = node.text?.toString()?.trim()
            val desc = node.contentDescription?.toString()?.trim()
            
            if (!text.isNullOrEmpty()) {
                list.add(Pair(rect, text))
            } else if (!desc.isNullOrEmpty()) {
                list.add(Pair(rect, desc))
            }
        }
        
        for (i in 0 until node.childCount) {
            collectTextNodes(node.getChild(i), list, rectNum, rectDet)
        }
    }


    private suspend fun startCancellationCheckSequence() {
        isSequenceRunning = true
        Journal.log("=== VÉRIFICATION DES ANNULATIONS DÉCLENCHÉE ===")
        
        wakeUpScreenAndUnlock()
        delay(1000)

        try {
            // 1. Mark trigger as handled
            NetworkClient.markCancellationTriggerHandled()

            // 2. Launch goDroid
            var targetPackage = "com.deliveryhero.rps.restaurantandroidapp"
            val pm = packageManager
            val packages = pm.getInstalledApplications(android.content.pm.PackageManager.GET_META_DATA)
            for (app in packages) {
                val appName = pm.getApplicationLabel(app).toString()
                if (appName.equals("goDroid", ignoreCase = true) || appName.equals("Glovo Partner", ignoreCase = true)) {
                    targetPackage = app.packageName
                    break
                }
            }

            kotlinx.coroutines.withContext(Dispatchers.Main) {
                android.widget.Toast.makeText(applicationContext, "Vérification Glovo...", android.widget.Toast.LENGTH_LONG).show()
            }

            val launchIntent = packageManager.getLaunchIntentForPackage(targetPackage)
            if (launchIntent != null) {
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                startActivity(launchIntent)
            }
            
            delay(4000)

            // 3. Open Drawer / Menu (usually content desc "Ouvrir le tiroir de navigation" or just 3 lines)
            Journal.log("Ouverture du menu")
            val root = rootInActiveWindow
            if (root != null) {
                if (!clickByText("Ouvrir le tiroir de navigation")) {
                    val drawerNodes = root.findAccessibilityNodeInfosByViewId("com.deliveryhero.rps.restaurantandroidapp:id/toolbar")
                    if (drawerNodes.isNotEmpty()) {
                        val toolbar = drawerNodes[0]
                        if (toolbar.childCount > 0) {
                            val firstChild = toolbar.getChild(0)
                            if (firstChild != null && firstChild.isClickable) {
                                firstChild.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                            }
                        }
                    } else {
                        clickByText("Menu")
                    }
                }
            }
            
            delay(2000)

            // 4. Click "Commandes récentes"
            Journal.log("Clic sur 'Commandes récentes'")
            clickByText("Commandes récentes")
            
            delay(3000)

            // 5. Click on Dropdown "Tout"
            Journal.log("Clic sur le filtre 'Tout' (Dropdown)")
            if (clickByText("Tout") || clickByText("Toutes")) {
                delay(1500)
                
                Journal.log("Lecture du numéro à côté de 'Annulée' dans le Dropdown...")
                val currentRoot = rootInActiveWindow
                var count = 0
                
                if (currentRoot != null) {
                    val screenText = extractAllText(currentRoot)
                    
                    // On cherche "Annulée (X)" ou "Annulées (X)"
                    val regexAnnulee = Regex("Annul[ée]es?\\s*\\(?\\s*([0-9]+)\\s*\\)?", RegexOption.IGNORE_CASE)
                    val matchCmd = regexAnnulee.find(screenText)
                    
                    if (matchCmd != null) {
                        count = matchCmd.groupValues[1].toInt()
                    } else {
                        // S'il n'y a pas de numéro, c'est 0
                        count = 0
                    }
                }
                
                Journal.log("Nombre détecté dans le Dropdown: $count")
                NetworkClient.sendCancelledOrderCount(count)
                delay(1000)
            } else {
                Journal.log("Attention: Filtre 'Tout' introuvable")
                NetworkClient.sendCancelledOrderCount(0)
            }

            // Close the dropdown or go to drawer
            Journal.log("Ouverture du menu (3 barres)")
            // Try to click the 3 bars to close dropdown and open menu
            val rootAfter = rootInActiveWindow
            if (rootAfter != null) {
                if (!clickByText("Ouvrir le tiroir de navigation")) {
                    val drawerNodes = rootAfter.findAccessibilityNodeInfosByViewId("com.deliveryhero.rps.restaurantandroidapp:id/toolbar")
                    if (drawerNodes.isNotEmpty()) {
                        val toolbar = drawerNodes[0]
                        if (toolbar.childCount > 0) {
                            val firstChild = toolbar.getChild(0)
                            if (firstChild != null && firstChild.isClickable) {
                                firstChild.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                            }
                        }
                    } else {
                        // Fallback: Use GLOBAL_ACTION_BACK to close the dropdown
                        performGlobalAction(GLOBAL_ACTION_BACK)
                        delay(1000)
                        clickByText("Ouvrir le tiroir de navigation")
                    }
                }
            }
            delay(2000)
            
            Journal.log("Clic sur 'Aperçu des commandes'")
            clickByText("Aperçu des commandes")
            delay(2000)
            
        } catch (e: Exception) {
            Journal.log("ERREUR: ${"$"}{e.message}")
        } finally {
            isSequenceRunning = false
            Journal.log("=== VÉRIFICATION TERMINÉE ===")
        }
    }

    private suspend fun startRuptureSequence(glovoName: String) {
        isSequenceRunning = true
        try {
            Journal.log("=== DÉBUT SÉQUENCE RUPTURE DE STOCK ===")
            Journal.log("Produit à désactiver: $glovoName")
            
            wakeUpScreenAndUnlock()
            delay(1000)

            // 1. Open app
            var targetPackage = "com.deliveryhero.rps.restaurantandroidapp"
            val pm = packageManager
            val packages = pm.getInstalledApplications(android.content.pm.PackageManager.GET_META_DATA)
            for (app in packages) {
                val appName = pm.getApplicationLabel(app).toString()
                if (appName.equals("goDroid", ignoreCase = true) || appName.equals("Glovo Partner", ignoreCase = true)) {
                    targetPackage = app.packageName
                    break
                }
            }

            kotlinx.coroutines.withContext(Dispatchers.Main) {
                android.widget.Toast.makeText(applicationContext, "Rupture de Stock: $glovoName !", android.widget.Toast.LENGTH_LONG).show()
            }

            val currentPackage = rootInActiveWindow?.packageName?.toString()
            if (currentPackage != targetPackage) {
                val launchIntent = packageManager.getLaunchIntentForPackage(targetPackage)
                if (launchIntent != null) {
                    launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    startActivity(launchIntent)
                    Journal.log("Ouverture de l'app: $targetPackage")
                    delay(1000)
                }
            }

            delay(1500)

            // 2. Open Menu (Drawer) and click "Menu" (for products)
            Journal.log("Ouverture du menu")
            val root = rootInActiveWindow
            if (root != null) {
                if (!clickByText("Ouvrir le tiroir de navigation")) {
                    val drawerNodes = root.findAccessibilityNodeInfosByViewId("com.deliveryhero.rps.restaurantandroidapp:id/toolbar")
                    if (drawerNodes.isNotEmpty()) {
                        val toolbar = drawerNodes[0]
                        if (toolbar.childCount > 0) {
                            val firstChild = toolbar.getChild(0)
                            if (firstChild != null && firstChild.isClickable) {
                                firstChild.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                            }
                        }
                    } else {
                        clickByText("Menu")
                    }
                }
            }
            delay(1000)
            
            Journal.log("Clic sur 'Menu'")
            clickByText("Menu")
            delay(1000)

            // 3. Click the Search icon (Loupe)
            Journal.log("Clic sur l'icône de recherche (Loupe)")
            var searchClicked = false
            
            // Collect all nodes to find anything related to search
            val allNodes = mutableListOf<AccessibilityNodeInfo>()
            fun collectAllNodes(node: AccessibilityNodeInfo?) {
                if (node == null) return
                allNodes.add(node)
                for (i in 0 until node.childCount) {
                    collectAllNodes(node.getChild(i))
                }
            }
            collectAllNodes(rootInActiveWindow)
            
            // Priority 1: Exact matches or well-known search IDs
            for (node in allNodes) {
                val id = node.viewIdResourceName?.toString() ?: ""
                val desc = node.contentDescription?.toString() ?: ""
                val cls = node.className?.toString() ?: ""
                
                if (id.endsWith(":id/action_search") || id.endsWith(":id/search_button") || 
                    desc.equals("Rechercher", ignoreCase = true) || desc.equals("Search", ignoreCase = true)) {
                    
                    var clickableNode: AccessibilityNodeInfo? = node
                    while (clickableNode != null && !clickableNode.isClickable) {
                        clickableNode = clickableNode.parent
                    }
                    if (clickableNode != null && clickableNode.isClickable) {
                        clickableNode.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                        searchClicked = true
                        break
                    } else if (node.isClickable) {
                        node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                        searchClicked = true
                        break
                    }
                }
            }
            
            // Priority 2: Fuzzy matches on ID and Desc
            if (!searchClicked) {
                for (node in allNodes) {
                    val id = node.viewIdResourceName?.toString() ?: ""
                    val desc = node.contentDescription?.toString() ?: ""
                    val cls = node.className?.toString() ?: ""
                    
                    if ((id.contains("search", ignoreCase = true) || desc.contains("search", ignoreCase = true) || desc.contains("recherch", ignoreCase = true))
                        && (cls.contains("Image") || cls.contains("Button") || cls.contains("Text") || cls.contains("Layout"))) {
                        
                        var clickableNode: AccessibilityNodeInfo? = node
                        while (clickableNode != null && !clickableNode.isClickable) {
                            clickableNode = clickableNode.parent
                        }
                        if (clickableNode != null && clickableNode.isClickable) {
                            Journal.log("Loupe trouvée par fallback: $id / $desc")
                            clickableNode.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                            searchClicked = true
                            break
                        }
                    }
                }
            }
            
            // Priority 3: Dispatch gesture tap to the coordinates of an ImageView that might be the search icon
            if (!searchClicked) {
                Journal.log("Dernier recours: Tenter de trouver une loupe sans ID...")
                
                val debugDump = StringBuilder()
                var possibleSearchNode: AccessibilityNodeInfo? = null
                var maxRight = -1
                
                for (node in allNodes) {
                    val id = node.viewIdResourceName?.toString() ?: ""
                    val cls = node.className?.toString() ?: ""
                    
                    if (cls.contains("ImageView") || cls.contains("ImageButton")) {
                        val r = android.graphics.Rect()
                        node.getBoundsInScreen(r)
                        debugDump.append("Class: $cls, ID: $id, Desc: ${node.contentDescription}, Bounds: [${r.left},${r.top},${r.right},${r.bottom}]\n")
                        
                        // We will guess the search icon is the rightmost ImageView in the top half of the screen
                        if (r.top < 600 && r.right > maxRight) {
                            maxRight = r.right
                            possibleSearchNode = node
                        }
                    }
                }
                
                if (possibleSearchNode != null) {
                    var clickableNode: AccessibilityNodeInfo? = possibleSearchNode
                    while (clickableNode != null && !clickableNode.isClickable) {
                        clickableNode = clickableNode.parent
                    }
                    if (clickableNode != null && clickableNode.isClickable) {
                        Journal.log("Guessing search icon at rightmost top ImageView!")
                        clickableNode.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                        searchClicked = true
                    }
                }
                
                // Still didn't work? Try generic text fallback and DUMP to firebase!
                if (!searchClicked) {
                    clickByText("Rechercher")
                    Journal.log("Envoi du dump debug à Firebase pour analyse...")
                    kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.IO).launch {
                        NetworkClient.dumpDebugInfo(debugDump.toString())
                    }
                }
            }
            
            delay(1000)

            // 4. Type the product name
            Journal.log("Saisie du produit: $glovoName")
            val searchBoxNodes = rootInActiveWindow?.findAccessibilityNodeInfosByViewId("com.deliveryhero.rps.restaurantandroidapp:id/search_src_text")
            if (searchBoxNodes != null && searchBoxNodes.isNotEmpty()) {
                val searchBox = searchBoxNodes[0]
                val arguments = android.os.Bundle()
                arguments.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, glovoName)
                searchBox.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments)
                delay(1000)
            } else {
                Journal.log("Erreur: Barre de recherche introuvable")
            }

            // 5. Find the toggle switch for the product and click it
            delay(2000) // Wait for search results
            Journal.log("Désactivation du produit...")
            val resultRoot = rootInActiveWindow
            
            var clickedToggle = false
            if (resultRoot != null) {
                val switches = findNodesByClassName(resultRoot, "android.widget.Switch")
                if (switches.isNotEmpty()) {
                    switches[0].performAction(AccessibilityNodeInfo.ACTION_CLICK)
                    clickedToggle = true
                    Journal.log("Clic sur le switch (android.widget.Switch)")
                } 
                
                // Fallback: Find the product name, and click the rightmost clickable item on its row!
                if (!clickedToggle) {
                    val allResults = mutableListOf<AccessibilityNodeInfo>()
                    fun collectResults(n: AccessibilityNodeInfo?) {
                        if (n == null) return
                        allResults.add(n)
                        for (i in 0 until n.childCount) collectResults(n.getChild(i))
                    }
                    collectResults(resultRoot)

                    // Find the product node manually to avoid findAccessibilityNodeInfosByText bugs
                    var productNode: AccessibilityNodeInfo? = null
                    val cleanGlovoName = glovoName.trim()
                    
                    for (node in allResults) {
                        val txt = node.text?.toString() ?: ""
                        if (txt.contains(cleanGlovoName, ignoreCase = true) && node.className?.toString() == "android.widget.TextView") {
                            productNode = node
                            break
                        }
                    }

                    if (productNode != null) {
                        val productRect = android.graphics.Rect()
                        productNode.getBoundsInScreen(productRect)
                        
                        val clickableItemsOnRow = mutableListOf<AccessibilityNodeInfo>()
                        
                        for (node in allResults) {
                            val r = android.graphics.Rect()
                            node.getBoundsInScreen(r)
                            
                            // Is it on the same horizontal row?
                            val centerY = productRect.centerY()
                            if (r.top <= centerY + 60 && r.bottom >= centerY - 60) {
                                
                                var clickableNode: AccessibilityNodeInfo? = node
                                while (clickableNode != null && !clickableNode.isClickable) {
                                    clickableNode = clickableNode.parent
                                }
                                
                                if (clickableNode != null && clickableNode.isClickable) {
                                    val clickRect = android.graphics.Rect()
                                    clickableNode.getBoundsInScreen(clickRect)
                                    
                                    // Make sure it's to the right of the product text
                                    if (clickRect.left > productRect.right) {
                                        // Avoid adding the exact same node multiple times
                                        if (!clickableItemsOnRow.contains(clickableNode)) {
                                            clickableItemsOnRow.add(clickableNode)
                                        }
                                    }
                                }
                            }
                        }
                        
                        // Sort by X coordinate to order them left-to-right
                        clickableItemsOnRow.sortBy { 
                            val rect = android.graphics.Rect()
                            it.getBoundsInScreen(rect)
                            rect.left 
                        }
                        
                        // The switch is the FIRST item to the right of the text. The arrow is the SECOND item.
                        val bestToggle = clickableItemsOnRow.firstOrNull()
                        
                        if (bestToggle != null) {
                            bestToggle.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                            clickedToggle = true
                            Journal.log("Clic sur la première boutona verte à droite du produit!")
                        }
                    }
                }
                
                if (!clickedToggle) {
                    Journal.log("Aucun Switch trouvé dans les résultats")
                    
                    // Dump to Firebase so we can see what the row actually contains!
                    val debugDump = StringBuilder()
                    val allResults = mutableListOf<AccessibilityNodeInfo>()
                    fun collect(n: AccessibilityNodeInfo?) {
                        if (n == null) return
                        allResults.add(n)
                        for (i in 0 until n.childCount) collect(n.getChild(i))
                    }
                    collect(resultRoot)
                    for (node in allResults) {
                        val id = node.viewIdResourceName?.toString() ?: ""
                        val cls = node.className?.toString() ?: ""
                        val txt = node.text?.toString() ?: ""
                        val r = android.graphics.Rect()
                        node.getBoundsInScreen(r)
                        if (r.width() > 0 && r.height() > 0) {
                            debugDump.append("Class: $cls, ID: $id, Text: $txt, Desc: ${node.contentDescription}, Bounds: [${r.left},${r.top},${r.right},${r.bottom}], Clickable: ${node.isClickable}\n")
                        }
                    }
                    kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.IO).launch {
                        NetworkClient.dumpDebugInfo("SEARCH RESULTS DUMP:\n" + debugDump.toString())
                    }
                }
            }

            delay(1000)
            
            // 6. Click "Indisponible aujourd'hui"
            if (clickedToggle) {
                Journal.log("Clic sur 'Indisponible aujourd'hui'")
                clickByText("Indisponible aujourd'hui")
                delay(1000)
            }

            // 7. Clean up and return
            Journal.log("Retour à l'Aperçu des commandes...")
            // Clear search or close search
            val closeSearchNodes = rootInActiveWindow?.findAccessibilityNodeInfosByViewId("com.deliveryhero.rps.restaurantandroidapp:id/search_close_btn")
            if (closeSearchNodes != null && closeSearchNodes.isNotEmpty()) {
                closeSearchNodes[0].performAction(AccessibilityNodeInfo.ACTION_CLICK)
            }
            delay(500)
            
            // Back out of search screen
            performGlobalAction(GLOBAL_ACTION_BACK)
            delay(500)
            // Back out of menu screen
            performGlobalAction(GLOBAL_ACTION_BACK)
            delay(500)
            
            // Open drawer and go to Aperçu des commandes
            clickByText("Ouvrir le tiroir de navigation")
            delay(500)
            clickByText("Aperçu des commandes")
            delay(1000)

            // Mark as handled
            NetworkClient.markRuptureTriggerHandled()
            Journal.log("=== SÉQUENCE RUPTURE TERMINÉE ===")
            
        } catch (e: Exception) {
            Journal.log("ERREUR RUPTURE: ${e.message}")
        } finally {
            isSequenceRunning = false
        }
    }

    private fun findNodesWithText(node: AccessibilityNodeInfo?, text: String): List<AccessibilityNodeInfo> {
        val result = mutableListOf<AccessibilityNodeInfo>()
        if (node == null) return result
        
        val nodeText = node.text?.toString() ?: ""
        val nodeDesc = node.contentDescription?.toString() ?: ""
        
        if (nodeText.contains(text, ignoreCase = true) || nodeDesc.contains(text, ignoreCase = true)) {
            val rect = android.graphics.Rect()
            node.getBoundsInScreen(rect)
            // Ignore the filter button at the top of the screen
            if (rect.top > 250) {
                result.add(node)
            }
        }
        
        for (i in 0 until node.childCount) {
            result.addAll(findNodesWithText(node.getChild(i), text))
        }
        return result
    }

    private fun findNodesByClassName(node: AccessibilityNodeInfo?, className: String): List<AccessibilityNodeInfo> {
        val result = mutableListOf<AccessibilityNodeInfo>()
        if (node == null) return result
        
        if (node.className?.toString() == className) {
            result.add(node)
        }
        
        for (i in 0 until node.childCount) {
            result.addAll(findNodesByClassName(node.getChild(i), className))
        }
        return result
    }

    private fun findScrollableNode(node: AccessibilityNodeInfo?): AccessibilityNodeInfo? {
        if (node == null) return null
        if (node.isScrollable) return node
        
        for (i in 0 until node.childCount) {
            val result = findScrollableNode(node.getChild(i))
            if (result != null) return result
        }
        return null
    }

    private suspend fun returnToNewOrdersTab() {
        Journal.log("Retour à la page Aperçu des commandes...")
        delay(500)
        performGlobalAction(GLOBAL_ACTION_BACK)
        delay(500)
        
        // Try clicking tabs to ensure we are on the new orders list
        if (clickByText("Aperçu des commandes")) {
            delay(500)
        } else if (clickByText("Nouvelle")) {
            delay(500)
        } else if (clickByText("Aperçu")) {
            delay(500)
        }
    }
}
