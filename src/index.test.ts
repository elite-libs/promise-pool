import Pool from './index';

describe('Pool: core', () => {
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
    expect(() => pool.add(jest.fn(() => Promise.resolve(420)))).toThrowError();
  });

  test('can handle calling .add() multiple times', async () => {
    const pool = new Pool();
    Array.from({ length: 10 }, () =>
      jest.fn(() => Promise.resolve(420))
    ).forEach((task) => pool.add(task));
    return await pool.done();
  });

  test('can handle calling .add() w/ 10 items multiple times', async () => {
    const pool = new Pool();
    const taskList = Array.from({ length: 10 }, () =>
      jest.fn(() => Promise.resolve(420))
    );
    pool.add(...taskList);
    pool.add(...taskList);
    return await pool.done();
  });

  test('can error on invalid tasks (non-async)', async () => {
    const pool = new Pool();
    const tasks = [jest.fn(() => 420), jest.fn(() => Error('an error'))];
    // expect(() => pool.add(...tasks)).toThrowError();
    
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
    const taskList = Array.from({ length: 10 }, (_, index) =>
      jest.fn(() => Promise.resolve(index))
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

  test('can run multiple async tasks', async () => {
    const maxLimit = 4; // Default is currently 4
    const pool = new Pool();
    const taskList = Array.from({ length: 10 }, (_, index) =>
      jest.fn(() => Promise.resolve(index))
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
});
