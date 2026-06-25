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
        val firstXMatch = Regex("(?i)\\d+[ \\t\\xA0]*[xX×-]").find(fullText)
        
        val totalIndex = fullText.indexOf("Total", ignoreCase = true)
        val sousTotalIndex = fullText.indexOf("Sous-total", ignoreCase = true)
        
        var endIndex = Int.MAX_VALUE
        if (totalIndex != -1 && totalIndex > (firstXMatch?.range?.first ?: -1) && totalIndex < endIndex) endIndex = totalIndex
        if (sousTotalIndex != -1 && sousTotalIndex > (firstXMatch?.range?.first ?: -1) && sousTotalIndex < endIndex) endIndex = sousTotalIndex
        
        var finalItemsList = if (firstXMatch != null && endIndex != Int.MAX_VALUE) {
            fullText.substring(firstXMatch.range.first, endIndex).split("\n").map { it.trim() }.filter { it.isNotEmpty() }
        } else {
            itemsList
        }
        
        finalItemsList = mergeSplitItemNames(finalItemsList)

        // 4. Build structured JSON
        val json = JSONObject()
        json.put("orderId", orderId)
        json.put("source", "GLOVO")
        json.put("total", totalAmount)
        json.put("paymentMethod", paymentMethod)
        
        val itemsArray = JSONArray()
        for (line in finalItemsList) {
            itemsArray.put(formatLine(line)) 
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
        val firstXMatch = Regex("(?i)\\d+[ \\t\\xA0]*[xX×-]").find(textItems)
        
        val totalIndex = textItems.indexOf("Total", ignoreCase = true)
        val sousTotalIndex = textItems.indexOf("Sous-total", ignoreCase = true)
        
        var endIndex = Int.MAX_VALUE
        if (totalIndex != -1 && totalIndex > (firstXMatch?.range?.first ?: -1) && totalIndex < endIndex) endIndex = totalIndex
        if (sousTotalIndex != -1 && sousTotalIndex > (firstXMatch?.range?.first ?: -1) && sousTotalIndex < endIndex) endIndex = sousTotalIndex
        
        var finalItemsList = if (firstXMatch != null && endIndex != Int.MAX_VALUE) {
            textItems.substring(firstXMatch.range.first, endIndex).split("\n").map { it.trim() }.filter { it.isNotEmpty() }
        } else if (firstXMatch != null) {
            textItems.substring(firstXMatch.range.first).split("\n").map { it.trim() }.filter { it.isNotEmpty() }
        } else {
            textItems.split("\n").map { it.trim() }.filter { it.isNotEmpty() }
        }
        
        finalItemsList = mergeSplitItemNames(finalItemsList)

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
            itemsArray.put(formatLine(line)) 
        }
        json.put("items", itemsArray)
        json.put("rawItemsText", finalItemsList.joinToString("\n"))

        return json.toString()
    }

    private fun formatLine(line: String): String {
        var result = line
        val lowerLine = line.lowercase()
        
        if (lowerLine.contains("sans ")) {
            result = result.replace(Regex("(?i)sans tomate.*"), "\ud83c\udf45 SANS TOMATE")
            result = result.replace(Regex("(?i)sans oignon.*"), "\ud83e\uddc5 SANS OIGNON")
            result = result.replace(Regex("(?i)sans olive.*"), "\ud83d\udfe2 SANS OLIVE VERT")
            result = result.replace(Regex("(?i)sans laitue.*"), "\ud83e\udd57 SANS LAITUE") // 🥗
            result = result.replace(Regex("(?i)sans carotte.*"), "\ud83e\udd55 SANS CAROTTE")
            result = result.replace(Regex("(?i)sans pur[eéèê]e? de pomme[s]? de terre.*|(?i)sans pomme de terre.*"), "\ud83e\udd54 SANS POMME DE TERRE")
            result = result.replace(Regex("(?i)sans sauce mayonnaise.*|(?i)sans mayonnaise.*"), "\ud83e\udd63 SANS SAUCE MAYONNAISE")
            result = result.replace(Regex("(?i)sans harissa.*|(?i)sans hrissa.*"), "\ud83c\udf36\ufe0f SANS HRISSA")
        }
        return result
    }

    private fun mergeSplitItemNames(lines: List<String>): List<String> {
        val mergedItemsList = mutableListOf<String>()
        val quantityRegex = Regex("^(?i)\\d+[ \\t\\xA0]*[xX×]")
        val priceRegex = Regex("^[\\d.,\\s]+(MAD|DH)?$", RegexOption.IGNORE_CASE)
        val pureGarbageRegex = Regex("(?i)(%|\\d{2}:\\d{2}|Test de lecture|Livraison|Adresse|Client|Floride)")
        
        for (rawLine in lines) {
            val line = rawLine.replace(Regex("(?i)(\\bModifier\\b|\\bAccepter\\b|\\bRefuser\\b|\\bContinuer\\b|\\bAide\\b|\\+?\\s*Ajoutez un produit|\\b\\d+\\+?\\s*mins?\\b)"), "").trim()
            
            if (line.isEmpty() || line == "-") continue
            
            val isQuantityLine = quantityRegex.containsMatchIn(line)
            val isOptionLine = line.startsWith("Sans ", ignoreCase = true) || 
                               line.startsWith("Ajout ", ignoreCase = true) || 
                               line.startsWith("Avec ", ignoreCase = true) || 
                               line.startsWith("-") ||
                               line.startsWith("•") ||
                               priceRegex.matches(line)
            val isMisc = Regex("^(MAD|DH|Total|Sous-total|Produits)", RegexOption.IGNORE_CASE).containsMatchIn(line)
            val isGarbage = pureGarbageRegex.containsMatchIn(line)
            
            if (!isQuantityLine && !isOptionLine && !isMisc && !isGarbage && mergedItemsList.isNotEmpty()) {
                val lastItem = mergedItemsList.removeAt(mergedItemsList.size - 1)
                mergedItemsList.add("$lastItem $line")
            } else if (!isGarbage) {
                mergedItemsList.add(line)
            }
        }
        return mergedItemsList
    }
}
