# Android Studio로 APK 추출하기 - 상세 가이드

EAS 없이 Windows 컴퓨터 + Android Studio로 직접 APK를 만드는 방법입니다.
빌드 횟수 제한 없이 무제한으로 사용할 수 있습니다.

---

## 준비물

- Windows 컴퓨터 (RAM 8GB 이상, 16GB 권장)
- 하드디스크 여유 공간 10GB 이상
- 인터넷 연결 (설치 파일 및 SDK 다운로드용)

---

## 1단계: Node.js 설치

1. https://nodejs.org 접속
2. **LTS (Recommended)** 버전 다운로드 (v20.x.x)
3. 설치 파일 실행 — 모든 옵션 기본값 그대로 "Next" 클릭
4. 설치 확인 — PowerShell 열고 입력:
   ```
   node --version
   ```
   `v20.x.x`가 보이면 성공

---

## 2단계: Android Studio 설치

### 2-1. 다운로드 및 설치

1. https://developer.android.com/studio 접속
2. 녹색 "Download Android Studio" 버튼 클릭
3. 약관 동의 후 다운로드
4. 설치 파일 실행 (`android-studio-xxx-windows.exe`)
5. 설치 옵션 화면:
   - "Choose the type of setup" → **Standard** 선택
   - "Select UI Theme" → 원하는 테마 선택
   - 모든 항목 체크된 상태로 "Next" 클릭
6. "Finish" 클릭 — Android Studio 첫 실행

### 2-2. SDK 초기 설정 (자동 다운로드)

1. 첫 실행 시 "Welcome to Android Studio" 화면이 나옴
2. 초기 설정 마법사가 자동으로 시작됨:
   - "Standard" 선택
   - SDK 구성 요소 자동 다운로드 시작 (약 3GB, 시간 소요)
3. 다운로드 완료 후 "Finish" 클릭
4. Android Studio 메인 화면이 나오면 설치 완료

### 2-3. 추가 SDK 패키지 설치

1. Android Studio 메인 화면에서:
   - **More Actions** → **SDK Manager** 클릭
   - 또는 메뉴: **File** → **Settings** → **Languages & Frameworks** → **Android SDK**
2. **SDK Platforms** 탭:
   - **Android 14.0 (API 35)** 체크
   - 하위 호환성을 위해 **Android 13.0 (API 34)**도 체크 권장
3. **SDK Tools** 탭:
   - **Android SDK Build-Tools 35** 체크 확인
   - **Android SDK Command-line Tools (latest)** 체크 확인
   - **Android Emulator** 체크 해제 (실물 폰 사용 시 불필요)
4. **Apply** 클릭 → **OK** → 다운로드 완료 후 **Finish**

### 2-4. 환경 변수 등록 (중요 — 이 단계를 건너뛰면 빌드 실패)

1. Windows 키 + R → `sysdm.cpl` 입력 → Enter
2. **고급** 탭 → **환경 변수** 버튼 클릭
3. **시스템 변수** 영역에서 **새로 만들기** 클릭

   **변수 1:**
   - 변수 이름: `ANDROID_HOME`
   - 변수 값: `C:\Users\본인계정\AppData\Local\Android\Sdk`

   **변수 2:**
   - 변수 이름: `ANDROID_SDK_ROOT`
   - 변수 값: `C:\Users\본인계정\AppData\Local\Android\Sdk`

   > `본인계정`은 실제 Windows 사용자 이름으로 변경하세요.
   > 경로를 모르겠으면 Android Studio의 SDK Manager에서 "Android SDK Location" 항목을 확인하세요.

4. 같은 화면에서 **시스템 변수**의 **Path**를 찾아 **편집** 클릭
5. **새로 만들기**로 다음 3개 추가:
   - `%ANDROID_HOME%\platform-tools`
   - `%ANDROID_HOME%\emulator`
   - `%ANDROID_HOME%\cmdline-tools\latest\bin`
6. **OK** 세 번 클릭하여 저장
7. **기존에 열려있던 PowerShell을 모두 닫고 새로 열기** (환경 변수 적용을 위해)
8. 확인:
   ```
   adb --version
   ```
   버전 정보가 보이면 성공

---

## 3단계: 프로젝트 준비

### 3-1. 프로젝트 다운로드 및 압축 해제

1. Bolt에서 프로젝트 다운로드
2. 적당한 폴더에 압축 해제 (예: `C:\Projects\shortconnect`)
   > 경로에 한글이나 공백이 없게 하세요 (예: `C:\내 프로젝트` → 빌드 오류 발생)

