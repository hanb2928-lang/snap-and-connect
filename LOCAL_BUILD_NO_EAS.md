# EAS 없이 로컬에서 APK 추출하기 (완전 무료, 무제한)

EAS 계정이나 빌드 한도 없이 Windows 컴퓨터에서 직접 APK를 만드는 방법입니다.

---

## 준비물

- Windows 컴퓨터 (RAM 8GB 이상 권장)
- 인터넷 연결 (설치 파일 다운로드용)

---

## 1단계: 필수 프로그램 설치

### 1-1. Node.js LTS 설치

1. https://nodejs.org 접속
2. "LTS (Recommended)" 버전 다운로드 및 설치
3. 설치 확인 — PowerShell 열고 입력:
   ```
   node --version
   ```
   v20.x.x 같은 버전이 보이면 성공

### 1-2. Android Studio 설치

1. https://developer.android.com/studio 접속
2. "Download Android Studio" 클릭
3. 설치 파일 실행 — 설정은 기본값 그대로 "Next" 계속 클릭
4. 설치 완료 후 첫 실행 — "Standard" 설정으로 초기화 진행
5. 초기화가 끝나면 SDK 구성 요소가 자동으로 다운로드됨 (약 3GB)

### 1-3. 환경 변수 설정 (중요)

Android SDK 경로를 시스템에 등록해야 합니다.

1. Windows 검색창에 "환경 변수" 입력 → "시스템 환경 변수 편집" 클릭
2. "환경 변수" 버튼 클릭
3. "시스템 변수"에서 "새로 만들기" 클릭

다음 3개를 각각 추가:

| 변수 이름 | 값 |
|---|---|
| `ANDROID_HOME` | `C:\Users\본인계정\AppData\Local\Android\Sdk` |
| `ANDROID_SDK_ROOT` | `C:\Users\본인계정\AppData\Local\Android\Sdk` |

"Path" 변수를 찾아 "편집" → "새로 만들기"로 다음 2개 추가:
- `%ANDROID_HOME%\platform-tools`
- `%ANDROID_HOME%\emulator`

> 본인계정 부분은 실제 Windows 사용자 이름으로 변경하세요.

4. 확인 눌러서 저장
5. PowerShell 재시작 후 확인:
   ```
   adb --version
   ```
   버전이 보이면 성공

---

## 2단계: 프로젝트 준비

1. Bolt에서 프로젝트 다운로드 및 압축 해제
2. PowerShell을 열고 프로젝트 폴더로 이동:
   ```
   cd "프로젝트_폴더_경로"
   ```
3. 패키지 설치:
   ```
   npm install
   ```
4. Android 네이티브 프로젝트 생성:
   ```
   npx expo prebuild --platform android --no-install
   ```
   이 명령어는 `android` 폴더를 만듭니다. EAS가 필요하지 않습니다.

---

## 3단계: APK 빌드

### 방법 A: 명령어로 빌드 (빠른 방법)

PowerShell에서 실행:
```
cd android
.\gradlew assembleRelease
```

빌드 완료 후 APK 위치:
```
android\app\build\outputs\apk\release\app-release.apk
```

> 첫 빌드는 약 10~20분 소요됩니다. 다음부터는 3~5분으로 단축됩니다.

### 방법 B: Android Studio로 빌드 (화면으로 확인)

1. Android Studio 실행
2. "Open" 클릭 → 프로젝트의 `android` 폴더 선택
3. 최초 로딩 완료까지 대기 (약 2~3분)
4. 상단 메뉴: **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
5. 우하단에 "APK(s) generated successfully" 메시지가 보이면 완료
6. "locate" 링크 클릭하면 APK가 있는 폴더가 열림

---

## 4단계: 폰에 설치

### 방법 A: USB 직접 설치 (권장)

1. 안드로이드폰 설정:
   - 설정 → 휴대전화 정보 → 소프트웨어 정보
   - "빌드 번호"를 7번 연속 터치 → 개발자 모드 활성화
   - 설정 → 개발자 옵션 → "USB 디버깅" 켜기
2. 폰을 USB 케이블로 컴퓨터에 연결
3. 폰에서 "USB 디버깅을 허용하시겠습니까?" → "허용"
4. PowerShell에서 설치 명령어 실행:
   ```
   adb install android\app\build\outputs\apk\release\app-release.apk
   ```
5. "Success"가 보이면 폰에서 앱 실행 가능

### 방법 B: APK 파일 전송

1. `app-release.apk` 파일을 확인
2. USB, 이메일, 카카오톡, 클라우드로 폰에 전송
3. 폰에서 APK 파일 실행
4. "출처를 알 수 없는 앱" 경고 → 설정에서 허용
5. 설치 완료

---

## 빌드 실패 시 해결

| 문제 | 해결 |
|---|---|
| `gradlew 명령을 인식할 수 없습니다` | `cd android` 후 다시 실행 |
| `SDK location not found` | 1-3단계 환경 변수 설정 확인 |
| `Java version error` | Android Studio 설치 시 자동으로 JDK가 포함됨 — Android Studio의 "Open"으로 빌드하면 해결 |
| `OutOfMemoryError` | `android/gradle.properties`에서 `org.gradle.jvmargs=-Xmx4096m`로 변경 |
| `expo prebuild 실패` | `npm install`이 완료되었는지 확인 |
| 메모리 부족 | Android Studio와 브라우저를 모두 켜지 말고 하나만 실행 |

---

## 업데이트 후 다시 빌드

코드를 수정한 후 다시 APK를 만들려면:

```
cd android
.\gradlew assembleRelease
```

`npx expo prebuild`는 최초 1회만 하면 됩니다. 단, 새로운 네이티브 패키지를 추가한 경우에는 다시 실행해야 합니다.

---

## 요약: 전체 명령어 (PowerShell)

```powershell
# 최초 1회만
npm install
npx expo prebuild --platform android --no-install

# 빌드 (코드 수정할 때마다)
cd android
.\gradlew assembleRelease

# 폰에 직접 설치 (USB 연결 시)
adb install app\build\outputs\apk\release\app-release.apk
```
