# 숏커넥트 Android APK 빌드 스크립트 (PowerShell)
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  숏커넥트 Android APK 빌드 스크립트" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# EAS_NO_VCS 설정 (Git 없이 EAS 사용)
$env:EAS_NO_VCS = "1"
Write-Host "EAS_NO_VCS=1 설정 완료 (Git 없이 빌드)" -ForegroundColor Green
Write-Host ""

Write-Host "[1/6] Node.js 확인 중..." -ForegroundColor Yellow
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

Write-Host "[2/6] 패키지 설치 중... (몇 분 걸릴 수 있습니다)" -ForegroundColor Yellow
npm install --legacy-peer-deps
if ($LASTEXITCODE -ne 0) {
    Write-Host "오류: npm install 실패." -ForegroundColor Red
    Read-Host "Enter를 눌러 종료"
    exit 1
}
Write-Host "패키지 설치 완료." -ForegroundColor Green
Write-Host ""

Write-Host "[3/6] EAS CLI 설치 중..." -ForegroundColor Yellow
npm install -g eas-cli
Write-Host ""

Write-Host "[4/6] EAS 로그인 중..." -ForegroundColor Yellow
eas whoami 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "EAS 로그인이 필요합니다." -ForegroundColor Yellow
    Write-Host "아직 계정이 없다면 https://expo.dev/signup 에서 가입하세요." -ForegroundColor Yellow
    Write-Host "기존 계정의 빌드 한도를 소진했다면 새 이메일로 새 계정을 만드세요." -ForegroundColor Yellow
    Write-Host ""
    eas login
    if ($LASTEXITCODE -ne 0) {
        Write-Host "오류: EAS 로그인 실패." -ForegroundColor Red
        Read-Host "Enter를 눌러 종료"
        exit 1
    }
}
Write-Host "로그인 확인 완료." -ForegroundColor Green
Write-Host ""

Write-Host "[5/6] 프로젝트 연결 중..." -ForegroundColor Yellow
Write-Host "기존 프로젝트 연결 정보를 초기화합니다..." -ForegroundColor DarkGray

# app.json에서 기존 projectId와 owner 제거 (새 계정 충돌 방지)
$appJson = Get-Content app.json -Raw
$appJson = $appJson -replace '"eas": \{[^}]*\}', '"eas": { "projectId": "" }'
$appJson = $appJson -replace '"owner": "[^"]*",?\r?\n', ''
Set-Content app.json $appJson

eas init
if ($LASTEXITCODE -ne 0) {
    Write-Host "경고: eas init 실패. 수동으로 프로젝트를 생성합니다." -ForegroundColor Yellow
    Write-Host "Expo 대시보드에서 프로젝트를 만들고 ID를 입력하세요." -ForegroundColor Yellow
    Write-Host "https://expo.dev 에서 New Project 클릭" -ForegroundColor Yellow
    Write-Host ""
    $projectId = Read-Host "Project ID를 입력하세요"
    eas init --id $projectId
}
Write-Host ""

Write-Host "[6/6] Android APK 빌드 시작... (약 10~15분 소요)" -ForegroundColor Yellow
eas build --platform android --profile preview --clear-cache --non-interactive
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Red
    Write-Host "  빌드 실패." -ForegroundColor Red
    Write-Host "============================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "일반적인 오류 해결 방법:" -ForegroundColor Yellow
    Write-Host '  1. "Android builds from the Free plan" - 무료 한도 소진.' -ForegroundColor White
    Write-Host "     새 이메일로 새 Expo 계정 만들기: https://expo.dev/signup" -ForegroundColor White
    Write-Host '  2. "project not found" - eas init 단계에서 프로젝트 연결 실패.' -ForegroundColor White
    Write-Host "     https://expo.dev 에서 직접 프로젝트 생성 후 ID 입력" -ForegroundColor White
    Write-Host '  3. "rate limit exceeded" - 너무 많은 빌드 시도.' -ForegroundColor White
    Write-Host "     1시간 후 다시 시도" -ForegroundColor White
    Write-Host ""
    Read-Host "Enter를 눌러 종료"
    exit 1
}
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  빌드가 완료되었습니다!" -ForegroundColor Green
Write-Host "  위에 표시된 URL에서 APK를 다운로드하세요." -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Read-Host "Enter를 눌러 종료"
