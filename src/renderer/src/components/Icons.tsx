const base = { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 } as const

export const PinIcon = ({ on }: { on: boolean }) => (
  <svg {...base}>
    <path d="M6 2h4l-.5 4 2.5 2.5H4L6.5 6 6 2zM8 8.5V14" fill={on ? 'currentColor' : 'none'} strokeLinejoin="round" />
  </svg>
)
export const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg {...base}>
    <path d={open ? 'M4 6l4 4 4-4' : 'M6 4l4 4-4 4'} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
export const ExpandIcon = () => (
  <svg {...base}>
    <path d="M9 3h4v4M13 3L8 8M7 13H3V9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
export const CloseIcon = () => (
  <svg {...base}>
    <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
  </svg>
)
export const CheckIcon = () => (
  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M3 8.5l3.2 3.2L13 5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
