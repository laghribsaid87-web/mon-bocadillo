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

class AutomatorAccessibilityService : AccessibilityService() {

    private val coroutineScope = CoroutineScope(Dispatchers.Default + Job())
    private var isSequenceRunning = false

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == "com.bocadillo.godroidautomator.START_SEQUENCE") {
                Journal.log("Broadcast reçu: START_SEQUENCE")
                if (!isSequenceRunning) {
                    startAutomationSequence()
                } else {
                    Log.d("AutoService", "Sequence already running, ignoring.")
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
                    if (!isSequenceRunning) {
                        val readyOrder = NetworkClient.checkReadyOrders()
                        if (readyOrder != null) {
                            startReadySequence(readyOrder.orderNumber, readyOrder.documentId)
                        }
                    }
                } catch (e: Exception) {
                    Log.e("AutoService", "Polling error", e)
                }
            }
        }
    }

    private fun startReadySequence(orderNumber: String, documentId: String) {
        isSequenceRunning = true
        val labelAcceptee = getLabel("btn_acceptee", "Acceptée")
        val labelPret = getLabel("btn_pret", "Prêt pour la livraison")
        val labelConfirmer = getLabel("btn_confirmer", "Confirmer")

        coroutineScope.launch {
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

                launch(Dispatchers.Main) {
                    android.widget.Toast.makeText(applicationContext, "Validation Commande $orderNumber !", android.widget.Toast.LENGTH_LONG).show()
                }

                val launchIntent = packageManager.getLaunchIntentForPackage(targetPackage)
                if (launchIntent != null) {
                    launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                    startActivity(launchIntent)
                    Journal.log("Ouverture de l'app: $targetPackage")
                }

                delay(3000)

                // 2. Click on "Acceptée" tab
                Journal.log("Clic sur l'onglet '$labelAcceptee'")
                clickByText(labelAcceptee)
                delay(2000)

                // 3. Find the order on the screen
                val formattedOrderNumber = if (orderNumber.startsWith("#")) orderNumber else "#$orderNumber"
                Journal.log("Recherche de la commande $formattedOrderNumber")
                
                // If we can click the exact order number
                if (clickByText(formattedOrderNumber)) {
                    delay(1500)
                    Journal.log("Clic sur '$labelPret'")
                    clickByText(labelPret)
                    
                    delay(2000)
                    
                    // Handle Dialogs
                    val screenText = extractAllText(rootInActiveWindow)
                    
                    // Grouped Orders Dialog: "Sélectionnez les commandes qui sont prêtes"
                    if (screenText.contains("Sélectionnez les commandes", ignoreCase = true)) {
                        Journal.log("Commandes groupées détectées, sélection de $formattedOrderNumber")
                        // Usually the checkbox has text next to it like "Commande n° 32"
                        val checkboxText = "Commande n° ${formattedOrderNumber.replace("#", "")}"
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
                    Journal.log("Erreur: Commande $formattedOrderNumber introuvable à l'écran")
                }

            } catch (e: Exception) {
                Journal.log("ERREUR FATALE: ${e.message}")
            } finally {
                isSequenceRunning = false
            }
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // We do not need to react to every event, we drive the sequence asynchronously
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

    private fun startAutomationSequence() {
        isSequenceRunning = true
        val labelMins = getLabel("btn_mins", "mins")
        val labelModifier = getLabel("btn_modifier", "Modifier")
        val labelContinuer = getLabel("btn_continuer", "Continuer")
        val labelAnnuler = getLabel("btn_annuler", "Annuler")
        val labelAccepter = getLabel("btn_accepter", "Accepter la commande")
        val labelConfirmer = getLabel("btn_confirmer", "Confirmer")

        coroutineScope.launch {
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
                
                // Show a toast on the UI thread
                launch(Dispatchers.Main) {
                    android.widget.Toast.makeText(applicationContext, "GoDroid Automator déclenché !", android.widget.Toast.LENGTH_LONG).show()
                }

                val launchIntent = packageManager.getLaunchIntentForPackage(targetPackage)
                if (launchIntent != null) {
                    launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                    startActivity(launchIntent)
                    Journal.log("Ouverture de l'app: $targetPackage")
                } else {
                    Journal.log("ERREUR: App goDroid introuvable !")
                }

                // 2. Wait 2 seconds
                delay(2000)

                // 3. Click "mins"
                Journal.log("Clic sur '$labelMins'")
                val minsClicked = clickByText(labelMins)
                if (!minsClicked) Journal.log("Attention: '$labelMins' introuvable")

                // 4. Wait 1 second
                delay(1000)

                // 5. Read screen content -> ContenuEcran (First screen has Order Items)
                Journal.log("Lecture ContenuEcran...")
                var contenuEcran = extractAllText(rootInActiveWindow)
                Journal.log("Texte lu: ${contenuEcran.length} charactères")

                // 6. Wait 1 second
                delay(1000)

                // 7. Click "Modifier"
                Journal.log("Clic sur '$labelModifier'")
                clickByText(labelModifier)

                // 8. Wait 1 second
                delay(1000)

                // 9. Click Checkbox
                Journal.log("Clic sur Checkbox")
                clickById("com.deliveryhero.rps.restaurantandroidapp:id/checkbox")

                // 10. Wait 1 second
                delay(1000)

                // 11. Click "Continuer"
                Journal.log("Clic sur '$labelContinuer'")
                clickByText(labelContinuer)

                // 12. Wait 2 seconds
                delay(2000)

                // 13. Read screen content -> TelephoneEcran (Second screen has Phone Number and Name)
                Journal.log("Lecture TelephoneEcran...")
                var telephoneEcran = extractAllText(rootInActiveWindow)
                Journal.log("Texte lu: ${telephoneEcran.length} charactères")

                // 14. Click "Annuler"
                Journal.log("Clic sur '$labelAnnuler'")
                clickByText(labelAnnuler)

                // 15. Removed Text Manipulation (Handled cleanly in NetworkClient)

                // 16. Send HTTP Request
                Journal.log("Lancement requête HTTP...")
                NetworkClient.sendOrderData(telephoneEcran, contenuEcran)

                // 17. Click "Accepter la commande"
                delay(1000)
                Journal.log("Clic sur '$labelAccepter'")
                clickByText(labelAccepter)

                // 18. Check for "payer en espèces" dialog and click "Confirmer"
                delay(1500)
                val dialogText = extractAllText(rootInActiveWindow)
                if (dialogText.contains("payer en espèces", ignoreCase = true)) {
                    Journal.log("Alerte Glovo: Le coursier doit payer en espèces")
                }
                Journal.log("Clic sur '$labelConfirmer'")
                clickByText(labelConfirmer)

                Journal.log("=== AUTOMATISATION TERMINEE ===")
            } catch (e: Exception) {
                Journal.log("ERREUR FATALE: ${e.message}")
                Log.e("AutoService", "Error in sequence", e)
            } finally {
                isSequenceRunning = false
            }
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
}
