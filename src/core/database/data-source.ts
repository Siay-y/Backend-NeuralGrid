import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './database.options';
import { loadDotEnvIfPresent, readDatabaseSettings } from './standalone-env';

loadDotEnvIfPresent();

export default new DataSource(buildDataSourceOptions(readDatabaseSettings()));
