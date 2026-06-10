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

    private fun startAutomationSequence() {
        isSequenceRunning = true
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
                Journal.log("Clic sur 'mins'")
                val minsClicked = clickByText("mins")
                if (!minsClicked) Journal.log("Attention: 'mins' introuvable")

                // 4. Wait 1 second
                delay(1000)

                // 5. Read screen content -> TelephoneEcran
                Journal.log("Lecture TelephoneEcran...")
                var telephoneEcran = extractAllText(rootInActiveWindow)
                Journal.log("Texte lu: ${telephoneEcran.length} charactères")

                // 6. Wait 1 second
                delay(1000)

                // 7. Click "Modifier"
                Journal.log("Clic sur 'Modifier'")
                clickByText("Modifier")

                // 8. Wait 1 second
                delay(1000)

                // 9. Click ID com.deliveryhero.rps.restaurantandroidapp:id/checkbox
                Journal.log("Clic sur Checkbox")
                clickById("com.deliveryhero.rps.restaurantandroidapp:id/checkbox")

                // 10. Wait 1 second
                delay(1000)

                // 11. Click "Continuer"
                Journal.log("Clic sur 'Continuer'")
                clickByText("Continuer")

                // 12. Wait 2 seconds
                delay(2000)

                // 13. Read screen content -> ContenuEcran
                Journal.log("Lecture ContenuEcran...")
                var contenuEcran = extractAllText(rootInActiveWindow)
                Journal.log("Texte lu: ${contenuEcran.length} charactères")

                // 14. Click "Annuler"
                Journal.log("Clic sur 'Annuler'")
                clickByText("Annuler")

                // 15. Text manipulation: Replace \n with |||
                telephoneEcran = telephoneEcran.replace("\n", "|||")
                contenuEcran = contenuEcran.replace("\n", "|||")

                // 16. Send HTTP Request
                Journal.log("Lancement requête HTTP...")
                NetworkClient.sendOrderData(telephoneEcran, contenuEcran)

                // 17. Click "Accepter la commande"
                delay(1000)
                Journal.log("Clic sur 'Accepter la commande'")
                clickByText("Accepter la commande")

                // 18. Click "Confirmer" (Wait a bit for the dialog)
                delay(1000)
                Journal.log("Clic sur 'Confirmer'")
                clickByText("Confirmer")

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
