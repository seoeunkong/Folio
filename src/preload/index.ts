import { contextBridge, ipcRenderer } from 'electron'
import { API_METHODS, type TodoApi } from '../shared/types'

const api = Object.fromEntries(
  API_METHODS.map((name) => [name, (...args: unknown[]) => ipcRenderer.invoke(`api:${name}`, ...args)]),
) as Omit<TodoApi, 'onChanged'>

const onChanged: TodoApi['onChanged'] = (cb) => {
  const listener = () => cb()
  ipcRenderer.on('changed', listener)
  return () => ipcRenderer.removeListener('changed', listener)
}

contextBridge.exposeInMainWorld('api', { ...api, onChanged } satisfies TodoApi)
