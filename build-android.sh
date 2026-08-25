#!/bin/bash
set -e
echo "============================================"
echo "  숏커넥트 Android APK 빌드 스크립트 (Mac/Linux)"
echo "============================================"
echo ""

export EAS_NO_VCS=1
echo "EAS_NO_VCS=1 설정 완료 (Git 없이 빌드)"
echo ""

echo "[1/6] Node.js 확인 중..."
if ! command -v node &> /dev/null; then
    echo "오류: Node.js가 설치되어 있지 않습니다."
    echo "다운로드: https://nodejs.org (LTS 버전 설치)"
    exit 1
fi
echo "Node.js $(node --version) 확인 완료."
echo ""

echo "[2/6] 패키지 설치 중... (몇 분 걸릴 수 있습니다)"
npm install --legacy-peer-deps
echo "패키지 설치 완료."
echo ""

echo "[3/6] EAS CLI 설치 중..."
npm install -g eas-cli
echo ""

echo "[4/6] EAS 로그인 확인 중..."
if ! eas whoami > /dev/null 2>&1; then
    echo "EAS 로그인이 필요합니다."
    echo "아직 계정이 없다면 https://expo.dev/signup 에서 가입하세요."
    echo "기존 계정의 빌드 한도를 소진했다면 새 이메일로 새 계정을 만드세요."
    echo ""
    eas login
fi
echo "로그인 확인 완료."
echo ""

echo "[5/6] 프로젝트 연결 중..."
echo "기존 프로젝트 연결 정보를 초기화합니다..."

# app.json에서 기존 projectId와 owner 제거 (새 계정 충돌 방지)
if command -v python3 &> /dev/null; then
    python3 -c "
import json, re
with open('app.json', 'r') as f:
    content = f.read()
content = re.sub(r'\"eas\": \{[^}]*\}', '\"eas\": { \"projectId\": \"\" }', content)
content = re.sub(r'\"owner\": \"[^\"]*\",?\n', '', content)
with open('app.json', 'w') as f:
    f.write(content)
"
elif command -v sed &> /dev/null; then
    sed -i.bak 's/"projectId": "[^"]*"/"projectId": ""/' app.json
    sed -i.bak '/"owner":/d' app.json
fi

eas init || {
    echo "경고: eas init 실패. 수동으로 프로젝트를 생성합니다."
    echo "Expo 대시보드에서 프로젝트를 만들고 ID를 입력하세요."
    echo "https://expo.dev 에서 New Project 클릭"
    echo ""
    read -p "Project ID를 입력하세요: " PROJECT_ID
    eas init --id "$PROJECT_ID"
}
echo ""

echo "[6/6] Android APK 빌드 시작... (약 10~15분 소요)"
eas build --platform android --profile preview --clear-cache --non-interactive || {
    echo ""
    echo "============================================"
    echo "  빌드 실패."
    echo "============================================"
    echo ""
    echo "일반적인 오류 해결 방법:"
    echo '  1. "Android builds from the Free plan" - 무료 한도 소진.'
    echo "     새 이메일로 새 Expo 계정 만들기: https://expo.dev/signup"
    echo '  2. "project not found" - eas init 단계에서 프로젝트 연결 실패.'
    echo "     https://expo.dev 에서 직접 프로젝트 생성 후 ID 입력"
    echo '  3. "rate limit exceeded" - 너무 많은 빌드 시도.'
    echo "     1시간 후 다시 시도"
    exit 1
}

echo ""
echo "============================================"
echo "  빌드가 완료되었습니다!"
echo "  위에 표시된 URL에서 APK를 다운로드하세요."
echo "============================================"
