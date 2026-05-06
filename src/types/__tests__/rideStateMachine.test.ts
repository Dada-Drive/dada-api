import { RideStatus } from '@/types/enums';
import { VALID_TRANSITIONS, validateTransition } from '@/types/rideStateMachine';

describe('Ride State Machine', () => {
  describe('VALID_TRANSITIONS', () => {
    it('defines transitions for every RideStatus value', () => {
      for (const status of Object.values(RideStatus)) {
        expect(VALID_TRANSITIONS).toHaveProperty(status);
      }
    });

    it('marks Completed as a terminal state', () => {
      expect(VALID_TRANSITIONS[RideStatus.Completed]).toEqual([]);
    });

    it('marks Cancelled as a terminal state', () => {
      expect(VALID_TRANSITIONS[RideStatus.Cancelled]).toEqual([]);
    });
  });

  describe('validateTransition', () => {
    const validCases: [RideStatus, RideStatus][] = [
      [RideStatus.Pending, RideStatus.Offered],
      [RideStatus.Pending, RideStatus.Cancelled],
      [RideStatus.Offered, RideStatus.Accepted],
      [RideStatus.Offered, RideStatus.Cancelled],
      [RideStatus.Accepted, RideStatus.InProgress],
      [RideStatus.Accepted, RideStatus.Cancelled],
      [RideStatus.InProgress, RideStatus.Completed],
      [RideStatus.InProgress, RideStatus.Cancelled],
    ];

    it.each(validCases)('%s → %s is allowed', (from, to) => {
      expect(() => validateTransition(from, to)).not.toThrow();
    });

    const invalidCases: [RideStatus, RideStatus][] = [
      [RideStatus.Pending, RideStatus.Accepted],
      [RideStatus.Pending, RideStatus.InProgress],
      [RideStatus.Pending, RideStatus.Completed],
      [RideStatus.Offered, RideStatus.Pending],
      [RideStatus.Offered, RideStatus.InProgress],
      [RideStatus.Offered, RideStatus.Completed],
      [RideStatus.Accepted, RideStatus.Pending],
      [RideStatus.Accepted, RideStatus.Offered],
      [RideStatus.Accepted, RideStatus.Completed],
      [RideStatus.InProgress, RideStatus.Pending],
      [RideStatus.InProgress, RideStatus.Offered],
      [RideStatus.InProgress, RideStatus.Accepted],
      [RideStatus.Completed, RideStatus.Pending],
      [RideStatus.Completed, RideStatus.Cancelled],
      [RideStatus.Cancelled, RideStatus.Pending],
      [RideStatus.Cancelled, RideStatus.Completed],
    ];

    it.each(invalidCases)('%s → %s throws RIDE_INVALID_STATUS', (from, to) => {
      expect(() => validateTransition(from, to)).toThrow(
        expect.objectContaining({ code: 'RIDE_INVALID_STATUS' }),
      );
    });
  });
});
