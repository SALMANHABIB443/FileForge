import { registerAppInfoHandlers } from './app-info'
import { registerWindowHandlers } from './window'
import { registerFileHandlers } from './file'
import { registerEngineHandlers } from './engine'
import { registerShellHandlers } from './shell'
import { registerNotificationHandlers } from './notifications'
import { registerUpdateHandlers } from './updater'

export function registerIpcHandlers(): void {
  registerAppInfoHandlers()
  registerWindowHandlers()
  registerFileHandlers()
  registerEngineHandlers()
  registerShellHandlers()
  registerNotificationHandlers()
  registerUpdateHandlers()
}