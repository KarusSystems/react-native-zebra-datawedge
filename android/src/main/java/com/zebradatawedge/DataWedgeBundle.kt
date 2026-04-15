package com.zebradatawedge

import android.content.Intent
import android.os.Bundle

internal object DataWedgeBundle {
  private val DECODER_KEY = mapOf(
    "code128" to "decoder_code128",
    "code39" to "decoder_code39",
    "code93" to "decoder_code93",
    "ean8" to "decoder_ean8",
    "ean13" to "decoder_ean13",
    "upca" to "decoder_upca",
    "upce" to "decoder_upce0",
    "qrcode" to "decoder_qrcode",
    "datamatrix" to "decoder_datamatrix",
    "pdf417" to "decoder_pdf417",
    "aztec" to "decoder_aztec",
    "i2of5" to "decoder_i2of5"
  )

  fun buildSetConfig(
    profileName: String,
    scanAction: String,
    packageName: String,
    decoders: List<String>,
    keystrokeOutput: Boolean
  ): Bundle {
    val barcodeParams = Bundle().apply {
      putString("scanner_selection", "auto")
      val enabled = decoders.mapNotNull { DECODER_KEY[it.lowercase()] }.toSet()
      DECODER_KEY.values.forEach { key ->
        putString(key, if (key in enabled) "true" else "false")
      }
    }
    val barcodePlugin = Bundle().apply {
      putString("PLUGIN_NAME", "BARCODE")
      putString("RESET_CONFIG", "true")
      putBundle("PARAM_LIST", barcodeParams)
    }

    val intentParams = Bundle().apply {
      putString("intent_output_enabled", "true")
      putString("intent_action", scanAction)
      putString("intent_category", Intent.CATEGORY_DEFAULT)
      putString("intent_delivery", "2") // 0=start activity, 1=service, 2=broadcast
    }
    val intentPlugin = Bundle().apply {
      putString("PLUGIN_NAME", "INTENT")
      putString("RESET_CONFIG", "true")
      putBundle("PARAM_LIST", intentParams)
    }

    val keystrokeParams = Bundle().apply {
      putString("keystroke_output_enabled", if (keystrokeOutput) "true" else "false")
    }
    val keystrokePlugin = Bundle().apply {
      putString("PLUGIN_NAME", "KEYSTROKE")
      putString("RESET_CONFIG", "true")
      putBundle("PARAM_LIST", keystrokeParams)
    }

    val appEntry = Bundle().apply {
      putString("PACKAGE_NAME", packageName)
      putStringArray("ACTIVITY_LIST", arrayOf("*"))
    }

    // DataWedge requires ArrayList (Parcelable) — not array — for these two.
    val pluginList = arrayListOf(barcodePlugin, intentPlugin, keystrokePlugin)
    val appList = arrayListOf(appEntry)

    return Bundle().apply {
      putString("PROFILE_NAME", profileName)
      putString("PROFILE_ENABLED", "true")
      putString("CONFIG_MODE", "CREATE_IF_NOT_EXIST")
      putParcelableArrayList("PLUGIN_CONFIG", pluginList)
      putParcelableArrayList("APP_LIST", appList)
    }
  }
}
