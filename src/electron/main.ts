import { app, BrowserWindow, shell } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import type { Server } from 'http'
import { createServerApp } from '../server/app.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null
let apiServer: Server | null = null

async function startApiServer(): Promise<number> {
  const expressApp = createServerApp()

  return new Promise((resolve, reject) => {
    const server = expressApp.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        reject(new Error('Unable to resolve API server port.'))
        return
      }
      apiServer = server
      console.log(`Trace Viewer API running at http://127.0.0.1:${address.port}`)
      resolve(address.port)
    })
    server.on('error', reject)
  })
}

async function createMainWindow() {
  const apiPort = await startApiServer()

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'Trace Viewer',
    backgroundColor: '#f8fafc',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('file:')) return
    event.preventDefault()
    shell.openExternal(url)
  })

  await mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), {
    query: { apiBaseUrl: `http://127.0.0.1:${apiPort}` },
  })
}

app.whenReady().then(createMainWindow).catch((error) => {
  console.error('Failed to launch Trace Viewer:', error)
  app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow().catch((error) => {
      console.error('Failed to recreate Trace Viewer window:', error)
    })
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  apiServer?.close()
  apiServer = null
})
