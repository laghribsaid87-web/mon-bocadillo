package com.bocadillo.godroidautomator

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

object NetworkClient {

    private val client = OkHttpClient()
    // Using the default URL from the mon-bocadillo project test script, can be adjusted as needed.
    private const val FIRESTORE_URL = "https://firestore.googleapis.com/v1/projects/mon-bocadillo-menu/databases/(default)/documents/artifacts/mon-bocadillo-menu/public/data/orders"

    suspend fun sendOrderData(telephoneEcran: String, contenuEcran: String) {
        withContext(Dispatchers.IO) {
            try {
                // The Firestore REST URL must point to the correct collection
                val url = "https://firestore.googleapis.com/v1/projects/mon-bocadillo-menu/databases/(default)/documents/artifacts/mon-bocadillo-menu/public/data/orders"
                
                // Format the text strings safely
                val formattedPhone = telephoneEcran.replace("\"", "\\\"").replace("\n", " ")
                val formattedContent = contenuEcran.replace("\"", "\\\"").replace("\n", " ")
                val finalNote = "TELEPHONE: $formattedPhone\n\nCONTENU: $formattedContent"

                val formatter = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US)
                formatter.timeZone = java.util.TimeZone.getTimeZone("UTC")
                val createdAt = formatter.format(java.util.Date())

                // Structure of Firestore REST document for an order
                val jsonStr = """
                {
                  "fields": {
                    "source": { "stringValue": "glovo" },
                    "status": { "stringValue": "preparing" },
                    "orderNumber": { "stringValue": "GLOVO-APP" },
                    "total": { "doubleValue": 0 },
                    "createdAt": { "timestampValue": "$createdAt" },
                    "items": {
                      "arrayValue": {
                        "values": [
                          {
                            "mapValue": {
                              "fields": {
                                "name": { "stringValue": "COMMANDE GLOVO" },
                                "qty": { "integerValue": "1" },
                                "price": { "integerValue": "0" }
                              }
                            }
                          }
                        ]
                      }
                    },
                    "orderNote": { "stringValue": "$finalNote" },
                    "nearestBranch": {
                      "mapValue": {
                        "fields": {
                          "id": { "stringValue": "laymoune" }
                        }
                      }
                    }
                  }
                }
                """.trimIndent()

                val mediaType = "application/json; charset=utf-8".toMediaType()
                val body = jsonStr.toRequestBody(mediaType)

                val request = Request.Builder()
                    .url(FIRESTORE_URL)
                    .post(body)
                    .build()

                Journal.log("Envoi POST vers KDS (Firestore)...")
                val response = client.newCall(request).execute()
                
                if (response.isSuccessful) {
                    Journal.log("Succès! KDS a répondu OK.")
                } else {
                    Journal.log("Erreur KDS: ${response.code} - ${response.body?.string()}")
                }
            } catch (e: Exception) {
                Journal.log("Exception réseau: ${e.message}")
                Log.e("NetworkClient", "Exception in sendOrderData", e)
            }
        }
    }
}
