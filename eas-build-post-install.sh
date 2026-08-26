#!/bin/bash
set -e

# Increase Gradle memory and limit architectures to avoid OOM on EAS build servers
if [ -f "android/gradle.properties" ]; then
  sed -i 's/org.gradle.jvmargs=.*/org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m/' android/gradle.properties
  sed -i 's/reactNativeArchitectures=.*/reactNativeArchitectures=arm64-v8a/' android/gradle.properties
  echo "[eas-build-post-install] Patched gradle.properties:"
  grep -E 'jvmargs|reactNativeArchitectures' android/gradle.properties
fi
