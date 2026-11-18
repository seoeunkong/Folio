# Folio

하루의 작업과 생각이 쌓이는 나만의 기록집. Windows에서 항상 띄워두는 개인용 할 일·주간 목표 위젯입니다.
설계: [설계안](https://claude.ai/artifact/WKqpmTa66byTrA1TQusGgm) (작성 당시 이름 TodoCalendar)

## 설치 (개발 도구 없이)

1. [Releases](https://github.com/seoeunkong/Folio/releases/latest)에서 `Folio-Setup-<버전>.exe`를 내려받아 실행한다. 사용자 폴더에 바로 설치되며 관리자 권한이 필요 없다.
2. 코드 서명이 없어 처음 실행할 때 "Windows의 PC 보호" 창이 뜨면 **추가 정보 → 실행**을 누른다.
3. 데이터는 그 PC의 `%APPDATA%\Folio\data.db`에 따로 저장된다(PC 사이에 동기화되지 않음).

## 업데이트

설치본은 시작할 때와 6시간마다 Releases의 새 버전을 확인해 백그라운드로 내려받는다. 다 받으면 알림이 뜨고,
트레이 메뉴의 **업데이트 설치 후 다시 시작**을 누르거나 다음에 종료할 때 설치된다. 데이터는 그대로 남는다.
자동 업데이트가 막힌 환경(회사 방화벽 등)에서는 Releases에서 새 설치 파일을 받아 실행하면 덮어 설치된다.

## 새 버전 배포

```sh
npm version patch          # package.json 버전을 올리고 커밋 + 태그(v0.2.1 등)를 만든다
git push --follow-tags     # 태그가 올라가면 GitHub Actions가 테스트 → 설치 파일 빌드 → Releases 게시
```

워크플로: `.github/workflows/release.yml`. 태그와 `package.json` 버전이 다르면 빌드하지 않는다.

## 실행

```sh
npm install
npm run dev        # 개발 실행 (실제 데이터 %APPDATA%\Folio\data.db 사용)
npm test           # 이월·정렬·목표 규칙 테스트
npm run smoke      # 임시 데이터로 앱을 띄워 IPC 확인 + 화면 캡처(smoke-out/)
npm run icon       # resources/icon.png 다시 만들기
npm run dist       # 설치 파일 dist\Folio-Setup-<버전>.exe (로컬 빌드, 게시하지 않음)
```

`FOLIO_USER_DATA=<폴더>`를 주면 실제 데이터 대신 그 폴더를 씁니다.
처음 실행할 때 `%APPDATA%\Folio`에 DB가 없고 이전 이름의 `%APPDATA%\TodoCalendar\data.db`가 있으면 복사해 옵니다(원본은 남김).

## 글꼴

위젯의 주간 테마 문구에만 네이버 **마루 부리 Regular**를 쓴다. 공식 배포본([hangeul.naver.com/font](https://hangeul.naver.com/font)의 `maruburi.zip`)의 OTF를 수정하지 않고 `src/renderer/src/assets/fonts/`에 넣었다.
SIL Open Font License 1.1(예약 글꼴 이름 MaruBuri)이므로 서브셋·형식 변환을 하면 이름을 바꿔야 한다. 저작권 안내와 라이선스 전문은 `resources/fonts/MaruBuri-LICENSE.txt`이며 설치본에 함께 들어간다.
불러오지 못하면 바탕 → 기존 세리프 순으로 대체한다.

## 구조

| 위치 | 역할 |
|---|---|
| `src/core/` | 날짜·이월·정렬 순수 함수, 내장 공휴일(2026~2027) |
| `src/main/db.ts` | SQLite(`node:sqlite`) 열기, 마이그레이션, 공휴일 채우기 |
| `src/main/taskService.ts` | 할 일·이월·휴일·주간 목표 규칙. DB를 바꾸는 유일한 곳 |
| `src/main/index.ts` | IPC 등록, 자정·절전 해제 이월, 트레이, 전역 단축키, 테마 |
| `src/main/windows.ts` | 위젯(항상 위, 위치·크기 기억, 접기)과 메인 창 |
| `src/preload/` | `window.api` 노출 (IPC 요청만) |
| `src/renderer/` | React 화면: 위젯, 메인(오늘·주간·월간·설정) |

## 단축키

`Ctrl+Alt+Space` 위젯 보이기/숨기기(전역) · `Ctrl+N` 새 할 일 · `Space` 선택 항목 체크 · `Alt+↑/↓` 순서 이동 · `Enter`/`F2` 제목 수정