### 3-2. 환경 변수 파일 만들기

프로젝트 폴더 루트에 `.env` 파일이 이미 있다면 건너뛰세요.
없다면 메모장으로 만들어야 합니다.

프로젝트 폴더에 `.env` 파일을 생성하고 다음 내용을 입력:

```
EXPO_PUBLIC_SUPABASE_URL=https://pnlyrodbiqlpwduuzrsp.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBubHlyb2RiaXFscHdkdXV6cnNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MTA0NDIsImV4cCI6MjEwMjI4NjQ0Mn0.CP2hnNB5UfPQh6kxUvIUzEkd8q0gby1ukLCCkh5ri38
```

### 3-3. 패키지 설치

PowerShell 열기 (프로젌트 폴더에서 Shift+우클릭 → "PowerShell 창 열기"):

```
cd "C:\Projects\shortconnect"
npm install
```

설치 완료까지 대기 (약 2~3분). 오류가 나지 않으면 성공.

### 3-4. Android SDK 경로 파일 만들기 (중요 — 이 단계를 건너뛰면 빌드 실패)

`android` 폴더 안에 `local.properties` 파일을 만들어야 합니다.

메모장으로 `android\local.properties` 파일을 생성하고 다음 내용을 입력:

```
sdk.dir=C:\\Users\\본인계정\\AppData\\Local\\Android\\Sdk
```

> `본인계정`은 실제 Windows 사용자 이름으로 변경하세요.
> 경로를 모르겠으면 Android Studio의 SDK Manager에서 "Android SDK Location" 항목을 확인하세요.
> 환경 변수 `ANDROID_HOME`이 설정되어 있어도 이 파일이 있어야 Gradle이 SDK를 찾을 수 있습니다.

### 3-5. Android 네이티브 프로젝트 생성

같은 PowerShell에서 실행:

```
npx expo prebuild --platform android --no-install
```

이 명령어는:
- `android` 폴더를 생성합니다
- Android Studio에서 열 수 있는 네이티브 프로젝트를 만듭니다
- EAS 계정이나 로그인이 필요 없습니다
- 약 1~2분 소요

완료되면 프로젝트 폴더 안에 `android` 폴더가 생깁니다.

---

## 4단계: Android Studio로 빌드

### 방법 A: Android Studio 화면으로 빌드 (초보자 권장)

1. **Android Studio 실행**
2. 메인 화면에서 **Open** 클릭
3. 프로젝트의 `android` 폴더 선택 (예: `C:\Projects\shortconnect\android`)
   > 주의: 프로젝트 루트가 아니라 `android` 폴더를 열어야 합니다
4. **Trust Project** 클릭
5. **Gradle Sync 자동 실행** — 하단에 진행 바가 표시됨
   - 첫 동기화는 약 3~5분 소요 (Gradle 다운로드 포함)
   - "Gradle sync finished"가 보이면 성공
6. 동기화 실패 시:
   - 상단에 "Gradle Sync" 버튼(코끼리 아이콘 + 새로고침) 클릭하여 재시도
   - SDK 버전 경고가 나오면 "Install missing components" 클릭

### APK 빌드 실행

7. 상단 메뉴: **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
   > 주의: "Build Bundle(s) / APK(s)"이지 "Generate Signed Bundle / APK"가 아닙니다
8. 하단 **Build** 창에 빌드 진행 상황이 표시됨
   - 첫 빌드: 약 15~20분
   - 이후 빌드: 약 3~5분
9. 완료 후 우하단에 녹색 알림:
   ```
   APK(s) generated successfully for 1 module
   ```
10. 알림에서 **locate** 링크 클릭
11. 파일 탐색기가 열리면 `app-release.apk` 또는 `app-debug.apk` 파일이 보임

> 파일이 안 보이면 수동으로 찾기:
> `android\app\build\outputs\apk\release\app-release.apk`

### 방법 B: 명령어로 빌드 (빠른 방법)

Android Studio를 열 필요 없이 PowerShell에서 바로 빌드:

```
cd "C:\Projects\shortconnect\android"
.\gradlew assembleRelease
```

완료 후 APK 위치:
```
android\app\build\outputs\apk\release\app-release.apk
```

---

## 5단계: 안드로이드폰에 설치

### 방법 A: USB로 직접 설치 (가장 빠름)

