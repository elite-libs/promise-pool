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

  test.todo('support high precision timestamps');

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

  test('can handle calling .add() multiple times', async () => {
    const pool = new Pool();
    Array.from({length: 10}, 
      () => jest.fn(() => Promise.resolve(420)))
    .forEach(task => pool.add(task));
    return await pool.done();
  });

  test('can error on invalid tasks (non-async)', async () => {
    const pool = new Pool();
    const tasks = [
      jest.fn(() => 420),
      jest.fn(() => Error('an error')),
    ];
    // @ts-expect-error
    pool.add(...tasks);
    const p = await pool.done();
    expect(tasks[0]).toHaveBeenCalledTimes(1);
    return p;
  });

  test('can error on invalid tasks (non-function)', async () => {
    const pool = new Pool();
    const tasks = [
      undefined,
      420,
      Error('an error'),
    ];
    // @ts-expect-error
    expect(() => pool.add(...tasks)).toThrowError('Task Invalid! Task is not a function.');
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
    console.log({ processingCount });
    const p = pool.done();
    expect(processingCount).toBe(maxLimit);
    expect(taskList[0]).toHaveBeenCalledTimes(1);
    console.log(pool._stats);
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
    console.log({ processingCount });
    const p = pool.done();
    expect(processingCount).toBe(maxLimit);
    expect(taskList[0]).toHaveBeenCalledTimes(1);
    console.log(pool._stats);
    await p;
    expect(taskList[9]).toHaveBeenCalledTimes(1);
    return p;
  });
  // test('can queue & run 10 tasks with concurrency of 1', async () => {
  //   const maxLimit = 4; // Default is currently 4
  //   const pool = new Pool();
  //   const taskList = Array.from({ length: 10 }, () => jest.fn());
  //   const processingCount = pool.add(...taskList);
  //   const p = pool.done();
  //   expect(processingCount).toBe(maxLimit);
  //   expect(taskList[0]).toHaveBeenCalledTimes(1);
  //   expect(taskList[9]).toHaveBeenCalledTimes(1);
  //   return p;
  // });
  test.todo('can queue & run 10 tasks with concurrency of 2');
  test.todo('can queue & run 2x parallel limit');
  test.todo('support cancellation');
  test.todo('support error handling');
  test.todo('support progress reporting');
  test.todo('support retry');
  test.todo('support retry backoff');
  test.todo('support retry limit');
  test.todo('support error limit');
  test.todo('support progress and concurrency');
  test.todo('support progress and concurrency and cancellation');
  test.todo('support progress and concurrency and error handling');
  test.todo('support progress, concurrency, errors, cancellation');
  test.todo('support changing concurrency mid-run');
  test.todo('support changing timeout mid-run');
});
