import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('amazonImageCsv', {
  processCsv: () => ipcRenderer.invoke('process-csv'),
  onProgress: callback => {
    const listener = (_event, progress) => callback(progress)
    ipcRenderer.on('progress', listener)
    return () => ipcRenderer.removeListener('progress', listener)
  },
})
