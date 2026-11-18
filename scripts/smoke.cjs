// 빌드된 앱을 임시 데이터 폴더로 띄워 IPC를 실제로 호출해 보고, 두 창을 PNG로 저장한 뒤 종료한다.
// 사용: npm run build && npx electron scripts/smoke.cjs <출력 폴더>
const { app, BrowserWindow } = require('electron')
const { mkdtempSync, writeFileSync, mkdirSync } = require('node:fs')
const { join, resolve } = require('node:path')
const { tmpdir } = require('node:os')

const outDir = resolve(process.argv[2] ?? 'smoke-out')
mkdirSync(outDir, { recursive: true })
process.env.FOLIO_USER_DATA = mkdtempSync(join(tmpdir(), 'folio-smoke-'))
require('../out/main/index.js')

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const loaded = (win) => new Promise((r) => (win.webContents.isLoading() ? win.webContents.once('did-finish-load', r) : r()))

app.whenReady().then(async () => {
  await wait(800)
  const widget = BrowserWindow.getAllWindows()[0]
  await loaded(widget)
  const run = (js) => widget.webContents.executeJavaScript(js)

  const log = await run(`(async () => {
    const api = window.api, today = await api.getToday()
    const a = await api.addTask(today, '주간 보고서 초안')
    const b = await api.addTask(today, '디자인 리뷰 피드백 정리')
    const c = await api.addTask(today, '휴가 신청서 제출')
    await api.addTask(today, '세금계산서 확인')
    await api.updateTask(b.id, { note: '3번 화면 여백 이슈 포함' })
    await api.setDone(c.id, true)
    await api.moveTask(a.id, b.id, null)            // a를 b 뒤로
    const list = (await api.listTasks(today)).map(t => (t.done ? '✓' : '·') + t.title)
    const holidays = (await api.listHolidays()).length
    return { today, list, holidays, notice: await api.getNotice(), prefs: await api.getPrefs() }
  })()`)
  console.log(JSON.stringify(log, null, 2))

  await run(`window.api.openMain()`)
  await wait(500)
  const main = BrowserWindow.getAllWindows().find((w) => w !== widget)
  await loaded(main)
  await wait(700)
  writeFileSync(join(outDir, 'widget.png'), (await widget.webContents.capturePage()).toPNG())
  writeFileSync(join(outDir, 'main.png'), (await main.webContents.capturePage()).toPNG())

  // 설정 탭
  await main.webContents.executeJavaScript(`[...document.querySelectorAll('.side button')].find(b => b.textContent === '설정').click()`)
  await wait(400)
  writeFileSync(join(outDir, 'settings.png'), (await main.webContents.capturePage()).toPNG())
  console.log('screenshots →', outDir)
  app.quit()
})
