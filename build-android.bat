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
    echo.
    echo 오류: npm install 실패.
    pause
    exit /b 1
)
echo 패키지 설치 완료.
echo.

echo [3/6] EAS CLI 설치 중...
call npm install -g eas-cli
echo.

echo [4/6] EAS 로그인 중...
call eas whoami >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo EAS 로그인이 필요합니다.
    echo.
    echo 아직 계정이 없다면 https://expo.dev/signup 에서 가입하세요.
    echo 기존 계정의 빌드 한도를 소진했다면 새 이메일로 새 계정을 만드세요.
    echo.
    call eas login
    if %ERRORLEVEL% neq 0 (
        echo.
        echo 오류: EAS 로그인 실패.
        pause
        exit /b 1
    )
)
echo 로그인 확인 완료.
echo.

echo [5/6] 프로젝트 연결 중...
echo 기존 프로젝트 연결 정보를 초기화합니다...

REM app.json에서 기존 projectId 제거 (새 계정 충돌 방지)
powershell -Command "(Get-Content app.json -Raw) -replace '\"eas\": \{[^}]*\}', '\"eas\": { \"projectId\": \"\" }' | Set-Content app.json"
powershell -Command "(Get-Content app.json -Raw) -replace '\"owner\": \"[^\"]*\",?\r?\n', '' | Set-Content app.json"

call eas init
if %ERRORLEVEL% neq 0 (
    echo.
    echo 경고: eas init 실패. 수동으로 프로젝트를 생성합니다.
    echo Expo 대시보드에서 프로젝트를 만들고 ID를 입력하세요.
    echo https://expo.dev 에서 New Project 클릭
    echo.
    set /p PROJECT_ID="Project ID를 입력하세요: "
    call eas init --id %PROJECT_ID%
)
echo.

echo [6/6] Android APK 빌드 시작... (약 10~15분 소요)
call eas build --platform android --profile preview --clear-cache --non-interactive
if %ERRORLEVEL% neq 0 (
    echo.
    echo ============================================
    echo   빌드 실패.
    echo ============================================
    echo.
    echo 일반적인 오류 해결 방법:
    echo   1. "Android builds from the Free plan" - 무료 한도 소진.
    echo      새 이메일로 새 Expo 계정 만들기: https://expo.dev/signup
    echo   2. "project not found" - eas init 단계에서 프로젝트 연결 실패.
    echo      https://expo.dev 에서 직접 프로젝트 생성 후 ID 입력
    echo   3. "rate limit exceeded" - 너무 많은 빌드 시도.
    echo      1시간 후 다시 시도
    echo.
    pause
    exit /b 1
)
echo.
echo ============================================
echo   빌드가 완료되었습니다!
echo   위에 표시된 URL에서 APK를 다운로드하세요.
echo ============================================
pause
