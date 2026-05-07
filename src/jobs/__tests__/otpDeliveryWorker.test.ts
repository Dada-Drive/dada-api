import { Job } from 'bullmq';

import { processOtpDelivery } from '../workers/otpDeliveryWorker';

import type { OtpDeliveryJobData } from '../workers/otpDeliveryWorker';

// Mock SMS/WhatsApp providers
const mockSendWhatsApp = jest.fn();
const mockSendSms = jest.fn();

jest.mock('@/services/providers/vonageWhatsappProvider', () => ({
  sendWhatsAppOtp: (...args: unknown[]) => mockSendWhatsApp(...args),
}));

jest.mock('@/services/providers/easySendSmsProvider', () => ({
  sendSmsOtp: (...args: unknown[]) => mockSendSms(...args),
}));

beforeEach(() => {
  mockSendWhatsApp.mockReset();
  mockSendSms.mockReset();
});

function makeJob(data: OtpDeliveryJobData): Job<OtpDeliveryJobData> {
  return { data } as unknown as Job<OtpDeliveryJobData>;
}

describe('otpDeliveryWorker', () => {
  it('delivers via WhatsApp when channel is whatsapp and succeeds', async () => {
    mockSendWhatsApp.mockResolvedValue(undefined);

    const job = makeJob({
      otpId: 'otp-1',
      phone: '+21650000001',
      code: '123456',
      channel: 'whatsapp',
    });

    await processOtpDelivery(job);
    expect(mockSendWhatsApp).toHaveBeenCalledWith('+21650000001', '123456');
    expect(mockSendSms).not.toHaveBeenCalled();
  });

  it('falls back to SMS when WhatsApp fails', async () => {
    mockSendWhatsApp.mockRejectedValue(new Error('WhatsApp down'));
    mockSendSms.mockResolvedValue(undefined);

    const job = makeJob({
      otpId: 'otp-2',
      phone: '+21650000002',
      code: '654321',
      channel: 'whatsapp',
    });

    await processOtpDelivery(job);
    expect(mockSendWhatsApp).toHaveBeenCalledWith('+21650000002', '654321');
    expect(mockSendSms).toHaveBeenCalledWith('+21650000002', '654321');
  });

  it('delivers directly via SMS when channel is sms', async () => {
    mockSendSms.mockResolvedValue(undefined);

    const job = makeJob({
      otpId: 'otp-3',
      phone: '+21650000003',
      code: '111222',
      channel: 'sms',
    });

    await processOtpDelivery(job);
    expect(mockSendWhatsApp).not.toHaveBeenCalled();
    expect(mockSendSms).toHaveBeenCalledWith('+21650000003', '111222');
  });

  it('throws when SMS delivery fails to trigger retry', async () => {
    mockSendSms.mockRejectedValue(new Error('SMS gateway down'));

    const job = makeJob({
      otpId: 'otp-4',
      phone: '+21650000004',
      code: '333444',
      channel: 'sms',
    });

    await expect(processOtpDelivery(job)).rejects.toThrow('SMS gateway down');
  });

  it('throws when both channels fail (WhatsApp then SMS)', async () => {
    mockSendWhatsApp.mockRejectedValue(new Error('WhatsApp down'));
    mockSendSms.mockRejectedValue(new Error('SMS down'));

    const job = makeJob({
      otpId: 'otp-5',
      phone: '+21650000005',
      code: '555666',
      channel: 'whatsapp',
    });

    await expect(processOtpDelivery(job)).rejects.toThrow('SMS down');
  });
});
