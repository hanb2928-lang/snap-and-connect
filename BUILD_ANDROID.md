# 숏커넥트 APK 만들기 - 초간단 가이드

컴퓨터에 아무것도 설치할 필요 없이 웹 브라우저만 있으면 됩니다.
GitHub에서 무료로 APK를 만들고 다운로드할 수 있습니다.

---

## 1단계: GitHub 가입하기

1. https://github.com 접속
2. 우상단 **Sign up** 클릭
3. 이메일, 비밀번호 입력하고 가입
4. 이메일로 온 인증 메일 확인

---

## 2단계: 새 저장소 만들기

1. GitHub 로그인 후 우상단 **+** 버튼 클릭 → **New repository**
2. Repository name에 `shortconnect` 입력
3. **Private** 선택 (소스 코드 보호)
4. **Create repository** 클릭

---

## 3단계: 프로젝트 파일 올리기

1. Bolt에서 프로젝트 다운로드 → 압축 해제
2. GitHub 저장소 페이지에서 **uploading an existing file** 클릭
3. 프로젝트의 모든 파일을 드래그 앤 드롭
   - **제외할 폴더:** `node_modules/`, `android/` 폴더는 올리지 마세요
   - `.github/workflows/build-android-apk.yml` 파일은 반드시 포함
4. 파일이 많아서 여러 번에 나눠 올려야 할 수 있습니다
5. **Commit changes** 클릭

> 팁: 파일이 너무 많으면 `node_modules`를 제외한 모든 파일을 한 번에 드래그하세요.

---

## 4단계: APK 만들기

1. 저장소 페이지 위쪽의 **Actions** 탭 클릭
2. 왼쪽 목록에서 **Build Android APK** 클릭
3. 오른쪽의 **Run workflow** 버튼 클릭
4. **Run workflow** 한 번 더 클릭

빌드가 시작됩니다. 약 15~25분 걸립니다.
빌드가 끝나면 초록색 체크 표시가 나옵니다.

---

## 5단계: APK 다운로드

1. 초록색 체크가 된 빌드 클릭
2. 페이지 아래쪽 **Artifacts** 섹션에서 `shortconnect-android-apk` 클릭
3. APK 파일이 다운로드됩니다 (zip 안에 APK가 들어 있음)
4. zip을 풀면 APK 파일이 나옵니다

---

## 6단계: 폰에 설치

1. 다운로드한 APK를 안드로이드폰으로 전송
   - USB 케이블, 이메일, 카카오톡, Google Drive 등 사용
2. 폰에서 APK 파일 실행
3. "출처를 알 수 없는 앱" 경고 → **설정에서 허용**
4. 설치 완료 후 앱 실행

---

## 코드 수정 후 다시 만들기

1. GitHub 저장소에서 수정할 파일 클릭 → 연필 아이콘 클릭 → 수정
2. **Commit changes** 클릭
3. 자동으로 빌드가 시작됨
4. 또는 Actions 탭에서 **Run workflow** 수동 클릭

---

## 빌드 실패 시

| 문제 | 해결 |
|------|------|
| Actions 탭이 안 보임 | Settings → Actions → General → "Allow all actions" 선택 |
| 빌드 시간 초과 | `.github/workflows/build-android-apk.yml`에서 `timeout-minutes`를 40으로 변경 |
| Gradle 에러 | Actions 탭에서 "Run workflow" 다시 클릭 |
| npm ci 실패 | `package-lock.json` 파일이 올라가 있는지 확인 |

---

## 무료 한도

- GitHub Actions 무료 한도: 매월 2,000분 (Private 저장소)
- Public 저장소는 무제한
- APK 1회당 약 20~25분 사용
- 매월 약 80회까지 무료 빌드 가능
