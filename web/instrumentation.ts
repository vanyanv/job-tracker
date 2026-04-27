export async function register() {
  if (typeof (Promise as unknown as { try?: unknown }).try !== "function") {
    Object.defineProperty(Promise, "try", {
      configurable: true,
      writable: true,
      value: function tryFn<T, A extends unknown[]>(
        fn: (...args: A) => T | Promise<T>,
        ...args: A
      ): Promise<T> {
        return new Promise<T>((resolve) => resolve(fn(...args)));
      },
    });
  }
}
