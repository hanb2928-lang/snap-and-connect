# APK 추출하기 - 완전 가이드 (EAS 계정 불필요)

## 개요

이 프로젝트는 **EAS 서버 없이 로컬에서 직접 APK를 빌드**합니다.
Expo 계정, 로그인, 빌드 한도가 전혀 필요 없습니다.

---

## 필수 설치 (최초 1회)

### 1. Node.js (LTS)
- https://nodejs.org 에서 LTS 버전 다운로드 후 설치

### 2. Android Studio
- https://developer.android.com/studio 에서 설치
- 설치 후 실행 → SDK 구성요소 자동 설치
- SDK 라이선스에 동의

Android Studio를 설치하면 Java JDK 17과 Android SDK가 함께 설치됩니다.

---

## 빌드 실행

### Windows
1. 프로젝트 폴더 열기
2. `build-android.bat` 더블클릭
3. 완료되면 APK 파일이 있는 폴더가 자동으로 열림

### Mac / Linux
1. 터미널 열기
2. 프로젝트 폴더로 이동
3. `bash build-android.sh` 실행
4. 완료되면 APK 경로가 출력됨

### PowerShell (Windows)
1. 프로젝트 폴더에서 우클릭 → "터미널에서 열기"
2. `.\build-android.ps1` 실행

---

## 빌드 스크립트가 하는 일

1. Node.js 설치 확인
2. 패키지 설치 (`npm install --legacy-peer-deps`)
3. Java SDK (JAVA_HOME) 확인
4. Android SDK (ANDROID_HOME) 확인
5. Gradle로 APK 빌드 (`./gradlew assembleRelease`)

빌드가 완료되면 APK 파일이 생성됩니다:

```
android/app/build/outputs/apk/release/app-release.apk
```

---

## 수동으로 빌드하기 (스크립트 없이)

터미널에서 순서대로 입력:

```bash
npm install --legacy-peer-deps
cd android
./gradlew assembleRelease
```

빌드 완료 후:
```
android/app/build/outputs/apk/release/app-release.apk
```

---

## 자주 묻는 질문

**Q: EAS 계정이 필요한가요?**
아니요. 로컬 Gradle로 빌드하므로 Expo 계정, 로그인, 빌드 한도가 전혀 필요 없습니다.

**Q: 빌드 시간은 얼마나 걸리나요?**
첫 빌드는 약 10~20분 (Gradle과 의존성 다운로드). 이후 재빌드는 3~5분.

**Q: "SDK license not accepted" 오류가 나요**
Android Studio를 실행해서 SDK 라이선스에 동의하세요.

**Q: "Could not find JAVA_HOME" 오류가 나요**
JDK 17을 설치하고 환경변수 JAVA_HOME을 설정하세요.
또는 Android Studio를 설치하면 자동으로 포함됩니다.

**Q: 메모리 부족 오류가 나요**
`android/gradle.properties`에서 `org.gradle.jvmargs` 값을 `-Xmx4096m`로 변경하세요.
