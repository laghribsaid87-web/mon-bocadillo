package com.bocadillo.godroidautomator

import android.content.Context
import android.os.Bundle
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

class SettingsActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        val prefs = getSharedPreferences("AutomatorPrefs", Context.MODE_PRIVATE)

        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 32, 32, 32)
        }

        val title = TextView(this).apply {
            text = "Paramètres des Boutons Glovo"
            textSize = 24f
            setPadding(0, 0, 0, 32)
        }
        layout.addView(title)
        
        val desc = TextView(this).apply {
            text = "Si Glovo change le texte de ses boutons, modifiez-les ici pour que l'automatisation continue de fonctionner."
            textSize = 14f
            setPadding(0, 0, 0, 32)
        }
        layout.addView(desc)

        val keys = listOf(
            "btn_mins" to "Mot-clé Chrono (ex: min)",
            "btn_produit" to "Mot-clé Produit (ex: produit)",
            "btn_hash" to "Mot-clé Numéro (ex: #)",
            "btn_nouvelle" to "Onglet Nouvelle",
            "btn_nouvelle_commande" to "Bannière Nouvelle commande",
            "btn_afficher" to "Bouton Afficher",
            "btn_modifier" to "Bouton Modifier",
            "btn_continuer" to "Bouton Continuer",
            "btn_annuler" to "Bouton Annuler",
            "btn_accepter" to "Bouton Accepter",
            "btn_confirmer" to "Bouton Confirmer",
            "btn_acceptee" to "Onglet Acceptée",
            "btn_pret" to "Bouton Prêt pour la livraison"
        )
        
        val defaultValues = mapOf(
            "btn_mins" to "min",
            "btn_produit" to "produit",
            "btn_hash" to "#",
            "btn_nouvelle" to "Nouvelle",
            "btn_nouvelle_commande" to "nouvelle commande",
            "btn_afficher" to "Afficher",
            "btn_modifier" to "Modifier",
            "btn_continuer" to "Continuer",
            "btn_annuler" to "Annuler",
            "btn_accepter" to "Accepter la commande",
            "btn_confirmer" to "Confirmer",
            "btn_acceptee" to "Acceptée",
            "btn_pret" to "Prêt pour la livraison"
        )

        val editTexts = mutableMapOf<String, EditText>()

        for ((key, label) in keys) {
            val tv = TextView(this).apply {
                text = label
                setTypeface(null, android.graphics.Typeface.BOLD)
                setPadding(0, 16, 0, 8)
            }
            layout.addView(tv)

            val et = EditText(this).apply {
                setText(prefs.getString(key, defaultValues[key]))
            }
            editTexts[key] = et
            layout.addView(et)
        }

        val tvWebhook = TextView(this).apply {
            text = "Sélectionnez votre Point de Vente :"
            setTypeface(null, android.graphics.Typeface.BOLD)
            setPadding(0, 16, 0, 8)
        }
        layout.addView(tvWebhook)
        
        val branches = arrayOf("Laymoune", "OumRabii", "Zoubire")
        val spinnerWebhook = android.widget.Spinner(this).apply {
            adapter = android.widget.ArrayAdapter(this@SettingsActivity, android.R.layout.simple_spinner_dropdown_item, branches)
            val savedBranch = prefs.getString("point_de_vente", "Laymoune")
            setSelection(branches.indexOf(savedBranch).takeIf { it >= 0 } ?: 0)
        }
        layout.addView(spinnerWebhook)

        val cbDisableAuto = CheckBox(this).apply {
            text = "Désactiver la lecture automatique (API officielle)"
            textSize = 16f
            setPadding(0, 32, 0, 32)
            isChecked = prefs.getBoolean("disable_auto_read", false)
        }
        layout.addView(cbDisableAuto)

        val cbExtractionOnly = CheckBox(this).apply {
            text = "Mode Extraction Uniquement (Tél + PIN)"
            textSize = 16f
            setPadding(0, 32, 0, 32)
            isChecked = prefs.getBoolean("extraction_only_mode", false)
        }
        layout.addView(cbExtractionOnly)


        val btnSave = Button(this).apply {
            text = "Sauvegarder"
            setPadding(0, 32, 0, 32)
            setOnClickListener {
                val editor = prefs.edit()
                for ((key, et) in editTexts) {
                    editor.putString(key, et.text.toString().trim())
                }
                editor.putString("point_de_vente", spinnerWebhook.selectedItem.toString())
                editor.putBoolean("disable_auto_read", cbDisableAuto.isChecked)
                editor.putBoolean("extraction_only_mode", cbExtractionOnly.isChecked)
                editor.apply()
                Toast.makeText(this@SettingsActivity, "Paramètres sauvegardés !", Toast.LENGTH_SHORT).show()
                finish()
            }
        }
        layout.addView(btnSave)

        val btnSetupArea = Button(this).apply {
            text = "Configurer Zone de Lecture (Cadre)"
            setPadding(0, 32, 0, 32)
            setOnClickListener {
                if (!Settings.canDrawOverlays(this@SettingsActivity)) {
                    val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName"))
                    startActivity(intent)
                    Toast.makeText(this@SettingsActivity, "Veuillez autoriser l'affichage superposé", Toast.LENGTH_LONG).show()
                } else {
                    startService(Intent(this@SettingsActivity, OverlayService::class.java))
                    Toast.makeText(this@SettingsActivity, "Ouvrez Glovo pour ajuster les cadres", Toast.LENGTH_LONG).show()
                    finish()
                }
            }
        }
        layout.addView(btnSetupArea)

        val scrollView = ScrollView(this).apply {
            addView(layout)
        }
        
        setContentView(scrollView)
    }
}
