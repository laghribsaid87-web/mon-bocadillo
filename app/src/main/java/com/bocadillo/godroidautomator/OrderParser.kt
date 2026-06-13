package com.bocadillo.godroidautomator

import android.graphics.Rect
import android.view.accessibility.AccessibilityNodeInfo
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.abs

object OrderParser {

    fun parseOrderScreen(nodesList: MutableList<Pair<Rect, String>>): String {
        if (nodesList.isEmpty()) return "{}"

        // Sort by Y first, then X
        nodesList.sortWith(Comparator { a, b ->
            val yDiff = a.first.top - b.first.top
            if (abs(yDiff) < 20) {
                a.first.left.compareTo(b.first.left)
            } else {
                yDiff.compareTo(0)
            }
        })

        var orderId = ""
        var totalAmount = 0.0
        var paymentMethod = "ONLINE" // Default
        val itemsList = mutableListOf<String>()

        var yStartItems = 0
        var yEndItems = 999999
        
        var totalY = -1

        // 1. Find Order ID and Boundaries
        for (node in nodesList) {
            val text = node.second
            val rect = node.first

            // Find Order ID (# followed by digits/letters)
            if (text.matches(Regex("^#[0-9A-Za-z]+.*"))) {
                orderId = text.split(" ")[0]
                yStartItems = rect.bottom // Items start below the Order ID card
            }

            // Find End of items ("Sous-total" or "TVA")
            if (text.equals("Sous-total", ignoreCase = true) || 
                text.equals("TVA (incl.)", ignoreCase = true) || 
                text.equals("Total", ignoreCase = true)) {
                if (rect.top < yEndItems) {
                    yEndItems = rect.top // Items end above the totals section
                }
            }

            // Find Total Amount
            if (text.equals("Total", ignoreCase = true)) {
                totalY = rect.top
            }

            // Find Payment Method
            val lowerText = text.lowercase()
            if (lowerText.contains("cash") || lowerText.contains("espèce") || lowerText.contains("espece")) {
                paymentMethod = "CASH"
            } else if (lowerText.contains("carte de crédit") || lowerText.contains("credit") || lowerText.contains("en ligne")) {
                paymentMethod = "CREDIT_CARD"
            }
        }

        // Extract total amount (it should be on the same Y line as "Total" or right below)
        if (totalY != -1) {
            for (node in nodesList) {
                if (abs(node.first.top - totalY) < 30 && node.second.contains("MAD", ignoreCase = true)) {
                    val priceStr = node.second.replace(Regex("[^0-9,]"), "").replace(",", ".")
                    totalAmount = priceStr.toDoubleOrNull() ?: 0.0
                }
            }
        }

        // 2. Extract Items between Y bounds
        val itemsGroupedByY = mutableMapOf<Int, MutableList<String>>()
        for (node in nodesList) {
            val rect = node.first
            val text = node.second
            
            // Allow a small margin (e.g. 50px) to ensure we don't miss the first item or last item
            if (rect.top >= (yStartItems - 10) && rect.bottom <= (yEndItems + 10)) {
                // Group by Y line (tolerance 20px)
                var foundKey = -1
                for (k in itemsGroupedByY.keys) {
                    if (abs(k - rect.top) < 20) {
                        foundKey = k
                        break
                    }
                }
                if (foundKey == -1) {
                    itemsGroupedByY[rect.top] = mutableListOf(text)
                } else {
                    itemsGroupedByY[foundKey]!!.add(text)
                }
            }
        }

        // Build the raw items list (Line by line)
        val sortedKeys = itemsGroupedByY.keys.sorted()
        for (k in sortedKeys) {
            val lineTexts = itemsGroupedByY[k]!!
            itemsList.add(lineTexts.joinToString(" "))
        }

        // 3. Build structured JSON
        val json = JSONObject()
        json.put("orderId", orderId)
        json.put("source", "GLOVO")
        json.put("total", totalAmount)
        json.put("paymentMethod", paymentMethod)
        
        val itemsArray = JSONArray()
        for (line in itemsList) {
            itemsArray.put(line) // We send the lines exactly as they appear in the grey frame
        }
        json.put("items", itemsArray)
        
        // We can also send the raw concatenated items text for fallback
        json.put("rawItemsText", itemsList.joinToString("\n"))

        return json.toString()
    }

}
