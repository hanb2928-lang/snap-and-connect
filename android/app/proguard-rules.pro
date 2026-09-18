# Add project specific ProGuard rules here.

# ── React Native core ──
-keep class com.facebook.react.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.module.** { *; }
-keep class com.facebook.react.uimanager.** { *; }
-keep class com.facebook.react.views.** { *; }
-keep class com.facebook.react.modules.** { *; }
-keep class com.facebook.react.devsupport.** { *; }
-keep class com.facebook.react.hermes.** { *; }

# ── Hermes JS engine ──
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.react.hermes.** { *; }

# ── react-native-reanimated ──
-keep class com.swmansion.reanimated.** { *; }

# ── react-native-gesture-handler ──
-keep class com.swmansion.gesturehandler.** { *; }

# ── react-native-screens ──
-keep class com.swmansion.rnscreens.** { *; }

# ── react-native-svg ──
-keep class com.horcrux.svg.** { *; }

# ── react-native-webview ──
-keep class com.reactnativecommunity.webview.** { *; }
-keep class com.reactnativecommunity.** { *; }

# ── react-native-view-shot ──
-keep class fr.greweb.** { *; }

# ── react-native-worklets ──
-keep class com.swmansion.worklets.** { *; }

# ── Expo modules (broad catch-all for all expo packages) ──
-keep class expo.modules.** { *; }
-keep class expo.modules.adapters.** { *; }
-keep class expo.modules.camera.** { *; }
-keep class expo.modules.clipboard.** { *; }
-keep class expo.modules.imagepicker.** { *; }
-keep class expo.modules.medialibrary.** { *; }
-keep class expo.modules.linearGradient.** { *; }
-keep class expo.modules.font.** { *; }
-keep class expo.modules.haptics.** { *; }
-keep class expo.modules.sharing.** { *; }
-keep class expo.modules.filesystem.** { *; }
-keep class expo.modules.imageloader.** { *; }
-keep class expo.modules.imageManipulator.** { *; }
-keep class expo.modules.keepawake.** { *; }
-keep class expo.modules.splashscreen.** { *; }
-keep class expo.modules.systemui.** { *; }
-keep class expo.modules.webbrowser.** { *; }
-keep class expo.modules.constants.** { *; }
-keep class expo.modules.linking.** { *; }
-keep class expo.modules.core.** { *; }
-keep class expo.modules.blur.** { *; }

# ── AsyncStorage ──
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# ── DateTimePicker ──
-keep class com.reactcommunity.rndatetimepicker.** { *; }

# ── SafeAreaContext ──
-keep class com.th3rdwave.safeareacontext.** { *; }

# ── Keep all React Native native module interfaces ──
-keep class * implements com.facebook.react.bridge.NativeModule { *; }
-keep class * implements com.facebook.react.bridge.JavaScriptModule { *; }
-keep class * implements com.facebook.react.turbomodule.coreTurboModule { *; }
-keep class * extends com.facebook.react.bridge.ReactContextBaseJavaModule { *; }

# ── Keep Expo module provider classes ──
-keep class * extends expo.modules.kotlin.modules.Module { *; }
-keep class * extends expo.modules.kotlin.view.ExpoView { *; }
-keep class * extends expo.modules.core.BasePackage { *; }
-keep class * implements expo.modules.core.interfaces.Package { *; }

# ── Keep all classes with @ReactModule annotation ──
-keep @interface com.facebook.react.module.annotations.ReactModule { *; }
-keep @com.facebook.react.module.annotations.ReactModule class * { *; }

# ── Suppress warnings ──
-dontwarn com.facebook.react.**
-dontwarn expo.modules.**
-dontwarn com.swmansion.**
-dontwarn com.horcrux.**
-dontwarn com.th3rdwave.**
-dontwarn com.reactnativecommunity.**
-dontwarn com.reactcommunity.**

# ── Keep native methods (JNI) ──
-keepclasseswithmembernames class * {
    native <methods>;
}

# ── Keep React Application class ──
-keep class com.snapconnect.app.** { *; }

# ── Kotlin metadata ──
-keep class kotlin.Metadata { *; }
-keepclassmembers class ** {
    @kotlin.Metadata *;
}

# ── OkHttp / network stack (used by Supabase JS client via fetch) ──
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }
-keep class okio.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**

# ── Keep enum values (used by Expo modules for serialization) ──
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# ── Keep Gson/Jackson-style serialization (if any deps use reflection) ──
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes EnclosingMethod
-keepattributes InnerClasses

# ── Prevent R8 from stripping JS bundle asset loaders ──
-keep class com.facebook.react.views.imagehelper.** { *; }
