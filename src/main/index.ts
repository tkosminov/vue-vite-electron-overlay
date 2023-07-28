import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { app, shell, BrowserWindow, Tray, Menu, ipcMain, MenuItemConstructorOptions, systemPreferences, dialog } from 'electron'
import { join } from 'path'

import { KeyHook } from '../hook/hook'

let window: BrowserWindow | null = null
let tray: Tray | null = null
let menu: Menu | null = null
let is_interactible = false

const key_hook: KeyHook = new KeyHook(ipcMain)

async function createOverlay() {
  window = new BrowserWindow({
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
    icon: join(__dirname, '../../build/icon.ico'),
    /**
     * Разрешает делать размер окна больше размера экрана
     * Актуально только для macOS, так как в других ОС по умолчанию разрешены окна большего размера, чем экран.
     */
    enableLargerThanScreen: true,
    /**
     * Делает окно прозрачным. По умолчанию - false.
     * В Windows не работает до тех пор, пока окно не будет без рамки.
     */
    // transparent: process.platform !== 'linux' ? false : true,
    transparent: true,
    /**
     * Есть ли у окна рамки
     */
    frame: false,
    /**
     * Перетаскивание окна.
     * В Linux это не реализовано.
     */
    movable: false,
    /**
     * Фокус на окне.
     * В Windows установка focusable: false также подразумевает установку skipTaskbar: true.
     * В Linux установка focusable: false приводит к тому, что окно перестает взаимодействовать с wm,
     * поэтому оно всегда будет оставаться сверху во всех рабочих пространствах.
     */
    // focusable: process.platform !== 'linux' ? false : true,
    focusable: true,
    /**
     * Показывать ли окно на панели задач
     */
    skipTaskbar: true,
    /**
     * Можно ли изменять размеры окна.
     */
    resizable: true,
    /**
     * Можно ли перевести окно в полноэкранный режим.
     * В macOS также определяет, должна ли кнопка maximize/zoom переключать полноэкранный режим или максимизировать окно.
     */
    fullscreenable: true,
    /**
     * Должно ли окно отображаться в полноэкранном режиме.
     * При явном значении false кнопка полноэкранного режима будет скрыта или отключена на macOS.
     */
    fullscreen: true,
  })

  /**
   * Убирает меню бар
   * Не работает в MacOS
   */
  window.removeMenu()

  /**
   * Поверх других окон
   */
  if (process.platform !== 'linux') {
    window.setAlwaysOnTop(true, 'pop-up-menu', 1)
  } else {
    window.setAlwaysOnTop(true)
  }

  /**
   * Заставляет окно игнорировать все события мыши.
   * Все события мыши, происходящие в этом окне, будут передаваться окну, расположенному ниже этого окна,
   * но если это окно имеет фокус, оно будет получать события клавиатуры.
   */
  window.setIgnoreMouseEvents(true, { forward: true })
  is_interactible = false

  /**
   * Устанавливает, должно ли окно быть видимым на всех рабочих пространствах.
   */
  window.setVisibleOnAllWorkspaces(false)

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  window.on('closed', () => {
    window = null
  })

  // window.on('ready-to-show', () => {
  //   if (window && !window.isVisible()) {
  //     window.show()
  //   }
  // })

  window.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)

    return { action: 'deny' }
  })
}

async function createOverlayTray() {
  if (is.dev) {
    tray = new Tray(join(__dirname, '../../src/renderer/public/icon.png'))
  } else {
    tray = new Tray(join(__dirname, '../renderer/icon.png'))
  }

  const items: MenuItemConstructorOptions[] = [
    {
      label: 'Exit',
      type: 'normal',
      click: () => {
        key_hook.unregister()
        app.quit()
      },
    },
  ]

  if (is.dev) {
    items.unshift({
      label: 'Toggle Dev Tools',
      type: 'normal',
      click: () => {
        if (window) {
          if (window.webContents.isDevToolsOpened()) {
            window.webContents.closeDevTools()
          } else {
            window.webContents.openDevTools({ mode: 'undocked' })
          }
        }
      },
    })
  }

  menu = Menu.buildFromTemplate(items)

  tray.setToolTip(`Overlay: ${app.getVersion()}`)
  tray.setContextMenu(menu)
}

async function toggleOverlay() {
  if (window != null) {
    if (window.isVisible()) {
      window.hide()
    } else {
      is_interactible = true

      await toggleIgnoreMouseEventOverlay()

      window.show()
    }
  }
}

async function toggleIgnoreMouseEventOverlay() {
  if (window != null) {
    if (is_interactible) {
      window.setIgnoreMouseEvents(true, { forward: true })

      ipcMain.emit('overlay-window-blur')
    } else {
      window.setIgnoreMouseEvents(false)
      window.focus()

      ipcMain.emit('overlay-window-focus')
    }

    is_interactible = !is_interactible
  }
}

/**
 * Оверлей должен работать в единсвенном экземпляре
 */
if (!app.requestSingleInstanceLock()) {
  dialog.showErrorBox('Overlay only works in a single instance', 'The overlay is already running.')

  key_hook.unregister()
  app.exit()
}

/**
 * В Windows прозрачные окна не будут работать правильно, если Aero не включен.
 */
if (process.platform === 'win32' && !systemPreferences.isAeroGlassEnabled()) {
  dialog.showErrorBox('Aero is required to run Overlay', 'Aero is currently disabled. Please enable Aero and try again.')

  key_hook.unregister()
  app.exit()
}

/**
 * Отключает аппаратное ускорение для текущего приложения.
 * Этот метод может быть вызван только до того, как приложение будет готово.
 */
app.disableHardwareAcceleration()

/**
 * Если разрешение окон в Windows увеличено, то приложение так же по умолчанию подстраивается под это разрешение.
 * Следующие два свойства отключают это.
 */
app.commandLine.appendSwitch('high-dpi-support', 'true')
app.commandLine.appendSwitch('force-device-scale-factor', '1')

app.whenReady().then(async () => {
  /**
   * Изменяет Application User Model ID.
   * https://learn.microsoft.com/en-us/windows/win32/shell/appids
   */
  electronApp.setAppUserModelId('com.electron.overlay')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  await createOverlay()

  await createOverlayTray()

  app.on('activate', async () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      await createOverlay()
    }

    if (tray == null) {
      await createOverlayTray()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    key_hook.unregister()
    app.quit()
  }
})

ipcMain.on('toggle-overlay', async () => {
  console.log('toggle-overlay')

  await toggleOverlay()
})

ipcMain.on('toggle-overlay-ignore-mouse-event', async () => {
  console.log('toggle-overlay-ignore-mouse-event')

  await toggleIgnoreMouseEventOverlay()
})
