// import { readFileSync } from "fs";

import { config as dotEnv } from "dotenv";

console.debug(`[config][DEBUG] Loading configuration...`);
console.debug(`[config][DEBUG] currentWorkingDir: ${process.cwd()}`);

// Load environment variables from .env file.
// This only applies when running the application through 'npm run start' in a local environment as
// the Teams Toolkit will automatically load environment when running the application through it
dotEnv({
  path: "./env/.env.local",
  debug: true,
  encoding: "utf8",
  override: true, // Override existing environment variables to allow for local hotswapping
});

// export interface SSLCert {
//   key: Buffer;
//   cert: Buffer;
// }

export interface BotConfiguration {
  botId: string;
  botPassword: string;
  botDomain: string;
  botType: string;
  botConnectionName: string;

  clientId: string;
  tenantId: string;
  clientSecret: string;
  authority: string;
  authorityHost: string;

  teamsAppId: string;
  teamsAppCatalogId: string;
  teamsAppTenantId: string;

  apiEndpoint: string;
  apiUsername: string;
  apiPassword: string;

  dbHost: string;
  dbPort: number;
  dbUser: string;
  dbPassword: string;
  dbName: string;

  graphUsername: string;
  graphPassword: string;

  allowAll: string;

  // ssl: SSLCert;
}

export const config: BotConfiguration = {
  // Azure bot settings
  botId: process.env.BOT_ID,
  botPassword: process.env.BOT_PASSWORD,
  botDomain: process.env.BOT_DOMAIN,
  botType: process.env.BOT_TYPE,
  botConnectionName: process.env.BOT_CONNECTION_NAME,

  // AAD app settings
  clientId: process.env.AAD_APP_CLIENT_ID,
  tenantId: process.env.AAD_APP_TENANT_ID,
  clientSecret: process.env.AAD_APP_CLIENT_SECRET,
  authority: process.env.AAD_APP_OAUTH_AUTHORITY,
  authorityHost: process.env.AAD_APP_OAUTH_AUTHORITY_HOST,

  // Teams app settings
  teamsAppId: process.env.TEAMS_APP_ID,
  teamsAppCatalogId: process.env.TEAMS_APP_CATALOG_ID,
  teamsAppTenantId: process.env.TEAMS_APP_TENANT_ID,

  // API settings
  apiEndpoint: process.env.API_ENDPOINT,
  apiUsername: process.env.API_USERNAME,
  apiPassword: process.env.API_PASSWORD,

  // Database settings
  dbHost: process.env.DB_HOST,
  dbPort: parseInt(process.env.DB_PORT),
  dbUser: process.env.DB_USER,
  dbPassword: process.env.DB_PASSWORD,
  dbName: process.env.DB_NAME,

  // Graph settings
  graphUsername: process.env.GRAPH_USERNAME,
  graphPassword: process.env.GRAPH_PASSWORD,

  // Debug settings
  allowAll: process.env.ALLOW_ALL,

  // SSL settings1
  // ssl: {
  //   key: readFileSync(process.env.SSL_KEY),
  //   cert: readFileSync(process.env.SSL_CERT),
  // },
};

// Create a safe version of the config object to avoid logging sensitive information
// like passwords or secrets
const safeConfig: Partial<BotConfiguration> = {};
const configKeys: (keyof BotConfiguration)[] = Object.keys(
  config
) as (keyof BotConfiguration)[];
configKeys.forEach((key: keyof BotConfiguration) => {
  if (
    key.toLowerCase().indexOf("password") < 0 &&
    key.toLowerCase().indexOf("secret") < 0
  ) {
    // This is to avoid logging sensitive information like passwords or secrets
    const safeKey = key as string;
    safeConfig[safeKey] = config[key];
  }
});
console.debug(
  `[config][DEBUG] config:\n${JSON.stringify(safeConfig, null, 2)}`
);
