import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { KR_PUBLIC_HOLIDAYS } from '../core/holidaysKR'

/**
 * 스키마 버전별 마이그레이션. PRAGMA user_version에 마지막으로 적용한 번호를 둔다.
 * tasks에는 v0.2(goal_id)·v0.3(source, asana_gid, sync_state) 컬럼을 미리 넣었고,
 * weeks/goals/asana_tasks 테이블은 해당 단계에서 다음 마이그레이션으로 추가한다.
 *
 * tasks.carry_count(이월 횟수)는 2026-11-19 기능을 없앤 뒤 읽지도 쓰지도 않는다. 기존 DB와 맞추려고 칸만 남긴다(기본값 0).
 * tasks.first_date(처음 넣은 날짜)는 화면에서 쓰지 않지만 NOT NULL이라 추가할 때 계속 채운다.
 */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE tasks (
    id          INTEGER PRIMARY KEY,
    title       TEXT    NOT NULL,
    note        TEXT    NOT NULL DEFAULT '',
    date        TEXT    NOT NULL,
    sort_order  REAL    NOT NULL,
    done        INTEGER NOT NULL DEFAULT 0,
    done_at     TEXT,
    first_date  TEXT    NOT NULL,
    carry_count INTEGER NOT NULL DEFAULT 0,
    goal_id     INTEGER,
    source      TEXT    NOT NULL DEFAULT 'local',
    asana_gid   TEXT,
    sync_state  TEXT
  );
  CREATE INDEX tasks_date ON tasks(date, done, sort_order);

  CREATE TABLE holidays (
    date TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('public', 'company'))
  );

  CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
  // v0.2 주간 목표·테마. review_json/reviewed_at은 v0.4 AI 평가가 쓴다.
  // goals.success_criteria는 입력을 없앤 뒤 쓰지 않는다(이미 만든 DB와 맞추려고 칸만 남김).
  `
  CREATE TABLE weeks (
    week_start  TEXT PRIMARY KEY,
    theme       TEXT NOT NULL DEFAULT '',
    review_json TEXT,
    reviewed_at TEXT
  );

  CREATE TABLE goals (
    id               INTEGER PRIMARY KEY,
    week_start       TEXT NOT NULL,
    title            TEXT NOT NULL,
    success_criteria TEXT NOT NULL DEFAULT '',
    sort_order       REAL NOT NULL
  );
  CREATE INDEX goals_week ON goals(week_start, sort_order);
  CREATE INDEX tasks_goal ON tasks(goal_id);
  `,
]

export function openDb(path: string): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseSync(path)
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
  migrate(db)
  seedPublicHolidays(db)
  return db
}

function migrate(db: DatabaseSync) {
  const { user_version } = db.prepare('PRAGMA user_version').get() as { user_version: number }
  for (let v = user_version; v < MIGRATIONS.length; v++) {
    transaction(db, () => {
      db.exec(MIGRATIONS[v])
      db.exec(`PRAGMA user_version = ${v + 1}`)
    })
  }
}

/**
 * 내장 공휴일을 연도 단위로 한 번만 채운다. 이미 채운 연도는 settings에 기록해 두어,
 * 사용자가 지운 공휴일이 다음 실행에 되살아나지 않게 한다. 앱 업데이트로 새 연도가 들어오면 그 해만 채운다.
 */
function seedPublicHolidays(db: DatabaseSync) {
  const seeded = new Set(getSetting<number[]>(db, 'seeded_holiday_years') ?? [])
  const years = Object.keys(KR_PUBLIC_HOLIDAYS).map(Number).filter((y) => !seeded.has(y))
  if (years.length === 0) return
  transaction(db, () => {
    const insert = db.prepare(`INSERT OR IGNORE INTO holidays(date, name, kind) VALUES (?, ?, 'public')`)
    for (const y of years) {
      for (const [date, name] of KR_PUBLIC_HOLIDAYS[y]) insert.run(date, name)
      seeded.add(y)
    }
    setSetting(db, 'seeded_holiday_years', [...seeded].sort())
  })
}

export function transaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

export function getSetting<T>(db: DatabaseSync, key: string): T | undefined {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return row ? (JSON.parse(row.value) as T) : undefined
}

export function setSetting(db: DatabaseSync, key: string, value: unknown) {
  db.prepare(
    'INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run(key, JSON.stringify(value))
}
