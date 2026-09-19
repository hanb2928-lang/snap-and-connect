# 숏커넥트 Android APK 빌드 스크립트 (PowerShell)
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  숏커넥트 Android APK 빌드 (EAS 서버)" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$env:EAS_NO_VCS = "1"

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
npm install -g eas-cli 2>$null
Write-Host "EAS CLI 준비 완료." -ForegroundColor Green
Write-Host ""

Write-Host "[4/6] EAS 로그인 확인 중..." -ForegroundColor Yellow
eas whoami 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "EAS 로그인이 필요합니다." -ForegroundColor Yellow
    Write-Host "계정이 없다면 https://expo.dev/signup 에서 가입하세요." -ForegroundColor Yellow
    Write-Host ""
    eas login
    eas whoami 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "오류: 로그인 실패." -ForegroundColor Red
        Read-Host "Enter를 눌러 종료"
        exit 1
    }
}
Write-Host "로그인 완료." -ForegroundColor Green
Write-Host ""

Write-Host "[5/6] 프로젝트 연결 확인 중..." -ForegroundColor Yellow
eas build:list --limit 1 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "프로젝트 연결이 필요합니다. 새 프로젝트를 생성합니다..." -ForegroundColor Yellow
    eas init --non-interactive 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "자동 생성 실패. 수동으로 진행합니다..." -ForegroundColor Yellow
        eas init
    }
    Write-Host "프로젝트 연결 완료." -ForegroundColor Green
} else {
    Write-Host "프로젝트 연결 정상." -ForegroundColor Green
}
Write-Host ""

Write-Host "[6/6] Android APK 빌드 시작... (약 10~15분 소요)" -ForegroundColor Yellow
Write-Host "EAS 서버에서 빌드합니다. 컴퓨터 성능과 무관합니다." -ForegroundColor DarkGray
Write-Host ""
eas build --platform android --profile development --clear-cache --non-interactive
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Red
    Write-Host "  빌드 실패." -ForegroundColor Red
    Write-Host "============================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "오류 해결 방법:" -ForegroundColor Yellow
    Write-Host "  1. 빌드 한도 소진 → 새 이메일로 새 계정 가입: https://expo.dev/signup" -ForegroundColor White
    Write-Host "  2. 프로젝트 연결 오류 → eas logout; eas login; eas init" -ForegroundColor White
    Write-Host "  3. 세션 만료 → eas logout 후 eas login" -ForegroundColor White
    Read-Host "Enter를 눌러 종료"
    exit 1
}
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  빌드가 완료되었습니다!" -ForegroundColor Green
Write-Host "  위에 표시된 URL에서 APK를 다운로드하세요." -ForegroundColor Green
Write-Host "  또는 https://expo.dev → 계정 → Builds" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Read-Host "Enter를 눌러 종료"
