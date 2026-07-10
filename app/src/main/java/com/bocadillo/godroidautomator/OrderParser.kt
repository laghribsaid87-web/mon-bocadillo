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

        // 2. Extract Items sequentially
        // We no longer rely on Y coordinates because scrolling changes them.
        // The garbage filter and foundFirstQuantity will handle ignoring the header and footer.
        for (node in nodesList) {
            val text = node.second
            val lowerText = text.lowercase()
            
            if (lowerText.contains("sous-total") || lowerText == "total" || lowerText.contains("ajoutez un produit") || lowerText.contains("tva")) {
                break // End of order items
            }
            
            itemsList.add(text)
        }
        
        var finalItemsList: List<String> = itemsList
        
        finalItemsList = mergeSplitItemNames(finalItemsList)
        finalItemsList = mergeAdjacentDuplicates(finalItemsList)

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
        val firstXMatch = Regex("(?i)(?:^|\\n)[^a-zA-Z0-9]*(?:\\d+[ \\t\\xA0]*)?[xX×-](?:[ \\t\\xA0]+|\\n|$)").find(textItems)
        
        var finalItemsList = if (firstXMatch != null) {
            textItems.substring(firstXMatch.range.first).split("\n").map { it.trim() }.filter { it.isNotEmpty() }
        } else {
            textItems.split("\n").map { it.trim() }.filter { it.isNotEmpty() }
        }

        finalItemsList = mergeSplitItemNames(finalItemsList)
        finalItemsList = mergeAdjacentDuplicates(finalItemsList)

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
        var result = line.replace("\"", "") // Remove double quotes
        result = result.replace("Œ", "Oe").replace("œ", "oe")
        
        // The user says anything with EXTRA should be GREEN.
        // In the KDS, the word "EXTRA" makes it green. If the Arabic translation removes "EXTRA", it won't be green.
        // So we append "EXTRA" to the end of translated strings, OR we let the user fix it in their KDS visual editor.
        // The best approach is to clean the string and if it starts with extra, force it uppercase.
        
        val lowerLine = result.lowercase()
        
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
        val quantityRegex = Regex("^(?i)[^a-zA-Z0-9]*(?:\\d+[ \\t\\xA0]*)?[xX×](?:[ \\t\\xA0]+|$)")
        val pureNumberRegex = Regex("^\\d+$")
        val priceRegex = Regex("^[\\d.,\\s]+(MAD|DH)$", RegexOption.IGNORE_CASE)
        val pureGarbageRegex = Regex("(?i)(^0$|%|\\d{2}:\\d{2}|^\\d{9,15}.*|Test de lecture|Livraison|Adresse|Client|Floride|TVA|Sous-total|Total|Le coursier.*|Coursier.*|Notre coursier.*|.*livrée.*|ESPÈCES|ESPCES|CASH|PAIEMENT EN LIGNE|Ajoutez un produit|--|Modifier|Accepter|Refuser|Continuer|Aide|mins?|.*produits?.*|.*Afficher.*|.*code QR.*|.*Nouvelle.*|.*Acceptée.*|.*À venir.*|.*est en route.*|.*Carte Google.*|.*Repère.*|.*#\\d+.*|.*Mon Bocadillo.*)")
        
        var foundFirstQuantity = false
        var lastSkippedLine = ""
        
        for (rawLine in lines) {
            val line = rawLine.replace(Regex("(?i)(\\bModifier\\b|\\bAccepter\\b|\\bRefuser\\b|\\bContinuer\\b|\\bAide\\b|\\+?\\s*Ajoutez un produit|\\b\\d+\\+?\\s*mins?\\b)"), "").trim()
            
            if (line.isEmpty() || line == "-" || line == "--" || line == "---") continue
            
            val isGarbage = pureGarbageRegex.containsMatchIn(line) || priceRegex.matches(line)
            
            if (!foundFirstQuantity) {
                if (quantityRegex.containsMatchIn(line) || line.lowercase() == "x" || line == "×") {
                    foundFirstQuantity = true
                    if (pureNumberRegex.matches(lastSkippedLine)) {
                        mergedItemsList.add(lastSkippedLine)
                    }
                } else {
                    if (!isGarbage) {
                        lastSkippedLine = line
                    }
                    continue // Ignore tout ce qui précède la première quantité
                }
            }
            
            if (isGarbage) continue
            
            if ((line == "x" || line == "X" || line == "×") && mergedItemsList.isNotEmpty() && pureNumberRegex.matches(mergedItemsList.last().trim())) {
                val lastItem = mergedItemsList.removeAt(mergedItemsList.size - 1)
                mergedItemsList.add("${lastItem}x")
                continue
            }
            
            val isQuantityLine = quantityRegex.containsMatchIn(line) || pureNumberRegex.matches(line)
            val isOptionLine = line.startsWith("Sans ", ignoreCase = true) || 
                               line.startsWith("Ajout ", ignoreCase = true) || 
                               line.startsWith("Avec ", ignoreCase = true) || 
                               line.startsWith("Extra ", ignoreCase = true) || 
                               line.startsWith("-") ||
                               line.startsWith("+")
            val isMisc = Regex("^(MAD|DH|Total|Sous-total|Produits)", RegexOption.IGNORE_CASE).containsMatchIn(line)
              
            if (mergedItemsList.isNotEmpty()) {
                val lastItem = mergedItemsList.last().trim()
                if (!isQuantityLine && !isMisc) {
                    if (isOptionLine) {
                        if (quantityRegex.matches(lastItem) || pureNumberRegex.matches(lastItem)) {
                            mergedItemsList.removeAt(mergedItemsList.size - 1)
                            mergedItemsList.add("$lastItem $line")
                            continue
                        }
                    } else {
                        if (line.contains("afak", ignoreCase = true) || line.contains("merci", ignoreCase = true) || line.contains("stp", ignoreCase = true) || line.contains("svp", ignoreCase = true)) {
                            mergedItemsList.add("NOTE: $line")
                            continue
                        } else {
                            mergedItemsList.removeAt(mergedItemsList.size - 1)
                            mergedItemsList.add("$lastItem $line")
                            continue
                        }
                    }
                }
            }
            
            mergedItemsList.add(line)
        }
        
        // Remove any dangling quantities or pure numbers that didn't merge with an item
        return mergedItemsList.filter { !it.matches(Regex("^(?i)\\d+[xX×-]?$")) }
    }

    private fun mergeAdjacentDuplicates(lines: List<String>): List<String> {
        if (lines.isEmpty()) return lines
        val result = mutableListOf<String>()
        var currentLine = lines[0]
        
        val quantityRegex = Regex("^(?i)(\\d+)[ \\t\\xA0]*[xX×][ \\t\\xA0]*(.*)$")
        
        for (i in 1 until lines.size) {
            val nextLine = lines[i]
            
            val matchCurrent = quantityRegex.find(currentLine)
            val matchNext = quantityRegex.find(nextLine)
            
            if (matchCurrent != null && matchNext != null) {
                val qty1 = matchCurrent.groupValues[1].toIntOrNull() ?: 1
                val name1 = matchCurrent.groupValues[2].trim()
                
                val qty2 = matchNext.groupValues[1].toIntOrNull() ?: 1
                val name2 = matchNext.groupValues[2].trim()
                
                if (name1.equals(name2, ignoreCase = true)) {
                    currentLine = "${qty1 + qty2}x $name1"
                } else {
                    result.add(currentLine)
                    currentLine = nextLine
                }
            } else {
                result.add(currentLine)
                currentLine = nextLine
            }
        }
        result.add(currentLine)
        return result
    }
}
