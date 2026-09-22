import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { writeFile } from 'node:fs/promises'
import { generateManifest } from './index.mjs'

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 760,
    height: 650,
    minWidth: 560,
    minHeight: 520,
    title: 'Amazon Image CSV',
    webPreferences: {
      preload: new URL('./desktop-preload.mjs', import.meta.url).pathname,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  mainWindow.loadFile(new URL('./desktop.html', import.meta.url).pathname)
}

ipcMain.handle('process-csv', async event => {
  const selected = await dialog.showOpenDialog({
    title: 'Choose Seller Central CSV',
    properties: ['openFile'],
    filters: [{ name: 'CSV files', extensions: ['csv'] }],
  })
  if (selected.canceled || selected.filePaths.length === 0) return { canceled: true }

  const { readFile } = await import('node:fs/promises')
  const input = await readFile(selected.filePaths[0], 'utf8')
  const sender = event.sender
  const result = await generateManifest(input, 4, (completed, total) => {
    sender.send('progress', { completed, total })
  })
  const save = await dialog.showSaveDialog({
    title: 'Save image URL manifest',
    defaultPath: 'amazon-image-urls.csv',
    filters: [{ name: 'CSV files', extensions: ['csv'] }],
  })
  if (save.canceled || !save.filePath) return { canceled: true, found: result.results.filter(row => row.urls.length > 0).length, total: result.records.length }
  await writeFile(save.filePath, result.csv, 'utf8')
  return {
    canceled: false,
    path: save.filePath,
    found: result.results.filter(row => row.urls.length > 0).length,
    total: result.records.length,
  }
})

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
