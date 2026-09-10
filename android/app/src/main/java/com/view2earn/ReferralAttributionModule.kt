package com.view2earn

import android.content.Context
import android.util.Log
import com.android.installreferrer.api.InstallReferrerClient
import com.android.installreferrer.api.InstallReferrerStateListener
import com.android.installreferrer.api.ReferrerDetails
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Exposes referral attribution to JS.
 *
 * Sources, in priority order:
 *  1. Deep-link `referrer` on the current intent (view2earn://.../https links).
 *  2. The `install_referrer` launch-intent extra (Android 12+, delivery by the
 *     Play Store at first launch).
 *  3. The Play Install Referrer API (com.android.installreferrer) — the
 *     canonical install-time attribution that works on every Android version.
 *
 * JS reads the value once at startup and stores it for auto-apply after signup.
 */
@ReactModule(name = ReferralAttributionModule.NAME)
class ReferralAttributionModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  companion object {
    const val NAME = "ReferralAttribution"
    private const val TAG = "ReferralAttribution"
  }

  override fun getName(): String = NAME

  private val shouldUseInstallReferrerApi: Boolean
    get() = android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.S

  private fun emit(referrer: String?) {
    val payload = Arguments.createMap().apply { putString("referrer", referrer) }
    reactApplicationContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("onReferralAttribution", payload)
  }

  /** Resolve the attributed referral code and resolve/emit it to JS. */
  @ReactMethod
  fun getReferrer(promise: Promise) {
    // 1. Deep-link referrer already held by the activity.
    val deepLink = extractReferrer()
    if (deepLink != null) {
      emit(deepLink)
      promise.resolve(deepLink)
      return
    }

    // 2. Fast path on Android 12+: read the install_referrer intent extra.
    val extra = readInstallReferrerExtra()
    if (extra != null) {
      emit(extra)
      promise.resolve(extra)
      return
    }

    // 3. Install Referrer API for every other version.
    if (shouldUseInstallReferrerApi) {
      queryInstallReferrer(promise)
    } else {
      promise.resolve(null)
    }
  }

  private fun queryInstallReferrer(promise: Promise) {
    try {
      val client = InstallReferrerClient.newBuilder(reactApplicationContext).build()
      client.startConnection(object : InstallReferrerStateListener {
        override fun onInstallReferrerSetupFinished(responseCode: Int) {
          try {
            if (responseCode == InstallReferrerClient.InstallReferrerResponse.OK) {
              val response: ReferrerDetails = client.installReferrer
              val raw = response.installReferrer
              val code = raw?.substringAfter("referrer=", "")?.takeIf { it.isNotEmpty() }
              emit(code)
              promise.resolve(code)
            } else {
              Log.w(TAG, "InstallReferrer response: $responseCode")
              promise.resolve(null)
            }
          } catch (e: Exception) {
            promise.resolve(null)
          } finally {
            client.endConnection()
          }
        }

        override fun onInstallReferrerServiceDisconnected() {
          promise.resolve(null)
        }
      })
    } catch (e: Exception) {
      promise.resolve(null)
    }
  }

  /** Read `referrer` from the current activity's intent (deep link / cold start). */
  private fun extractReferrer(): String? {
    val activity = reactApplicationContext.currentActivity ?: return null
    val intent = activity.intent ?: return null
    val data = intent.data ?: return null
    val referrer = data.getQueryParameter("referrer")
    if (referrer != null) return referrer
    return intent.getStringExtra("referrer")
  }

  /** Android 12+ delivers the Play referrer as an `install_referrer` extra. */
  private fun readInstallReferrerExtra(): String? {
    if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.S) return null
    val activity = reactApplicationContext.currentActivity ?: return null
    val intent = activity.intent
    val raw = intent?.getStringExtra("install_referrer") ?: return null
    return raw.substringAfter("referrer=", "").takeIf { it.isNotEmpty() }
  }
}
