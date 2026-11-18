# TodoCalendar

Windows에서 항상 띄워두는 개인용 할 일·주간 목표 위젯. 설계: [TodoCalendar 설계안](https://claude.ai/artifact/WKqpmTa66byTrA1TQusGgm)

## 실행

```sh
npm install
npm run dev        # 개발 실행 (실제 데이터 %APPDATA%\TodoCalendar\data.db 사용)
npm test           # 이월·정렬 규칙 테스트
npm run smoke      # 임시 데이터로 앱을 띄워 IPC 확인 + 화면 캡처(smoke-out/)
npm run dist       # 설치 파일 dist\TodoCalendar Setup <버전>.exe
```

`TODOCAL_USER_DATA=<폴더>`를 주면 실제 데이터 대신 그 폴더를 씁니다.

## 구조

| 위치 | 역할 |
|---|---|
| `src/core/` | 날짜·이월·정렬 순수 함수, 내장 공휴일(2026~2027) |
| `src/main/db.ts` | SQLite(`node:sqlite`) 열기, 마이그레이션, 공휴일 채우기 |
| `src/main/taskService.ts` | 할 일·이월·휴일 규칙. DB를 바꾸는 유일한 곳 |
| `src/main/index.ts` | IPC 등록, 자정·절전 해제 이월, 트레이, 전역 단축키 |
| `src/main/windows.ts` | 위젯(항상 위, 위치·크기 기억, 접기)과 메인 창 |
| `src/preload/` | `window.api` 노출 (IPC 요청만) |
| `src/renderer/` | React 화면: 위젯, 메인(오늘·설정) |

## 단축키

`Ctrl+Alt+Space` 위젯 보이기/숨기기(전역) · `Ctrl+N` 새 할 일 · `Space` 선택 항목 체크 · `Alt+↑/↓` 순서 이동 · `Enter`/`F2` 제목 수정
