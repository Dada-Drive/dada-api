import { fn, col } from 'sequelize';

import { Vehicle } from '@/models/index';

async function getMakes(): Promise<string[]> {
  const results = await Vehicle.findAll({
    attributes: [[fn('DISTINCT', col('make')), 'make']],
    order: [['make', 'ASC']],
    raw: true,
  });
  return results.map((r) => r.make);
}

async function getModelsByMake(make: string): Promise<string[]> {
  const results = await Vehicle.findAll({
    attributes: [[fn('DISTINCT', col('model')), 'model']],
    where: { make },
    order: [['model', 'ASC']],
    raw: true,
  });
  return results.map((r) => r.model);
}

export { getMakes, getModelsByMake };
