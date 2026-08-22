package com.bocadillo.godroidautomator

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray

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
            setPadding(0, 0, 0, 8)
        }
        layout.addView(title)
        
        val pInfo = packageManager.getPackageInfo(packageName, 0)
        val appVersionName = pInfo.versionName
        
        val versionText = TextView(this).apply {
            text = "Version: $appVersionName"
            textSize = 14f
            setTextColor(android.graphics.Color.GRAY)
            setPadding(0, 0, 0, 32)
        }
        layout.addView(versionText)
        
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
        
        val btnTest = Button(this).apply {
            text = "TEST Lecture Commande (Écran ouvert)"
            setOnClickListener {
                android.widget.Toast.makeText(this@MainActivity, "Basculez sur Glovo, lecture dans 3s...", android.widget.Toast.LENGTH_LONG).show()
                val intent = Intent("com.bocadillo.godroidautomator.TEST_READ_ORDER")
                sendBroadcast(intent)
            }
        }
        layout.addView(btnTest)

        val btnScanTree = Button(this).apply {
            text = "SCAN ARBRE UI (Glovo) - 4s"
            setOnClickListener {
                android.widget.Toast.makeText(this@MainActivity, "Ouverture de Glovo... Le scan démarre dans 4s!", android.widget.Toast.LENGTH_LONG).show()
                val intent = Intent("com.bocadillo.godroidautomator.SCAN_UI_TREE")
                sendBroadcast(intent)
            }
        }
        layout.addView(btnScanTree)

        val btnScanTreeIndrive = Button(this).apply {
            text = "SCAN ARBRE UI (InDrive) - 4s"
            setOnClickListener {
                android.widget.Toast.makeText(this@MainActivity, "Ouverture de InDrive... Le scan démarre dans 4s!", android.widget.Toast.LENGTH_LONG).show()
                val intent = Intent("com.bocadillo.godroidautomator.SCAN_UI_TREE_INDRIVE")
                sendBroadcast(intent)
            }
        }
        layout.addView(btnScanTreeIndrive)
        
        val btnSettings = Button(this).apply {
            text = "Paramètres de Texte (Boutons Glovo)"
            setOnClickListener {
                startActivity(Intent(this@MainActivity, SettingsActivity::class.java))
            }
        }
        layout.addView(btnSettings)
        val btnClear = Button(this).apply {
            text = "Vider le Journal"
            setOnClickListener { Journal.clear() }
        }

        val btnCopy = Button(this).apply {
            text = "Copier le Journal"
            setOnClickListener {
                val logsText = Journal.logs.value.joinToString("\n")
                val clipboard = getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                val clip = android.content.ClipData.newPlainText("Journal GoDroid", if (logsText.isEmpty()) "Journal vide" else logsText)
                clipboard.setPrimaryClip(clip)
                android.widget.Toast.makeText(this@MainActivity, "Journal copié dans le presse-papiers !", android.widget.Toast.LENGTH_SHORT).show()
            }
        }

        val buttonsLayout = android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.HORIZONTAL
            addView(btnClear, android.widget.LinearLayout.LayoutParams(0, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
            addView(btnCopy, android.widget.LinearLayout.LayoutParams(0, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        }
        layout.addView(buttonsLayout)

        val logTitle = TextView(this).apply {
            text = "\nJournal du Robot (Notre APK):"
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
        
        checkForUpdates()
    }

    private fun checkForUpdates() {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val client = OkHttpClient()
                val request = Request.Builder()
                    .url("https://api.github.com/repos/laghribsaid87-web/mon-bocadillo/releases")
                    .build()
                
                val response = client.newCall(request).execute()
                if (response.isSuccessful) {
                    val body = response.body?.string()
                    if (!body.isNullOrEmpty()) {
                        val jsonArray = JSONArray(body)
                        if (jsonArray.length() > 0) {
                            val latestRelease = jsonArray.getJSONObject(0)
                            val tagName = latestRelease.getString("tag_name")
                            
                            val pInfo = packageManager.getPackageInfo(packageName, 0)
                            val currentVersion = "v" + pInfo.versionName
                            
                            if (isNewerVersion(tagName, currentVersion) && !currentVersion.startsWith("v3.3.126")) {
                                withContext(Dispatchers.Main) {
                                    showUpdateDialog(tagName)
                                }
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    private fun isNewerVersion(githubVersion: String, currentVersion: String): Boolean {
        try {
            val v1 = githubVersion.replace("v", "").split(".").map { it.toIntOrNull() ?: 0 }
            val v2 = currentVersion.replace("v", "").split(".").map { it.toIntOrNull() ?: 0 }
            val length = maxOf(v1.size, v2.size)
            for (i in 0 until length) {
                val num1 = v1.getOrElse(i) { 0 }
                val num2 = v2.getOrElse(i) { 0 }
                if (num1 > num2) return true
                if (num1 < num2) return false
            }
        } catch (e: Exception) { /* N'ignorez pas l'erreur, on retourne juste false */ }
        return false
    }

    private fun showUpdateDialog(newVersion: String) {
        android.app.AlertDialog.Builder(this)
            .setTitle("Mise à jour disponible !")
            .setMessage("Une nouvelle version ($newVersion) est disponible. Voulez-vous la télécharger ?")
            .setPositiveButton("Télécharger") { _, _ ->
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://www.monbocadillo.ma/glovo"))
                startActivity(intent)
            }
            .setNegativeButton("Plus tard", null)
            .show()
    }
}
