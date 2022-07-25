/* eslint @typescript-eslint/no-explicit-any: 0 */
export const unpackPromise = <TResult>(): {
  promise: Promise<TResult>;
  resolve: (value: TResult | PromiseLike<TResult>) => void;
  reject: (reason?: any) => void;
} => {
  let resolve: (value: TResult | PromiseLike<TResult>) => void;
  let reject: (reason?: any) => void;
  const promise = new Promise<TResult>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise, resolve: resolve!, reject: reject!,
  };
};
