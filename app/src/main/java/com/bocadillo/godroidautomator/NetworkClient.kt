package com.bocadillo.godroidautomator

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject

object NetworkClient {

    private fun getBranchSuffix(context: android.content.Context): String {
        val prefs = context.getSharedPreferences("AutomatorPrefs", android.content.Context.MODE_PRIVATE)
        val branch = prefs.getString("point_de_vente", "Laymoune")
        return when (branch) {
            "OumRabii" -> "_OumRabii"
            "Zoubire" -> "_Zoubire"
            else -> ""
        }
    }

    private fun getBranchId(context: android.content.Context): String {
        val prefs = context.getSharedPreferences("AutomatorPrefs", android.content.Context.MODE_PRIVATE)
        val branch = prefs.getString("point_de_vente", "Laymoune")
        return when (branch) {
            "OumRabii" -> "oum_rabii"
            "Zoubire" -> "zoubire"
            else -> "laymoune"
        }
    }

    private val client = OkHttpClient()
    // Default Firestore REST API URL
    private const val DEFAULT_FIRESTORE_URL = "https://firestore.googleapis.com/v1/projects/mon-bocadillo-menu/databases/(default)/documents/artifacts/mon-bocadillo-menu/public/data/Commandes_Brutes_Glovo"

    suspend fun sendGroupedOrders(context: android.content.Context, orderIds: List<String>) {
        withContext(Dispatchers.IO) {
            try {
                val fields = JSONObject()
                
                val typeObj = JSONObject()
                typeObj.put("stringValue", "GROUP_ORDERS")
                
                val elementsArray = JSONArray()
                for (id in orderIds) {
                    val idObj = JSONObject()
                    idObj.put("stringValue", id)
                    elementsArray.put(idObj)
                }
                
                val arrayValue = JSONObject()
                arrayValue.put("values", elementsArray)
                
                val ordersObj = JSONObject()
                ordersObj.put("arrayValue", arrayValue)
                
                fields.put("type", typeObj)
                fields.put("orders", ordersObj)
                
                val statusObj = JSONObject()
                statusObj.put("stringValue", "new")
                fields.put("status", statusObj)
                
                val jsonObject = JSONObject()
                jsonObject.put("fields", fields)
                val body = jsonObject.toString().toRequestBody("application/json; charset=utf-8".toMediaType())
                
                val prefs = context.getSharedPreferences("AutomatorPrefs", android.content.Context.MODE_PRIVATE)
                val pointDeVente = prefs.getString("point_de_vente", "Laymoune") ?: "Laymoune"
                val suffix = if (pointDeVente.equals("Laymoune", ignoreCase = true) || pointDeVente.isBlank()) "" else "_$pointDeVente"
                val collectionUrl = "${DEFAULT_FIRESTORE_URL}$suffix"
                
                val requestBuilder = Request.Builder().url(collectionUrl).post(body)
                val response = client.newCall(requestBuilder.build()).execute()
                if (response.isSuccessful) {
                    Journal.log("✅ Groupe envoyé au Webhook (${orderIds.joinToString(", ")})")
                } else {
                    Journal.log("❌ Erreur envoi groupe: ${response.code}")
                }
            } catch (e: Exception) {
                Journal.log("❌ Exception envoi groupe: ${e.message}")
            }
        }
    }

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

