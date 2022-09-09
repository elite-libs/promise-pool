import Pool from './index';
import { delay } from './shared';
import util from 'util';
const { inspect } = util;

describe('PromisePool', () => {
  describe('Smart drain technology', () => {
    it('should await only last task', async () => {
      const TASK_DELAY_MS = 10;
      const pool = new Pool({ maxWorkers: 5 });
      // const drainSpy = jest.spyOn(pool, 'drain');

      let { getRuntime } = startRuntimeHelper();
      const tasks = generateTasks(10, (index) => delay(TASK_DELAY_MS, index));
      pool.add(...tasks);
      // Save some promises returned by calling `.drain()` (and don't await yet)
      const initialDrainPromise = pool.drain();
      // initialDrainPromise should be the only 'timer' waiting -- until we call .drain again!
      const secondDrainPromise = pool.drain();
      // now `await initialDrainPromise` should resolve immediately!
      await initialDrainPromise;
      expect(getRuntime()).toBeLessThanOrEqual(16);
      // And `secondDrainPromise` should wait 10-20ms
      await secondDrainPromise;
      await pool.drain();
      // console.log('drainSpy:', getRuntime(), getMockStats(drainSpy));
      // console.dir(drainSpy.mock.results, { depth: 10 });
      // console.dir(
      //   await Promise.all(drainSpy.mock.results.map((p) => p.value)),
      //   { depth: 10 }
      // );

      await pool.done();
      // console.log(
      //   'drainSpy2:',
      //   getRuntime(),
      //   // @ts-expect-error
      //   getMockStats(drainSpy),
      //   pool._stats
      // );
      expect(getRuntime()).toBeLessThan(7 * TASK_DELAY_MS);
      expect(getRuntime()).toBeGreaterThanOrEqual(2 * TASK_DELAY_MS);
    });
  });

  describe('Core functionality', () => {
    test('can run a single task', async () => {
      const pool = new Pool();
      const task = jest.fn(() => Promise.resolve(420));
      pool.add(task);
      const p = pool.done();
      await p;
      expect(task).toHaveBeenCalledTimes(1);
      return p;
    });

    test('can run multiple batches of tasks (singleton mode)', async () => {
      const pool = new Pool({ maxWorkers: 4, backgroundRecheckInterval: 1 });
      const taskList = generateTasks(8, (index) => delay(1, index));
      pool.add(...taskList);
      expect(pool._stats.currentTaskIndex).toBe(3);
      await pool.drain();
      expect(pool._stats.currentTaskIndex).toBe(-1);
      pool.add(...generateTasks(10));
      expect(pool._stats.currentTaskIndex).toBe(3);
      expect(taskList[0]).toHaveBeenCalledTimes(1);
      await pool.drain();
      expect(pool._stats.currentTaskIndex).toBe(-1);
      return pool.done();
    });

    test('can handle failing tasks', async () => {
      const pool = new Pool();
      const tasks = [
        jest.fn(() => Promise.resolve(420)),
        jest.fn(() => Promise.reject(Error('an error'))),
      ];
      pool.add(...tasks);
      const p = await pool.done();
      expect(tasks[0]).toHaveBeenCalledTimes(1);
      return p;
    });

    test('can handle calling .done() twice', async () => {
      const pool = new Pool();
      const task = jest.fn(() => Promise.resolve(420));
      pool.add(task);
      const p1 = pool.done();
      const p2 = pool.done();
      expect(p1).toBe(p2);
      return p1;
    });

    test('can use custom timestamp function', async () => {
      const getBigTimestamp = (start?: bigint) => {
        const bigTime = process.hrtime.bigint();
        if (start) return start - bigTime;

        return bigTime;
      };
      const pool = new Pool({
        timestampCallback: getBigTimestamp,
      });
      const task = jest.fn(() => Promise.resolve(420));
      pool.add(task);
      return pool.done();
    });

    test('can use custom timestamp function w/ BigInt', async () => {
      const getBigTimestamp = (start?: bigint) => {
        const time = BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1_000_000);
        if (start) return time * 2n;
        return time;
      };
      const pool = new Pool({
        timestampCallback: getBigTimestamp,
      });
      const task = jest.fn(() => Promise.resolve(420));
      pool.add(task);
      return pool.done();
    });

    test('can use simple timestamp function w/ BigInt', async () => {
      let timeStampCount = 0n;
      const getBigTimestamp = () => {
        timeStampCount++;
        const time = BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1_000_000);
        return time * timeStampCount;
      };
      const pool = new Pool({
        timestampCallback: getBigTimestamp,
      });
      const task = jest.fn(() => Promise.resolve(420));
      pool.add(task);
      return pool.done();
    });

    test('can disable runtime stats', async () => {
      const pool = new Pool({
        timestampCallback: null,
      });
      const task = jest.fn(() => Promise.resolve(420));
      pool.add(task);
      return pool.done();
    });

    test('can complete without tasks added', async () => {
      const pool = new Pool();
      return expect(pool.done()).resolves.toBeDefined();
    });

    test('can throw error on adding tasks after completion', async () => {
      const pool = new Pool();
      await pool.done();
      expect(() =>
        pool.add(jest.fn(() => Promise.resolve(420)))
      ).toThrowError();
    });

    test('can handle calling .add() multiple times', async () => {
      const pool = new Pool();
      generateTasks(10).forEach((task) => pool.add(task));
      expect(pool._stats.processingTaskCount).toBe(4);
      return pool.done();
    });

    test('can handle calling .add() w/ 10 items multiple times', async () => {
      const pool = new Pool();
      const taskList = generateTasks(10);
      pool.add(...taskList);
      pool.add(...taskList);
      await pool.done();
      expect(taskList[0]).toHaveBeenCalledTimes(2);
      expect(taskList[1]).toHaveBeenCalledTimes(2);
    });

    test('can error on invalid tasks (non-async)', async () => {
      const pool = new Pool();
      const tasks = [jest.fn(() => 420), jest.fn(() => Error('an error'))];
      // @ts-expect-error
      expect(pool.add(...tasks)).toBe(2);
      await expect(pool.done()).rejects.toThrowError();
      expect(tasks[0]).toHaveBeenCalledTimes(1);
      expect(tasks[1]).toHaveBeenCalledTimes(1);
    });

    test('can error on invalid tasks (non-function)', async () => {
      const pool = new Pool();
      const tasks = [undefined, 420, Error('an error')];
      // @ts-expect-error
      expect(() => pool.add(...tasks)).toThrowError(
        'Task Invalid! Task is not a function.'
      );
      const p = await pool.done();
      return p;
    });

    test('can run multiple tasks', async () => {
      const maxLimit = 4; // Default is currently 4
      const pool = new Pool();
      const taskList = Array.from(
        {
          length: 10,
        },
        (_, index) => jest.fn(() => Promise.resolve(index))
      );
      const processingCount = pool.add(...taskList);
      const p = pool.done();
      expect(processingCount).toBe(maxLimit);
      expect(taskList[0]).toHaveBeenCalledTimes(1);
      await p;
      expect(taskList[9]).toHaveBeenCalledTimes(1);
      return p;
    });

    test('can run multiple async tasks', async () => {
      const maxLimit = 4; // Default is currently 4
      const pool = new Pool();
      const taskList = Array.from(
        {
          length: 10,
        },
        (_, index) => jest.fn(() => Promise.resolve(index))
      );
      const processingCount = pool.add(...taskList);
      // console.log({ processingCount });
      const p = pool.done();
      expect(processingCount).toBe(maxLimit);
      expect(taskList[0]).toHaveBeenCalledTimes(1);
      // console.log(pool._stats);
      await p;
      expect(taskList[9]).toHaveBeenCalledTimes(1);
      return p;
    });

    describe('Edge cases', () => {
      test('can handle multiple tasks & multiple calls to `.drain()`', async () => {
        const maxWorkers = 5;
        const pool = new Pool({ maxWorkers });
        const tasks_2ms = generateTasks(2 * maxWorkers, function delayMaker() { return delay(2, 420); });
        const tasks_4ms = generateTasks(2 * maxWorkers, () => delay(4, 420));
        // The theoretical fastest completion time is 12ms, but we'll allow for a bit of leeway
        const processingCount = pool.add(...tasks_2ms);
        expect(processingCount).toBe(maxWorkers);
        pool.add(...tasks_4ms);
        expect(processingCount).toBe(maxWorkers);
        let drainResults = [];
        // Start draining W/O awaiting
        const p1 = pool.drain();
        const p2 = pool.drain();
        const timerP1 = startRuntimeHelper();
        drainResults.push(await p1);
        expect(timerP1.getRuntime()).toBeLessThanOrEqual(3);
        // Add 10 'instant' tasks, shouldn't trip up in the `done()` call
        await delay(4);
        expect(tasks_2ms[1]).toHaveBeenCalledTimes(1);
        expect(timerP1.getRuntime()).toBeLessThan(16);
        drainResults.push(await p2);
        // console.log('drainResults', drainResults);
        await pool.drain();
        expect(timerP1.getRuntime()).toBeLessThan(25 * 2.5);
        expect(timerP1.getRuntime()).toBeGreaterThan(12);
        await delay(38);
        await pool.done();
        await delay(38);
        expect(tasks_2ms[1]).toHaveBeenCalledTimes(1);
        // console.dir(tasks_2ms.map(getMockStats), { depth: 10 });
        expect(tasks_2ms[8]).toHaveBeenCalledTimes(1);
        // expect(tasks_4ms[9]).toHaveBeenCalledTimes(1);
        return pool.done();
      });
    });
  });
});

