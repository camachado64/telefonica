import { ConnectionPool } from "mssql";

import { config } from "../config/config";
import { TechnicianRepository } from "../repositories/technicians";
import { LogsRepository } from "../repositories/logs";

// Create database connection pool
export const dbConnection: ConnectionPool = new ConnectionPool({
  server: config.dbHost,
  port: config.dbPort,
  user: config.dbUser,
  password: config.dbPassword,
  database: config.dbName,
  options: {
    encrypt: false,
    enableArithAbort: true,
  },
});

// Export the repositories
export const techRepository: TechnicianRepository = new TechnicianRepository(
  dbConnection
);
export const logsRepository: LogsRepository = new LogsRepository(dbConnection);
