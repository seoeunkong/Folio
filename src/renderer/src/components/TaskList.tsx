import { useState, type Dispatch, type HTMLAttributes, type KeyboardEvent, type Ref, type SetStateAction } from 'react'
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { restrictToParent } from './dndModifiers'
import type { Task } from '../../../shared/types'
import { weekStartOf } from '../../../core/dates'
import { useWeek } from '../hooks'
import { CheckIcon, ChevronIcon, CloseIcon } from './Icons'
import { GoalMark, goalNoText } from './GoalMark'

/** 체크한 할 일이 제자리에 남아 있는 시간. 그 뒤 완료 묶음으로 내려간다. */
const LINGER_MS = 1200

interface Props {
  tasks: Task[]
  setTasks: Dispatch<SetStateAction<Task[] | undefined>>
  /** 메인 창은 메모를 펼쳐 편집할 수 있다 */
  withNotes?: boolean
  doneOpenByDefault?: boolean
  /** true면 DndContext를 만들지 않는다. 바깥(월 달력)이 드래그를 맡고 dropOnTask로 순서를 바꾼다. */
  bare?: boolean
  /** false면 목표 표식에서 번호(01)를 뺀다. 번호가 보이지 않는 월간 화면용 */
  goalNumbers?: boolean
}

/**
 * 미완료 목록에서 id를 toIndex로 옮긴다. 화면은 먼저 바꿔 두고(깜박임 방지)
 * 메인 프로세스에는 이웃 id만 보낸다. 순서 값 계산은 메인이 한다.
 */
export function reorderTask(tasks: Task[], setTasks: Props['setTasks'], id: number, toIndex: number) {
  const undone = tasks.filter((t) => !t.done)
  const from = undone.findIndex((t) => t.id === id)
  if (from < 0 || toIndex < 0 || toIndex >= undone.length || from === toIndex) return
  const next = arrayMove(undone, from, toIndex)
  setTasks([...next, ...tasks.filter((t) => t.done)])
  void window.api.moveTask(id, next[toIndex - 1]?.id ?? null, next[toIndex + 1]?.id ?? null)
}

/** 끌던 할 일을 다른 할 일 위에 놓았을 때 */
export function dropOnTask(tasks: Task[], setTasks: Props['setTasks'], activeId: number, overId: number) {
  if (activeId === overId) return
  reorderTask(tasks, setTasks, activeId, tasks.filter((t) => !t.done).findIndex((t) => t.id === overId))
}

export function TaskList({ tasks, setTasks, withNotes = false, doneOpenByDefault = false, bare = false, goalNumbers = true }: Props) {
  const [doneOpen, setDoneOpen] = useState(doneOpenByDefault)
  const [expanded, setExpanded] = useState<number | null>(null)
  // 방금 체크해 제자리에 잠깐 남겨 둔 할 일: id → 체크할 때 미완료 목록에서의 위치
  const [lingering, setLingering] = useState<ReadonlyMap<number, number>>(new Map())
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const undone = tasks.filter((t) => !t.done)
  const done = tasks.filter((t) => t.done && !lingering.has(t.id))
  // 화면에 보이는 진행 목록 = 미완료 + 방금 체크한 것(원래 자리에)
  const active = [...undone]
  for (const t of tasks.filter((x) => x.done && lingering.has(x.id)).sort((a, b) => lingering.get(a.id)! - lingering.get(b.id)!))
    active.splice(Math.min(lingering.get(t.id)!, active.length), 0, t)

  /** DB에는 바로 저장하고, 화면에서만 잠깐 제자리에 둔다. 그 사이 창을 닫아도 완료는 남는다. */
  const toggleDone = (task: Task) => {
    if (!task.done) {
      const at = active.findIndex((t) => t.id === task.id)
      setLingering((m) => new Map(m).set(task.id, at))
      setTasks((ts) => ts?.map((t) => (t.id === task.id ? { ...t, done: true } : t)))
      window.setTimeout(() => {
        setLingering((m) => {
          const n = new Map(m)
          n.delete(task.id)
          return n
        })
      }, LINGER_MS)
    }
    void window.api.setDone(task.id, !task.done)
  }

  const move = (id: number, toIndex: number) => reorderTask(tasks, setTasks, id, toIndex)
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over) dropOnTask(tasks, setTasks, Number(active.id), Number(over.id))
  }

  const onRowKey = (e: KeyboardEvent<HTMLLIElement>, task: Task) => {
    if (e.target !== e.currentTarget) return
    const rows = () => [...(e.currentTarget.closest('.task-list')?.querySelectorAll<HTMLElement>('li.task') ?? [])]
    if (e.key === ' ') {
      e.preventDefault()
      toggleDone(task)
    } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && !task.done) {
      e.preventDefault()
      move(task.id, undone.findIndex((t) => t.id === task.id) + (e.key === 'ArrowUp' ? -1 : 1))
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const all = rows()
      all[all.indexOf(e.currentTarget) + (e.key === 'ArrowUp' ? -1 : 1)]?.focus()
    }
  }

  const rowProps = (t: Task) => ({
    task: t,
    withNotes,
    goalNumbers,
    expanded: expanded === t.id,
    onToggleExpand: () => setExpanded(expanded === t.id ? null : t.id),
    onToggleDone: () => toggleDone(t),
    onKeyDown: (e: KeyboardEvent<HTMLLIElement>) => onRowKey(e, t),
  })

  const sortable = (
    <SortableContext items={undone.map((t) => t.id)} strategy={verticalListSortingStrategy}>
      <ul>
        {active.map((t) =>
          t.done ? <Row key={t.id} {...rowProps(t)} expanded={false} /> : <SortableRow key={t.id} {...rowProps(t)} />,
        )}
      </ul>
    </SortableContext>
  )

  return (
    <div className="task-list">
      {bare ? (
        sortable
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToParent]} onDragEnd={onDragEnd}>
          {sortable}
        </DndContext>
      )}
      {active.length === 0 && <p className="empty">할 일이 없습니다</p>}

      {/* 완료 묶음: 같은 목록의 마지막 줄. 누르면 그 아래로 펼친다. */}
      {done.length > 0 && (
        <ul className="done-group">
          <li>
            <button className="done-toggle" aria-expanded={doneOpen} onClick={() => setDoneOpen(!doneOpen)}>
              <span className="done-check">✓</span> 완료 <span className="num">{done.length}</span>
              <ChevronIcon open={doneOpen} />
            </button>
          </li>
          {doneOpen && done.map((t) => <Row key={t.id} {...rowProps(t)} expanded={false} />)}
        </ul>
      )}
    </div>
  )
}

