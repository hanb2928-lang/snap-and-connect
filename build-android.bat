@echo off
chcp 65001 >nul
title 숏커넥트 Android APK 로컬 빌드
color 0B

echo ============================================
echo   숏커넥트 Android APK 로컬 빌드 (EAS 불필요)
echo ============================================
echo.

echo [1/5] Node.js 확인 중...
call node --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo.
    echo 오류: Node.js가 설치되어 있지 않습니다.
    echo 다운로드: https://nodejs.org (LTS 버전 설치)
    pause
    exit /b 1
)
echo Node.js 확인 완료.
echo.

echo [2/5] 패키지 설치 중... (몇 분 걸릴 수 있습니다)
call npm install --legacy-peer-deps
if %ERRORLEVEL% neq 0 (
    echo.
    echo 오류: npm install 실패.
    pause
    exit /b 1
)
echo 패키지 설치 완료.
echo.

echo [3/5] Java SDK 확인 중...
if "%JAVA_HOME%"=="" (
    where java >nul 2>&1
    if %ERRORLEVEL% equ 0 (
        for /f "delims=" %%i in ('where java') do set JAVA_PATH=%%i
        for %%i in ("%JAVA_PATH%") do set JAVA_HOME=%%~dpi
        for %%i in ("%JAVA_HOME%..") do set JAVA_HOME=%%~fi
        echo JAVA_HOME 자동 감지: %JAVA_HOME%
    ) else (
        echo 경고: Java가 설치되어 있지 않을 수 있습니다.
        echo Android Studio 또는 JDK 17 설치 필요: https://developer.android.com/studio
    )
) else (
    echo JAVA_HOME: %JAVA_HOME%
)
echo.

echo [4/5] Android SDK 확인 중...
if "%ANDROID_HOME%"=="" (
    if exist "%LOCALAPPDATA%\Android\Sdk" (
        set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
        echo ANDROID_HOME 자동 감지: %ANDROID_HOME%
    ) else if exist "%USERPROFILE%\AppData\Local\Android\Sdk" (
        set ANDROID_HOME=%USERPROFILE%\AppData\Local\Android\Sdk
        echo ANDROID_HOME 자동 감지: %ANDROID_HOME%
    ) else (
        echo 경고: Android SDK 경로를 찾을 수 없습니다.
        echo Android Studio 설치 필요: https://developer.android.com/studio
    )
) else (
    echo ANDROID_HOME: %ANDROID_HOME%
)
echo.

echo [5/5] APK 빌드 시작... (약 10~20분 소요)
cd android
call gradlew.bat assembleRelease --no-daemon
if %ERRORLEVEL% neq 0 (
    echo.
    echo ============================================
    echo   빌드 실패.
    echo ============================================
    echo.
    echo 일반적인 오류 해결 방법:
    echo   1. Java 미설치 - JDK 17 설치
    echo   2. Android SDK 미설치 - Android Studio 설치
    echo   3. SDK 라이선스 미동의 - Android Studio에서 SDK 설치 후 동의
    echo   4. 메모리 부족 - gradle.properties의 Xmx 값을 4096m로 증가
    cd ..
    pause
    exit /b 1
)
cd ..

set APK_PATH=android\app\build\outputs\apk\release\app-release.apk
if exist "%APK_PATH%" (
    echo.
    echo ============================================
    echo   빌드 성공!
    echo   APK 위치: %APK_PATH%
    echo ============================================
    echo.
    explorer android\app\build\outputs\apk\release
) else (
    echo.
    echo 경고: APK 파일을 찾을 수 없습니다. 빌드 출력을 확인하세요.
)
pause