1. **폰 개발자 모드 활성화:**
   - 설정 → 휴대전화 정보 → 소프트웨어 정보
   - "빌드 번호"를 7번 연속 터치
   - "개발자 모드가 활성화되었습니다" 메시지 확인

2. **USB 디버깅 켜기:**
   - 설정 → 개발자 옵션 (또는 시스템 → 개발자 옵션)
   - "USB 디버깅" 켜기

3. **폰을 USB로 컴퓨터에 연결**
   - 폰 화면에 "USB 디버깅을 허용하시겠습니까?" → **허용**
   - "이 컴퓨터에서 항상 허용" 체크 권장

4. **PowerShell에서 설치 명령어 실행:**
   ```
   adb install "C:\Projects\shortconnect\android\app\build\outputs\apk\release\app-release.apk"
   ```
   > 경로는 실제 APK 위치로 변경하세요

5. 결과:
   - `Success`가 보이면 설치 완료 — 폰에서 앱 실행
   - `INSTALL_FAILED_UPDATE_INCOMPATIBLE` → 기존 앱 삭제 후 재시도
   - `device offline` → USB 다시 연결 후 `adb devices`로 확인

### 방법 B: APK 파일 전송 후 설치

1. APK 파일 위치로 이동:
   ```
   C:\Projects\shortconnect\android\app\build\outputs\apk\release\app-release.apk
   ```
2. 폰으로 파일 전송:
   - USB 케이블로 파일 복사
   - 또는 이메일, 카카오톡, Google Drive 등 사용
3. 폰에서 파일 탐색기로 APK 실행
4. "출처를 알 수 없는 앱" 경고 → **설정 → 허용**
5. 설치 완료 후 앱 실행

### 방법 C: Android Studio에서 Run 버튼으로 직접 설치

1. 폰을 USB로 연결 (개발자 모드 + USB 디버깅 활성화 상태)
2. Android Studio 상단 기기 선택 드롭다운에서 연결된 폰 선택
3. 녹색 **Run** 버튼(재생 아이콘) 클릭
4. 앱이 폰에 자동 설치되고 실행됨

---

## 6단계: 코드 수정 후 다시 빌드

코드를 수정한 후 APK를 다시 만드는 방법:

### JavaScript/TypeScript 코드만 수정한 경우
```
cd "C:\Projects\shortconnect\android"
.\gradlew assembleRelease
```
빌드 시간: 약 3~5분

### 새로운 npm 패키지를 추가한 경우
```
cd "C:\Projects\shortconnect"
npm install
npx expo prebuild --platform android --no-install --clean
cd android
.\gradlew assembleRelease
```
빌드 시간: 약 10~15분

---

## 빌드 오류 해결

| 오류 | 원인 | 해결 |
|---|---|---|
| `SDK location not found` | 환경 변수 미설정 | 2-4단계 다시 실행 |
| `Failed to find Build Tools` | Build Tools 미설치 | 2-3단계에서 Build Tools 35 체크 |
| `Gradle sync failed` | 네트워크 문제 | File → Sync Project with Gradle Files 클릭 |
| `OutOfMemoryError` | JVM 메모리 부족 | `android/gradle.properties`에서 `org.gradle.jvmargs=-Xmx4096m`로 변경 |
| `expo prebuild 실패` | npm install 미실행 | `npm install` 먼저 실행 |
| `adb: command not found` | 환경 변수 미설정 | PowerShell을 닫고 새로 열기 |
| `Unauthorized` | 폰 USB 디버깅 미승인 | 폰에서 "허용" 클릭 |
| `app-release.apk 없음` | 빌드 미완료 | Build 창에서 "Build APK(s)" 다시 클릭 |
| `Lint found fatal errors` | 린트 오류 | 명령어로 빌드 시: `.\gradlew assembleRelease -x lint` |

---

## 전체 명령어 요약 (PowerShell)

```powershell
# === 최초 1회만 ===
cd "C:\Projects\shortconnect"
npm install
npx expo prebuild --platform android --no-install

# === APK 빌드 (수정할 때마다) ===
cd android
.\gradlew assembleRelease

# === 폰에 직접 설치 (USB 연결 시) ===
adb install app\build\outputs\apk\release\app-release.apk
```

---

## 폰 설정 요약

1. 설정 → 휴대전화 정보 → 빌드 번호 7번 터치 → 개발자 모드 활성화
2. 설정 → 개발자 옵션 → USB 디버깅 켜기
3. USB 연결 → "USB 디버깅 허용" → 허용