// type MockedFunc = (...args: any[]) => any;

// const getMockStats = <TFuncType extends MockedFunc>(
//   mock: jest.MockedFunction<TFuncType> | jest.Mock
// ) => {
//   return {
//     // name: mock?.mockName,
//     calls: mock?.mock?.calls?.length,
//     instances: mock?.mock?.instances?.length,
//     lastCall:
//       mock?.mock?.calls?.length ?? 0 > 0
//         ? mock?.mock?.calls.slice(-1)
//         : undefined,
//   };
// };

describe('Test Helpers', () => {
  test('runtime helper accurately measures time', async () => {
    const timer = startRuntimeHelper();
    await delay(3);
    expect(timer.getRuntime()).toBeGreaterThanOrEqual(2);
    expect(timer.getRuntime()).toBeLessThanOrEqual(30);
  });
});

function startRuntimeHelper() {
  const startTime = Date.now();
  const getRuntime = () => Date.now() - startTime;
  return { startTime, getRuntime };
}

type TaskCallback<TReturn> = (index?: number) => TReturn;

// Nope, can't use TPromiseValue here, must be determined on the RHS of the `=` sign.
// type TaskCallback<TReturn extends Promise<infer TPromiseValue>> = (index: number) => TPromiseValue;
// type TaskCallback<TReturn> = (index: number) => TReturn

// Needs the generic declared on left side of `=`
// type TaskCallback = <TReturn extends number>(index: number) => Promise<TReturn>;

function generateTasks(
  count: number = 10,
  promiseFn: TaskCallback<Promise<number>> = (index?: number) =>
    Promise.resolve(420)
) {
  return Array.from(
    {
      length: count,
    },
    (_, index) => jest.fn(() => promiseFn(index))
  );
}
