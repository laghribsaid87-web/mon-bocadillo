package com.bocadillo.godroidautomator

import android.content.Context
import android.os.Bundle
import android.widget.Button
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
            "btn_mins" to "Bouton Chrono (ex: mins, min)",
            "btn_modifier" to "Bouton Modifier",
            "btn_continuer" to "Bouton Continuer",
            "btn_annuler" to "Bouton Annuler",
            "btn_accepter" to "Bouton Accepter",
            "btn_confirmer" to "Bouton Confirmer",
            "btn_acceptee" to "Onglet Acceptée",
            "btn_pret" to "Bouton Prêt pour la livraison"
        )
        
        val defaultValues = mapOf(
            "btn_mins" to "mins",
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

        val btnSave = Button(this).apply {
            text = "Sauvegarder"
            setPadding(0, 32, 0, 32)
            setOnClickListener {
                val editor = prefs.edit()
                for ((key, et) in editTexts) {
                    editor.putString(key, et.text.toString().trim())
                }
                editor.apply()
                Toast.makeText(this@SettingsActivity, "Paramètres sauvegardés !", Toast.LENGTH_SHORT).show()
                finish()
            }
        }
        layout.addView(btnSave)

        val scrollView = ScrollView(this).apply {
            addView(layout)
        }
        
        setContentView(scrollView)
    }
}
