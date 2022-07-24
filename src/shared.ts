export const unpackPromise = <TResult>(): {
  promise: Promise<TResult>;
  resolve: Function;
  reject: Function;
} => {
  let resolve: Function;
  let reject: Function;
  const promise = new Promise<TResult>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve: resolve!, reject: reject! };
};
