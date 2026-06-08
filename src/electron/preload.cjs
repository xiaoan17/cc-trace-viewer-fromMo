const { contextBridge } = require('electron')

const params = new URLSearchParams(window.location.search)
const apiBaseUrl = params.get('apiBaseUrl') || ''

contextBridge.exposeInMainWorld('traceViewer', {
  apiBaseUrl,
})