    suspend fun checkReadyOrders(context: android.content.Context): List<ReadyOrder> {
        return withContext(Dispatchers.IO) {
            val branchId = getBranchId(context)
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
                          },
                          {
                            "fieldFilter": {
                              "field": {"fieldPath": "nearestBranch.id"},
                              "op": "EQUAL",
                              "value": {"stringValue": "$branchId"}
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

    suspend fun markOrderAsGlovoReady(documentId: String, pickupCode: String? = null) {
        withContext(Dispatchers.IO) {
            try {
                // We use a PATCH request to update the specific field using updateMask
                val url = "https://firestore.googleapis.com/v1/projects/mon-bocadillo-menu/databases/(default)/documents/artifacts/mon-bocadillo-menu/public/data/orders/$documentId"
                
                val fields = JSONObject()
                fields.put("isGlovoReadyClicked", JSONObject().put("booleanValue", true))
                if (pickupCode != null) {
                    fields.put("pickupCode", JSONObject().put("stringValue", pickupCode))
                }
                
                val jsonObject = JSONObject().put("fields", fields)

                val mediaType = "application/json; charset=utf-8".toMediaType()
                val body = jsonObject.toString().toRequestBody(mediaType)
                
                var patchUrl = "$url?updateMask.fieldPaths=isGlovoReadyClicked"
                if (pickupCode != null) {
                    patchUrl += "&updateMask.fieldPaths=pickupCode"
                }

                // OkHttp doesn't have a direct PATCH method on builder in older versions, but you can do .method("PATCH", body)
                val request = Request.Builder()
                    .url(patchUrl)
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

    suspend fun checkExtractionOrders(context: android.content.Context): List<ReadyOrder> {
        return withContext(Dispatchers.IO) {
            val branchId = getBranchId(context)
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
                              "field": {"fieldPath": "needsAutomatorExtraction"},
                              "op": "EQUAL",
                              "value": {"booleanValue": true}
                            }
                          },
                          {
                            "fieldFilter": {
                              "field": {"fieldPath": "source"},
                              "op": "EQUAL",
                              "value": {"stringValue": "glovo"}
                            }
                          },
                          {
                            "fieldFilter": {
                              "field": {"fieldPath": "nearestBranch.id"},
                              "op": "EQUAL",
                              "value": {"stringValue": "$branchId"}
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
                        
                        val isExtractionDone = fields.optJSONObject("isExtractionDone")?.optBoolean("booleanValue", false) ?: false
                        if (!isExtractionDone) {
                            
                            // Délais de 1 minute (60 secondes) avant d'extraire
                            val createTimeStr = document.optString("createTime", "")
                            var isOldEnough = true
                            if (createTimeStr.isNotEmpty()) {
                                try {
                                    val instant = java.time.Instant.parse(createTimeStr)
                                    val now = java.time.Instant.now()
                                    val duration = java.time.Duration.between(instant, now)
                                    if (duration.seconds < 60) {
                                        isOldEnough = false
                                    }
                                } catch (e: Exception) {}
                            }
                            
                            if (!isOldEnough) {
                                continue // On passe à la commande suivante, on réessaiera au prochain tour de boucle
                            }

                            val docName = document.optString("name")
                            val docId = docName.substringAfterLast("/")
                            val orderNumber = fields.optJSONObject("orderNumber")?.optString("stringValue", "") ?: ""
                            orders.add(ReadyOrder(docId, orderNumber))
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e("NetworkClient", "Exception in checkExtractionOrders", e)
            }
            return@withContext orders
        }
    }

    suspend fun markOrderExtractionDone(documentId: String, pickupCode: String? = null) {
        withContext(Dispatchers.IO) {
            try {
                val url = "https://firestore.googleapis.com/v1/projects/mon-bocadillo-menu/databases/(default)/documents/artifacts/mon-bocadillo-menu/public/data/orders/$documentId"
                
                val fields = JSONObject()
                fields.put("isExtractionDone", JSONObject().put("booleanValue", true))
                if (pickupCode != null) {
                    fields.put("pickupCode", JSONObject().put("stringValue", pickupCode))
                }
                
                val jsonObject = JSONObject().put("fields", fields)
                val mediaType = "application/json; charset=utf-8".toMediaType()
                val body = jsonObject.toString().toRequestBody(mediaType)
                
                var patchUrl = "$url?updateMask.fieldPaths=isExtractionDone"
                if (pickupCode != null) {
                    patchUrl += "&updateMask.fieldPaths=pickupCode"
                }

                val request = Request.Builder()
                    .url(patchUrl)
                    .method("PATCH", body)
                    .build()

                val response = client.newCall(request).execute()
                if (response.isSuccessful) {
                    Journal.log("Extraction marquée comme terminée pour $documentId.")
                } else {
                    Log.e("NetworkClient", "Error updating extraction status: ${response.code} ${response.body?.string()}")
                }
            } catch (e: Exception) {
                Log.e("NetworkClient", "Exception in markOrderExtractionDone", e)
            }
        }
    }

    suspend fun checkCancellationTrigger(context: android.content.Context): Boolean {
        return withContext(Dispatchers.IO) {
            try {
                val suffix = getBranchSuffix(context)
                val url = "https://firestore.googleapis.com/v1/projects/mon-bocadillo-menu/databases/(default)/documents/artifacts/mon-bocadillo-menu/public/data/settings/glovo_trigger$suffix"
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

    suspend fun markCancellationTriggerHandled(context: android.content.Context) {
        withContext(Dispatchers.IO) {
            try {
                val suffix = getBranchSuffix(context)
                val url = "https://firestore.googleapis.com/v1/projects/mon-bocadillo-menu/databases/(default)/documents/artifacts/mon-bocadillo-menu/public/data/settings/glovo_trigger$suffix?updateMask.fieldPaths=isHandled"
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

    suspend fun checkRuptureTrigger(context: android.content.Context): RuptureTask? {
        return withContext(Dispatchers.IO) {
            try {
                val suffix = getBranchSuffix(context)
                val url = "https://firestore.googleapis.com/v1/projects/mon-bocadillo-menu/databases/(default)/documents/artifacts/mon-bocadillo-menu/public/data/settings/glovo_rupture$suffix"
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

    suspend fun markRuptureTriggerHandled(context: android.content.Context) {
        withContext(Dispatchers.IO) {
            try {
                val suffix = getBranchSuffix(context)
                val url = "https://firestore.googleapis.com/v1/projects/mon-bocadillo-menu/databases/(default)/documents/artifacts/mon-bocadillo-menu/public/data/settings/glovo_rupture$suffix?updateMask.fieldPaths=isHandled&updateMask.fieldPaths=status"
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
