# Folio

하루의 작업과 생각이 쌓이는 나만의 기록집. Windows에서 항상 띄워두는 개인용 할 일·주간 목표 위젯입니다.
설계: [설계안](https://claude.ai/artifact/WKqpmTa66byTrA1TQusGgm) (작성 당시 이름 TodoCalendar)

## 실행

```sh
npm install
npm run dev        # 개발 실행 (실제 데이터 %APPDATA%\Folio\data.db 사용)
npm test           # 이월·정렬·목표 규칙 테스트
npm run smoke      # 임시 데이터로 앱을 띄워 IPC 확인 + 화면 캡처(smoke-out/)
npm run icon       # resources/icon.png 다시 만들기
npm run dist       # 설치 파일 dist\Folio Setup <버전>.exe
```

`FOLIO_USER_DATA=<폴더>`를 주면 실제 데이터 대신 그 폴더를 씁니다.
처음 실행할 때 `%APPDATA%\Folio`에 DB가 없고 이전 이름의 `%APPDATA%\TodoCalendar\data.db`가 있으면 복사해 옵니다(원본은 남김).

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
