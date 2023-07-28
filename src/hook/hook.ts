import { IpcMain } from 'electron'
import { uIOhook, UiohookKey, UiohookKeyboardEvent } from 'uiohook-napi'

export class KeyHook {
  constructor(private readonly ipcMain: IpcMain) {
    uIOhook.on('keydown', (e) => {
      this.parse(e)
    })

    uIOhook.start()
  }

  public unregister() {
    uIOhook.stop()
  }

  private parse(e: UiohookKeyboardEvent) {
    if (e.altKey) {
      switch (e.keycode) {
        case UiohookKey.Q:
          this.ipcMain.emit('toggle-overlay')

          break
        case UiohookKey.A:
          this.ipcMain.emit('toggle-overlay-ignore-mouse-event')

          break
        default:
          break
      }
    }
  }
}
