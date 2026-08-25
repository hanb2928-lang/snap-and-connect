@echo off
chcp 65001 >nul
title 숏커넥트 Android APK 빌드
color 0B

echo ============================================
echo   숏커넥트 Android APK 빌드 스크립트
echo ============================================
echo.

REM EAS_NO_VCS 설정 (Git 없이 EAS 사용)
set EAS_NO_VCS=1
echo EAS_NO_VCS=1 설정 완료 (Git 없이 빌드)
echo.

echo [1/6] Android SDK 경로 설정 중...
if not defined ANDROID_HOME (
    set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
)
if exist "%ANDROID_HOME%" (
    echo sdk.dir=%ANDROID_HOME%> android\local.properties
    echo local.properties 생성 완료: %ANDROID_HOME%
) else (
    echo 경고: Android SDK를 찾을 수 없습니다. (%ANDROID_HOME%)
    echo Android Studio를 설치하고 SDK를 다운로드한 후 다시 시도하세요.
    pause
    exit /b 1
)
echo.

echo [2/6] 패키지 설치 중... (몇 분 걸릴 수 있습니다)
call npm install
if %ERRORLEVEL% neq 0 (
    echo.
    echo 오류: npm install 실패. Node.js가 설치되어 있는지 확인하세요.
    echo 다운로드: https://nodejs.org
    pause
    exit /b 1
)
echo 패키지 설치 완료.
echo.

echo [3/6] EAS CLI 설치 확인 중...
call npm install -g eas-cli
echo.

echo [4/6] EAS 로그인 확인 중...
call eas whoami >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo EAS 로그인이 필요합니다.
    echo.
    echo 아직 계정이 없다면 https://expo.dev/signup 에서 가입하세요.
    echo 기존 계정의 빌드 한도를 소진했다면 새 계정을 만드세요.
    echo.
    call eas login
    if %ERRORLEVEL% neq 0 (
        echo 오류: EAS 로그인 실패.
        pause
        exit /b 1
    )
)
echo 로그인 확인 완료.
echo.

echo [5/6] 프로젝트 연결 중...
call eas init
echo.

echo [6/6] Android APK 빌드 시작... (약 10~15분 소요)
call eas build --platform android --profile preview --clear-cache
if %ERRORLEVEL% neq 0 (
    echo.
    echo 빌드 실패. 위 에러 메시지를 확인해주세요.
    echo "Android builds from the Free plan" 에러가 나오면 새 Expo 계정으로 빌드하세요.
    pause
    exit /b 1
)
echo.
echo ============================================
echo   빌드가 완료되었습니다!
echo   위에 표시된 URL에서 APK를 다운로드하세요.
echo ============================================
pause
