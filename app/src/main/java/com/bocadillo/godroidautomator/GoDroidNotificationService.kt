package com.bocadillo.godroidautomator

import android.content.Intent
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log

class GoDroidNotificationService : NotificationListenerService() {

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val packageName = sbn.packageName
        val title = sbn.notification.extras.getString("android.title") ?: ""
        val text = sbn.notification.extras.getString("android.text") ?: ""

        var appName = ""
        try {
            val pm = applicationContext.packageManager
            val appInfo = pm.getApplicationInfo(packageName, 0)
            appName = pm.getApplicationLabel(appInfo).toString()
        } catch (e: Exception) {
            // Ignore
        }

        Journal.log("Notif reçue: pkg=$packageName, app=$appName, titre=$title")

        // Trigger on target app notifications ONLY if it's an actual order
        val isTargetApp = packageName.contains("deliveryhero.rps") || packageName.contains("godroid", ignoreCase = true) ||
                          appName.contains("goDroid", ignoreCase = true) || appName.contains("Glovo", ignoreCase = true)
        
        val isOrderNotification = title.contains("Nouvelle commande", ignoreCase = true) || 
                                  title.contains("Commande", ignoreCase = true) ||
                                  text.contains("Nouvelle commande", ignoreCase = true)

        if (isTargetApp && isOrderNotification) {
            Journal.log("MATCH! Réveil de l'Automator...")
            
            // Send an explicit broadcast to AutomatorAccessibilityService
            val intent = Intent("com.bocadillo.godroidautomator.START_SEQUENCE")
            intent.setPackage(applicationContext.packageName)
            sendBroadcast(intent)
        }
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification) {
        // Nothing to do
    }
}
