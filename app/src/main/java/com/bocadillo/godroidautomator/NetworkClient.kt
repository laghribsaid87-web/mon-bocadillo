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
    // Default Firestore REST API URL
    private const val DEFAULT_FIRESTORE_URL = "https://firestore.googleapis.com/v1/projects/mon-bocadillo-menu/databases/(default)/documents/artifacts/mon-bocadillo-menu/public/data/Commandes_Brutes_Glovo"

    suspend fun sendOrderData(context: android.content.Context, telephoneEcran: String, contenuEcran: String, existingDocId: String? = null): String? {
        return withContext(Dispatchers.IO) {
            try {
                // Formatting payload for Firestore
                val fields = JSONObject()
                
                val rawTextObj = JSONObject().put("stringValue", contenuEcran)
                val phoneTextObj = JSONObject().put("stringValue", telephoneEcran)
                val statusObj = JSONObject().put("stringValue", "new")
                
                fields.put("raw_text", rawTextObj)
                fields.put("phone_text", phoneTextObj)
                fields.put("status", statusObj)
                
                val jsonObject = JSONObject().put("fields", fields)

                val mediaType = "application/json; charset=utf-8".toMediaType()
                val body = jsonObject.toString().toRequestBody(mediaType)

                val prefs = context.getSharedPreferences("AutomatorPrefs", android.content.Context.MODE_PRIVATE)
                val pointDeVente = prefs.getString("point_de_vente", "Laymoune") ?: "Laymoune"
                val suffix = if (pointDeVente.equals("Laymoune", ignoreCase = true) || pointDeVente.isBlank()) "" else "_$pointDeVente"
                val collectionUrl = "${DEFAULT_FIRESTORE_URL}$suffix"

                val requestBuilder = Request.Builder()

                if (existingDocId != null) {
                    val patchUrl = "$collectionUrl/$existingDocId?updateMask.fieldPaths=phone_text"
                    requestBuilder.url(patchUrl).patch(body)
                    Journal.log("Envoi PATCH vers Firestore ($existingDocId)...")
                } else {
                    requestBuilder.url(collectionUrl).post(body)
                    Journal.log("Envoi POST vers Firestore (${collectionUrl.substringAfterLast("/")})...")
                }

                val response = client.newCall(requestBuilder.build()).execute()
                val responseBody = response.body?.string() ?: ""
                
                if (response.isSuccessful) {
                    Journal.log("✅ Commande envoyée au Webhook avec succès!")
                    if (existingDocId == null && responseBody.isNotEmpty()) {
                        try {
                            val json = JSONObject(responseBody)
                            val name = json.optString("name", "")
                            if (name.isNotEmpty()) {
                                return@withContext name.substringAfterLast("/")
                            }
                        } catch (e: Exception) {}
                    }
                    return@withContext existingDocId
                } else {
                    Journal.log("❌ Erreur d'envoi Webhook: ${response.code}")
                    Journal.log("Détails: $responseBody")
                    return@withContext null
                }
            } catch (e: Exception) {
                Journal.log("❌ Exception lors de l'envoi Webhook: ${e.message}")
                return@withContext null
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

    suspend fun sendCancelledOrderCount(count: Int) {
        withContext(Dispatchers.IO) {
            try {
                val url = "https://firestore.googleapis.com/v1/projects/mon-bocadillo-menu/databases/(default)/documents/artifacts/mon-bocadillo-menu/public/data/settings/glovo_cancellations_count"
                
                val jsonStr = """
                {
                  "fields": {
                    "count": { "integerValue": "$count" },
                    "updatedAt": { "timestampValue": "${java.time.Instant.now().toString()}" }
                  }
                }
                """.trimIndent()

                val mediaType = "application/json; charset=utf-8".toMediaType()
                val body = jsonStr.toRequestBody(mediaType)
                val request = Request.Builder().url(url).method("PATCH", body).build()

                val response = client.newCall(request).execute()
                if (!response.isSuccessful) {
                    Log.e("NetworkClient", "Failed to send cancelled count: ${response.code}")
                } else {
                    Journal.log("Nombre d'annulations envoyé avec succès: $count")
                }
            } catch (e: Exception) {
                Log.e("NetworkClient", "Exception in sendCancelledOrderCount", e)
            }
        }
    }

    suspend fun incrementCancelledOrderCount() {
        withContext(Dispatchers.IO) {
            try {
                val url = "https://firestore.googleapis.com/v1/projects/mon-bocadillo-menu/databases/(default)/documents/artifacts/mon-bocadillo-menu/public/data/settings/glovo_cancellations_count"
                
                // Fetch current count
                val request = Request.Builder().url(url).build()
                val response = client.newCall(request).execute()
                var currentCount = 0
                
                if (response.isSuccessful) {
                    val bodyString = response.body?.string()
                    if (bodyString != null) {
                        val rootObj = org.json.JSONObject(bodyString)
                        val fields = rootObj.optJSONObject("fields")
                        if (fields != null) {
                            val countObj = fields.optJSONObject("count")
                            if (countObj != null) {
                                currentCount = countObj.optInt("integerValue", 0)
                            }
                        }
                    }
                }
                
                // Increment and send
                sendCancelledOrderCount(currentCount + 1)
                
            } catch (e: Exception) {
                Log.e("NetworkClient", "Exception in incrementCancelledOrderCount", e)
            }
        }
    }

    data class RuptureTask(val glovoName: String, val action: String)

    suspend fun checkRuptureTrigger(): RuptureTask? {
        return withContext(Dispatchers.IO) {
            try {
                val url = "https://firestore.googleapis.com/v1/projects/mon-bocadillo-menu/databases/(default)/documents/artifacts/mon-bocadillo-menu/public/data/settings/glovo_rupture"
                val request = Request.Builder().url(url).get().build()
                val response = client.newCall(request).execute()
                
                if (response.isSuccessful) {
                    val responseStr = response.body?.string() ?: return@withContext null
                    val json = org.json.JSONObject(responseStr)
                    val fields = json.optJSONObject("fields") ?: return@withContext null
                    
                    val status = fields.optJSONObject("status")?.optString("stringValue", "")
                    val glovoName = fields.optJSONObject("glovoName")?.optString("stringValue", "")
                    val isHandled = fields.optJSONObject("isHandled")?.optBoolean("booleanValue", true) ?: true
                    val action = fields.optJSONObject("action")?.optString("stringValue", "rupture") ?: "rupture"
                    
                    if (status == "pending_robot" && !isHandled && !glovoName.isNullOrEmpty()) {
                        return@withContext RuptureTask(glovoName, action)
                    }
                }
            } catch (e: Exception) {
                Log.e("NetworkClient", "Exception in checkRuptureTrigger", e)
            }
            return@withContext null
        }
    }

    suspend fun markRuptureTriggerHandled() {
        withContext(Dispatchers.IO) {
            try {
                val url = "https://firestore.googleapis.com/v1/projects/mon-bocadillo-menu/databases/(default)/documents/artifacts/mon-bocadillo-menu/public/data/settings/glovo_rupture?updateMask.fieldPaths=isHandled&updateMask.fieldPaths=status"
                val jsonStr = """
                {
                  "fields": {
                    "isHandled": { "booleanValue": true },
                    "status": { "stringValue": "handled" }
                  }
                }
                """.trimIndent()
                val mediaType = "application/json; charset=utf-8".toMediaType()
                val body = jsonStr.toRequestBody(mediaType)
                val request = Request.Builder().url(url).method("PATCH", body).build()
                client.newCall(request).execute()
            } catch (e: Exception) {
                Log.e("NetworkClient", "Exception in markRuptureTriggerHandled", e)
            }
        }
    }

    suspend fun dumpDebugInfo(info: String) {
        withContext(Dispatchers.IO) {
            try {
                val url = "https://firestore.googleapis.com/v1/projects/mon-bocadillo-menu/databases/(default)/documents/artifacts/mon-bocadillo-menu/public/data/settings/debug_nodes"
                
                // Escape quotes and newlines for JSON
                val escapedInfo = info.replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "")
                
                val jsonStr = """
                {
                  "fields": {
                    "dump": { "stringValue": "$escapedInfo" },
                    "timestamp": { "stringValue": "${System.currentTimeMillis()}" }
                  }
                }
                """.trimIndent()
                val mediaType = "application/json; charset=utf-8".toMediaType()
                val body = jsonStr.toRequestBody(mediaType)
                // Use PATCH to update or create
                val request = Request.Builder().url(url).method("PATCH", body).build()
                val response = client.newCall(request).execute()
                if (response.isSuccessful) {
                    Journal.log("Infos de debug envoyées à Firebase avec succès.")
                } else {
                    Journal.log("Erreur envoi debug: ${response.code} ${response.body?.string()}")
                }
            } catch (e: Exception) {
                Log.e("NetworkClient", "Exception in dumpDebugInfo", e)
            }
        }
    }
}
