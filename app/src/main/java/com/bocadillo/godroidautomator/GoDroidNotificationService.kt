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

        Log.d("GoDroidNotif", "Notification received: package=$packageName, appName=$appName, title=$title")

        // Trigger on any notification from the target app, or specifically "goDroid" as per user request
        if (packageName.contains("deliveryhero.rps") || packageName.contains("godroid", ignoreCase = true)
            || appName.contains("goDroid", ignoreCase = true) || appName.contains("Glovo", ignoreCase = true)
            || title.contains("Nouvelle commande", ignoreCase = true) || title.contains("goDroid", ignoreCase = true)
            || title.contains("Commande", ignoreCase = true)) {
            
            Log.d("GoDroidNotif", "Matched goDroid notification! Waking up Automator...")
            
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
