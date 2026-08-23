#!/bin/bash
set -e
echo "============================================"
echo "  숏커넥트 Android APK 빌드 스크립트 (Mac/Linux)"
echo "============================================"
echo ""

export EAS_NO_VCS=1
echo "EAS_NO_VCS=1 설정 완료 (Git 없이 빌드)"
echo ""

echo "[1/5] 패키지 설치 중... (몇 분 걸릴 수 있습니다)"
npm install
echo "패키지 설치 완료."
echo ""

echo "[2/5] EAS CLI 설치 확인 중..."
npm install -g eas-cli
echo ""

echo "[3/5] EAS 로그인 확인 중..."
if ! eas whoami > /dev/null 2>&1; then
  echo "EAS 로그인이 필요합니다."
  echo "아직 계정이 없다면 https://expo.dev/signup 에서 가입하세요."
  echo "기존 계정의 빌드 한도를 소진했다면 새 계정을 만드세요."
  echo ""
  eas login
fi
echo ""

echo "[4/5] 프로젝트 연결 중..."
eas init
echo ""

echo "[5/5] Android APK 빌드 시작... (약 10~15분 소요)"
eas build --platform android --profile preview --clear-cache

echo ""
echo "============================================"
echo "  빌드가 완료되었습니다!"
echo "  위에 표시된 URL에서 APK를 다운로드하세요."
echo "============================================"
