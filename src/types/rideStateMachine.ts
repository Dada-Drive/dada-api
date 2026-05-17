import { captureNonFatal } from '@/config/sentry';
import { RideStatus } from '@/types/enums';
import { ErrorCodes, appError } from '@/types/errorCodes';

const VALID_TRANSITIONS: Record<RideStatus, RideStatus[]> = {
  [RideStatus.Pending]: [RideStatus.Offered, RideStatus.Cancelled],
  [RideStatus.Offered]: [RideStatus.Pending, RideStatus.Accepted, RideStatus.Cancelled],
  [RideStatus.Accepted]: [RideStatus.InProgress, RideStatus.Cancelled],
  [RideStatus.InProgress]: [RideStatus.Completed, RideStatus.Cancelled],
  [RideStatus.Completed]: [],
  [RideStatus.Cancelled]: [],
};

function validateTransition(current: RideStatus, next: RideStatus): void {
  if (!VALID_TRANSITIONS[current].includes(next)) {
    captureNonFatal(new Error(`Invalid ride transition: ${current} -> ${next}`), {
      from: current,
      to: next,
    });
    throw appError(ErrorCodes.RIDE.RIDE_INVALID_STATUS, { from: current, to: next });
  }
}

export { VALID_TRANSITIONS, validateTransition };
