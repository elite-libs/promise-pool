import Pool from './index';
setTimeout;
describe('Pool: core', () => {
  test('can run a single task', async () => {
    const pool = new Pool();
    const task = jest.fn();
    const added = pool.add(task);
    console.log({ added });
    const p = pool.done();
    console.log(pool._stats);
    expect(task).toHaveBeenCalledTimes(1);
    await p;
    console.log(pool._stats);

    return p;
  });
  test.todo('support high precision timestamps');

  test('can run multiple tasks', async () => {
    const maxLimit = 4; // Default is currently 4
    const pool = new Pool();
    const taskList = Array.from({ length: 10 }, () => jest.fn());
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
    const taskList = Array.from({ length: 10 }, () => jest.fn(() => Promise.resolve(null)));
    const processingCount = pool.add(...taskList);
    const p = pool.done();
    expect(processingCount).toBe(maxLimit);
    expect(taskList[0]).toHaveBeenCalledTimes(1);
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
