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
                Log.d("AutoService", "Received START_SEQUENCE broadcast")
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
                Log.d("AutoService", "--- STARTING AUTOMATION SEQUENCE ---")

                // 1. Launch goDroid (com.deliveryhero.rps.restaurantandroidapp)
                val launchIntent = packageManager.getLaunchIntentForPackage("com.deliveryhero.rps.restaurantandroidapp")
                if (launchIntent != null) {
                    launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                    startActivity(launchIntent)
                    Log.d("AutoService", "Launched goDroid app")
                } else {
                    Log.e("AutoService", "goDroid app not found on device")
                }

                // 2. Wait 2 seconds
                delay(2000)

                // 3. Click "mins"
                Log.d("AutoService", "Clicking 'mins'")
                clickByText("mins")

                // 4. Wait 1 second
                delay(1000)

                // 5. Read screen content -> TelephoneEcran
                Log.d("AutoService", "Reading TelephoneEcran")
                var telephoneEcran = extractAllText(rootInActiveWindow)
                Log.d("AutoService", "TelephoneEcran length: \${telephoneEcran.length}")

                // 6. Wait 1 second
                delay(1000)

                // 7. Click "Modifier"
                Log.d("AutoService", "Clicking 'Modifier'")
                clickByText("Modifier")

                // 8. Wait 1 second
                delay(1000)

                // 9. Click ID com.deliveryhero.rps.restaurantandroidapp:id/checkbox
                Log.d("AutoService", "Clicking checkbox ID")
                clickById("com.deliveryhero.rps.restaurantandroidapp:id/checkbox")

                // 10. Wait 1 second
                delay(1000)

                // 11. Click "Continuer"
                Log.d("AutoService", "Clicking 'Continuer'")
                clickByText("Continuer")

                // 12. Wait 2 seconds
                delay(2000)

                // 13. Read screen content -> ContenuEcran
                Log.d("AutoService", "Reading ContenuEcran")
                var contenuEcran = extractAllText(rootInActiveWindow)
                Log.d("AutoService", "ContenuEcran length: \${contenuEcran.length}")

                // 14. Click "Annuler"
                Log.d("AutoService", "Clicking 'Annuler'")
                clickByText("Annuler")

                // 15. Text manipulation: Replace \n with |||
                telephoneEcran = telephoneEcran.replace("\n", "|||")
                contenuEcran = contenuEcran.replace("\n", "|||")

                // 16. Send HTTP Request
                Log.d("AutoService", "Sending POST request to Firestore")
                NetworkClient.sendOrderData(telephoneEcran, contenuEcran)

                // 17. Click "Accepter la commande"
                delay(1000)
                Log.d("AutoService", "Clicking 'Accepter la commande'")
                clickByText("Accepter la commande")

                // 18. Click "Confirmer" (Wait a bit for the dialog)
                delay(1000)
                Log.d("AutoService", "Clicking 'Confirmer'")
                clickByText("Confirmer")

                Log.d("AutoService", "--- AUTOMATION SEQUENCE COMPLETED ---")
            } catch (e: Exception) {
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
