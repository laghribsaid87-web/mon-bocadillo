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
        
        // Load Num Rect
        val numLeft = prefs.getInt("cropNumLeft", 100)
        val numTop = prefs.getInt("cropNumTop", 100)
        val numRight = prefs.getInt("cropNumRight", 400)
        val numBottom = prefs.getInt("cropNumBottom", 250)
        val rectNum = Rect(numLeft, numTop, numRight, numBottom)

        // Load Details Rect
        val detLeft = prefs.getInt("cropDetLeft", 100)
        val detTop = prefs.getInt("cropDetTop", 300)
        val detRight = prefs.getInt("cropDetRight", 500)
        val detBottom = prefs.getInt("cropDetBottom", 800)
        val rectDet = Rect(detLeft, detTop, detRight, detBottom)

        val cropView = CropView(this, rectNum, rectDet)

        val btnSave = Button(this).apply {
            text = "Sauvegarder"
            setBackgroundColor(Color.parseColor("#4CAF50"))
            setTextColor(Color.WHITE)
            setOnClickListener {
                prefs.edit().apply {
                    putInt("cropNumLeft", cropView.rectNum.left)
                    putInt("cropNumTop", cropView.rectNum.top)
                    putInt("cropNumRight", cropView.rectNum.right)
                    putInt("cropNumBottom", cropView.rectNum.bottom)
                    
                    putInt("cropDetLeft", cropView.rectDet.left)
                    putInt("cropDetTop", cropView.rectDet.top)
                    putInt("cropDetRight", cropView.rectDet.right)
                    putInt("cropDetBottom", cropView.rectDet.bottom)
                    apply()
                }
                Toast.makeText(this@OverlayActivity, "Zones sauvegardées !", Toast.LENGTH_SHORT).show()
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
                    putInt("cropNumLeft", 0)
                    putInt("cropNumTop", 0)
                    putInt("cropNumRight", 0)
                    putInt("cropNumBottom", 0)
                    putInt("cropDetLeft", 0)
                    putInt("cropDetTop", 0)
                    putInt("cropDetRight", 0)
                    putInt("cropDetBottom", 0)
                    apply()
                }
                Toast.makeText(this@OverlayActivity, "Zones désactivées (Lecture complète)", Toast.LENGTH_SHORT).show()
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

    class CropView(context: Context, var rectNum: Rect, var rectDet: Rect) : View(context) {
        private val paintBg = Paint().apply { color = Color.parseColor("#80000000") } // Semi-transparent black
        
        private val paintBoxNum = Paint().apply {
            color = Color.parseColor("#2196F3") // Blue
            style = Paint.Style.STROKE
            strokeWidth = 5f
        }
        private val paintBoxDet = Paint().apply {
            color = Color.parseColor("#4CAF50") // Green
            style = Paint.Style.STROKE
            strokeWidth = 5f
        }
        
        private val paintText = Paint().apply {
            color = Color.WHITE
            textSize = 30f
            isFakeBoldText = true
        }

        private val paintCorner = Paint().apply { color = Color.RED }

        // dragging state: -1 = none, 0..4 = rectNum (0:TL, 1:TR, 2:BR, 3:BL, 4:Center)
        //                 10..14 = rectDet (10:TL, 11:TR, 12:BR, 13:BL, 14:Center)
        private var draggingState = -1 
        private var lastX = 0f
        private var lastY = 0f

        override fun onDraw(canvas: Canvas) {
            super.onDraw(canvas)
            // Just draw a semi transparent background everywhere
            canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), paintBg)

            // Draw Rect Num (Blue)
            canvas.drawRect(rectNum, paintBoxNum)
            canvas.drawText("Numéro Commande (#)", rectNum.left.toFloat() + 10, rectNum.top.toFloat() + 35, paintText)
            drawCorners(canvas, rectNum)

            // Draw Rect Det (Green)
            canvas.drawRect(rectDet, paintBoxDet)
            canvas.drawText("Détails (Articles + Prix)", rectDet.left.toFloat() + 10, rectDet.top.toFloat() + 35, paintText)
            drawCorners(canvas, rectDet)
        }

        private fun drawCorners(canvas: Canvas, rect: Rect) {
            val r = 20f
            canvas.drawCircle(rect.left.toFloat(), rect.top.toFloat(), r, paintCorner)
            canvas.drawCircle(rect.right.toFloat(), rect.top.toFloat(), r, paintCorner)
            canvas.drawCircle(rect.right.toFloat(), rect.bottom.toFloat(), r, paintCorner)
            canvas.drawCircle(rect.left.toFloat(), rect.bottom.toFloat(), r, paintCorner)
        }

        override fun onTouchEvent(event: MotionEvent): Boolean {
            val x = event.x
            val y = event.y

            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    lastX = x
                    lastY = y
                    draggingState = getTouchedCorner(x, y)
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = (x - lastX).toInt()
                    val dy = (y - lastY).toInt()

                    when (draggingState) {
                        0 -> { rectNum.left += dx; rectNum.top += dy }
                        1 -> { rectNum.right += dx; rectNum.top += dy }
                        2 -> { rectNum.right += dx; rectNum.bottom += dy }
                        3 -> { rectNum.left += dx; rectNum.bottom += dy }
                        4 -> rectNum.offset(dx, dy)

                        10 -> { rectDet.left += dx; rectDet.top += dy }
                        11 -> { rectDet.right += dx; rectDet.top += dy }
                        12 -> { rectDet.right += dx; rectDet.bottom += dy }
                        13 -> { rectDet.left += dx; rectDet.bottom += dy }
                        14 -> rectDet.offset(dx, dy)
                    }

                    // Enforce minimum size
                    if (rectNum.width() < 100) rectNum.right = rectNum.left + 100
                    if (rectNum.height() < 100) rectNum.bottom = rectNum.top + 100
                    if (rectDet.width() < 100) rectDet.right = rectDet.left + 100
                    if (rectDet.height() < 100) rectDet.bottom = rectDet.top + 100

                    lastX = x
                    lastY = y
                    invalidate()
                }
                MotionEvent.ACTION_UP -> {
                    draggingState = -1
                }
            }
            return true
        }

        private fun getTouchedCorner(x: Float, y: Float): Int {
            val threshold = 60f
            // Check rectNum
            if (Math.abs(x - rectNum.left) < threshold && Math.abs(y - rectNum.top) < threshold) return 0
            if (Math.abs(x - rectNum.right) < threshold && Math.abs(y - rectNum.top) < threshold) return 1
            if (Math.abs(x - rectNum.right) < threshold && Math.abs(y - rectNum.bottom) < threshold) return 2
            if (Math.abs(x - rectNum.left) < threshold && Math.abs(y - rectNum.bottom) < threshold) return 3
            if (rectNum.contains(x.toInt(), y.toInt())) return 4

            // Check rectDet
            if (Math.abs(x - rectDet.left) < threshold && Math.abs(y - rectDet.top) < threshold) return 10
            if (Math.abs(x - rectDet.right) < threshold && Math.abs(y - rectDet.top) < threshold) return 11
            if (Math.abs(x - rectDet.right) < threshold && Math.abs(y - rectDet.bottom) < threshold) return 12
            if (Math.abs(x - rectDet.left) < threshold && Math.abs(y - rectDet.bottom) < threshold) return 13
            if (rectDet.contains(x.toInt(), y.toInt())) return 14

            return -1
        }
    }
}
