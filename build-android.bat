@echo off
chcp 65001 >nul
title 숏커넥트 Android APK 빌드
color 0B

echo ============================================
echo   숏커넥트 Android APK 빌드 (EAS 서버)
echo ============================================
echo.

set EAS_NO_VCS=1

echo [1/6] Node.js 확인 중...
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

echo [2/6] 패키지 설치 중... (몇 분 걸릴 수 있습니다)
call npm install --legacy-peer-deps
if %ERRORLEVEL% neq 0 (
    echo 오류: npm install 실패.
    pause
    exit /b 1
)
echo 패키지 설치 완료.
echo.

echo [3/6] EAS CLI 설치 중...
call npm install -g eas-cli >nul 2>&1
echo EAS CLI 준비 완료.
echo.

echo [4/6] EAS 로그인 확인 중...
call eas whoami >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo EAS 로그인이 필요합니다.
    echo 계정이 없다면 https://expo.dev/signup 에서 가입하세요.
    echo.
    call eas login
    call eas whoami >nul 2>&1
    if %ERRORLEVEL% neq 0 (
        echo 오류: 로그인 실패.
        pause
        exit /b 1
    )
)
echo 로그인 완료.
echo.

echo [5/6] 프로젝트 연결 확인 중...
call eas build:list --limit 1 >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo 프로젝트 연결이 필요합니다. 새 프로젝트를 생성합니다...
    call eas init --non-interactive 2>nul
    if %ERRORLEVEL% neq 0 (
        echo 자동 생성 실패. 수동으로 진행합니다...
        call eas init
    )
    echo 프로젝트 연결 완료.
) else (
    echo 프로젝트 연결 정상.
)
echo.

echo [6/6] Android APK 빌드 시작... (약 10~15분 소요)
echo EAS 서버에서 빌드합니다. 컴퓨터 성능과 무관합니다.
echo.
call eas build --platform android --profile preview --clear-cache --non-interactive
if %ERRORLEVEL% neq 0 (
    echo.
    echo ============================================
    echo   빌드 실패.
    echo ============================================
    echo.
    echo 오류 해결 방법:
    echo   1. 빌드 한도 소진 → 새 이메일로 새 계정 가입: https://expo.dev/signup
    echo   2. 프로젝트 연결 오류 → eas logout ^&^& eas login ^&^& eas init
    echo   3. 세션 만료 → eas logout 후 eas login
    echo.
    pause
    exit /b 1
)
echo.
echo ============================================
echo   빌드가 완료되었습니다!
echo   위에 표시된 URL에서 APK를 다운로드하세요.
echo   또는 https://expo.dev → 계정 → Builds
echo ============================================
pause
