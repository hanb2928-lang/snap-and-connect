# 숏커넥트 Android APK 로컬 빌드 스크립트 (PowerShell)
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  숏커넥트 Android APK 로컬 빌드 (EAS 불필요)" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/5] Node.js 확인 중..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>&1
    Write-Host "Node.js $nodeVersion 확인 완료." -ForegroundColor Green
} catch {
    Write-Host "오류: Node.js가 설치되어 있지 않습니다." -ForegroundColor Red
    Write-Host "다운로드: https://nodejs.org (LTS 버전 설치)" -ForegroundColor Red
    Read-Host "Enter를 눌러 종료"
    exit 1
}
Write-Host ""

Write-Host "[2/5] 패키지 설치 중... (몇 분 걸릴 수 있습니다)" -ForegroundColor Yellow
npm install --legacy-peer-deps
if ($LASTEXITCODE -ne 0) {
    Write-Host "오류: npm install 실패." -ForegroundColor Red
    Read-Host "Enter를 눌러 종료"
    exit 1
}
Write-Host "패키지 설치 완료." -ForegroundColor Green
Write-Host ""

Write-Host "[3/5] Java SDK 확인 중..." -ForegroundColor Yellow
if (-not $env:JAVA_HOME) {
    $javaCmd = Get-Command java -ErrorAction SilentlyContinue
    if ($javaCmd) {
        $javaDir = Split-Path $javaCmd.Source
        $env:JAVA_HOME = Split-Path $javaDir
        Write-Host "JAVA_HOME 자동 감지: $env:JAVA_HOME" -ForegroundColor Green
    } else {
        Write-Host "경고: Java가 설치되어 있지 않을 수 있습니다." -ForegroundColor Yellow
        Write-Host "Android Studio 또는 JDK 17 설치 필요: https://developer.android.com/studio" -ForegroundColor Yellow
    }
} else {
    Write-Host "JAVA_HOME: $env:JAVA_HOME" -ForegroundColor Green
}
Write-Host ""

Write-Host "[4/5] Android SDK 확인 중..." -ForegroundColor Yellow
if (-not $env:ANDROID_HOME) {
    $sdkPaths = @(
        "$env:LOCALAPPDATA\Android\Sdk",
        "$env:USERPROFILE\AppData\Local\Android\Sdk"
    )
    $foundSdk = $false
    foreach ($path in $sdkPaths) {
        if (Test-Path $path) {
            $env:ANDROID_HOME = $path
            Write-Host "ANDROID_HOME 자동 감지: $env:ANDROID_HOME" -ForegroundColor Green
            $foundSdk = $true
            break
        }
    }
    if (-not $foundSdk) {
        Write-Host "경고: Android SDK 경로를 찾을 수 없습니다." -ForegroundColor Yellow
        Write-Host "Android Studio 설치 필요: https://developer.android.com/studio" -ForegroundColor Yellow
    }
} else {
    Write-Host "ANDROID_HOME: $env:ANDROID_HOME" -ForegroundColor Green
}
Write-Host ""

Write-Host "[5/5] APK 빌드 시작... (약 10~20분 소요)" -ForegroundColor Yellow
Set-Location android
.\gradlew.bat assembleRelease --no-daemon
$buildResult = $LASTEXITCODE
Set-Location ..
if ($buildResult -ne 0) {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Red
    Write-Host "  빌드 실패." -ForegroundColor Red
    Write-Host "============================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "일반적인 오류 해결 방법:" -ForegroundColor Yellow
    Write-Host "  1. Java 미설치 - JDK 17 설치" -ForegroundColor White
    Write-Host "  2. Android SDK 미설치 - Android Studio 설치" -ForegroundColor White
    Write-Host "  3. SDK 라이선스 미동의 - Android Studio에서 SDK 설치 후 동의" -ForegroundColor White
    Write-Host "  4. 메모리 부족 - gradle.properties의 Xmx 값을 4096m로 증가" -ForegroundColor White
    Read-Host "Enter를 눌러 종료"
    exit 1
}

$apkPath = "android\app\build\outputs\apk\release\app-release.apk"
if (Test-Path $apkPath) {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "  빌드 성공!" -ForegroundColor Green
    Write-Host "  APK 위치: $apkPath" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Cyan
    Start-Process explorer.exe "android\app\build\outputs\apk\release"
} else {
    Write-Host ""
    Write-Host "경고: APK 파일을 찾을 수 없습니다. 빌드 출력을 확인하세요." -ForegroundColor Yellow
}
Read-Host "Enter를 눌러 종료"
