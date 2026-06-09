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

        Log.d("GoDroidNotif", "Notification received: package=$packageName, title=$title, text=$text")

        // Trigger on any notification from the target app, or specifically "goDroid" as per user request
        // Delivery hero package is usually com.deliveryhero.rps.restaurantandroidapp
        if (packageName.contains("deliveryhero.rps") || packageName.contains("godroid", ignoreCase = true)
            || title.contains("Nouvelle commande", ignoreCase = true) || title.contains("goDroid", ignoreCase = true)) {
            
            Log.d("GoDroidNotif", "Matched goDroid notification! Waking up Automator...")
            
            // Send a broadcast to AutomatorAccessibilityService to start the sequence
            val intent = Intent("com.bocadillo.godroidautomator.START_SEQUENCE")
            sendBroadcast(intent)
        }
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification) {
        // Nothing to do
    }
}
