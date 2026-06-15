package com.bocadillo.godroidautomator

import android.app.Activity
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.os.Bundle
import android.view.MotionEvent
import android.view.View
import android.widget.Button
import android.widget.FrameLayout
import android.widget.Toast

class OverlayActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        val prefs = getSharedPreferences("AutomatorPrefs", Context.MODE_PRIVATE)
        val savedLeft = prefs.getInt("cropLeft", 100)
        val savedTop = prefs.getInt("cropTop", 200)
        val savedRight = prefs.getInt("cropRight", 500)
        val savedBottom = prefs.getInt("cropBottom", 800)

        val cropView = CropView(this, Rect(savedLeft, savedTop, savedRight, savedBottom))

        val btnSave = Button(this).apply {
            text = "Sauvegarder"
            setBackgroundColor(Color.parseColor("#4CAF50"))
            setTextColor(Color.WHITE)
            setOnClickListener {
                val rect = cropView.getCropRect()
                prefs.edit().apply {
                    putInt("cropLeft", rect.left)
                    putInt("cropTop", rect.top)
                    putInt("cropRight", rect.right)
                    putInt("cropBottom", rect.bottom)
                    apply()
                }
                Toast.makeText(this@OverlayActivity, "Zone sauvegardée !", Toast.LENGTH_SHORT).show()
                finish()
            }
        }

        val btnCancel = Button(this).apply {
            text = "Annuler"
            setBackgroundColor(Color.parseColor("#F44336"))
            setTextColor(Color.WHITE)
            setOnClickListener { finish() }
        }

        val btnClear = Button(this).apply {
            text = "Désactiver"
            setBackgroundColor(Color.DKGRAY)
            setTextColor(Color.WHITE)
            setOnClickListener {
                prefs.edit().apply {
                    putInt("cropLeft", 0)
                    putInt("cropTop", 0)
                    putInt("cropRight", 0)
                    putInt("cropBottom", 0)
                    apply()
                }
                Toast.makeText(this@OverlayActivity, "Zone désactivée (Lecture complète)", Toast.LENGTH_SHORT).show()
                finish()
            }
        }

        val buttonsLayout = android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.HORIZONTAL
            addView(btnSave)
            addView(btnClear)
            addView(btnCancel)
        }

        val mainLayout = FrameLayout(this).apply {
            addView(cropView)
            addView(buttonsLayout, FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = android.view.Gravity.BOTTOM or android.view.Gravity.CENTER_HORIZONTAL
                bottomMargin = 50
            })
        }

        setContentView(mainLayout)
    }

    class CropView(context: Context, private var cropRect: Rect) : View(context) {
        private val paintBg = Paint().apply { color = Color.parseColor("#80000000") } // Semi-transparent black
        private val paintBox = Paint().apply {
            color = Color.GREEN
            style = Paint.Style.STROKE
            strokeWidth = 5f
        }
        private val paintCorner = Paint().apply { color = Color.RED }

        private var draggingCorner = -1 // 0: TopLeft, 1: TopRight, 2: BottomRight, 3: BottomLeft, 4: Center (move all)
        private var lastX = 0f
        private var lastY = 0f

        override fun onDraw(canvas: Canvas) {
            super.onDraw(canvas)
            // Draw background (darkened except for crop box)
            canvas.drawRect(0f, 0f, width.toFloat(), cropRect.top.toFloat(), paintBg)
            canvas.drawRect(0f, cropRect.top.toFloat(), cropRect.left.toFloat(), cropRect.bottom.toFloat(), paintBg)
            canvas.drawRect(cropRect.right.toFloat(), cropRect.top.toFloat(), width.toFloat(), cropRect.bottom.toFloat(), paintBg)
            canvas.drawRect(0f, cropRect.bottom.toFloat(), width.toFloat(), height.toFloat(), paintBg)

            // Draw crop box
            canvas.drawRect(cropRect, paintBox)

            // Draw corners
            val r = 20f
            canvas.drawCircle(cropRect.left.toFloat(), cropRect.top.toFloat(), r, paintCorner)
            canvas.drawCircle(cropRect.right.toFloat(), cropRect.top.toFloat(), r, paintCorner)
            canvas.drawCircle(cropRect.right.toFloat(), cropRect.bottom.toFloat(), r, paintCorner)
            canvas.drawCircle(cropRect.left.toFloat(), cropRect.bottom.toFloat(), r, paintCorner)
        }

        override fun onTouchEvent(event: MotionEvent): Boolean {
            val x = event.x
            val y = event.y

            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    lastX = x
                    lastY = y
                    draggingCorner = getTouchedCorner(x, y)
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = (x - lastX).toInt()
                    val dy = (y - lastY).toInt()

                    when (draggingCorner) {
                        0 -> { cropRect.left += dx; cropRect.top += dy }
                        1 -> { cropRect.right += dx; cropRect.top += dy }
                        2 -> { cropRect.right += dx; cropRect.bottom += dy }
                        3 -> { cropRect.left += dx; cropRect.bottom += dy }
                        4 -> cropRect.offset(dx, dy)
                    }

                    // Enforce minimum size
                    if (cropRect.width() < 100) cropRect.right = cropRect.left + 100
                    if (cropRect.height() < 100) cropRect.bottom = cropRect.top + 100

                    lastX = x
                    lastY = y
                    invalidate()
                }
                MotionEvent.ACTION_UP -> {
                    draggingCorner = -1
                }
            }
            return true
        }

        private fun getTouchedCorner(x: Float, y: Float): Int {
            val threshold = 60f
            if (Math.abs(x - cropRect.left) < threshold && Math.abs(y - cropRect.top) < threshold) return 0
            if (Math.abs(x - cropRect.right) < threshold && Math.abs(y - cropRect.top) < threshold) return 1
            if (Math.abs(x - cropRect.right) < threshold && Math.abs(y - cropRect.bottom) < threshold) return 2
            if (Math.abs(x - cropRect.left) < threshold && Math.abs(y - cropRect.bottom) < threshold) return 3
            if (cropRect.contains(x.toInt(), y.toInt())) return 4 // Drag center
            return -1
        }

        fun getCropRect(): Rect = cropRect
    }
}
