package com.merzgames.app

import android.os.Build
import android.os.Bundle
import androidx.activity.enableEdgeToEdge
import androidx.core.view.WindowCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // Edge-to-edge es API 29+. En 7.1.2 (API 25) hay que evitarlo.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      enableEdgeToEdge()
    }
    super.onCreate(savedInstanceState)
    // Iconos/texto claros (blancos) sobre fondo oscuro del kiosco.
    WindowCompat.getInsetsController(window, window.decorView).apply {
      isAppearanceLightStatusBars = false
      isAppearanceLightNavigationBars = false
    }
  }
}
