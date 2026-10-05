# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# React Native Biometrics
-keep class com.rnbiometrics.** { *; }

# React Native Screens
-keep class com.swmansion.rnscreens.** { *; }

# React Native Vector Icons
-keep class com.oblador.vectoricons.** { *; }

# React Native InAppBrowser
-keep class com.proyecto26.inappbrowser.** { *; }

# React Native WebView
-keep class com.reactnativecommunity.webview.** { *; }

# React Native Google Mobile Ads
-keep class com.google.android.gms.ads.** { *; }
-dontwarn com.google.android.gms.ads.**

# ---------------------------------------------------------------- AdMob mediation
# AdMob instantiates mediation adapters BY REFLECTION from a class-name string it
# receives from the server, so R8 cannot see these as reachable and strips or
# renames them. The Unity adapter AAR ships no consumer rules of its own, so
# without these keeps Unity works in a debug build and silently never fills in
# release — verified: unity-4.16.6.0.aar contains no proguard.txt.
-keep class com.google.ads.mediation.unity.** { *; }
-keep class com.unity3d.ads.** { *; }
-keep class com.unity3d.services.** { *; }
-dontwarn com.google.ads.mediation.unity.**
-dontwarn com.unity3d.ads.**
-dontwarn com.unity3d.services.**

# Adapter entry points the Google Mobile Ads SDK looks up by name.
-keep class * implements com.google.android.gms.ads.mediation.MediationAdapter { *; }
-keep class * extends com.google.android.gms.ads.mediation.Adapter { *; }
