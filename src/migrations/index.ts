import * as migration_20250529_181234 from './20250529_181234';

export const migrations = [
  {
    up: migration_20250529_181234.up,
    down: migration_20250529_181234.down,
    name: '20250529_181234'
  },
];
