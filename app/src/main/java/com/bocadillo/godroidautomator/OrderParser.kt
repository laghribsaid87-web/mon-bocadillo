package com.bocadillo.godroidautomator

import android.graphics.Rect
import android.view.accessibility.AccessibilityNodeInfo
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.abs

object OrderParser {

    fun parseOrderScreen(nodesList: MutableList<Pair<Rect, String>>, rectNum: android.graphics.Rect? = null): String {
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

        var totalY = -1
        var totalX = -1

        // First pass: Find "Total" to know which pane is the order details (useful for tablets)
        for (node in nodesList) {
            if (node.second.equals("Total", ignoreCase = true)) {
                totalY = node.first.top
                totalX = node.first.centerX()
                break
            }
        }

        // 1. Find Order ID and Boundaries
        for (node in nodesList) {
            val text = node.second
            val rect = node.first

            // Find Order ID (# followed by digits/letters)
            if (text.matches(Regex("^#[0-9A-Za-z]+.*"))) {
                val inHorizontalPane = totalX == -1 || abs(rect.centerX() - totalX) < 500
                val inCropRect = rectNum == null || android.graphics.Rect.intersects(rectNum, rect)
                
                if (inHorizontalPane && inCropRect) {
                    if (orderId.isEmpty()) {
                        orderId = text.split(" ")[0]
                    }
                }
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

        // Build the raw items list (Line by line)
        val sortedKeys = itemsGroupedByY.keys.sorted()
        for (k in sortedKeys) {
            val lineTexts = itemsGroupedByY[k]!!
            itemsList.add(lineTexts.joinToString(" "))
        }

        // 3. Filter items using the "1 x to MAD" rule
        val fullText = itemsList.joinToString("\n")
        val firstXMatch = Regex("\\d+\\s*[xX]").find(fullText)
        val lastMadIndex = fullText.lastIndexOf("MAD", ignoreCase = true)
        
        val finalItemsList = if (firstXMatch != null && lastMadIndex != -1 && lastMadIndex > firstXMatch.range.first) {
            fullText.substring(firstXMatch.range.first, lastMadIndex + 3).split("\n").map { it.trim() }.filter { it.isNotEmpty() }
        } else {
            itemsList
        }

        // 4. Build structured JSON
        val json = JSONObject()
        json.put("orderId", orderId)
        json.put("source", "GLOVO")
        json.put("total", totalAmount)
        json.put("paymentMethod", paymentMethod)
        
        val itemsArray = JSONArray()
        for (line in finalItemsList) {
            itemsArray.put(line) 
        }
        json.put("items", itemsArray)
        
        json.put("rawItemsText", finalItemsList.joinToString("\n"))

        return json.toString()
    }

}
