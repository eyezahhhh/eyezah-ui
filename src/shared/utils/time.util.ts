import { timeout, Timer } from "ags/time"

export function createDebouncer<T extends any[]>(
  callback: (...args: T) => void,
  duration: number,
) {
  let timer: Timer | null = null

  const debounce = (...args: T) => {
    timer?.cancel()
    timer = timeout(duration, () => callback(...args))
  }
  return debounce
}
