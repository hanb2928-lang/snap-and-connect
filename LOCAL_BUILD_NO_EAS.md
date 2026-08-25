# APK 추출하기 - EAS 서버 빌드 가이드

## 개요

EAS 서버에서 APK를 빌드합니다. 컴퓨터 성능과 무관하며, Android Studio 설치가 필요 없습니다.
Node.js만 있으면 됩니다.

---

## 필수 설치 (최초 1회)

### Node.js (LTS)
- https://nodejs.org 에서 LTS 버전 다운로드 후 설치

---

## 빌드 실행

### Windows
1. 프로젝트 폴더 열기
2. `build-android.bat` 더블클릭

### Mac / Linux
1. 터미널 열기
2. 프로젝트 폴더로 이동
3. `bash build-android.sh` 실행

### PowerShell (Windows)
1. 프로젝트 폴더에서 `.\build-android.ps1` 실행

---

## 빌드 스크립트가 하는 일

1. Node.js 설치 확인
2. 패키지 설치 (`npm install --legacy-peer-deps`)
3. EAS CLI 설치
4. EAS 로그인 (안 되어 있으면 자동으로 로그인 화면 표시)
5. 프로젝트 연결 확인 (연결 오류 시 자동으로 새 프로젝트 생성)
6. EAS 서버에서 APK 빌드 (`eas build --platform android --profile preview`)

빌드 완료 후 터미널에 URL이 표시되면 클릭하여 APK를 다운로드하면 됩니다.

---

## 계정 연결 오류 해결

빌드 스크립트가 자동으로 처리하지만, 수동 해결이 필요한 경우:

### "Project not found" 오류
```bash
eas logout
eas login
eas init
```

### "You don't have access to this project" 오류
기존 계정의 프로젝트 연결이 꼬인 경우입니다:
```bash
eas logout
eas login    # 새 계정 또는 같은 계정으로 다시 로그인
eas init     # 새 프로젝트 생성
```

### "Android builds from the Free plan are temporarily limited" 오류
무료 계정의 월간 빌드 한도(15회)를 소진한 경우입니다:
1. https://expo.dev/signup 에서 **다른 이메일**로 새 계정 가입
2. `eas logout && eas login` 으로 새 계정 로그인
3. `eas init` 으로 새 프로젝트 생성
4. 빌드 스크립트 다시 실행

### "You are not logged in" 오류
세션이 만료된 경우입니다:
```bash
eas logout
eas login
```

---

## 수동으로 빌드하기 (스크립트 없이)

터미널에서 순서대로 입력:

```bash
npm install --legacy-peer-deps
npm install -g eas-cli
eas login
eas init
eas build --platform android --profile preview --clear-cache
```

---

## 자주 묻는 질문

**Q: Android Studio가 필요한가요?**
아니요. EAS 서버에서 빌드하므로 컴퓨터에 Android Studio, Java, Android SDK가 필요 없습니다.

**Q: 빌드 시간은 얼마나 걸리나요?**
약 10~15분 (EAS 서버에서 빌드).

**Q: 빌드 한도는 몇 회인가요?**
무료 계정마다 매월 15회. 한도 소진 시 새 이메일로 새 계정을 만들면 됩니다.

**Q: APK는 어디서 다운로드하나요?**
빌드 완료 후 터미널에 표시되는 URL을 클릭하거나, https://expo.dev → 계정 → Builds 에서 다운로드할 수 있습니다.

**Q: 같은 컴퓨터에서 계정을 바꿀 수 있나요?**
네. `eas logout` 후 `eas login`으로 새 계정 로그인하면 됩니다.
