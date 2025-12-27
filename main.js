const { app, BrowserWindow, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

const TRIAL_DAYS = 3

function isTrialValid() {
  const trialFile = path.join(app.getPath('userData'), 'trial.json')

  if (!fs.existsSync(trialFile)) {
    fs.writeFileSync(trialFile, JSON.stringify({ start: Date.now() }))
    return true
  }

  try {
    const { start } = JSON.parse(fs.readFileSync(trialFile))
    const daysUsed = (Date.now() - start) / (1000 * 60 * 60 * 24)

    return daysUsed <= TRIAL_DAYS
  } catch {
    return true // fail open
  }
}

function createWindow() {
  if (!isTrialValid()) {
    dialog.showErrorBox(
      'Trial expired',
      'Your 7-day trial has ended.\n\nPurchase the full version to keep using Chord Companion.'
    )
    app.quit()
    return
  }

  const win = new BrowserWindow({
    width: 800,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, 'assets/icon.png')
  })

  win.loadFile(path.join(__dirname, 'renderer/index.html'))
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
