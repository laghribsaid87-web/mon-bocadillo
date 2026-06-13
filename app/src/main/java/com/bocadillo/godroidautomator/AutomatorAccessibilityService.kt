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

                        // 2. Normal check for Ready Orders
                        val readyOrders = NetworkClient.checkReadyOrders()
                        for (order in readyOrders) {
                            if (!processedReadyOrders.contains(order.documentId)) {
                                processedReadyOrders.add(order.documentId)
                                sequenceMutex.withLock {
                                    startReadySequence(order.orderNumber, order.documentId)
                                }
                            }
                        }

                        // 3. Check Visually for "mins" on screen (Fallback for missed notifications)
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
                    delay(2000)
                }
            }

            delay(3000)

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
            delay(2000)
            Journal.log("Clic sur 'Aperçu des commandes'")
            clickByText("Aperçu des commandes")
            delay(2000)

            // 2. Click on "Acceptée" tab
            Journal.log("Clic sur l'onglet '$labelAcceptee'")
            clickByText(labelAcceptee)
            delay(2000)

            // 3. Find the order on the screen
            val orderTextToFind = orderNumber.replace("#", "")
            Journal.log("Recherche de la commande $orderTextToFind")
            
            // If we can click the exact order number
            if (clickByText(orderTextToFind)) {
                delay(1500)
                Journal.log("Clic sur '$labelPret' pour $orderTextToFind")
                
                val clickedInSameContainer = clickButtonInSameContainer(orderTextToFind, labelPret)
                if (!clickedInSameContainer) {
                    Journal.log("Bouton non trouvé près de $orderTextToFind, essai par défaut")
                    clickByText(labelPret)
                }
                
                delay(2000)
                
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
                
                delay(2000)
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

            // 2. Wait and Open the new order by clicking its card
            Journal.log("Attente de la nouvelle commande...")
            
            // On cherche le bouton Accepter la commande qui n'apparait que pour les nouvelles commandes
            val foundBtn = waitUntilTextAppears(labelAccepter, 10000)
            if (foundBtn) {
                Journal.log("Nouvelle commande détectée! Tentative d'ouverture...")
                // On cherche le texte "produit" (qui est sur la carte de la commande)
                // Mais pour être sûr de cliquer sur la NOUVELLE commande, on cherche à proximité du bouton Accepter
                var clicked = false
                val root = rootInActiveWindow
                if (root != null) {
                    val referenceNodes = mutableListOf<AccessibilityNodeInfo>()
                    findAllNodesWithTextRecursively(labelAccepter, root, referenceNodes)
                    if (referenceNodes.isNotEmpty()) {
                        val acceptNode = referenceNodes[0]
                        // Remonter de 2 ou 3 niveaux pour avoir la carte entière
                        var cardNode: AccessibilityNodeInfo? = acceptNode
                        for (i in 0..5) {
                            if (cardNode == null) break
                            if (cardNode.isClickable) {
                                cardNode.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                                clicked = true
                                break
                            }
                            cardNode = cardNode.parent
                        }
                        
                        // Si la carte n'est pas cliquable directement, on cherche "produit" dans la même carte
                        if (!clicked) {
                            cardNode = acceptNode
                            for (i in 0..8) {
                                if (cardNode == null) break
                                val prodNode = findNodeWithTextRecursively("produit", cardNode)
                                if (prodNode != null) {
                                    var clickableProd: AccessibilityNodeInfo? = prodNode
                                    while (clickableProd != null) {
                                        if (clickableProd.isClickable) {
                                            clickableProd.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                                            clicked = true
                                            break
                                        }
                                        clickableProd = clickableProd.parent
                                    }
                                }
                                if (clicked) break
                                cardNode = cardNode.parent
                            }
                        }
                    }
                }
                
                if (!clicked) {
                    Journal.log("Attention: Clic sur la carte a échoué. Essai sur 'produit'")
                    clickByText("produit") 
                }
            } else {
                Journal.log("Aucune nouvelle commande avec '$labelAccepter' trouvée.")
                isSequenceRunning = false
                return
            }

            // 3. Wait until the order details are loaded (we check for 'Modifier' or 'Client')
            Journal.log("Attente de l'ouverture de la commande...")
            // On attend que le bouton Modifier apparaisse (il est dans les détails)
            val orderOpened = waitUntilTextAppears(labelModifier, 4000)
            
            if (!orderOpened) {
                Journal.log("La commande ne s'est pas ouverte ! Deuxième essai...")
                clickByText("produit")
                if (!waitUntilTextAppears(labelModifier, 4000)) {
                    Journal.log("ERREUR: Impossible d'ouvrir la commande. Annulation pour éviter les erreurs.")
                    return // Stop sequence to avoid sending garbage data
                }
            }
            
            // Wait extra time for the transition animation and list to fully load
            delay(2000)

            // 4. Read full details (Items, Price, Order Num)
            Journal.log("Lecture détails de la commande...")
            val nodesList = mutableListOf<Pair<android.graphics.Rect, String>>()
            collectTextNodes(rootInActiveWindow, nodesList)
            
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
            
            collectTextNodes(rootInActiveWindow, nodesList)
            
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
            
            val contenuEcran = OrderParser.parseOrderScreen(distinctNodes)
            Journal.log("JSON généré: ${contenuEcran.take(100)}...")

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
            delay(1500)

            // 9. Read Phone number from this screen
            Journal.log("Lecture du numéro de téléphone...")
            val telephoneEcran = extractAllText(rootInActiveWindow)
            Journal.log("Extraction num téléphone terminée.")

            // 10. Send the order data
            Journal.log("Lancement requête HTTP globale...")
            NetworkClient.sendOrderData(this, telephoneEcran, contenuEcran)

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
            
            delay(1000)
            
            // 14. Return to New Orders Tab
            returnToNewOrdersTab()

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
    

    
    private fun collectTextNodes(node: AccessibilityNodeInfo?, list: MutableList<Pair<android.graphics.Rect, String>>) {
        if (node == null) return
        val rect = android.graphics.Rect()
        node.getBoundsInScreen(rect)
        val text = node.text?.toString()?.trim()
        val desc = node.contentDescription?.toString()?.trim()
        
        if (!text.isNullOrEmpty()) {
            list.add(Pair(rect, text))
        } else if (!desc.isNullOrEmpty()) {
            list.add(Pair(rect, desc))
        }
        
        for (i in 0 until node.childCount) {
            collectTextNodes(node.getChild(i), list)
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
        delay(1000)
        performGlobalAction(GLOBAL_ACTION_BACK)
        delay(1000)
        
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
