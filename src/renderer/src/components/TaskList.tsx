import { useState, type Dispatch, type HTMLAttributes, type KeyboardEvent, type Ref, type SetStateAction } from 'react'
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { restrictToParent } from './dndModifiers'
import type { Task } from '../../../shared/types'
import { weekStartOf } from '../../../core/dates'
import { useWeek } from '../hooks'
import { CheckIcon, ChevronIcon, CloseIcon } from './Icons'

interface Props {
  tasks: Task[]
  setTasks: Dispatch<SetStateAction<Task[] | undefined>>
  /** 메인 창은 메모를 펼쳐 편집할 수 있다 */
  withNotes?: boolean
  doneOpenByDefault?: boolean
  /** true면 DndContext를 만들지 않는다. 바깥(월 달력)이 드래그를 맡고 dropOnTask로 순서를 바꾼다. */
  bare?: boolean
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

export function TaskList({ tasks, setTasks, withNotes = false, doneOpenByDefault = false, bare = false }: Props) {
  const undone = tasks.filter((t) => !t.done)
  const done = tasks.filter((t) => t.done)
  const [doneOpen, setDoneOpen] = useState(doneOpenByDefault)
  const [expanded, setExpanded] = useState<number | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const move = (id: number, toIndex: number) => reorderTask(tasks, setTasks, id, toIndex)
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over) dropOnTask(tasks, setTasks, Number(active.id), Number(over.id))
  }

  const onRowKey = (e: KeyboardEvent<HTMLLIElement>, task: Task, index: number) => {
    if (e.target !== e.currentTarget) return
    const rows = () => [...(e.currentTarget.parentElement?.parentElement?.querySelectorAll<HTMLElement>('li.task') ?? [])]
    if (e.key === ' ') {
      e.preventDefault()
      void window.api.setDone(task.id, !task.done)
    } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && !task.done) {
      e.preventDefault()
      move(task.id, index + (e.key === 'ArrowUp' ? -1 : 1))
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const all = rows()
      all[all.indexOf(e.currentTarget) + (e.key === 'ArrowUp' ? -1 : 1)]?.focus()
    }
  }

  const sortable = (
    <SortableContext items={undone.map((t) => t.id)} strategy={verticalListSortingStrategy}>
      <ul>
        {undone.map((t, i) => (
          <SortableRow
            key={t.id}
            task={t}
            withNotes={withNotes}
            expanded={expanded === t.id}
            onToggleExpand={() => setExpanded(expanded === t.id ? null : t.id)}
            onKeyDown={(e) => onRowKey(e, t, i)}
          />
        ))}
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
      {undone.length === 0 && <p className="empty">할 일이 없습니다</p>}

      {done.length > 0 && (
        <section className="done">
          <button className="done-toggle" onClick={() => setDoneOpen(!doneOpen)}>
            <ChevronIcon open={doneOpen} /> 완료 {done.length}
          </button>
          {doneOpen && (
            <ul>
              {done.map((t, i) => (
                <Row key={t.id} task={t} withNotes={withNotes} expanded={false} onKeyDown={(e) => onRowKey(e, t, i)} />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}

interface RowProps {
  task: Task
  withNotes: boolean
  expanded: boolean
  onToggleExpand?: () => void
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
  expanded,
  onToggleExpand,
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
          onClick={() => void window.api.setDone(task.id, !task.done)}
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
              <span className="goal-tag">
                <span className="goal-mark">◆</span> {task.goalTitle}
              </span>
            )}
            {task.carryCount > 0 && (
              <span className="carry" title={`${task.firstDate}부터 ${task.carryCount}번 이월됨`}>
                ↻{task.carryCount}
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
          {foreign && <option value={task.goalId!}>{task.goalTitle} (지난 주)</option>}
          {goals.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title}
            </option>
          ))}
        </select>
        {goals.length === 0 && !foreign && <span className="hint">이번 주 목표가 없습니다 (주간 탭에서 추가)</span>}
      </label>
    </div>
  )
}
