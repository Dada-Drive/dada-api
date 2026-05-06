import { generateAccessToken } from '@/services/jwtService';
import { UserRole } from '@/types/enums';

function generateTestToken(userId = 'test-user-id', role: UserRole = UserRole.Rider): string {
  const { accessToken } = generateAccessToken(userId, role);
  return accessToken;
}

export { generateTestToken };
