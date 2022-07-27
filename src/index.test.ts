import Pool from './index';
import { delay } from './shared';

describe('PromisePool', () => {
  describe('Core functionality', () => {
    test('can run a single task', async () => {
      const pool = new Pool();
      const task = jest.fn(() => Promise.resolve(420));
      // const processingCount =
      pool.add(task);
      // console.log({ processingCount });
      const p = pool.done();
      await p;
      expect(task).toHaveBeenCalledTimes(1);
      return p;
    });

    test('can run multiple batches of tasks (singleton mode)', async () => {
      const pool = new Pool();
      const taskList = generateTasks(8);
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
        const startTime = new Date().getTime();
        const getRunTime = () => new Date().getTime() - startTime;
        const maxWorkers = 5;
        const pool = new Pool({ maxWorkers });
        const tasks_2ms = generateTasks(2 * maxWorkers, () => delay(2, 420));
        const tasks_4ms = generateTasks(2 * maxWorkers, () => delay(4, 420));
        // The theoretical fastest completion time is 12ms, but we'll allow for a bit of leeway
        const processingCount = pool.add(...tasks_2ms);
        expect(processingCount).toBe(maxWorkers);
        pool.add(...tasks_4ms);
        expect(processingCount).toBe(maxWorkers);
        // Start draining W/O awaiting
        pool.drain(); 
        // Add 10 'instant' tasks, shouldn't trip up in the `done()` call
        pool.add(...generateTasks());
        await delay(2);
        expect(tasks_2ms[9]).toHaveBeenCalledTimes(1);
        await pool.drain();
        expect(getRunTime()).toBeGreaterThanOrEqual(4);
        await delay(8);
        expect(tasks_4ms[9]).toHaveBeenCalledTimes(1);
        return pool.done();
      });
    });
  });
});

function generateTasks(
  count: number = 10,
  promiseFn: () => Promise<unknown> = () => Promise.resolve(420)
) {
  return Array.from(
    {
      length: count,
    },
    () => jest.fn(promiseFn)
  );
}
