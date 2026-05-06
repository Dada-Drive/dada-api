import { Request, Response } from 'express';

import * as adminService from '@/services/adminService';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendPaginated, sendSuccess } from '@/utils/responseHelpers';

const getStats = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const stats = await adminService.getStats();
  sendSuccess(res, stats);
});

const listUsers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { rows, meta } = await adminService.listUsers(req.query as Record<string, unknown>);
  sendPaginated(res, rows, meta);
});

const getUserDetails = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = await adminService.getUserDetails(req.params.userId as string);
  sendSuccess(res, user);
});

const deactivateUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = await adminService.deactivateUser(req.params.userId as string);
  sendSuccess(res, user);
});

const activateUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = await adminService.activateUser(req.params.userId as string);
  sendSuccess(res, user);
});

const listDrivers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { rows, meta } = await adminService.listDrivers(req.query as Record<string, unknown>);
  sendPaginated(res, rows, meta);
});

const getPendingDrivers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { rows, meta } = await adminService.getPendingDrivers(req.query as Record<string, unknown>);
  sendPaginated(res, rows, meta);
});

const approveDriver = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const profile = await adminService.approveDriver(req.params.userId as string);
  sendSuccess(res, profile);
});

const rejectDriver = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const profile = await adminService.rejectDriver(req.params.userId as string);
  sendSuccess(res, profile);
});

const listRides = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { rows, meta } = await adminService.listRides(req.query as Record<string, unknown>);
  sendPaginated(res, rows, meta);
});

const listTransactions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { rows, meta } = await adminService.listTransactions(req.query as Record<string, unknown>);
  sendPaginated(res, rows, meta);
});

export {
  activateUser,
  approveDriver,
  deactivateUser,
  getPendingDrivers,
  getStats,
  getUserDetails,
  listDrivers,
  listRides,
  listTransactions,
  listUsers,
  rejectDriver,
};
