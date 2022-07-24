import Pool from './index';

describe('Pool: core', () => {
  test('can run a single task', async () => {
    const pool = new Pool();
    const task = jest.fn();
    const added = pool.add(task);
    console.log({ added });
    const p = pool.done();
    console.log(pool._stats);
    expect(task).toHaveBeenCalledTimes(1);
    return p;
  });
  test.todo('support high precision timestamps');

  test.todo('can run multiple tasks');
  test.todo('can queue & run 10 tasks with concurrency of 1');
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
