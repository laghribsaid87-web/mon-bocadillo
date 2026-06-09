package com.bocadillo.godroidautomator

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        val layout = android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            setPadding(32, 32, 32, 32)
        }
        
        val title = TextView(this).apply {
            text = "GoDroid Automator"
            textSize = 24f
            setPadding(0, 0, 0, 32)
        }
        layout.addView(title)
        
        val btnAccessibility = Button(this).apply {
            text = "Activer l'Accessibilité (GoDroid Auto-Clicker)"
            setOnClickListener {
                startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
            }
        }
        layout.addView(btnAccessibility)
        
        val btnNotification = Button(this).apply {
            text = "Autoriser les Notifications (GoDroid Notification Listener)"
            setOnClickListener {
                startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
            }
        }
        layout.addView(btnNotification)

        val instructions = TextView(this).apply {
            text = "\nInstructions:\n1. Cliquez sur le premier bouton et activez 'GoDroid Auto-Clicker' dans les services téléchargés.\n2. Cliquez sur le deuxième bouton et autorisez 'GoDroid Automator' à lire les notifications.\n3. Dès qu'une notification goDroid est reçue, l'automatisation démarrera."
            textSize = 16f
            setPadding(0, 32, 0, 0)
        }
        layout.addView(instructions)
        
        setContentView(layout)
    }
}
