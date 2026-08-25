# 숏커넥트 Android APK 빌드 스크립트 (PowerShell)
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  숏커넥트 Android APK 빌드 스크립트" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# EAS_NO_VCS 설정 (Git 없이 EAS 사용) - PowerShell 방식
$env:EAS_NO_VCS = "1"
Write-Host "EAS_NO_VCS=1 설정 완료 (Git 없이 빌드)" -ForegroundColor Green
Write-Host ""

Write-Host "[1/6] Android SDK 경로 설정 중..." -ForegroundColor Yellow
$sdkPath = $env:ANDROID_HOME
if (-not $sdkPath) {
    $sdkPath = "$env:LOCALAPPDATA\Android\Sdk"
}
if (Test-Path $sdkPath) {
    $localProps = "sdk.dir=$($sdkPath -replace '\\', '\\')"
    Set-Content -Path "android\local.properties" -Value $localProps -Encoding UTF8
    Write-Host "local.properties 생성 완료: $sdkPath" -ForegroundColor Green
} else {
    Write-Host "경고: Android SDK를 찾을 수 없습니다. ($sdkPath)" -ForegroundColor Red
    Write-Host "Android Studio를 설치하고 SDK를 다운로드한 후 다시 시도하세요." -ForegroundColor Red
    Read-Host "Enter를 눌러 종료"
    exit 1
}
Write-Host ""

Write-Host "[2/6] 패키지 설치 중... (몇 분 걸릴 수 있습니다)" -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "오류: npm install 실패. Node.js가 설치되어 있는지 확인하세요." -ForegroundColor Red
    Read-Host "Enter를 눌러 종료"
    exit 1
}
Write-Host "패키지 설치 완료." -ForegroundColor Green
Write-Host ""

Write-Host "[3/6] EAS CLI 설치 확인 중..." -ForegroundColor Yellow
npm install -g eas-cli
Write-Host ""

Write-Host "[4/6] EAS 로그인 확인 중..." -ForegroundColor Yellow
eas whoami 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "EAS 로그인이 필요합니다." -ForegroundColor Yellow
    Write-Host "아직 계정이 없다면 https://expo.dev/signup 에서 가입하세요." -ForegroundColor Yellow
    Write-Host "기존 계정의 빌드 한도를 소진했다면 새 계정을 만드세요." -ForegroundColor Yellow
    Write-Host ""
    eas login
    if ($LASTEXITCODE -ne 0) {
        Write-Host "오류: EAS 로그인 실패." -ForegroundColor Red
        Read-Host "Enter를 눌러 종료"
        exit 1
    }
}
Write-Host ""

Write-Host "[5/6] 프로젝트 연결 중..." -ForegroundColor Yellow
eas init
Write-Host ""

Write-Host "[6/6] Android APK 빌드 시작... (약 10~15분 소요)" -ForegroundColor Yellow
eas build --platform android --profile preview --clear-cache
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "빌드 실패. 위 에러 메시지를 확인해주세요." -ForegroundColor Red
    Write-Host "'Android builds from the Free plan' 에러가 나오면 새 Expo 계정으로 빌드하세요." -ForegroundColor Yellow
    Read-Host "Enter를 눌러 종료"
    exit 1
}
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  빌드가 완료되었습니다!" -ForegroundColor Green
Write-Host "  위에 표시된 URL에서 APK를 다운로드하세요." -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Read-Host "Enter를 눌러 종료"
