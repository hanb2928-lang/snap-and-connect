# 숏커넥트 - 안드로이드 APK 빌드 가이드 (처음부터 끝까지)

## 현재 상황

- 기존 Expo 계정(hanbonggoo)의 무료 월간 빌드 한도 소진
- 9월 1일에 초기화됨 (9일 남음)
- **해결책: 새 Expo 계정을 만들어 빌드하면 즉시 가능**

---

## 단계별 가이드

### 1단계: 프로젝트 다운로드 및 압축 해제

Bolt에서 프로젝트를 다운로드하고, 원하는 폴더에 압축을 해제합니다.

### 2단계: Node.js 설치 확인

Node.js v18 이상이 필요합니다. 설치 여부 확인:

**Windows (PowerShell):**
```powershell
node --version
```

버전이 표시되지 않으면 https://nodejs.org 에서 LTS 버전을 설치하세요.

### 3단계: 새 Expo 계정 만들기

1. https://expo.dev/signup 접속
2. 새 이메일로 가입 (기존 계정과 다른 이메일 사용)
3. 가입 완료 후 이메일 인증

### 4단계: EAS CLI 설치

**Windows (PowerShell):**
```powershell
npm install -g eas-cli
```

### 5단계: 패키지 설치

프로젝트 폴더에서 PowerShell을 열고 실행:

```powershell
cd "프로젝트_폴더_경로"
npm install
```

설치가 완료될 때까지 대기 (2~3분 소요).

### 6단계: 환경 변수 설정

**Windows (PowerShell) - 매 터미널 세션마다 실행 필요:**
```powershell
$env:EAS_NO_VCS=1
```

### 7단계: 새 계정으로 로그인

```powershell
eas login
```

3단계에서 만든 새 계정의 이메일과 비밀번호 입력.

### 8단계: 프로젝트 연결 (최초 1회만)

```powershell
eas init
```

이 명령어는 새 계정에 프로젝트를 등록하고, `app.json`에 projectId를 자동으로 채워줍니다.

### 9단계: APK 빌드

```powershell
eas build --platform android --profile preview --clear-cache
```

빌드가 시작되면:
- EAS 서버에서 자동으로 컴파일 (약 10~15분 소요)
- 진행 상황이 터미널에 실시간 표시
- 완료되면 다운로드 URL이 표시됨

### 10단계: APK 다운로드 및 설치

1. 빌드 완료 후 터미널에 표시된 URL 클릭 (또는 https://expo.dev 계정 페이지에서 빌드 항목 확인)
2. APK 파일 다운로드
3. 안드로이드 폰으로 전송 (USB, 이메일, 클라우드 등)
4. 폰에서 APK 실행하여 설치
   - "출처를 알 수 없는 앱" 경고가 나오면 설정에서 허용

---

## 한 번에 실행 (PowerShell)

모든 단계를 순서대로 실행하는 전체 명령어:

```powershell
# 1. 패키지 설치
npm install

# 2. 환경 변수 설정
$env:EAS_NO_VCS=1

# 3. 새 계정 로그인
eas login

# 4. 프로젝트 연결
eas init

# 5. 빌드
eas build --platform android --profile preview --clear-cache
```

---

## 빌드 스크립트로 한 번에 실행

프로젝트 폴더의 `build-android.bat` 파일을 더블클릭하면 2~5단계가 자동 실행됩니다. 로그인만 직접 하면 됩니다.

---

## 자주 발생하는 에러

| 에러 메시지 | 원인 | 해결 |
|---|---|---|
| `node modules installed?` | npm install 안 함 | `npm install` 실행 |
| `Failed to resolve plugin` | npm install 안 함 | `npm install` 실행 |
| `projectId is empty` | eas init 안 함 | `eas init` 실행 |
| `git command not found` | Git 미설치 | `$env:EAS_NO_VCS=1` 설정 |
| `Android builds from the Free plan` | 빌드 한도 소진 | 새 Expo 계정으로 빌드 |
| `Gradle build failed` | 네이티브 컴파일 오류 | `--clear-cache` 추가 |
| `You are not logged in` | 로그인 안 됨 | `eas login` 실행 |

---

## 주의사항

- **반드시 `npm install`을 먼저 실행하세요.** Bolt에서 다운로드한 프로젝트에는 `node_modules` 폴더가 없습니다.
- **매 터미널 세션마다 `$env:EAS_NO_VCS=1`을 설정해야 합니다.** 창을 닫거면 다시 설정해야 합니다.
- **`--profile preview`를 사용하세요.** 이 프로필은 Expo Go 없이 작동하는 독립 APK를 만듭니다.
- **새 계정으로 빌드하려면 반드시 `eas init`을 다시 실행해야 합니다.** 기존 projectId는 이전 계정에 연결되어 있습니다.
