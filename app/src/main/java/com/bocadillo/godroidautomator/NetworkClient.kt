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
    // Using the Webhook URL for the robust parsing logic
    private const val WEBHOOK_URL = "https://us-central1-mon-bocadillo-menu.cloudfunctions.net/glovoWebhook"

    suspend fun sendOrderData(telephoneEcran: String, contenuEcran: String) {
        withContext(Dispatchers.IO) {
            try {
                // Formatting payload for Webhook (Expects 'title' and 'text')
                val jsonObject = JSONObject()
                jsonObject.put("title", telephoneEcran)
                jsonObject.put("text", contenuEcran)

                val mediaType = "application/json; charset=utf-8".toMediaType()
                val body = jsonObject.toString().toRequestBody(mediaType)

                val request = Request.Builder()
                    .url(WEBHOOK_URL)
                    .post(body)
                    .build()

                Journal.log("Envoi POST vers Webhook...")
                val response = client.newCall(request).execute()
                
                if (response.isSuccessful) {
                    Journal.log("✅ Commande envoyée au Webhook avec succès!")
                } else {
                    Journal.log("❌ Erreur d'envoi Webhook: ${response.code}")
                    val responseBody = response.body?.string() ?: "Aucun détail"
                    Journal.log("Détails: $responseBody")
                }
            } catch (e: Exception) {
                Journal.log("❌ Exception lors de l'envoi Webhook: ${e.message}")
            }
        }
    }

    data class ReadyOrder(val documentId: String, val orderNumber: String)

    suspend fun checkReadyOrders(): List<ReadyOrder> {
        return withContext(Dispatchers.IO) {
            val orders = mutableListOf<ReadyOrder>()
            try {
                val url = "https://firestore.googleapis.com/v1/projects/mon-bocadillo-menu/databases/(default)/documents/artifacts/mon-bocadillo-menu/public/data:runQuery"
                val jsonStr = """
                {
                  "structuredQuery": {
                    "from": [{"collectionId": "orders"}],
                    "where": {
                      "compositeFilter": {
                        "op": "AND",
                        "filters": [
                          {
                            "fieldFilter": {
                              "field": {"fieldPath": "status"},
                              "op": "EQUAL",
                              "value": {"stringValue": "ready"}
                            }
                          },
                          {
                            "fieldFilter": {
                              "field": {"fieldPath": "source"},
                              "op": "EQUAL",
                              "value": {"stringValue": "glovo"}
                            }
                          }
                        ]
                      }
                    }
                  }
                }
                """.trimIndent()

                val mediaType = "application/json; charset=utf-8".toMediaType()
                val body = jsonStr.toRequestBody(mediaType)
                val request = Request.Builder().url(url).post(body).build()

                val response = client.newCall(request).execute()
                if (response.isSuccessful) {
                    val responseStr = response.body?.string() ?: return@withContext emptyList()
                    if (responseStr.trim() == "[]") return@withContext emptyList()

                    val jsonArray = org.json.JSONArray(responseStr)
                    for (i in 0 until jsonArray.length()) {
                        val item = jsonArray.optJSONObject(i) ?: continue
                        val document = item.optJSONObject("document") ?: continue
                        val fields = document.optJSONObject("fields") ?: continue
                        
                        val isGlovoReadyClicked = fields.optJSONObject("isGlovoReadyClicked")?.optBoolean("booleanValue", false) ?: false
                        if (!isGlovoReadyClicked) {
                            val docName = document.optString("name")
                            val docId = docName.substringAfterLast("/")
                            val orderNumber = fields.optJSONObject("orderNumber")?.optString("stringValue", "") ?: ""
                            orders.add(ReadyOrder(docId, orderNumber))
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e("NetworkClient", "Exception in checkReadyOrders", e)
            }
            return@withContext orders
        }
    }

    suspend fun markOrderAsGlovoReady(documentId: String) {
        withContext(Dispatchers.IO) {
            try {
                // We use a PATCH request to update the specific field using updateMask
                val url = "https://firestore.googleapis.com/v1/projects/mon-bocadillo-menu/databases/(default)/documents/artifacts/mon-bocadillo-menu/public/data/orders/$documentId?updateMask.fieldPaths=isGlovoReadyClicked"
                
                val jsonStr = """
                {
                  "fields": {
                    "isGlovoReadyClicked": {
                      "booleanValue": true
                    }
                  }
                }
                """.trimIndent()

                val mediaType = "application/json; charset=utf-8".toMediaType()
                val body = jsonStr.toRequestBody(mediaType)

                // OkHttp doesn't have a direct PATCH method on builder in older versions, but you can do .method("PATCH", body)
                val request = Request.Builder()
                    .url(url)
                    .method("PATCH", body)
                    .build()

                val response = client.newCall(request).execute()
                if (response.isSuccessful) {
                    Journal.log("Statut Prêt synchronisé en base de données.")
                } else {
                    Log.e("NetworkClient", "Error updating order: ${response.code} ${response.body?.string()}")
                }
            } catch (e: Exception) {
                Log.e("NetworkClient", "Exception in markOrderAsGlovoReady", e)
            }
        }
    }

    suspend fun checkCancellationTrigger(): Boolean {
        return withContext(Dispatchers.IO) {
            try {
                val url = "https://firestore.googleapis.com/v1/projects/mon-bocadillo-menu/databases/(default)/documents/artifacts/mon-bocadillo-menu/public/data/settings/glovo_trigger"
                val request = Request.Builder().url(url).get().build()
                val response = client.newCall(request).execute()
                
                if (response.isSuccessful) {
                    val responseStr = response.body?.string() ?: return@withContext false
                    val json = JSONObject(responseStr)
                    val fields = json.optJSONObject("fields") ?: return@withContext false
                    
                    val action = fields.optJSONObject("action")?.optString("stringValue", "")
                    val isHandled = fields.optJSONObject("isHandled")?.optBoolean("booleanValue", true) ?: true
                    
                    if (action == "VERIFY_CANCELLATIONS" && !isHandled) {
                        return@withContext true
                    }
                }
            } catch (e: Exception) {
                Log.e("NetworkClient", "Exception in checkCancellationTrigger", e)
            }
            return@withContext false
        }
    }

    suspend fun markCancellationTriggerHandled() {
        withContext(Dispatchers.IO) {
            try {
                val url = "https://firestore.googleapis.com/v1/projects/mon-bocadillo-menu/databases/(default)/documents/artifacts/mon-bocadillo-menu/public/data/settings/glovo_trigger?updateMask.fieldPaths=isHandled"
                val jsonStr = """
                {
                  "fields": {
                    "isHandled": { "booleanValue": true }
                  }
                }
                """.trimIndent()
                val mediaType = "application/json; charset=utf-8".toMediaType()
                val body = jsonStr.toRequestBody(mediaType)
                val request = Request.Builder().url(url).method("PATCH", body).build()
                client.newCall(request).execute()
            } catch (e: Exception) {
                Log.e("NetworkClient", "Exception in markCancellationTriggerHandled", e)
            }
        }
    }

    suspend fun sendCancelledOrderReport(orderNumber: String, reasonText: String) {
        withContext(Dispatchers.IO) {
            try {
                val url = "https://firestore.googleapis.com/v1/projects/mon-bocadillo-menu/databases/(default)/documents/artifacts/mon-bocadillo-menu/public/data/glovo_cancellations"
                val formatter = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US)
                formatter.timeZone = java.util.TimeZone.getTimeZone("UTC")
                val createdAt = formatter.format(java.util.Date())

                val formattedReason = reasonText.replace("\"", "\\\"").replace("\n", " | ")
                val formattedOrder = orderNumber.replace("\"", "\\\"").replace("\n", " ")

                val jsonStr = """
                {
                  "fields": {
                    "orderNumber": { "stringValue": "$formattedOrder" },
                    "reasonText": { "stringValue": "$formattedReason" },
                    "createdAt": { "timestampValue": "$createdAt" }
                  }
                }
                """.trimIndent()

                val mediaType = "application/json; charset=utf-8".toMediaType()
                val body = jsonStr.toRequestBody(mediaType)
                val request = Request.Builder().url(url).post(body).build()

                val response = client.newCall(request).execute()
                if (!response.isSuccessful) {
                    Log.e("NetworkClient", "Failed to send cancelled order: ${response.code}")
                } else {
                    Journal.log("Rapport d'annulation envoyé avec succès.")
                }
            } catch (e: Exception) {
                Log.e("NetworkClient", "Exception in sendCancelledOrderReport", e)
            }
        }
    }
}
