import { Request, Response } from 'express';

import * as vehicleCatalogService from '@/services/vehicleCatalogService';
import { VehicleType } from '@/types/enums';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendSuccess } from '@/utils/responseHelpers';

const getMakes = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const makes = await vehicleCatalogService.getMakes();
  sendSuccess(res, makes);
});

const getModelsByMake = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const models = await vehicleCatalogService.getModelsByMake(req.params.make as string);
  sendSuccess(res, models);
});

const getVehicleTypes = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  sendSuccess(res, Object.values(VehicleType));
});

export { getMakes, getModelsByMake, getVehicleTypes };
