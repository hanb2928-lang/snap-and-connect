# EAS로 APK 추출하기 - 완전 가이드

## 계정 오류로 빌드가 안 될 때 해결 방법

가장 흔한 원인 3가지와 해결책을 아래에 정리했습니다.

---

## 원인 1: 무료 빌드 한도 소진 (가장 많음)

Expo 무료 계정은 매월 15회 빌드 가능. 한도 소진 시 아래 에러가 나옵니다:

```
Android builds from the Free plan are temporarily limited
```

### 해결: 새 Expo 계정 만들기

1. https://expo.dev/signup 접속
2. **다른 이메일**로 새 계정 만들기 (같은 이메일 안 됨)
3. 프로젝트 폴더에서 빌드 스크립트 다시 실행
4. 스크립트가 자동으로 로그아웃 → 새 계정으로 로그인

---

## 원인 2: 기존 프로젝트 연결 충돌

app.json에 이전 계정의 projectId와 owner가 남아 있어서 새 계정으로 빌드할 때 충돌이 발생합니다:

```
Project not found
```

또는

```
You don't have access to this project
```

### 해결 (빌드 스크립트가 자동으로 처리)

빌드 스크립트가 실행되면 자동으로:
1. app.json에서 기존 projectId와 owner 정보 제거
2. `eas init`으로 새 계정에 새 프로젝트 생성
3. 새 projectId 자동 연결

수동으로 하려면:
```
eas init
```

---

## 원인 3: 로그인 세션 만료

```
You are not logged in
```

### 해결: 다시 로그인

```
eas logout
eas login
```

---

## 빌드 순서 (처음부터)

### Windows
1. https://nodejs.org 에서 Node.js LTS 설치
2. 프로젝트 폴더 열기
3. `build-android.bat` 더블클릭
4. 스크립트가 안내에 따라 진행

### Mac
1. https://nodejs.org 에서 Node.js LTS 설치
2. 터미널 열기
3. 프로젝트 폴더로 이동
4. `bash build-android.sh` 실행

### 빌드 스크립트가 하는 일
1. Node.js 설치 확인
2. 패키지 설치 (`npm install --legacy-peer-deps`)
3. EAS CLI 설치
4. EAS 로그인 (안 될 경우 자동으로 로그인 화면 표시)
5. 기존 프로젝트 연결 정보 초기화 (계정 충돌 방지)
6. 새 프로젝트 연결 (`eas init`)
7. APK 빌드 (`eas build --platform android --profile preview`)

### 빌드 완료 후
- 터미널에 URL이 표시됨
- URL 클릭 → APK 다운로드
- 또는 https://expo.dev 접속 → 계정 → Builds에서 다운로드

---

## 수동으로 빌드하기 (스크립트 없이)

터미널에서 순서대로 입력:

```
npm install --legacy-peer-deps
npm install -g eas-cli
eas login
eas init
eas build --platform android --profile preview --clear-cache
```

---

## 자주 묻는 질문

**Q: 새 계정 만들면 기존 앱 데이터가 날아가나요?**
아니요. Supabase 데이터는 계정과 무관하게 그대로 유지됩니다.

**Q: 빌드 한도 몇 회인가요?**
무료 계정마다 매월 15회. 한도 소진 시 새 이메일로 새 계정 만들면 됩니다.

**Q: 빌드 시간은 얼마나 걸리나요?**
약 10~15분.

**Q: 같은 컴퓨터에서 계정 바꿀 수 있나요?**
네. `eas logout` 후 `eas login`으로 새 계정 로그인하면 됩니다.
