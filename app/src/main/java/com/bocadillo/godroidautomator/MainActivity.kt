package com.bocadillo.godroidautomator

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

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
        val btnClear = Button(this).apply {
            text = "Vider le Journal"
            setOnClickListener { Journal.clear() }
        }
        layout.addView(btnClear)

        val logTitle = TextView(this).apply {
            text = "\nJournal Système:"
            textSize = 18f
            setPadding(0, 32, 0, 8)
            setTypeface(null, android.graphics.Typeface.BOLD)
        }
        layout.addView(logTitle)

        val logView = TextView(this).apply {
            text = "En attente d'événements..."
            textSize = 12f
            setPadding(16, 16, 16, 16)
            setBackgroundColor(android.graphics.Color.parseColor("#EEEEEE"))
        }

        val scrollView = android.widget.ScrollView(this).apply {
            addView(logView)
            layoutParams = android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
                android.widget.LinearLayout.LayoutParams.MATCH_PARENT
            )
        }
        layout.addView(scrollView)
        
        setContentView(layout)

        lifecycleScope.launch {
            Journal.logs.collect { logsList ->
                logView.text = if (logsList.isEmpty()) "Journal vide" else logsList.joinToString("\n")
            }
        }
    }
}
