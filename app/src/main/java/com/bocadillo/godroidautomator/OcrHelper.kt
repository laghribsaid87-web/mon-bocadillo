package com.bocadillo.godroidautomator

import android.accessibilityservice.AccessibilityService
import android.graphics.Bitmap
import android.graphics.Rect
import android.os.Build
import android.view.Display
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

    suspend fun extractTextFromBitmap(bitmap: Bitmap, cropRect: Rect?): String = suspendCancellableCoroutine { continuation ->
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
                    // Extract text strictly in chronological line order
                    val sb = StringBuilder()
                    for (block in visionText.textBlocks) {
                        for (line in block.lines) {
                            sb.append(line.text).append("\n")
                        }
                    }
                    continuation.resume(sb.toString().trim())
                }
                .addOnFailureListener { e ->
                    Journal.log("ML Kit OCR Error: ${e.message}")
                    continuation.resume("")
                }
        } catch (e: Exception) {
            Journal.log("Bitmap Crop Error: ${e.message}")
            continuation.resume("")
        }
    }
}
