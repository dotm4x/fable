/** Returns the value, throwing when the driver returned null. */
export function required<TValue>(value: TValue | null, message: string): TValue {
  if (value === null) {
    throw new Error(message)
  }

  return value
}
