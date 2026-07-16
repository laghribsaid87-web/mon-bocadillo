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
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.withLock

class AutomatorAccessibilityService : AccessibilityService() {

    private val coroutineScope = CoroutineScope(Dispatchers.Default + SupervisorJob())
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
            } else if (intent?.action == "com.bocadillo.godroidautomator.TEST_READ_ORDER") {
                Journal.log("Broadcast reçu: TEST_READ_ORDER")
                coroutineScope.launch {
                    sequenceMutex.withLock {
                        if (!isSequenceRunning) {
                            testReadSequence()
                        } else {
                            Journal.log("Séquence déjà en cours, test annulé.")
                        }
                    }
                }
            } else if (intent?.action == "com.bocadillo.godroidautomator.SCAN_UI_TREE") {
                Journal.log("Broadcast reçu: SCAN_UI_TREE (Ouverture de Glovo et Scan dans 4s)")
                coroutineScope.launch {
                    val launchIntent = packageManager.getLaunchIntentForPackage("com.deliveryhero.rps.restaurantandroidapp")
                    if (launchIntent != null) {
                        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        startActivity(launchIntent)
                    } else {
                        Journal.log("Glovo introuvable sur l'appareil.")
                    }
                    
                    delay(4000)
                    Journal.log("--- SCAN MANUEL DE L'ÉCRAN (UI TREE) ---")
                    try {
                        dumpNodeTree(rootInActiveWindow, 0)
                    } catch (e: Exception) {
                        Journal.log("Erreur pendant le scan manuel: ${e.message}")
                    }
                    Journal.log("--- FIN DU SCAN MANUEL ---")
                }
            }
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.d("AutoService", "Accessibility Service Connected")
        val filter = IntentFilter()
        filter.addAction("com.bocadillo.godroidautomator.START_SEQUENCE")
        filter.addAction("com.bocadillo.godroidautomator.TEST_READ_ORDER")
        filter.addAction("com.bocadillo.godroidautomator.SCAN_UI_TREE")
        
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
                Journal.log("Échec du dispatch du Swipe Up.")
            }
        } catch (e: Exception) {
            Journal.log("Erreur lors du Swipe Up: ${e.message}")
        }
    }

    private fun performSmallSwipeUp() {
        try {
            val displayMetrics = resources.displayMetrics
            val middleX = displayMetrics.widthPixels / 2f
            val startY = displayMetrics.heightPixels * 0.7f // Commencer en bas (70%)
            val endY = displayMetrics.heightPixels * 0.4f   // Finir au milieu (40%) - Scroll de 30%

            val path = android.graphics.Path()
            path.moveTo(middleX, startY)
            path.lineTo(middleX, endY)

            val gestureBuilder = android.accessibilityservice.GestureDescription.Builder()
            gestureBuilder.addStroke(android.accessibilityservice.GestureDescription.StrokeDescription(path, 0, 500))

            dispatchGesture(gestureBuilder.build(), null, null)
        } catch (e: Exception) {
            Journal.log("Erreur lors du Small Swipe Up: ${e.message}")
        }
    }

    private fun performSystemScrollForward() {
        try {
            val rootForScroll = rootInActiveWindow
            if (rootForScroll != null) {
                val scrollableNode = findScrollableNode(rootForScroll)
                if (scrollableNode != null) {
                    scrollableNode.performAction(android.view.accessibility.AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)
                }
            }
        } catch (e: Exception) {
            Journal.log("Erreur lors du System Scroll Forward: ${e.message}")
        }
    }

    private fun performSwipeDown() {
        try {
            val displayMetrics = resources.displayMetrics
            val middleX = displayMetrics.widthPixels / 2f
            val startY = displayMetrics.heightPixels * 0.2f // Commencer en haut (20%)
            val endY = displayMetrics.heightPixels * 0.8f   // Finir en bas (80%)

            val path = android.graphics.Path()
            path.moveTo(middleX, startY)
            path.lineTo(middleX, endY)

            val gestureBuilder = android.accessibilityservice.GestureDescription.Builder()
            gestureBuilder.addStroke(android.accessibilityservice.GestureDescription.StrokeDescription(path, 0, 500))

            val result = dispatchGesture(gestureBuilder.build(), object : android.accessibilityservice.AccessibilityService.GestureResultCallback() {
                override fun onCompleted(gestureDescription: android.accessibilityservice.GestureDescription?) {
                    super.onCompleted(gestureDescription)
                    Journal.log("Glissement (Swipe Down) réussi.")
                }
                override fun onCancelled(gestureDescription: android.accessibilityservice.GestureDescription?) {
                    super.onCancelled(gestureDescription)
                    Journal.log("Glissement (Swipe Down) annulé.")
                }
            }, null)
            
            if (!result) {
                Journal.log("Impossible de lancer le glissement (Swipe Down).")
            }
        } catch (e: Exception) {
            Journal.log("Erreur lors du Swipe Down: ${e.message}")
        }
    }

    private fun startPollingForReadyOrders() {
        coroutineScope.launch {
            while (true) {
                try {
                    delay(5000) // Poll every 5 seconds
                    if (!sequenceMutex.isLocked && !isSequenceRunning) {
                        
                        // 1. Check for Manual Trigger from POS to verify Cancellations
                        val shouldVerifyCancellations = NetworkClient.checkCancellationTrigger(applicationContext)
                        if (shouldVerifyCancellations) {
                            sequenceMutex.withLock {
                                startCancellationCheckSequence()
                            }
                            continue // skip ready orders check in this tick
                        }
                        // 2. Check for Rupture de Stock trigger from KDS
                        val ruptureTask = NetworkClient.checkRuptureTrigger(applicationContext)
                        if (ruptureTask != null) {
                            sequenceMutex.withLock {
                                startRuptureSequence(ruptureTask.glovoName, ruptureTask.action)
                            }
                            continue
                        }

                        // 3. Normal check for Ready Orders
                        val readyOrders = NetworkClient.checkReadyOrders(applicationContext)
                        for (order in readyOrders) {
                            if (!processedReadyOrders.contains(order.documentId)) {
                                processedReadyOrders.add(order.documentId)
                                sequenceMutex.withLock {
                                    startReadySequence(order.orderNumber, order.documentId)
                                }
                            }
                        }

                        // 4. Check Visually for popups that block the screen
                        checkAndDismissPopups()

                        // 5. Check Visually for "mins" on screen (Fallback for missed notifications)
                        triggerFallbackVisualCheck()
                    }
                } catch (e: Exception) {
                    Log.e("AutoService", "Polling error", e)
                }
            }
        }
    }

    private fun hasNewOrderCard(root: AccessibilityNodeInfo?): Boolean {
        if (root == null) return false
        
        val labelNouvelle = getLabel("btn_nouvelle", "Nouvelle")
        val labelAcceptee = getLabel("btn_acceptee", "Acceptée")
        val labelMin = getLabel("btn_mins", "min")
        val labelProduit = getLabel("btn_produit", "produit")
        val labelHash = getLabel("btn_hash", "#")

        var nouvelleY = -1
        val nouvelleNodes = mutableListOf<AccessibilityNodeInfo>()
        findAllNodesWithTextRecursively(labelNouvelle, root, nouvelleNodes)
        val validNouvelle = nouvelleNodes.firstOrNull { 
            val txt = it.text?.toString() ?: ""
            val desc = it.contentDescription?.toString() ?: ""
            !txt.contains("commande", ignoreCase = true) && !desc.contains("commande", ignoreCase = true) 
        }
        if (validNouvelle != null) {
            val rect = android.graphics.Rect()
            validNouvelle.getBoundsInScreen(rect)
            nouvelleY = rect.bottom
        }
        
        // Si l'onglet/titre "Nouvelle" n'est pas à l'écran, on n'est pas sur le dashboard principal
        if (nouvelleY == -1) {
            return false
        }
        
        var accepteeY = Int.MAX_VALUE
        val accepteeNodes = mutableListOf<AccessibilityNodeInfo>()
        findAllNodesWithTextRecursively(labelAcceptee, root, accepteeNodes)
        if (accepteeNodes.isNotEmpty()) {
            val rect = android.graphics.Rect()
            accepteeNodes.first().getBoundsInScreen(rect)
            accepteeY = rect.top
        }
        
        val clickableNodes = findClickableNodes(root)
        
        for (node in clickableNodes) {
            val rect = android.graphics.Rect()
            node.getBoundsInScreen(rect)
            val centerY = (rect.top + rect.bottom) / 2
            
            if (nouvelleY != -1 && centerY < nouvelleY) continue
            if (centerY > accepteeY) continue
            
            val allTexts = extractAllTextsFromNode(node)
            val hasMin = allTexts.any { it.endsWith(labelMin, ignoreCase = true) || it.contains(labelMin, ignoreCase = true) }
            val hasProduit = allTexts.any { it.contains(labelProduit, ignoreCase = true) }
            val hasHash = allTexts.any { it.startsWith(labelHash) || it.contains(labelHash) }
            
            if (hasMin && hasProduit && hasHash) {
                return true
            }
        }
        return false
    }

    private fun findBannerNode(root: AccessibilityNodeInfo?): AccessibilityNodeInfo? {
        if (root == null) return null
        val labelNouvelleCommande = getLabel("btn_nouvelle_commande", "nouvelle commande")
        val labelAfficher = getLabel("btn_afficher", "Afficher")

        val nodes = mutableListOf<AccessibilityNodeInfo>()
        findAllNodesWithTextRecursively(labelNouvelleCommande, root, nodes)
        
        for (node in nodes) {
            var clickableNode: AccessibilityNodeInfo? = node
            while (clickableNode != null && !clickableNode.isClickable) {
                clickableNode = clickableNode.parent
            }
            if (clickableNode != null && clickableNode.isClickable) {
                val allTexts = extractAllTextsFromNode(clickableNode)
                if (allTexts.any { it.contains(labelAfficher, ignoreCase = true) }) {
                    return clickableNode
                }
            }
        }
        return null
    }

    private fun triggerFallbackVisualCheck() {
        val root = rootInActiveWindow
        if (root != null && !isSequenceRunning) {
            val isBannerPresent = (findBannerNode(root) != null)
            
            if (hasNewOrderCard(root) || isBannerPresent) {
                Journal.log("Suite de commande: Carte ou Bannière détectée ! (Fallback)")
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
            var orderFound = false
            for (i in 0..5) {
                if (clickExactText(orderTextToFind)) {
                    orderFound = true
                    break
                }
                Journal.log("Commande non visible, défilement vers le bas ($i/5)...")
                val rootForScroll = rootInActiveWindow
                if (rootForScroll != null) {
                    val scrollableNode = findScrollableNode(rootForScroll)
                    if (scrollableNode != null) {
                        scrollableNode.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)
                    } else {
                        performSwipeUp()
                    }
                }
                delay(1500)
            }

            if (orderFound) {
                delay(500)
                
                var extractedPin: String? = null
                try {
                    Journal.log("Recherche du code QR pour $orderTextToFind")
                    val clickedQrButton = clickButtonInSameContainer(orderTextToFind, "code QR") || clickButtonInSameContainer(orderTextToFind, "Afficher")
                    if (clickedQrButton) {
                        Journal.log("Popup QR ouvert. Lecture...")
                        delay(1500)
                        
                        val popupText = extractAllText(rootInActiveWindow)
                        val pinRegex = Regex("PIN\\s*:\\s*([a-zA-Z0-9]+)", RegexOption.IGNORE_CASE)
                        val match = pinRegex.find(popupText)
                        if (match != null) {
                            extractedPin = match.groupValues[1]
                            Journal.log("Code PIN extrait : $extractedPin")
                        } else {
                            Journal.log("Aucun code PIN trouvé dans le popup.")
                        }
                        
                        clickByText("Fermer")
                        delay(1000)
                    } else {
                        Journal.log("Bouton QR introuvable pour $orderTextToFind")
                    }
                } catch (e: Exception) {
                    Journal.log("Erreur lors de la lecture du QR: ${e.message}")
                }

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
                NetworkClient.markOrderAsGlovoReady(documentId, extractedPin)
                Journal.log("=== SÉQUENCE PRÊT TERMINÉE ===")
            } else {
                Journal.log("Commande $orderTextToFind introuvable même après défilement.")
                // Mark as handled to prevent endless retries
                NetworkClient.markOrderAsGlovoReady(documentId, null)
            }

        } catch (e: Exception) {
            Journal.log("ERREUR FATALE: ${e.message}")
        } finally {
            returnToNewOrdersTab()
            isSequenceRunning = false
            triggerFallbackVisualCheck()
        }
    }

    private var lastTriggerTime = 0L
    private var lastTreeLogTime = 0L // Jdid: Pour ne pas spammer le log avec l'arbre UI

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        
        // 1. Déclenchement par Notification (Ultra-rapide)
        if (event.eventType == AccessibilityEvent.TYPE_NOTIFICATION_STATE_CHANGED) {
            val packageName = event.packageName?.toString() ?: ""
            if (packageName.contains("deliveryhero", ignoreCase = true) || packageName.contains("glovo", ignoreCase = true)) {
                
                val currentTime = System.currentTimeMillis()
                if (currentTime - lastTriggerTime < 3000) return // Debounce 3 seconds
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
        // 1.5 DUMP UI TREE POUR LE DEBUG GLOVO (Toutes les 15s au changement de page) - DESACTIVE
        // (Le scan manuel via le bouton de l'application reste actif)
        
        // 2. Déclenchement par Visuel (Si l'app est déjà ouverte)
        if (event.eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED || event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            val root = rootInActiveWindow ?: return
            
            val rootPackage = root.packageName?.toString() ?: ""
            if (!rootPackage.contains("deliveryhero", ignoreCase = true) && !rootPackage.contains("glovo", ignoreCase = true)) {
                return
            }
            
            // --- FERMETURE DES POPUPS GLOVO ---
            val welcomePopup = findNodeWithTextRecursively("Bienvenue dans la nouvelle version", root, true)
            val attentePopup = findNodeWithTextRecursively("commande en attente", root, true)
            
            if (welcomePopup != null || attentePopup != null) {
                val currentTime = System.currentTimeMillis()
                if (currentTime - lastTriggerTime > 2000) {
                    lastTriggerTime = currentTime
                    val popupName = if (welcomePopup != null) "Nouvelle version" else "Commande en attente"
                    Journal.log("Popup '$popupName' détecté ! Fermeture automatique...")
                    performGlobalAction(GLOBAL_ACTION_BACK)
                }
                return
            }

            val labelMins = getLabel("btn_mins", "min")
            val labelNouvelle = getLabel("btn_nouvelle_commande", "nouvelle commande")
            
            if (isSequenceRunning) return
            
            val currentTime = System.currentTimeMillis()
            if (currentTime - lastTriggerTime < 3000) return // Debounce 3 seconds
            
            val nodeMins = findNodeWithTextRecursively(labelMins, root)
            val nodeNouvelle = findNodeWithTextRecursively(labelNouvelle, root)
            
            if ((nodeMins != null && isNodeClickable(nodeMins)) || (nodeNouvelle != null && isNodeClickable(nodeNouvelle))) {
                Journal.log("Détection visuelle (Carré vert ou Nouvelle commande)")
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

    private fun clickCenterOfScreen() {
        try {
            val displayMetrics = resources.displayMetrics
            val middleX = displayMetrics.widthPixels / 2f
            val middleY = displayMetrics.heightPixels / 2f

            val path = android.graphics.Path()
            path.moveTo(middleX, middleY)
            
            val gestureBuilder = android.accessibilityservice.GestureDescription.Builder()
            gestureBuilder.addStroke(android.accessibilityservice.GestureDescription.StrokeDescription(path, 0, 100))

            dispatchGesture(gestureBuilder.build(), null, null)
            Journal.log("Clic physique au centre de l'écran (pour fermer Popup).")
        } catch (e: Exception) {
            Log.e("GoDroidUI", "Error click center", e)
        }
    }

    private fun checkAndDismissPopups() {
        try {
            val root = rootInActiveWindow ?: return
            val text = extractAllText(root)
            
            // Handle the full-screen green popup: "Vous avez X nouvelle commande en attente !"
            if (text.contains("nouvelle commande en attente", ignoreCase = true)) {
                Journal.log("Popup plein écran détecté. Clic au milieu...")
                
                // Le client indique qu'il FAUT cliquer au milieu de l'écran
                clickCenterOfScreen()
                
                // Essayer aussi de cliquer sur le texte ou fermer par sécurité
                clickByText("nouvelle commande en attente") 
                clickByText("Commencez à accepter")
                clickByText("Fermer") || clickByText("X")
                
                performGlobalAction(GLOBAL_ACTION_BACK)
                
                Thread.sleep(1000)
            }
        } catch (e: Exception) {
            Log.e("GoDroidUI", "Error dismissing popups", e)
        }
    }

    private fun findClickableNodes(node: AccessibilityNodeInfo?): List<AccessibilityNodeInfo> {
        val list = mutableListOf<AccessibilityNodeInfo>()
        if (node == null) return list
        if (node.isClickable) {
            list.add(node)
        }
        for (i in 0 until node.childCount) {
            list.addAll(findClickableNodes(node.getChild(i)))
        }
        return list
    }

    private fun isNodeClickable(node: AccessibilityNodeInfo?): Boolean {
        var current = node
        while (current != null) {
            if (current.isClickable) return true
            current = current.parent
        }
        return false
    }

    private fun findNodeWithTextRecursively(text: String, node: AccessibilityNodeInfo?, containsMode: Boolean = false): AccessibilityNodeInfo? {
        if (node == null) return null
        
        val nodeText = node.text?.toString() ?: ""
        val nodeDesc = node.contentDescription?.toString() ?: ""
        
        // Exact match, ends with, or contains for specific banners
        if (containsMode) {
            if (nodeText.contains(text, ignoreCase = true) || nodeDesc.contains(text, ignoreCase = true)) {
                return node
            }
        } else {
            if (nodeText.equals(text, ignoreCase = true) || nodeText.endsWith(" " + text, ignoreCase = true) || (text.equals("nouvelle commande", ignoreCase = true) && nodeText.contains(text, ignoreCase = true) && !nodeText.contains("aucune", ignoreCase = true)) ||
                nodeDesc.equals(text, ignoreCase = true) || nodeDesc.endsWith(" " + text, ignoreCase = true) || (text.equals("nouvelle commande", ignoreCase = true) && nodeDesc.contains(text, ignoreCase = true) && !nodeDesc.contains("aucune", ignoreCase = true))) {
                return node
            }
        }

        for (i in 0 until node.childCount) {
            val childNode = findNodeWithTextRecursively(text, node.getChild(i), containsMode)
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

    private fun clickExactText(text: String): Boolean {
        val root = rootInActiveWindow ?: return false
        val nodes = mutableListOf<AccessibilityNodeInfo>()
        findAllNodesWithTextRecursively(text, root, nodes)
        
        for (node in nodes) {
            var clickableNode: AccessibilityNodeInfo? = node
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

    private fun findAllNodesWithTextRecursively(text: String, node: AccessibilityNodeInfo?, result: MutableList<AccessibilityNodeInfo>) {
        if (node == null) return
        
        val nodeText = node.text?.toString() ?: ""
        val nodeDesc = node.contentDescription?.toString() ?: ""
        
        val cleanNodeText = nodeText.replace("#", "").trim()
        val cleanDesc = nodeDesc.replace("#", "").trim()
        val cleanText = text.replace("#", "").trim()
        
        if (cleanNodeText.equals(cleanText, ignoreCase = true) || cleanNodeText.endsWith(" " + cleanText, ignoreCase = true) || (cleanText.equals("nouvelle commande", ignoreCase = true) && cleanNodeText.contains(cleanText, ignoreCase = true) && !cleanNodeText.contains("aucune", ignoreCase = true)) ||
            cleanDesc.equals(cleanText, ignoreCase = true) || cleanDesc.endsWith(" " + cleanText, ignoreCase = true) || (cleanText.equals("nouvelle commande", ignoreCase = true) && cleanDesc.contains(cleanText, ignoreCase = true) && !cleanDesc.contains("aucune", ignoreCase = true))) {
            result.add(node)
        }

        for (i in 0 until node.childCount) {
            findAllNodesWithTextRecursively(text, node.getChild(i), result)
        }
    }

    override fun onInterrupt() {
        Log.e("AutoService", "Service Interrupted")
    }

    private fun extractAllTextsFromNode(node: AccessibilityNodeInfo?): List<String> {
        val list = mutableListOf<String>()
        if (node == null) return list
        if (node.text != null) list.add(node.text.toString())
        if (node.contentDescription != null) list.add(node.contentDescription.toString())
        for (i in 0 until node.childCount) {
            list.addAll(extractAllTextsFromNode(node.getChild(i)))
        }
        return list
    }

    private fun findAndClickNewOrderCard(root: AccessibilityNodeInfo?): Boolean {
        if (root == null) return false
        
        val labelNouvelle = getLabel("btn_nouvelle", "Nouvelle")
        val labelAcceptee = getLabel("btn_acceptee", "Acceptée")
        val labelMin = getLabel("btn_mins", "min")
        val labelProduit = getLabel("btn_produit", "produit")
        val labelHash = getLabel("btn_hash", "#")

        var nouvelleY = -1
        val nouvelleNodes = mutableListOf<AccessibilityNodeInfo>()
        findAllNodesWithTextRecursively(labelNouvelle, root, nouvelleNodes)
        // Ignorer les bannières 'nouvelle commande' pour se concentrer sur l'onglet/titre
        val validNouvelle = nouvelleNodes.firstOrNull { 
            val txt = it.text?.toString() ?: ""
            val desc = it.contentDescription?.toString() ?: ""
            !txt.contains("commande", ignoreCase = true) && !desc.contains("commande", ignoreCase = true) 
        }
        if (validNouvelle != null) {
            val rect = android.graphics.Rect()
            validNouvelle.getBoundsInScreen(rect)
            nouvelleY = rect.bottom
        }
        
        // Si l'onglet/titre "Nouvelle" n'est pas à l'écran, on n'est pas sur le dashboard principal
        if (nouvelleY == -1) {
            return false
        }
        
        var accepteeY = Int.MAX_VALUE
        val accepteeNodes = mutableListOf<AccessibilityNodeInfo>()
        findAllNodesWithTextRecursively(labelAcceptee, root, accepteeNodes)
        if (accepteeNodes.isNotEmpty()) {
            val rect = android.graphics.Rect()
            accepteeNodes.first().getBoundsInScreen(rect)
            accepteeY = rect.top
        }
        
        val clickableNodes = findClickableNodes(root)
        
        for (node in clickableNodes) {
            val rect = android.graphics.Rect()
            node.getBoundsInScreen(rect)
            val centerY = (rect.top + rect.bottom) / 2
            
            // Doit être sous 'Nouvelle' et au-dessus de 'Acceptée'
            if (nouvelleY != -1 && centerY < nouvelleY) continue
            if (centerY > accepteeY) continue
            
            val allTexts = extractAllTextsFromNode(node)
            val hasMin = allTexts.any { it.endsWith(labelMin, ignoreCase = true) || it.contains(labelMin, ignoreCase = true) }
            val hasProduit = allTexts.any { it.contains(labelProduit, ignoreCase = true) }
            val hasHash = allTexts.any { it.startsWith(labelHash) || it.contains(labelHash) }
            
            if (hasMin && hasProduit && hasHash) {
                Journal.log("Carte de commande intelligente détectée ! Clic en cours...")
                node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                return true
            }
        }
        return false
    }

    override fun onDestroy() {
        super.onDestroy()
        unregisterReceiver(receiver)
        coroutineScope.cancel()
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

        val labelMins = getLabel("btn_mins", "min")
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
                // Toast supprimé pour ne pas cacher le texte lors de la capture d'écran OCR
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

            // 2. Wait until "min", "nouvelle commande" or "Nouvelle" appears
            val labelNouvelle = getLabel("btn_nouvelle_commande", "nouvelle commande")
            val labelNouvelleTab = getLabel("btn_nouvelle", "Nouvelle")
            Journal.log("Attente de '$labelMins', '$labelNouvelle' ou onglet '$labelNouvelleTab'...")
            
            var clickedBanner = false
            var cardFound = false
            for (i in 0..20) {
                // Smart detection pour la nouvelle mise à jour (ex: "9 min" dans un carré vert) en PREMIER !
                try {
                    if (findAndClickNewOrderCard(rootInActiveWindow)) {
                        cardFound = true
                        break
                    }
                } catch (e: Exception) {
                    Journal.log("Erreur dans findAndClickNewOrderCard: ${e.message}")
                }

                val bannerNode = findBannerNode(rootInActiveWindow)
                if (!clickedBanner && bannerNode != null) {
                    Journal.log("Clic sur la bannière 'nouvelle commande'")
                    bannerNode.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                    clickedBanner = true
                    // On ne fait pas de break ici ! On continue d'attendre l'apparition du carré vert.
                }
                
                if (findNodeWithTextRecursively(labelMins, rootInActiveWindow) != null) {
                    Journal.log("Clic sur '$labelMins'")
                    if (clickByText(labelMins)) {
                        cardFound = true
                        break
                    }
                }
                
                delay(500)
            }
            
            // Si après 10 secondes on n'a toujours rien trouvé, on tente l'onglet "Nouvelle" en dernier recours
            if (!cardFound) {
                val root = rootInActiveWindow
                if (root != null) {
                    val nodes = mutableListOf<AccessibilityNodeInfo>()
                    findAllNodesWithTextRecursively(labelNouvelleTab, root, nodes)
                    val validTabNodes = nodes.filter { !(it.text?.toString() ?: "").contains("commande", ignoreCase = true) && !(it.contentDescription?.toString() ?: "").contains("commande", ignoreCase = true) }
                    if (validTabNodes.isNotEmpty()) {
                        Journal.log("Clic sur l'onglet '$labelNouvelleTab' (Dernier recours)")
                        validTabNodes.first().performAction(AccessibilityNodeInfo.ACTION_CLICK)
                        delay(1000)
                        try {
                            if (!findAndClickNewOrderCard(rootInActiveWindow)) {
                                if (waitUntilTextAppears(labelMins, 3000)) {
                                    clickByText(labelMins)
                                }
                            }
                        } catch (e: Exception) {
                            Journal.log("Erreur dans findAndClickNewOrderCard: ${e.message}")
                        }
                    }
                }
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
            
            Journal.log("Utilisation de la méthode classique (Lecture de l'écran).")
            
            if (!useOcr) {
                var accumulatedNodes = mutableListOf<Pair<android.graphics.Rect, String>>()
                collectTextNodes(rootInActiveWindow, accumulatedNodes, rectNum, rectDet)
                
                // SCROLL DOWN TO READ PAYMENT METHOD & LONG ORDERS
                var scrollAttempts = 0
                while (scrollAttempts < 3) {
                    Journal.log("Petit défilement vers le bas pour lire la suite... (Tentative ${scrollAttempts + 1}/3)")
                    performSystemScrollForward()
                    delay(1500) // Wait for scroll animation
                    
                    val newNodes = mutableListOf<Pair<android.graphics.Rect, String>>()
                    collectTextNodes(rootInActiveWindow, newNodes, rectNum, rectDet)
                    
                    val accStrings = accumulatedNodes.map { it.second }
                    val newStrings = newNodes.map { it.second }
                    
                    // 1. Find the sticky header (longest common prefix)
                    var commonPrefixLen = 0
                    val minLen = Math.min(accStrings.size, newStrings.size)
                    for (i in 0 until minLen) {
                        if (accStrings[i] == newStrings[i]) {
                            commonPrefixLen++
                        } else {
                            break
                        }
                    }
                    
                    if (commonPrefixLen == newStrings.size) {
                        Journal.log("Fin de la liste atteinte (aucun nouvel élément).")
                        break
                    }
                    
                    // 2. Find the floating footer (longest common suffix)
                    var commonSuffixLen = 0
                    for (i in 0 until (minLen - commonPrefixLen)) {
                        if (accStrings[accStrings.size - 1 - i] == newStrings[newStrings.size - 1 - i]) {
                            commonSuffixLen++
                        } else {
                            break
                        }
                    }
                    
                    // 3. Extract the core scrolling content
                    val coreAccNodes = accumulatedNodes.subList(0, accumulatedNodes.size - commonSuffixLen)
                    val coreAccStrings = coreAccNodes.map { it.second }
                    
                    val coreNewNodes = newNodes.subList(commonPrefixLen, newNodes.size - commonSuffixLen)
                    val coreNewStrings = coreNewNodes.map { it.second }
                    
                    // 4. Find max overlap in the core content
                    var maxOverlap = 0
                    val minCoreLen = Math.min(coreAccStrings.size, coreNewStrings.size)
                    for (i in 1..minCoreLen) {
                        val suffix = coreAccStrings.subList(coreAccStrings.size - i, coreAccStrings.size)
                        val prefix = coreNewStrings.subList(0, i)
                        if (suffix == prefix) {
                            maxOverlap = i
                        }
                    }
                    
                    // 5. Merge safely
                    val footerNodes = accumulatedNodes.subList(accumulatedNodes.size - commonSuffixLen, accumulatedNodes.size)
                    val newAccumulated = mutableListOf<Pair<android.graphics.Rect, String>>()
                    newAccumulated.addAll(coreAccNodes)
                    newAccumulated.addAll(coreNewNodes.subList(maxOverlap, coreNewNodes.size))
                    newAccumulated.addAll(footerNodes)
                    
                    accumulatedNodes = newAccumulated
                    
                    scrollAttempts++
                }
                
                contenuEcran = OrderParser.parseOrderScreen(accumulatedNodes)
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

            // 5. Click "Modifier" or new layout "Besoin d'aide"
            Journal.log("Tentative de clic sur '$labelModifier'...")
            if (clickByText(labelModifier)) {
                Journal.log("Clic sur '$labelModifier' réussi (Ancien Layout)")
                
                // 6. Wait for Checkbox
                Journal.log("Attente Checkbox...")
                if (waitUntilIdAppears("com.deliveryhero.rps.restaurantandroidapp:id/checkbox", 3000)) {
                    Journal.log("Clic sur Checkbox")
                    clickById("com.deliveryhero.rps.restaurantandroidapp:id/checkbox")
                } else {
                    delay(500) // Fallback
                }
            } else {
                Journal.log("Bouton '$labelModifier' introuvable. Essai du Nouveau Layout (Besoin d'aide)...")
                if (clickByText("Besoin d'aide avec cette commande")) {
                    Journal.log("Clic sur 'Besoin d'aide avec cette commande' réussi")
                    delay(1000)
                    
                    val labelProduitNonDispo = "Produit non disponible"
                    Journal.log("Attente de '$labelProduitNonDispo'...")
                    if (waitUntilTextAppears(labelProduitNonDispo, 3000)) {
                        Journal.log("Clic sur '$labelProduitNonDispo'")
                        clickByText(labelProduitNonDispo)
                        delay(1000)
                        
                        // Wait for Checkbox
                        Journal.log("Attente Checkbox...")
                        if (waitUntilIdAppears("com.deliveryhero.rps.restaurantandroidapp:id/checkbox", 3000)) {
                            Journal.log("Clic sur Checkbox")
                            clickById("com.deliveryhero.rps.restaurantandroidapp:id/checkbox")
                        } else {
                            delay(500) // Fallback
                        }
                    } else {
                        Journal.log("Option '$labelProduitNonDispo' introuvable.")
                    }
                } else {
                    Journal.log("Aucun des deux boutons (Modifier / Besoin d'aide) n'a été trouvé.")
                }
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
            
            delay(500)
            Journal.log("=== AUTOMATISATION TERMINEE ===")
        } catch (e: Exception) {
            Journal.log("ERREUR FATALE: ${e.message}")
            Log.e("AutoService", "Error in sequence", e)
        } finally {
            returnToNewOrdersTab()
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


    private suspend fun testReadSequence() {
        isSequenceRunning = true
        Journal.log("=== DÉBUT TEST LECTURE COMMANDE ===")
        
        wakeUpScreenAndUnlock()
        delay(1000)

        try {
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
                // Toast supprimé car il cachait le texte lors de la capture d'écran OCR
            }

            val currentPackage = rootInActiveWindow?.packageName?.toString()
            if (currentPackage != targetPackage) {
                val launchIntent = packageManager.getLaunchIntentForPackage(targetPackage)
                if (launchIntent != null) {
                    launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    startActivity(launchIntent)
                    Journal.log("Ouverture de l'app: $targetPackage")
                    // Increased delay for PC Emulators (LDPlayer) to fully load
                    delay(2000)
                }
            }
            
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
            
            Journal.log("Utilisation de la méthode classique (Lecture de l'écran).")
            
            if (!useOcr) {
                // --- SMART SCROLL HIDING (ONCE) ---
                Journal.log("Recherche du premier produit pour le Smart Scroll...")
                val initialNodes = mutableListOf<Pair<android.graphics.Rect, String>>()
                collectTextNodes(rootInActiveWindow, initialNodes, rectNum, rectDet)
                
                val quantityRegex = Regex("^(?i)[^a-zA-Z0-9]*(?:\\d+[ \\t\\xA0]*)?[xX×](?:[ \\t\\xA0]+|$)")
                val pureNumberRegex = Regex("^\\d+$")
                var firstItemY = -1
                
                for (node in initialNodes) {
                    val text = node.second
                    if (firstItemY == -1 && (quantityRegex.containsMatchIn(text) || pureNumberRegex.matches(text))) {
                        firstItemY = node.first.top
                    }
                }
                
                if (firstItemY != -1) {
                    val displayMetrics = resources.displayMetrics
                    val screenHeight = displayMetrics.heightPixels
                    val screenWidth = displayMetrics.widthPixels
                    
                    val targetY = 300
                    
                    if (firstItemY > targetY + 20) {
                        val distanceToScroll = firstItemY - targetY
                        
                        // 1. Find the scrollable node so we don't accidentally swipe on a floating button
                        var scrollNode: AccessibilityNodeInfo? = null
                        val queue = java.util.LinkedList<AccessibilityNodeInfo>()
                        rootInActiveWindow?.let { queue.add(it) }
                        while (queue.isNotEmpty()) {
                            val n = queue.poll()
                            if (n != null) {
                                if (n.isScrollable) {
                                    scrollNode = n
                                    break
                                }
                                for (i in 0 until n.childCount) {
                                    n.getChild(i)?.let { queue.add(it) }
                                }
                            }
                        }
                        
                        val bounds = android.graphics.Rect()
                        if (scrollNode != null) {
                            scrollNode.getBoundsInScreen(bounds)
                        } else {
                            rootInActiveWindow?.getBoundsInScreen(bounds)
                        }
                        
                        // 2. Add 30 pixels to overcome Android's TouchSlop (which absorbs initial finger movement)
                        val actualSwipeDistance = distanceToScroll + 30
                        Journal.log("Smart Scroll: Remontée de $distanceToScroll px (Swipe = $actualSwipeDistance px).")
                        
                        val path = android.graphics.Path()
                        val startX = bounds.centerX().toFloat()
                        
                        // Center the swipe inside the bounds
                        var startY = bounds.centerY().toFloat() + (actualSwipeDistance / 2f)
                        if (startY > bounds.bottom - 20f) startY = bounds.bottom - 20f.toFloat()
                        
                        var endY = startY - actualSwipeDistance
                        if (endY < bounds.top + 20f) endY = bounds.top + 20f.toFloat()
                        
                        path.moveTo(startX, startY)
                        path.lineTo(startX, endY)
                        
                        val gesture = android.accessibilityservice.GestureDescription.Builder()
                            .addStroke(android.accessibilityservice.GestureDescription.StrokeDescription(path, 0, 400))
                            .build()
                        
                        dispatchGesture(gesture, null, null)
                        delay(800) // Wait for UI to settle (reduced per user request)
                    } else {
                        Journal.log("Smart Scroll ignoré: Le produit est déjà assez haut.")
                    }
                } else {
                    Journal.log("Smart Scroll ignoré: Aucun produit trouvé.")
                }
                // --- FIN SMART SCROLL ---
                
                var accumulatedNodes = mutableListOf<Pair<android.graphics.Rect, String>>()
                collectTextNodes(rootInActiveWindow, accumulatedNodes, rectNum, rectDet)
                
                // Sort nodes for the first screen
                accumulatedNodes.sortWith(Comparator { a, b ->
                    val yDiff = a.first.top - b.first.top
                    if (kotlin.math.abs(yDiff) < 20) a.first.left.compareTo(b.first.left) else yDiff.compareTo(0)
                })
                
                val displayMetrics = resources.displayMetrics
                val screenHeight = displayMetrics.heightPixels
                
                var scrollAttempts = 0
                while (scrollAttempts < 3) {
                    
                    Journal.log("Commande longue: Défilement pour lire la suite... (Tentative ${scrollAttempts + 1}/3)")
                    
                    val scrollDistance = (screenHeight * 0.45).toInt()
                    
                    var scrollNode: AccessibilityNodeInfo? = null
                    val queue = java.util.LinkedList<AccessibilityNodeInfo>()
                    rootInActiveWindow?.let { queue.add(it) }
                    while (queue.isNotEmpty()) {
                        val n = queue.poll()
                        if (n != null) {
                            if (n.isScrollable) {
                                scrollNode = n
                                break
                            }
                            for (i in 0 until n.childCount) {
                                n.getChild(i)?.let { queue.add(it) }
                            }
                        }
                    }
                    
                    val bounds = android.graphics.Rect()
                    if (scrollNode != null) scrollNode.getBoundsInScreen(bounds)
                    else rootInActiveWindow?.getBoundsInScreen(bounds)
                    
                    val actualSwipeDistance = scrollDistance + 30
                    val path = android.graphics.Path()
                    val startX = bounds.centerX().toFloat()
                    var startY = bounds.centerY().toFloat() + (actualSwipeDistance / 2f)
                    if (startY > bounds.bottom - 20f) startY = bounds.bottom - 20f.toFloat()
                    var endY = startY - actualSwipeDistance
                    if (endY < bounds.top + 20f) endY = bounds.top + 20f.toFloat()
                    
                    path.moveTo(startX, startY)
                    path.lineTo(startX, endY)
                    
                    val gesture = android.accessibilityservice.GestureDescription.Builder()
                        .addStroke(android.accessibilityservice.GestureDescription.StrokeDescription(path, 0, 400))
                        .build()
                    
                    dispatchGesture(gesture, null, null)
                    delay(800) // Wait for UI to settle (reduced per user request)
                    
                    val newNodes = mutableListOf<Pair<android.graphics.Rect, String>>()
                    collectTextNodes(rootInActiveWindow, newNodes, rectNum, rectDet)
                    
                    // Sort nodes for the new screen
                    newNodes.sortWith(Comparator { a, b ->
                        val yDiff = a.first.top - b.first.top
                        if (kotlin.math.abs(yDiff) < 20) a.first.left.compareTo(b.first.left) else yDiff.compareTo(0)
                    })
                    
                    val accStrings = accumulatedNodes.map { it.second }
                    val newStrings = newNodes.map { it.second }
                    
                    var commonPrefixLen = 0
                    val minLen = Math.min(accStrings.size, newStrings.size)
                    for (i in 0 until minLen) {
                        if (accStrings[i] == newStrings[i]) commonPrefixLen++ else break
                    }
                    
                    if (commonPrefixLen == newStrings.size) {
                        Journal.log("Fin de la liste atteinte (aucun nouvel élément).")
                        break
                    }
                    
                    var commonSuffixLen = 0
                    for (i in 0 until (minLen - commonPrefixLen)) {
                        if (accStrings[accStrings.size - 1 - i] == newStrings[newStrings.size - 1 - i]) commonSuffixLen++ else break
                    }
                    
                    val coreAccNodes = accumulatedNodes.subList(0, accumulatedNodes.size - commonSuffixLen)
                    val coreAccStrings = coreAccNodes.map { it.second }
                    
                    val coreNewNodes = newNodes.subList(commonPrefixLen, newNodes.size - commonSuffixLen)
                    val coreNewStrings = coreNewNodes.map { it.second }
                    
                    var maxOverlap = 0
                    val minCoreLen = Math.min(coreAccStrings.size, coreNewStrings.size)
                    for (i in 1..minCoreLen) {
                        val suffix = coreAccStrings.subList(coreAccStrings.size - i, coreAccStrings.size)
                        val prefix = coreNewStrings.subList(0, i)
                        if (suffix == prefix) maxOverlap = i
                    }
                    
                    val footerNodes = accumulatedNodes.subList(accumulatedNodes.size - commonSuffixLen, accumulatedNodes.size)
                    val newAccumulated = mutableListOf<Pair<android.graphics.Rect, String>>()
                    newAccumulated.addAll(coreAccNodes)
                    newAccumulated.addAll(coreNewNodes.subList(maxOverlap, coreNewNodes.size))
                    newAccumulated.addAll(footerNodes)
                    
                    accumulatedNodes = newAccumulated
                    scrollAttempts++
                }
                
                contenuEcran = OrderParser.parseOrderScreen(accumulatedNodes)
            }
            
            try {
                val jsonResult = org.json.JSONObject(contenuEcran)
                var readId = jsonResult.optString("orderId", "N/A")
                
                // Add TEST- prefix to avoid backend duplicate filtering
                if (!readId.startsWith("TEST-")) {
                    readId = "TEST-$readId"
                    jsonResult.put("orderId", readId)
                    contenuEcran = jsonResult.toString()
                }
                
                val readItems = jsonResult.optString("rawItemsText", "")
                Journal.log("===========================")
                Journal.log("✅ TEST COMMANDE LUE : $readId")
                Journal.log("---------------------------")
                Journal.log(if (readItems.isNotEmpty()) readItems else "(Aucun détail trouvé)")
                Journal.log("===========================")
            } catch (e: Exception) {
                Journal.log("JSON généré: ${contenuEcran.take(200)}...")
            }

            NetworkClient.sendOrderData(this@AutomatorAccessibilityService, "0600000000", contenuEcran)
            Journal.log("✅ Commande de test envoyée à KDS.")

        } catch (e: Exception) {
            Journal.log("ERREUR TEST: ${e.message}")
        } finally {
            isSequenceRunning = false
        }
    }

    private suspend fun startCancellationCheckSequence() {
        isSequenceRunning = true
        Journal.log("=== VÉRIFICATION DES ANNULATIONS DÉCLENCHÉE ===")
        
        wakeUpScreenAndUnlock()
        delay(1000)

        try {
            // 1. Mark trigger as handled
            NetworkClient.markCancellationTriggerHandled(applicationContext)

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
            // Click on Aperçu des commandes is moved to finally
        } catch (e: Exception) {
            Journal.log("ERREUR: ${"$"}{e.message}")
        } finally {
            returnToNewOrdersTab()
            isSequenceRunning = false
            Journal.log("=== VÉRIFICATION TERMINÉE ===")
        }
    }

    private suspend fun startRuptureSequence(glovoName: String, action: String = "rupture") {
        isSequenceRunning = true
        
        wakeUpScreenAndUnlock()
        delay(1000)

        try {
            Journal.log("=== DÉBUT SÉQUENCE RUPTURE DE STOCK ===")
            if (action.equals("disponible", ignoreCase = true) || action.equals("activer", ignoreCase = true)) {
                Journal.log("Produit à activer: $glovoName")
            } else {
                Journal.log("Produit à désactiver: $glovoName")
            }

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
            
            // 6. Handle Deactivation Popups
            if (clickedToggle) {
                if (action.equals("disponible", ignoreCase = true) || action.equals("activer", ignoreCase = true)) {
                    Journal.log("Produit réactivé avec succès (Pas de popup).")
                    delay(500)
                } else {
                    Journal.log("Attente de la popup de durée de désactivation...")
                    delay(1500)
                    Journal.log("Clic sur 'Jusqu'à ce que je réactive'")
                    clickByText("Jusqu'à ce que je réactive")
                    delay(1000)
                    Journal.log("Clic sur 'Passer indisponible'")
                    clickByText("Passer indisponible")
                    delay(1000)
                }
            }

            // 7. Navigation de retour demandée (1 Back -> 3 tirets -> Aperçu)
            Journal.log("Bouton retour Android (1 fois)...")
            performGlobalAction(GLOBAL_ACTION_BACK)
            delay(1000)

            Journal.log("Clic sur les 3 tirets (Tiroir de navigation)...")
            if (!clickByText("Ouvrir le tiroir de navigation")) {
                val drawerNodes = rootInActiveWindow?.findAccessibilityNodeInfosByViewId("com.deliveryhero.rps.restaurantandroidapp:id/toolbar")
                if (drawerNodes != null && drawerNodes.isNotEmpty()) {
                    val toolbar = drawerNodes[0]
                    if (toolbar.childCount > 0) {
                        val firstChild = toolbar.getChild(0)
                        if (firstChild != null && firstChild.isClickable) {
                            firstChild.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                        }
                    }
                }
            }
            delay(1000)

            Journal.log("Clic sur 'Aperçu des commandes'...")
            clickByText("Aperçu des commandes")
            delay(500)

            // Mark as handled
            NetworkClient.markRuptureTriggerHandled(applicationContext)
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

    private fun findScrollableNode(node: android.view.accessibility.AccessibilityNodeInfo?): android.view.accessibility.AccessibilityNodeInfo? {
        val scrollableNodes = mutableListOf<android.view.accessibility.AccessibilityNodeInfo>()
        fun collectScrollableNodes(n: android.view.accessibility.AccessibilityNodeInfo?) {
            if (n == null) return
            if (n.isScrollable) {
                scrollableNodes.add(n)
            }
            for (i in 0 until n.childCount) {
                collectScrollableNodes(n.getChild(i))
            }
        }
        collectScrollableNodes(node)
        
        if (scrollableNodes.isEmpty()) return null
        
        // On retourne l'élément défilant qui a la plus grande hauteur (la liste principale de Glovo)
        return scrollableNodes.maxByOrNull { n -> 
            val rect = android.graphics.Rect()
            n.getBoundsInScreen(rect)
            rect.height()
        }
    }

    private suspend fun returnToNewOrdersTab() {
        Journal.log("Retour à la page Aperçu des commandes...")
        delay(500)

        // Try to see if Aperçu des commandes is already visible (e.g. if drawer was already opened)
        if (clickByText("Aperçu des commandes")) {
            Journal.log("Aperçu des commandes trouvé directement.")
            delay(500)
            return
        }

        // Try to find the drawer icon (3 bars) first to avoid pressing BACK unnecessarily
        if (clickByText("Ouvrir le tiroir de navigation")) {
            Journal.log("Tiroir de navigation ouvert directement.")
            delay(1000)
            clickByText("Aperçu des commandes")
            delay(500)
            return
        }

        // If drawer is not found, we might be in an order detail, dropdown, or search.
        // Try closing search if it exists
        val closeSearchNodes = rootInActiveWindow?.findAccessibilityNodeInfosByViewId("com.deliveryhero.rps.restaurantandroidapp:id/search_close_btn")
        if (closeSearchNodes != null && closeSearchNodes.isNotEmpty()) {
            Journal.log("Fermeture de la recherche...")
            closeSearchNodes[0].performAction(AccessibilityNodeInfo.ACTION_CLICK)
            delay(500)
        }

        // Press BACK to exit the current sub-screen (like order detail or search)
        Journal.log("Bouton retour Android pour quitter le sous-menu...")
        performGlobalAction(GLOBAL_ACTION_BACK)
        delay(1000)

        // Try opening drawer again
        if (clickByText("Ouvrir le tiroir de navigation")) {
            Journal.log("Tiroir ouvert après retour.")
            delay(1000)
            clickByText("Aperçu des commandes")
            delay(500)
            return
        }

        // Fallback: click tabs if visible
        if (clickByText("Aperçu des commandes")) {
            delay(500)
        } else if (clickByText("Nouvelle")) {
            delay(500)
        } else if (clickByText("Aperçu")) {
            delay(500)
        }

        Journal.log("Retour en haut de la page pour surveiller les nouvelles commandes...")
        val rootForScroll = rootInActiveWindow
        if (rootForScroll != null) {
            val scrollableNode = findScrollableNode(rootForScroll)
            if (scrollableNode != null) {
                scrollableNode.performAction(AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD) // 8192
            } else {
                performSwipeDown()
            }
        }
        delay(500)
    }

    // 🔥 Jdid: Fonction pour imprimer l'arbre complet de l'interface (Chajara dyal UI)
    private fun dumpNodeTree(node: AccessibilityNodeInfo?, depth: Int) {
        if (node == null) return
        val indent = "  ".repeat(depth)
        val text = node.text?.toString()?.replace("\n", " ")
        val desc = node.contentDescription?.toString()?.replace("\n", " ")
        val className = node.className?.toString()?.substringAfterLast(".")
        val viewId = node.viewIdResourceName?.substringAfterLast("/") // ID du composant
        val bounds = android.graphics.Rect()
        node.getBoundsInScreen(bounds)
        
        if (!text.isNullOrBlank() || !desc.isNullOrBlank() || node.isClickable || !viewId.isNullOrBlank()) {
            val info = buildString {
                append("$indent[$className]")
                if (!viewId.isNullOrBlank()) append(" ID:\"$viewId\"")
                if (!text.isNullOrBlank()) append(" txt:\"$text\"")
                if (!desc.isNullOrBlank()) append(" desc:\"$desc\"")
                if (node.isClickable) append(" [CLICKABLE]")
                append(" $bounds")
            }
            Journal.log(info)
            Log.d("GoDroidUI", info)
        }

        for (i in 0 until node.childCount) {
            val child = node.getChild(i)
            if (child != null) {
                dumpNodeTree(child, depth + 1)
                child.recycle() // Clean up memory
            }
        }
    }
}
