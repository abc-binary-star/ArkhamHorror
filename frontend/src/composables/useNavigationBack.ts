import { computed, inject, onScopeDispose, provide, shallowRef, type InjectionKey } from 'vue'

export interface NavigationBackAction {
  label: string
  run: () => unknown
  disabled?: boolean
}

type Entry = { get: () => NavigationBackAction | null; priority: number }
const navigationBackKey: InjectionKey<ReturnType<typeof createNavigationBack>> = Symbol('navigationBack')

function createNavigationBack() {
  const entries = shallowRef<Entry[]>([])
  const action = computed(() => entries.value
    .map((entry, index) => ({ ...entry, index, action: entry.get() }))
    .filter(entry => entry.action !== null)
    .sort((a, b) => b.priority - a.priority || b.index - a.index)[0]?.action ?? null)
  function register(entry: Entry) {
    entries.value = [...entries.value, entry]
    onScopeDispose(() => { entries.value = entries.value.filter(item => item !== entry) })
  }
  return { action, register }
}

export function provideNavigationBack() {
  const navigation = createNavigationBack()
  provide(navigationBackKey, navigation)
  return navigation
}

export function useNavigationBack(get: Entry['get'], priority = 0) {
  inject(navigationBackKey, null)?.register({ get, priority })
}

export function useNavigationBackContext() {
  return inject(navigationBackKey, null)
}
