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
                
                // 1. Extract Order Number
                val orderRegex = Regex("#([0-9]+)")
                val orderMatch = orderRegex.find(contenuEcran) ?: orderRegex.find(telephoneEcran)
                val orderNumber = orderMatch?.groupValues?.get(1) ?: "GLOVO-APP"

                // 2. Extract Exact Total Price (Supports MAD, DH, DHS, dhs)
                val priceRegex = Regex("([0-9]+[.,]?[0-9]*)\\s*(MAD|DH|DHS)", RegexOption.IGNORE_CASE)
                val priceMatches = priceRegex.findAll(contenuEcran).toList()
                val extractedTotalString = priceMatches.lastOrNull()?.groupValues?.get(1)?.replace(",", ".") ?: "0.0"
                val extractedTotal = extractedTotalString.toDoubleOrNull() ?: 0.0

                // 3. Format strings
                // KDS Note (Order Details only)
                val formattedContent = contenuEcran.replace("\"", "\\\"").replace("\n", " ")
                // Phone string (Idara)
                val formattedPhone = telephoneEcran.replace("\"", "\\\"").replace("\n", " ")

                val formatter = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US)
                formatter.timeZone = java.util.TimeZone.getTimeZone("UTC")
                val createdAt = formatter.format(java.util.Date())

                val lines = contenuEcran.split("\n").map { it.trim() }.filter { it.isNotEmpty() }
                
                var parsedItemsJsonArray = ""
                
                try {
                    val itemsList = mutableListOf<JSONObject>()
                    var i = 0
                    
                    while (i < lines.size) {
                        var line = lines[i]
                        
                        var qty: Int
                        var name: String
                        
                        val newFormatMatch = Regex("^([0-9]+)\\s*x\\s+(.*)\$").find(line)
                        if (newFormatMatch != null) {
                            qty = newFormatMatch.groupValues[1].toIntOrNull() ?: 1
                            name = newFormatMatch.groupValues[2].trim()
                            i++
                        } else {
                            val oldFormatMatch = Regex("^([0-9]+)\$").find(line)
                            if (oldFormatMatch != null && i + 1 < lines.size) {
                                qty = oldFormatMatch.groupValues[1].toIntOrNull() ?: 1
                                name = lines[i+1].trim()
                                i += 2
                            } else {
                                i++
                                continue
                            }
                        }
                        
                        val currentItem = JSONObject()
                        currentItem.put("qty", qty)
                        currentItem.put("price", 0.0)
                        
                        val inlinePriceMatch = Regex("([0-9]+[.,]?[0-9]*)\\s*(MAD|DH|DHS)").find(name)
                        if (inlinePriceMatch != null) {
                            val p = inlinePriceMatch.groupValues[1].replace(",", ".").toDoubleOrNull() ?: 0.0
                            currentItem.put("price", p)
                            name = name.replace(inlinePriceMatch.value, "").trim()
                        } else if (i < lines.size) {
                            val nextLine = lines[i]
                            val priceMatch = Regex("([0-9]+[.,]?[0-9]*)\\s*(MAD|DH|DHS)", RegexOption.IGNORE_CASE).find(nextLine)
                            if (priceMatch != null) {
                                val p = priceMatch.groupValues[1].replace(",", ".").toDoubleOrNull() ?: 0.0
                                currentItem.put("price", p)
                                i++
                            }
                        }
                        
                        val optionsBuffer = mutableListOf<String>()
                        while (i < lines.size) {
                            val optLine = lines[i]
                            if (Regex("^([1-9][0-9]*)\$").matches(optLine)) break 
                            if (Regex("^([1-9][0-9]*)\\s*x\\s+(.*)\$").matches(optLine)) break 
                            if (Regex("(?i).*(MAD|DH|DHS).*").matches(optLine) && !optLine.startsWith("--")) break
                            if (optLine.equals("Sous-total", ignoreCase = true) || optLine.equals("Total", ignoreCase = true) || optLine.startsWith("Prêt pour", ignoreCase = true)) break
                            
                            optionsBuffer.add(optLine)
                            i++
                        }
                        
                        if (optionsBuffer.isNotEmpty()) {
                            name = name + "\n" + optionsBuffer.joinToString("\n")
                        }
                        
                        currentItem.put("name", name)
                        itemsList.add(currentItem)
                    }
                    
                    if (itemsList.isNotEmpty()) {
                        parsedItemsJsonArray = itemsList.map { item ->
                            """
                            {
                              "mapValue": {
                                "fields": {
                                  "name": { "stringValue": "${item.getString("name").replace("\"", "\\\"").replace("\n", "\\n")}" },
                                  "qty": { "integerValue": "${item.getInt("qty")}" },
                                  "price": { "doubleValue": ${item.getDouble("price")} }
                                }
                              }
                            }
                            """.trimIndent()
                        }.joinToString(",")
                    } else {
                        parsedItemsJsonArray = """
                            {
                              "mapValue": {
                                "fields": {
                                  "name": { "stringValue": "COMMANDE GLOVO" },
                                  "qty": { "integerValue": "1" },
                                  "price": { "doubleValue": $extractedTotal }
                                }
                              }
                            }
                        """.trimIndent()
                    }
                } catch (e: Exception) {
                    parsedItemsJsonArray = """
                        {
                          "mapValue": {
                            "fields": {
                              "name": { "stringValue": "COMMANDE GLOVO" },
                              "qty": { "integerValue": "1" },
                              "price": { "doubleValue": $extractedTotal }
                            }
                          }
                        }
                    """.trimIndent()
                }

                // Structure of Firestore REST document for an order
                val jsonStr = """
                {
                  "fields": {
                    "source": { "stringValue": "glovo" },
                    "status": { "stringValue": "preparing" },
                    "orderNumber": { "stringValue": "$orderNumber" },
                    "total": { "doubleValue": $extractedTotal },
                    "createdAt": { "timestampValue": "$createdAt" },
                    "items": {
                      "arrayValue": {
                        "values": [
                          $parsedItemsJsonArray
                        ]
                      }
                    },
                    "orderNote": { "stringValue": "$formattedContent" },
                    "phone": { "stringValue": "$formattedPhone" },
                    "customerName": { "stringValue": "Client Glovo" },
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