interface RowProps {
  task: Task
  withNotes: boolean
  goalNumbers: boolean
  expanded: boolean
  onToggleExpand?: () => void
  onToggleDone: () => void
  onKeyDown: (e: KeyboardEvent<HTMLLIElement>) => void
}

function SortableRow(props: RowProps) {
  const [editing, setEditing] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.task.id,
    disabled: editing || props.expanded,
  })
  return (
    <Row
      {...props}
      editing={editing}
      setEditing={setEditing}
      liProps={{
        ref: setNodeRef,
        style: { transform: CSS.Translate.toString(transform), transition },
        ...attributes,
        ...listeners,
        'data-dragging': isDragging || undefined,
      }}
    />
  )
}

function Row({
  task,
  withNotes,
  goalNumbers,
  expanded,
  onToggleExpand,
  onToggleDone,
  onKeyDown,
  editing: editingProp,
  setEditing: setEditingProp,
  liProps,
}: RowProps & {
  editing?: boolean
  setEditing?: (v: boolean) => void
  liProps?: HTMLAttributes<HTMLLIElement> & { ref?: Ref<HTMLLIElement>; 'data-dragging'?: true }
}) {
  const [localEditing, setLocalEditing] = useState(false)
  const editing = editingProp ?? localEditing
  const setEditing = setEditingProp ?? setLocalEditing
  const [draft, setDraft] = useState(task.title)

  const startEdit = () => {
    setDraft(task.title)
    setEditing(true)
  }
  const commit = () => {
    setEditing(false)
    if (draft.trim() && draft.trim() !== task.title) void window.api.updateTask(task.id, { title: draft })
  }

  return (
    <li
      className="task"
      data-done={task.done || undefined}
      {...liProps}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === 'F2')) {
          e.preventDefault()
          startEdit()
        } else onKeyDown(e)
      }}
    >
      <div className="task-line">
        <button
          className="check"
          aria-label={task.done ? '완료 취소' : '완료'}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onToggleDone}
        >
          {task.done && <CheckIcon />}
        </button>

        {editing ? (
          <input
            className="title-edit"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) commit()
              else if (e.key === 'Escape') setEditing(false)
            }}
          />
        ) : (
          <span className="title" onDoubleClick={startEdit} onClick={withNotes ? onToggleExpand : undefined}>
            {task.title}
            {task.goalTitle && (
              <span className="goal-tag" title={task.goalTitle}>
                <GoalMark no={goalNumbers ? task.goalNo : null} /> {task.goalTitle}
              </span>
            )}
          </span>
        )}

        <button
          className="icon del"
          aria-label="삭제"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => void window.api.deleteTask(task.id)}
        >
          <CloseIcon />
        </button>
      </div>

      {withNotes && !expanded && task.note && <p className="note-preview">{task.note}</p>}
      {withNotes && expanded && <TaskDetail task={task} />}
    </li>
  )
}

/** 펼친 할 일: 메모 편집과 목표 연결 */
function TaskDetail({ task }: { task: Task }) {
  const [note, setNote] = useState(task.note)
  const week = useWeek(weekStartOf(task.date))
  const goals = week?.goals ?? []
  // 이월로 다른 주에 온 할 일은 원래(지난 주) 목표도 선택지에 남겨 둔다
  const foreign = task.goalId !== null && !goals.some((g) => g.id === task.goalId)
  const stop = { onPointerDown: (e: { stopPropagation(): void }) => e.stopPropagation(), onKeyDown: (e: { stopPropagation(): void }) => e.stopPropagation() }

  return (
    <div className="task-detail">
      <textarea
        className="note-edit"
        placeholder="메모"
        autoFocus
        value={note}
        rows={3}
        {...stop}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => note !== task.note && void window.api.updateTask(task.id, { note })}
      />
      <label className="goal-pick">
        <span>목표</span>
        <select
          {...stop}
          value={task.goalId ?? ''}
          onChange={(e) => void window.api.setTaskGoal(task.id, e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">없음</option>
          {foreign && (
            <option value={task.goalId!}>
              {goalNoText(task.goalNo)} {task.goalTitle} (지난 주)
            </option>
          )}
          {goals.map((g, i) => (
            <option key={g.id} value={g.id}>
              {goalNoText(i + 1)} {g.title}
            </option>
          ))}
        </select>
        {goals.length === 0 && !foreign && <span className="hint">이번 주 목표가 없습니다 (주간 탭에서 추가)</span>}
      </label>
    </div>
  )
}
