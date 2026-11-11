import { RealtimePublisher } from './realtime.publisher';
import { REALTIME_USER_ROOM } from './realtime.types';

describe('RealtimePublisher isolation', () => {
  it('notifyUser / inboxChanged only target the recipient room', () => {
    const emitToUser = jest.fn();
    const emitToRoom = jest.fn();
    const disconnectUser = jest.fn();
    const gateway = { emitToUser, emitToRoom, disconnectUser } as any;
    const publisher = new RealtimePublisher(gateway);

    publisher.inboxChanged(42);
    publisher.notifyUser(99, 'alert.disciplinary', { itemId: 7 });

    expect(emitToUser).toHaveBeenCalledTimes(2);
    expect(emitToUser.mock.calls[0][0]).toBe(42);
    expect(emitToUser.mock.calls[0][1]).toEqual(
      expect.objectContaining({ type: 'inbox.changed' }),
    );
    expect(emitToUser.mock.calls[1][0]).toBe(99);
    expect(emitToUser.mock.calls[1][1]).toEqual(
      expect.objectContaining({ type: 'alert.disciplinary', itemId: 7 }),
    );
    expect(emitToRoom).not.toHaveBeenCalled();
    expect(REALTIME_USER_ROOM(42)).toBe('user:42');
    expect(REALTIME_USER_ROOM(99)).toBe('user:99');
  });

  it('does not broadcast a private event to a different user id', () => {
    const rooms = new Map<number, unknown[]>();
    const gateway = {
      emitToUser: (userId: number, event: unknown) => {
        const list = rooms.get(userId) ?? [];
        list.push(event);
        rooms.set(userId, list);
      },
      emitToRoom: jest.fn(),
      disconnectUser: jest.fn(),
    } as any;
    const publisher = new RealtimePublisher(gateway);

    publisher.notifyUser(10, 'inbox.changed');

    expect(rooms.get(10)).toHaveLength(1);
    expect(rooms.get(11)).toBeUndefined();
  });
});
