package com.zebradatawedge

import com.facebook.react.bridge.ReactApplicationContext

class ZebraDatawedgeModule(reactContext: ReactApplicationContext) :
  NativeZebraDatawedgeSpec(reactContext) {

  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }

  companion object {
    const val NAME = NativeZebraDatawedgeSpec.NAME
  }
}
