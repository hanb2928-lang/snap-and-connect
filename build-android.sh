#!/bin/bash
set -e
echo "============================================"
echo "  숏커넥트 Android APK 로컬 빌드 (EAS 불필요)"
echo "============================================"
echo ""

echo "[1/5] Node.js 확인 중..."
if ! command -v node &> /dev/null; then
    echo "오류: Node.js가 설치되어 있지 않습니다."
    echo "다운로드: https://nodejs.org (LTS 버전 설치)"
    exit 1
fi
echo "Node.js $(node --version) 확인 완료."
echo ""

echo "[2/5] 패키지 설치 중... (몇 분 걸릴 수 있습니다)"
npm install --legacy-peer-deps
echo "패키지 설치 완료."
echo ""

echo "[3/5] Java SDK 확인 중..."
if [ -z "$JAVA_HOME" ]; then
    if command -v java &> /dev/null; then
        JAVA_HOME="$(dirname "$(dirname "$(command -v java)")")"
        export JAVA_HOME
        echo "JAVA_HOME 자동 감지: $JAVA_HOME"
    else
        echo "경고: Java가 설치되어 있지 않을 수 있습니다."
        echo "Android Studio 또는 JDK 17 설치 필요: https://developer.android.com/studio"
    fi
else
    echo "JAVA_HOME: $JAVA_HOME"
fi
echo ""

echo "[4/5] Android SDK 확인 중..."
if [ -z "$ANDROID_HOME" ]; then
    if [ -d "$HOME/Android/Sdk" ]; then
        export ANDROID_HOME="$HOME/Android/Sdk"
        echo "ANDROID_HOME 자동 감지: $ANDROID_HOME"
    elif [ -d "$HOME/Library/Android/sdk" ]; then
        export ANDROID_HOME="$HOME/Library/Android/sdk"
        echo "ANDROID_HOME 자동 감지: $ANDROID_HOME"
    else
        echo "경고: Android SDK 경로를 찾을 수 없습니다."
        echo "Android Studio 설치 필요: https://developer.android.com/studio"
        echo "또는 환경변수 ANDROID_HOME을 수동 설정하세요."
    fi
else
    echo "ANDROID_HOME: $ANDROID_HOME"
fi
echo ""

echo "[5/5] APK 빌드 시작... (약 10~20분 소요)"
cd android
chmod +x gradlew
./gradlew assembleRelease --no-daemon || {
    echo ""
    echo "============================================"
    echo "  빌드 실패."
    echo "============================================"
    echo ""
    echo "일반적인 오류 해결 방법:"
    echo "  1. Java 미설치 - JDK 17 설치"
    echo "  2. Android SDK 미설치 - Android Studio 설치"
    echo "  3. SDK 라이선스 미동의 - Android Studio에서 SDK 설치 후 동의"
    echo "  4. 메모리 부족 - gradle.properties의 Xmx 값을 4096m로 증가"
    exit 1
}
cd ..

APK_PATH="android/app/build/outputs/apk/release/app-release.apk"
if [ -f "$APK_PATH" ]; then
    echo ""
    echo "============================================"
    echo "  빌드 성공!"
    echo "  APK 위치: $APK_PATH"
    echo "============================================"
    echo ""
    echo "폴더를 열려면:"
    echo "  open $(dirname "$APK_PATH")"
else
    echo ""
    echo "경고: APK 파일을 찾을 수 없습니다. 빌드 출력을 확인하세요."
fi
