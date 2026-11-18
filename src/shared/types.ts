export interface Task {
  id: number
  title: string
  note: string
  date: string
  sortOrder: number
  done: boolean
  doneAt: string | null
  firstDate: string
  carryCount: number
  goalId: number | null
  /** 연결된 목표의 제목(목록에 바로 표시하려고 함께 가져온다) */
  goalTitle: string | null
  source: 'local' | 'asana'
  asanaGid: string | null
  syncState: string | null
}

export interface TaskPatch {
  title?: string
  note?: string
}

export interface Goal {
  id: number
  weekStart: string
  title: string
  successCriteria: string
  sortOrder: number
}

export interface GoalPatch {
  title?: string
  successCriteria?: string
}

export interface Week {
  weekStart: string
  theme: string
  /** 목표마다 연결된 할 일(다른 주로 이월된 것 포함), 날짜순 */
  goals: (Goal & { tasks: Task[] })[]
}

export type ThemeSource = 'system' | 'light' | 'dark'

export interface DaySummary {
  date: string
  total: number
  done: number
}

export type HolidayKind = 'public' | 'company'

export interface Holiday {
  date: string
  name: string
  kind: HolidayKind
}

export interface Prefs {
  widgetOpacity: number
  widgetPinned: boolean
  widgetCollapsed: boolean
  openAtLogin: boolean
  theme: ThemeSource
}

/** preload가 window.api로 노출하는 함수들. 모두 메인 프로세스로 IPC 요청만 보낸다. */
export interface TodoApi {
  getToday(): Promise<string>
  getNotice(): Promise<string | null>
  listTasks(date: string): Promise<Task[]>
  addTask(date: string, title: string): Promise<Task>
  updateTask(id: number, patch: TaskPatch): Promise<void>
  deleteTask(id: number): Promise<void>
  setDone(id: number, done: boolean): Promise<void>
  moveTask(id: number, prevId: number | null, nextId: number | null): Promise<void>
  moveTaskToDate(id: number, date: string): Promise<void>
  getDaySummaries(from: string, to: string): Promise<DaySummary[]>
  listTasksRange(from: string, to: string): Promise<Task[]>
  getWeek(weekStart: string): Promise<Week>
  setWeekTheme(weekStart: string, theme: string): Promise<void>
  addGoal(weekStart: string, title: string, successCriteria: string): Promise<void>
  updateGoal(id: number, patch: GoalPatch): Promise<void>
  deleteGoal(id: number): Promise<void>
  setTaskGoal(taskId: number, goalId: number | null): Promise<void>
  listHolidays(): Promise<Holiday[]>
  /** 반환값은 그날의 미완료 할 일 수(오늘 이후 날짜일 때만). 0보다 크면 화면이 옮길지 묻는다. */
  addHoliday(date: string, name: string): Promise<number>
  removeHoliday(date: string): Promise<void>
  moveTasksOffHoliday(date: string): Promise<{ target: string; moved: number }>
  getPrefs(): Promise<Prefs>
  setPrefs(patch: Partial<Prefs>): Promise<Prefs>
  openMain(): Promise<void>
  hideWidget(): Promise<void>
  /** DB나 설정이 바뀌면 호출된다. 반환한 함수로 구독을 끊는다. */
  onChanged(cb: () => void): () => void
}

export const API_METHODS = [
  'getToday', 'getNotice', 'listTasks', 'addTask', 'updateTask', 'deleteTask', 'setDone', 'moveTask',
  'moveTaskToDate', 'getDaySummaries', 'listTasksRange',
  'getWeek', 'setWeekTheme', 'addGoal', 'updateGoal', 'deleteGoal', 'setTaskGoal', 'listHolidays', 'addHoliday', 'removeHoliday', 'moveTasksOffHoliday',
  'getPrefs', 'setPrefs', 'openMain', 'hideWidget',
] as const satisfies ReadonlyArray<Exclude<keyof TodoApi, 'onChanged'>>

export type ApiMethod = (typeof API_METHODS)[number]

/** 이 메서드가 성공하면 메인 프로세스가 모든 창에 변경을 알린다. */
export const MUTATING_METHODS: ReadonlySet<ApiMethod> = new Set<ApiMethod>([
  'addTask', 'updateTask', 'deleteTask', 'setDone', 'moveTask', 'moveTaskToDate',
  'setWeekTheme', 'addGoal', 'updateGoal', 'deleteGoal', 'setTaskGoal',
  'addHoliday', 'removeHoliday', 'moveTasksOffHoliday', 'setPrefs',
])
