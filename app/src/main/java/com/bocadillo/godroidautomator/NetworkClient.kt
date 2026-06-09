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
                // Structure of Firestore REST document
                val json = JSONObject().apply {
                    put("fields", JSONObject().apply {
                        put("telephoneEcran", JSONObject().put("stringValue", telephoneEcran))
                        put("contenuEcran", JSONObject().put("stringValue", contenuEcran))
                        put("source", JSONObject().put("stringValue", "godroid_automator_app"))
                    })
                }

                val mediaType = "application/json; charset=utf-8".toMediaType()
                val body = json.toString().toRequestBody(mediaType)

                val request = Request.Builder()
                    .url(FIRESTORE_URL)
                    .post(body)
                    .build()

                Log.d("NetworkClient", "Sending POST to Firestore...")
                val response = client.newCall(request).execute()
                
                if (response.isSuccessful) {
                    Log.d("NetworkClient", "Successfully sent to Firestore! Response: ${response.body?.string()}")
                } else {
                    Log.e("NetworkClient", "Error sending to Firestore: ${response.code} - ${response.body?.string()}")
                }
            } catch (e: Exception) {
                Log.e("NetworkClient", "Exception in sendOrderData", e)
            }
        }
    }
}
