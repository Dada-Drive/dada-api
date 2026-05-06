import { coordinateFields, paginationParams, textField, uuidParam } from '@/validators/common';

const availableSharedRidesValidation = paginationParams();

const joinSharedRideValidation = [
  uuidParam('id'),
  ...coordinateFields('pickupLat', 'pickupLng'),
  textField('pickupAddress'),
  ...coordinateFields('dropoffLat', 'dropoffLng'),
  textField('dropoffAddress'),
];

const passengerActionValidation = [uuidParam('id'), uuidParam('passengerId')];

export { availableSharedRidesValidation, joinSharedRideValidation, passengerActionValidation };
