import { app, globalShortcut, ipcMain, Menu, nativeImage, nativeTheme, powerMonitor, Tray } from 'electron'
import { join } from 'node:path'
import icon from '../../resources/icon.png?asset'
import { toYmd } from '../core/dates'
import { API_METHODS, MUTATING_METHODS, type Prefs, type ThemeSource, type TodoApi } from '../shared/types'
import { getSetting, openDb, setSetting } from './db'
import { TaskService } from './taskService'
import { Windows } from './windows'

// DB 위치: %APPDATA%\TodoCalendar\data.db (개발 실행과 설치본이 같은 데이터를 쓴다)
// TODOCAL_USER_DATA를 주면 그 폴더를 대신 쓴다(실제 데이터를 건드리지 않고 시험할 때).
app.setPath('userData', process.env.TODOCAL_USER_DATA ?? join(app.getPath('appData'), 'TodoCalendar'))
app.setAppUserModelId('TodoCalendar')

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) app.quit()

let tray: Tray | null = null // GC로 트레이가 사라지지 않게 붙잡아 둔다

app.whenReady().then(() => {
  if (!gotLock) return
  const db = openDb(join(app.getPath('userData'), 'data.db'))
  const svc = new TaskService(db)
  const wins = new Windows(db)

  // ── 날짜 변경 감시와 자동 이월 ─────────────────────────
  // 앱 시작, 자정(30초마다 날짜 비교), 절전 해제 때 실행한다. 이월은 여러 번 실행해도 안전하다.
  let today = toYmd(new Date())
  const checkDay = (force = false) => {
    const now = toYmd(new Date())
    if (!force && now === today) return
    today = now
    svc.runRollover(today)
    wins.broadcast('changed')
  }
  svc.runRollover(today)
  setInterval(checkDay, 30_000)
  powerMonitor.on('resume', () => checkDay(true))
  powerMonitor.on('unlock-screen', () => checkDay(true))

  // ── 설정 ──────────────────────────────────────────────
  const getPrefs = (): Prefs => ({
    widgetOpacity: getSetting<number>(db, 'widget_opacity') ?? 1,
    widgetPinned: getSetting<boolean>(db, 'widget_pinned') ?? true,
    widgetCollapsed: getSetting<boolean>(db, 'widget_collapsed') ?? false,
    openAtLogin: app.getLoginItemSettings().openAtLogin,
    theme: nativeTheme.themeSource,
  })
  const setPrefs = (p: Partial<Prefs>): Prefs => {
    if (p.widgetOpacity !== undefined) {
      const v = Math.min(1, Math.max(0.3, p.widgetOpacity))
      setSetting(db, 'widget_opacity', v)
      wins.widget.setOpacity(v)
    }
    if (p.widgetPinned !== undefined) {
      setSetting(db, 'widget_pinned', p.widgetPinned)
      wins.widget.setAlwaysOnTop(p.widgetPinned, 'floating')
    }
    if (p.widgetCollapsed !== undefined) wins.setWidgetCollapsed(p.widgetCollapsed)
    if (p.openAtLogin !== undefined) app.setLoginItemSettings({ openAtLogin: p.openAtLogin })
    if (p.theme !== undefined) {
      setSetting(db, 'theme', p.theme)
      nativeTheme.themeSource = p.theme
    }
    return getPrefs()
  }
  // 모든 창의 CSS prefers-color-scheme가 이 값을 따른다
  nativeTheme.themeSource = getSetting<ThemeSource>(db, 'theme') ?? 'system'

  // ── IPC: 화면은 이 함수들만 부를 수 있다 ───────────────
  const api: Omit<TodoApi, 'onChanged'> = {
    getToday: async () => today,
    getNotice: async () => svc.holidayNotice(today),
    listTasks: async (date) => svc.listTasks(date),
    addTask: async (date, title) => svc.addTask(date, title),
    updateTask: async (id, patch) => svc.updateTask(id, patch),
    deleteTask: async (id) => svc.deleteTask(id),
    setDone: async (id, done) => svc.setDone(id, done),
    moveTask: async (id, prevId, nextId) => svc.moveTask(id, prevId, nextId),
    moveTaskToDate: async (id, date) => svc.moveTaskToDate(id, date, today),
    getDaySummaries: async (from, to) => svc.daySummaries(from, to),
    listTasksRange: async (from, to) => svc.listTasksRange(from, to),
    getWeek: async (weekStart) => svc.getWeek(weekStart),
    setWeekTheme: async (weekStart, theme) => svc.setWeekTheme(weekStart, theme),
    addGoal: async (weekStart, title, criteria) => void svc.addGoal(weekStart, title, criteria),
    updateGoal: async (id, patch) => svc.updateGoal(id, patch),
    deleteGoal: async (id) => svc.deleteGoal(id),
    setTaskGoal: async (taskId, goalId) => svc.setTaskGoal(taskId, goalId),
    listHolidays: async () => svc.listHolidays(),
    addHoliday: async (date, name) => svc.addHoliday(date, name, 'company', today),
    removeHoliday: async (date) => svc.removeHoliday(date),
    moveTasksOffHoliday: async (date) => svc.moveTasksOffHoliday(date),
    getPrefs: async () => getPrefs(),
    setPrefs: async (p) => setPrefs(p),
    openMain: async () => wins.openMain(),
    hideWidget: async () => wins.widget.hide(),
  }
  for (const name of API_METHODS) {
    ipcMain.handle(`api:${name}`, async (_e, ...args: unknown[]) => {
      const result = await (api[name] as (...a: unknown[]) => Promise<unknown>)(...args)
      if (MUTATING_METHODS.has(name)) wins.broadcast('changed')
      return result
    })
  }

  // ── 창·트레이·단축키 ──────────────────────────────────
  wins.createWidget()

  tray = new Tray(nativeImage.createFromPath(icon).resize({ width: 16, height: 16 }))
  tray.setToolTip('TodoCalendar')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '위젯 보이기/숨기기', click: () => wins.toggleWidget() },
      { label: '메인 창 열기', click: () => wins.openMain() },
      { type: 'separator' },
      { label: '종료', click: () => app.quit() },
    ]),
  )
  tray.on('click', () => wins.toggleWidget())

  globalShortcut.register('Control+Alt+Space', () => wins.toggleWidget())

  app.on('second-instance', () => {
    wins.widget.show()
    wins.widget.focus()
  })
  app.on('before-quit', () => (wins.quitting = true))
  app.on('will-quit', () => {
    globalShortcut.unregisterAll()
    db.close()
  })
})

// 메인 창을 닫아도 트레이에 남는다.
app.on('window-all-closed', () => {})
