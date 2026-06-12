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
                
                // Wake up screen and unlock
                try {
                    val powerManager = getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
                    val isScreenOn = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT_WATCH) {
                        powerManager.isInteractive
                    } else {
                        powerManager.isScreenOn
                    }
                    if (!isScreenOn) {
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
                        val keyguardLock = keyguardManager.newKeyguardLock("GoDroidAutomator::KeyguardLock")
                        keyguardLock.disableKeyguard()
                    }
                } catch (e: Exception) {
                    Journal.log("Erreur WakeUp: ${e.message}")
                }

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

    private fun startPollingForReadyOrders() {
        coroutineScope.launch {
            while (true) {
                try {
                    delay(15000) // Poll every 15 seconds
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
                    }
                } catch (e: Exception) {
                    Log.e("AutoService", "Polling error", e)
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

            val launchIntent = packageManager.getLaunchIntentForPackage(targetPackage)
            if (launchIntent != null) {
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                startActivity(launchIntent)
                Journal.log("Ouverture de l'app: $targetPackage")
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
                Journal.log("Clic sur '$labelPret'")
                clickByText(labelPret)
                
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
            val screenText = extractAllText(root)
            val nouvelleRegex = Regex("Nouvelle\\s+([1-9][0-9]*)", RegexOption.IGNORE_CASE)
            
            if (nouvelleRegex.find(screenText) != null && node != null && isNodeClickable(node)) {
                Journal.log("Détection visuelle de Nouvelle Commande et '$labelMins'")
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

            val launchIntent = packageManager.getLaunchIntentForPackage(targetPackage)
            if (launchIntent != null) {
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                startActivity(launchIntent)
                Journal.log("Ouverture de l'app: $targetPackage")
            } else {
                Journal.log("ERREUR: App goDroid introuvable !")
            }

            // 2. Wait until "mins" appears dynamically
            Journal.log("Attente de '$labelMins'...")
            if (waitUntilTextAppears(labelMins, 5000)) {
                Journal.log("Clic sur '$labelMins'")
                clickByText(labelMins)
            } else {
                Journal.log("Attention: '$labelMins' introuvable")
                clickByText(labelMins) // Try anyway
            }

            // 3. Wait until "Modifier" appears (indicates order details loaded)
            Journal.log("Attente de '$labelModifier'...")
            waitUntilTextAppears(labelModifier, 4000)
            
            // Wait extra time for the transition animation and list to fully load
            delay(2000)

            // 4. Read full details (Items, Price, Order Num)
            Journal.log("Lecture détails de la commande...")
            val screenWidth = resources.displayMetrics.widthPixels
            val contenuEcran = extractOrderDetailsText(rootInActiveWindow, screenWidth)
            Journal.log("Texte lu: ${contenuEcran.length} charactères")

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

            // 9. Read Phone number from this screen
            Journal.log("Lecture du numéro de téléphone...")
            val telephoneEcran = extractAllText(rootInActiveWindow)
            Journal.log("Extraction num téléphone terminée.")

            // 10. Send the order data
            Journal.log("Lancement requête HTTP globale...")
            NetworkClient.sendOrderData(telephoneEcran, contenuEcran)

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
    
    private fun extractOrderDetailsText(node: AccessibilityNodeInfo?, screenWidth: Int): String {
        val nodesList = mutableListOf<Pair<android.graphics.Rect, String>>()
        collectTextNodes(node, nodesList)
        
        // Sort by Y (top) first, then X (left). Give a 20px tolerance for Y to group same-line items.
        nodesList.sortWith(Comparator { a, b ->
            val yDiff = a.first.top - b.first.top
            if (kotlin.math.abs(yDiff) < 20) {
                a.first.left.compareTo(b.first.left)
            } else {
                yDiff.compareTo(0)
            }
        })
        
        val sb = java.lang.StringBuilder()
        if (nodesList.isNotEmpty()) {
            var currentY = nodesList[0].first.top
            for (item in nodesList) {
                if (kotlin.math.abs(item.first.top - currentY) < 20) {
                    if (sb.isNotEmpty() && !sb.endsWith("\n")) {
                        sb.append(" ")
                    }
                    sb.append(item.second)
                } else {
                    sb.append("\n").append(item.second)
                    currentY = item.first.top
                }
            }
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
