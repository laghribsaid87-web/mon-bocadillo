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

        var totalY = -1

        // 1. Find Order ID and Boundaries
        for (node in nodesList) {
            val text = node.second
            val rect = node.first

            // Find Order ID (# followed by digits/letters)
            if (text.matches(Regex("^#[0-9A-Za-z]+.*"))) {
                orderId = text.split(" ")[0]
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

        // 3. Filter items using the "1 x to MAD/Total" rule
        val fullText = itemsList.joinToString("\n")
        val firstXMatch = Regex("(?i)\\d+[ \\t\\xA0]*[xX×]").find(fullText)
        
        val madIndex = fullText.indexOf("MAD", ignoreCase = true)
        val totalIndex = fullText.indexOf("Total", ignoreCase = true)
        val sousTotalIndex = fullText.indexOf("Sous-total", ignoreCase = true)
        
        var endIndex = Int.MAX_VALUE
        if (madIndex != -1 && madIndex > (firstXMatch?.range?.first ?: -1) && madIndex < endIndex) endIndex = madIndex
        if (totalIndex != -1 && totalIndex > (firstXMatch?.range?.first ?: -1) && totalIndex < endIndex) endIndex = totalIndex
        if (sousTotalIndex != -1 && sousTotalIndex > (firstXMatch?.range?.first ?: -1) && sousTotalIndex < endIndex) endIndex = sousTotalIndex
        
        val finalItemsList = if (firstXMatch != null && endIndex != Int.MAX_VALUE) {
            fullText.substring(firstXMatch.range.first, endIndex).split("\n").map { it.trim() }.filter { it.isNotEmpty() }
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

    fun parseOcrScreen(textItems: String, textNum: String, fullScreenText: String): String {
        // 1. Extract Order ID from textNum or fullScreenText
        var orderId = ""
        val numMatch = Regex("#[0-9A-Za-z]+").find(textNum)
        if (numMatch != null) {
            orderId = numMatch.value
        } else {
            val fullMatch = Regex("#[0-9A-Za-z]+").find(fullScreenText)
            if (fullMatch != null) {
                orderId = fullMatch.value
            }
        }

        // 2. Extract Payment Method
        var paymentMethod = "ONLINE"
        val lowerText = fullScreenText.lowercase()
        if (lowerText.contains("cash") || lowerText.contains("espèce") || lowerText.contains("espece") || lowerText.contains("espèces")) {
            paymentMethod = "CASH"
        } else if (lowerText.contains("carte de crédit") || lowerText.contains("credit") || lowerText.contains("en ligne")) {
            paymentMethod = "CREDIT_CARD"
        }

        // 3. Extract items using "1 x to MAD/Total" rule on textItems
        val firstXMatch = Regex("(?i)\\d+[ \\t\\xA0]*[xX×]").find(textItems)
        
        val madIndex = textItems.indexOf("MAD", ignoreCase = true)
        val totalIndex = textItems.indexOf("Total", ignoreCase = true)
        val sousTotalIndex = textItems.indexOf("Sous-total", ignoreCase = true)
        
        var endIndex = Int.MAX_VALUE
        if (madIndex != -1 && madIndex > (firstXMatch?.range?.first ?: -1) && madIndex < endIndex) endIndex = madIndex
        if (totalIndex != -1 && totalIndex > (firstXMatch?.range?.first ?: -1) && totalIndex < endIndex) endIndex = totalIndex
        if (sousTotalIndex != -1 && sousTotalIndex > (firstXMatch?.range?.first ?: -1) && sousTotalIndex < endIndex) endIndex = sousTotalIndex
        
        val finalItemsList = if (firstXMatch != null && endIndex != Int.MAX_VALUE) {
            textItems.substring(firstXMatch.range.first, endIndex).split("\n").map { it.trim() }.filter { it.isNotEmpty() }
        } else if (firstXMatch != null) {
            textItems.substring(firstXMatch.range.first).split("\n").map { it.trim() }.filter { it.isNotEmpty() }
        } else {
            textItems.split("\n").map { it.trim() }.filter { it.isNotEmpty() }
        }

        // 4. Extract Total Amount
        var totalAmount = 0.0
        // Find all prices with MAD or DH (e.g. "150,00 MAD", "150.00 MAD", "15 MAD")
        val priceMatches = Regex("(\\d+[.,]?\\d*)\\s*(?:MAD|DH)", RegexOption.IGNORE_CASE).findAll(fullScreenText).toList()
        if (priceMatches.isNotEmpty()) {
            // The last price on the screen is almost always the Total
            val lastPriceStr = priceMatches.last().groupValues[1].replace(",", ".")
            totalAmount = lastPriceStr.toDoubleOrNull() ?: 0.0
        }

        // 5. Build JSON
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
