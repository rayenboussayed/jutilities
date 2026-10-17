import type {
  AnyAsyncFunction,
  AnyFunction,
  AnySyncFunction,
} from "@/types/type.js";
import type { WithSignal } from "@/types/with.js";
import { sleepAsync, sleepSync } from "./sleep.js";

export type Options = WithSignal<{
  delay?: number;
}>;

/**
 *
 * @param fn
 * @param root0
 * @param root0.signal
 * @param root0.delay
 */
export async function withDelayAsync<T extends AnyAsyncFunction>(
  fn: T,
  { signal, delay = 0 }: Options = {},
) {
  if (delay <= 0) return fn;
  return async function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    await sleepAsync({ sleep: delay, signal });
    return fn.apply(this, args);
  } as T;
}

/**
 *
 * @param fn
 * @param root0
 * @param root0.signal
 * @param root0.delay
 */
export function withDelaySync<T extends AnyFunction>(
  fn: AnySyncFunction<T>,
  { signal, delay = 0 }: Options = {},
) {
  if (delay <= 0) return fn;
  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    sleepSync({ sleep: delay, signal });
    return fn.apply(this, args);
  };
}
