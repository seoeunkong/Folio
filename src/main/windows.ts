import { BrowserWindow, screen, type Rectangle } from 'electron'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import icon from '../../resources/icon.png?asset'
import { getSetting, setSetting } from './db'

const COLLAPSED_HEIGHT = 44
const preload = join(__dirname, '../preload/index.js')

function loadView(win: BrowserWindow, view: 'widget' | 'main') {
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(`${process.env.ELECTRON_RENDERER_URL}?view=${view}`)
  else win.loadFile(join(__dirname, '../renderer/index.html'), { query: { view } })
}

/** 저장된 위치가 연결된 모니터 밖이면(모니터를 뺀 경우 등) 쓰지 않는다. */
function visibleBounds(b: Rectangle | undefined): Rectangle | undefined {
  if (!b) return undefined
  const area = screen.getDisplayMatching(b).workArea
  const overlaps = b.x < area.x + area.width && b.x + b.width > area.x && b.y < area.y + area.height && b.y + 40 > area.y
  return overlaps ? b : undefined
}

export class Windows {
  widget!: BrowserWindow
  main: BrowserWindow | null = null
  quitting = false

  constructor(private readonly db: DatabaseSync) {}

  createWidget() {
    const work = screen.getPrimaryDisplay().workArea
    const saved = visibleBounds(getSetting<Rectangle>(this.db, 'widget_bounds'))
    const b = saved ?? { width: 320, height: 480, x: work.x + work.width - 340, y: work.y + 20 }
    const collapsed = getSetting<boolean>(this.db, 'widget_collapsed') ?? false

    const win = new BrowserWindow({
      ...b,
      height: collapsed ? COLLAPSED_HEIGHT : b.height,
      minWidth: 240,
      minHeight: COLLAPSED_HEIGHT,
      frame: false,
      skipTaskbar: true,
      show: false,
      icon,
      webPreferences: { preload },
    })
    win.setAlwaysOnTop(getSetting<boolean>(this.db, 'widget_pinned') ?? true, 'floating')
    win.setOpacity(getSetting<number>(this.db, 'widget_opacity') ?? 1)
    win.once('ready-to-show', () => win.showInactive())

    // 닫기는 숨기기. 종료는 트레이 메뉴에서만.
    win.on('close', (e) => {
      if (!this.quitting) {
        e.preventDefault()
        win.hide()
      }
    })

    // 크기·위치 기억. 접힌 동안에는 펼친 높이를 덮어쓰지 않는다.
    let timer: NodeJS.Timeout | undefined
    const save = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (win.isDestroyed()) return
        const cur = win.getBounds()
        const prev = getSetting<Rectangle>(this.db, 'widget_bounds')
        const isCollapsed = getSetting<boolean>(this.db, 'widget_collapsed') ?? false
        setSetting(this.db, 'widget_bounds', isCollapsed && prev ? { ...cur, height: prev.height } : cur)
      }, 400)
    }
    win.on('moved', save)
    win.on('resized', save)

    loadView(win, 'widget')
    this.widget = win
  }

  setWidgetCollapsed(collapsed: boolean) {
    const win = this.widget
    const cur = win.getBounds()
    if (collapsed) {
      setSetting(this.db, 'widget_bounds', cur)
      win.setBounds({ ...cur, height: COLLAPSED_HEIGHT })
    } else {
      const h = getSetting<Rectangle>(this.db, 'widget_bounds')?.height ?? 480
      win.setBounds({ ...cur, height: Math.max(h, 160) })
    }
    setSetting(this.db, 'widget_collapsed', collapsed)
  }

  toggleWidget() {
    if (this.widget.isVisible() && this.widget.isFocused()) this.widget.hide()
    else {
      this.widget.show()
      this.widget.focus()
    }
  }

  openMain() {
    if (this.main && !this.main.isDestroyed()) {
      if (this.main.isMinimized()) this.main.restore()
      this.main.show()
      this.main.focus()
      return
    }
    const win = new BrowserWindow({
      width: 1100,
      height: 720,
      minWidth: 860,
      minHeight: 420,
      title: 'Folio',
      icon,
      autoHideMenuBar: true,
      show: false,
      webPreferences: { preload },
    })
    win.once('ready-to-show', () => win.show())
    win.on('closed', () => (this.main = null))
    loadView(win, 'main')
    this.main = win
  }

  broadcast(channel: string) {
    for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send(channel)
  }
}
