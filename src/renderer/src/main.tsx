import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Widget } from './Widget'
import { MainWindow } from './MainWindow'
import './styles.css'

const view = new URLSearchParams(location.search).get('view')
document.body.dataset.view = view ?? 'main'

createRoot(document.getElementById('root')!).render(
  <StrictMode>{view === 'widget' ? <Widget /> : <MainWindow />}</StrictMode>,
)
