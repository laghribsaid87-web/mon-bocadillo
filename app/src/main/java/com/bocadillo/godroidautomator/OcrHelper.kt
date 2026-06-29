package com.bocadillo.godroidautomator

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Rect
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.view.Display
import android.content.ContentValues
import androidx.annotation.RequiresApi
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

object OcrHelper {

    @RequiresApi(Build.VERSION_CODES.R)
    suspend fun captureScreenBitmap(service: AccessibilityService): Bitmap? = suspendCancellableCoroutine { continuation ->
        try {
            service.takeScreenshot(Display.DEFAULT_DISPLAY, service.mainExecutor, object : AccessibilityService.TakeScreenshotCallback {
                override fun onSuccess(screenshotResult: AccessibilityService.ScreenshotResult) {
                    try {
                        val hardwareBuffer = screenshotResult.hardwareBuffer
                        val colorSpace = screenshotResult.colorSpace
                        val bitmap = Bitmap.wrapHardwareBuffer(hardwareBuffer, colorSpace)
                        
                        // Convert Hardware Bitmap to Software Bitmap for ML Kit
                        val softwareBitmap = bitmap?.copy(Bitmap.Config.ARGB_8888, false)
                        bitmap?.recycle()
                        hardwareBuffer.close()
                        
                        // Save a copy to the Gallery for debugging
                        if (softwareBitmap != null) {
                            // saveBitmapToGallery(service, softwareBitmap)
                        }
                        
                        continuation.resume(softwareBitmap)
                    } catch (e: Exception) {
                        Journal.log("Screenshot Buffer Error: ${e.message}")
                        continuation.resume(null)
                    }
                }

                override fun onFailure(errorCode: Int) {
                    Journal.log("Screenshot Capture Failed: Error Code $errorCode")
                    continuation.resume(null)
                }
            })
        } catch (e: Exception) {
            Journal.log("takeScreenshot Exception: ${e.message}")
            continuation.resume(null)
        }
    }

    private fun saveBitmapToGallery(context: Context, bitmap: Bitmap) {
        try {
            val contentValues = ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, "OCR_Screenshot_${System.currentTimeMillis()}.png")
                put(MediaStore.MediaColumns.MIME_TYPE, "image/png")
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_PICTURES)
                }
            }
            val resolver = context.contentResolver
            val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, contentValues)
            if (uri != null) {
                resolver.openOutputStream(uri)?.use { stream ->
                    bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)
                }
                Journal.log("✅ Capture d'écran enregistrée dans la Galerie (Dossier Pictures)!")
            }
        } catch (e: Exception) {
            Journal.log("Erreur lors de la sauvegarde de l'image: ${e.message}")
        }
    }

    suspend fun extractRawLinesFromBitmap(bitmap: Bitmap, cropRect: Rect?): List<Pair<Rect, String>> = suspendCancellableCoroutine { continuation ->
        try {
            val finalBitmap = if (cropRect != null) {
                // Ensure cropRect is within bounds
                val left = maxOf(0, cropRect.left)
                val top = maxOf(0, cropRect.top)
                val right = minOf(bitmap.width, cropRect.right)
                val bottom = minOf(bitmap.height, cropRect.bottom)
                
                if (right > left && bottom > top) {
                    Bitmap.createBitmap(bitmap, left, top, right - left, bottom - top)
                } else {
                    bitmap
                }
            } else {
                bitmap
            }

            val image = InputImage.fromBitmap(finalBitmap, 0)
            val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
            
            recognizer.process(image)
                .addOnSuccessListener { visionText ->
                    // Extract text strictly in chronological line order (Top to Bottom)
                    val allLines = mutableListOf<com.google.mlkit.vision.text.Text.Line>()
                    for (block in visionText.textBlocks) {
                        for (line in block.lines) {
                            allLines.add(line)
                        }
                    }
                    
                    // Sort all lines by their Y coordinate (Top position)
                    allLines.sortBy { it.boundingBox?.top ?: 0 }

                    val resultList = mutableListOf<Pair<Rect, String>>()
                    for (line in allLines) {
                        resultList.add(Pair(line.boundingBox ?: Rect(), line.text))
                    }
                    continuation.resume(resultList)
                }
                .addOnFailureListener { e ->
                    Journal.log("ML Kit OCR Error: ${e.message}")
                    continuation.resume(emptyList())
                }
        } catch (e: Exception) {
            Journal.log("Bitmap Crop Error: ${e.message}")
            continuation.resume(emptyList())
        }
    }

    suspend fun extractTextFromBitmap(bitmap: Bitmap, cropRect: Rect?): String {
        val lines = extractRawLinesFromBitmap(bitmap, cropRect)
        val sb = StringBuilder()
        for (line in lines) {
            sb.append(line.second).append("\n")
        }
        return sb.toString().trim()
    }
}
