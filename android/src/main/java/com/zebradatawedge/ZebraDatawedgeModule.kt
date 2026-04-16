package com.zebradatawedge

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

class ZebraDataWedgeModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext), LifecycleEventListener {

  override fun getName(): String = NAME

  private val profileName: String by lazy { resString("zdw_profile_name", "AppDataWedgeProfile") }
  private val scanAction: String by lazy {
    val v = resString("zdw_scan_action", "")
    if (v.isNotEmpty()) v else "${reactContext.packageName}.SCAN"
  }
  private val decoders: List<String> by lazy { resStringArray("zdw_enabled_decoders", listOf("code128")) }
  private val keystrokeOutput: Boolean by lazy { resBool("zdw_keystroke_output_enabled", false) }

  @Volatile private var profileConfigured: Boolean = false

  private val mainHandler = Handler(Looper.getMainLooper())
  private var pendingPromise: Promise? = null
  private var pendingResult: WritableMap? = null
  private var pendingRemaining: Int = 0
  private var pendingTimeout: Runnable? = null

  private val receiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      intent ?: return
      when (intent.action) {
        scanAction -> handleScan(intent)
        ACTION_RESULT -> handleResult(intent)
      }
    }
  }

  init {
    reactContext.addLifecycleEventListener(this)
    registerReceiver()
  }

  private fun registerReceiver() {
    val filter = IntentFilter().apply {
      addAction(scanAction)
      addAction(ACTION_RESULT)
      addCategory(Intent.CATEGORY_DEFAULT)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      reactContext.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
    } else {
      @Suppress("UnspecifiedRegisterReceiverFlag")
      reactContext.registerReceiver(receiver, filter)
    }
  }

  override fun onHostResume() {
    if (profileConfigured) sendSwitchToProfile()
  }

  override fun onHostPause() {}

  override fun onHostDestroy() {
    try {
      reactContext.unregisterReceiver(receiver)
    } catch (_: IllegalArgumentException) {
    }
  }

  @ReactMethod
  fun configureProfile(promise: Promise) {
    try {
      val bundle = DataWedgeBundle.buildSetConfig(
        profileName = profileName,
        scanAction = scanAction,
        packageName = reactContext.packageName,
        decoders = decoders,
        keystrokeOutput = keystrokeOutput
      )
      sendDataWedgeBroadcast("com.symbol.datawedge.api.SET_CONFIG", bundle)
      sendSwitchToProfile()
      profileConfigured = true
      promise.resolve(true)
    } catch (t: Throwable) {
      promise.reject("DW_CONFIGURE_FAILED", t.message, t)
    }
  }

  @ReactMethod
  fun getDiagnostics(promise: Promise) {
    val pm = reactContext.packageManager
    val result = Arguments.createMap()

    val installed = try {
      pm.getPackageInfo(DW_PACKAGE, 0)
      true
    } catch (_: PackageManager.NameNotFoundException) {
      false
    }
    result.putBoolean("installed", installed)
    result.putString("profileName", profileName)
    result.putString("scanAction", scanAction)
    result.putBoolean("profileConfigured", profileConfigured)

    var packageEnabled = false
    var version: String? = null
    if (installed) {
      try {
        val ai = pm.getApplicationInfo(DW_PACKAGE, 0)
        packageEnabled = ai.enabled
      } catch (_: PackageManager.NameNotFoundException) {}
      try {
        version = pm.getPackageInfo(DW_PACKAGE, 0).versionName
      } catch (_: PackageManager.NameNotFoundException) {}
    }
    result.putBoolean("packageEnabled", packageEnabled)
    if (version == null) result.putNull("version") else result.putString("version", version)

    if (!installed || !packageEnabled) {
      result.putBoolean("serviceEnabled", false)
      result.putBoolean("profileExists", false)
      result.putBoolean("enabled", false)
      promise.resolve(result)
      return
    }

    // Supersede any in-flight query.
    pendingPromise?.let { prior ->
      pendingTimeout?.let { mainHandler.removeCallbacks(it) }
      prior.reject("DW_DIAGNOSTICS_SUPERSEDED", "Superseded by newer getDiagnostics call")
    }
    pendingPromise = promise
    pendingResult = result
    pendingRemaining = 2

    sendDataWedgeBroadcast("com.symbol.datawedge.api.GET_DATAWEDGE_STATUS", extraString = null)
    sendDataWedgeBroadcast("com.symbol.datawedge.api.GET_PROFILES_LIST", extraString = null)

    val timeout = Runnable { finalizePending(fillMissing = true) }
    pendingTimeout = timeout
    mainHandler.postDelayed(timeout, 2000)
  }

  @ReactMethod
  fun openDataWedgeApp(promise: Promise) {
    try {
      val intent = reactContext.packageManager.getLaunchIntentForPackage(DW_PACKAGE)
      if (intent == null) {
        promise.resolve(false)
        return
      }
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactContext.startActivity(intent)
      promise.resolve(true)
    } catch (t: Throwable) {
      promise.reject("DW_OPEN_FAILED", t.message, t)
    }
  }

  @ReactMethod
  fun openDataWedgeAppDetails(promise: Promise) {
    try {
      val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
        data = Uri.parse("package:$DW_PACKAGE")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      reactContext.startActivity(intent)
      promise.resolve(true)
    } catch (t: Throwable) {
      promise.reject("DW_OPEN_SETTINGS_FAILED", t.message, t)
    }
  }

  @ReactMethod
  fun setScannerEnabled(enabled: Boolean, promise: Promise) {
    try {
      android.util.Log.d("ZebraDataWedge", "setScannerEnabled($enabled)")
      sendDataWedgeBroadcast(
        "com.symbol.datawedge.api.SCANNER_INPUT_PLUGIN",
        extraString = if (enabled) "ENABLE_PLUGIN" else "DISABLE_PLUGIN"
      )
      promise.resolve(true)
    } catch (t: Throwable) {
      promise.reject("DW_SCANNER_TOGGLE_FAILED", t.message, t)
    }
  }

  @ReactMethod
  fun triggerSoftScan(start: Boolean, promise: Promise) {
    try {
      // SOFTSCANTRIGGER uses its own action + a dedicated EXTRA_PARAMETER
      // key — not the generic "com.symbol.datawedge.api.ACTION" wrapper.
      val intent = Intent("com.symbol.datawedge.api.ACTION_SOFTSCANTRIGGER").apply {
        setPackage(DW_PACKAGE)
        putExtra(
          "com.symbol.datawedge.api.EXTRA_PARAMETER",
          if (start) "START_SCANNING" else "STOP_SCANNING"
        )
      }
      reactContext.sendBroadcast(intent)
      promise.resolve(true)
    } catch (t: Throwable) {
      promise.reject("DW_SOFT_SCAN_FAILED", t.message, t)
    }
  }

  // RN 0.65+ NativeEventEmitter stubs — presence prevents warnings; no-op bodies.
  @ReactMethod fun addListener(eventName: String) {}
  @ReactMethod fun removeListeners(count: Double) {}

  // ---- helpers ----

  private fun handleScan(intent: Intent) {
    // DataWedge uses one of two extra keys depending on firmware version.
    val data = intent.getStringExtra("com.symbol.datawedge.data_string")
      ?: intent.getStringExtra("decoded_data")
      ?: return
    val labelType = intent.getStringExtra("com.symbol.datawedge.label_type")
      ?: intent.getStringExtra("decoded_label_type")
    android.util.Log.d("ZebraDataWedge", "scan received: $data ($labelType)")
    val event = Arguments.createMap().apply {
      putString("data", data)
      if (labelType == null) putNull("labelType") else putString("labelType", labelType)
    }
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("onBarcode", event)
  }

  private fun handleResult(intent: Intent) {
    val result = pendingResult ?: return
    val extras = intent.extras ?: return
    if (extras.containsKey("com.symbol.datawedge.api.RESULT_GET_DATAWEDGE_STATUS")) {
      val status = extras.getString("com.symbol.datawedge.api.RESULT_GET_DATAWEDGE_STATUS")
      result.putBoolean("serviceEnabled", status.equals("enabled", ignoreCase = true))
      pendingRemaining--
    }
    if (extras.containsKey("com.symbol.datawedge.api.RESULT_GET_PROFILES_LIST")) {
      val profiles = extras.getStringArray("com.symbol.datawedge.api.RESULT_GET_PROFILES_LIST")
      val found = profiles?.any { it == profileName } == true
      result.putBoolean("profileExists", found)
      pendingRemaining--
    }
    if (pendingRemaining <= 0) finalizePending(fillMissing = false)
  }

  private fun finalizePending(fillMissing: Boolean) {
    val promise = pendingPromise ?: return
    val result = pendingResult ?: return
    pendingTimeout?.let { mainHandler.removeCallbacks(it) }
    pendingTimeout = null

    if (fillMissing) {
      if (!result.hasKey("serviceEnabled")) result.putBoolean("serviceEnabled", false)
      if (!result.hasKey("profileExists")) result.putBoolean("profileExists", false)
    }
    val pkg = if (result.hasKey("packageEnabled")) result.getBoolean("packageEnabled") else false
    val svc = if (result.hasKey("serviceEnabled")) result.getBoolean("serviceEnabled") else false
    result.putBoolean("enabled", pkg && svc)

    pendingPromise = null
    pendingResult = null
    pendingRemaining = 0
    promise.resolve(result)
  }

  private fun sendSwitchToProfile() {
    sendDataWedgeBroadcast(
      "com.symbol.datawedge.api.SWITCH_TO_PROFILE",
      extraString = profileName
    )
  }

  // Target the DataWedge package explicitly. Without setPackage, Android 8+
  // drops the implicit broadcast and DataWedge never sees it — silently
  // failing SET_CONFIG / SWITCH_TO_PROFILE / GET_* calls.
  private fun sendDataWedgeBroadcast(apiExtra: String, bundle: android.os.Bundle) {
    val intent = Intent(ACTION_DATAWEDGE_FROM_API).apply {
      setPackage(DW_PACKAGE)
      putExtra(apiExtra, bundle)
      putExtra("SEND_RESULT", "LAST_RESULT")
    }
    reactContext.sendBroadcast(intent)
  }

  private fun sendDataWedgeBroadcast(apiExtra: String, extraString: String?) {
    val intent = Intent(ACTION_DATAWEDGE_FROM_API).apply {
      setPackage(DW_PACKAGE)
      // Queries like GET_DATAWEDGE_STATUS take an empty string extra — null
      // causes DataWedge to ignore the request.
      putExtra(apiExtra, extraString ?: "")
      putExtra("SEND_RESULT", "LAST_RESULT")
    }
    reactContext.sendBroadcast(intent)
  }

  private fun resString(name: String, fallback: String): String {
    val id = reactContext.resources.getIdentifier(name, "string", reactContext.packageName)
    return if (id != 0) reactContext.resources.getString(id) else fallback
  }

  private fun resBool(name: String, fallback: Boolean): Boolean {
    val id = reactContext.resources.getIdentifier(name, "bool", reactContext.packageName)
    return if (id != 0) reactContext.resources.getBoolean(id) else fallback
  }

  private fun resStringArray(name: String, fallback: List<String>): List<String> {
    val id = reactContext.resources.getIdentifier(name, "array", reactContext.packageName)
    return if (id != 0) reactContext.resources.getStringArray(id).toList() else fallback
  }

  companion object {
    const val NAME = "ZebraDataWedge"
    private const val DW_PACKAGE = "com.symbol.datawedge"
    private const val ACTION_RESULT = "com.symbol.datawedge.api.RESULT_ACTION"
    private const val ACTION_DATAWEDGE_FROM_API = "com.symbol.datawedge.api.ACTION"
  }
}
