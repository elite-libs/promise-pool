/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Unpack Promise returns an object containing the following:
 *  a promise, with its `resolve()` & `reject()` methods.
 */
export const unpackPromise = <TResult>(): UnpackedPromise<TResult> => {
  let resolve: (value: TResult | PromiseLike<TResult>) => void;
  let reject: (reason?: any) => void;
  const promise = new Promise<TResult>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {
    promise,
    resolve: resolve!,
    reject: reject!,
  };
};

/** `delay(ms)` will wait for a given number of milliseconds */
export const delay = <TValue>(
  ms: number,
  value?: TValue,
): Promise<TValue> => new Promise((resolve) => {
    setTimeout(
      resolve, ms, value,
    );
  });

export type UnpackedPromise<TResult> = {
  promise: Promise<TResult>;
  resolve: (value: TResult | PromiseLike<TResult>) => void;
  reject: (reason?: any) => void;
};
