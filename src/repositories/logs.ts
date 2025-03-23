import { ConnectionPool, IResult } from "mssql";

export declare interface APILog {
  id: number;
  fecha: Date;
  txt: any;
}

export class LogsRepository {
  constructor(private readonly _db: ConnectionPool) {}

  private async _connect(): Promise<void> {
    await this._db.connect().catch((error: Error) => {
      console.error(
        `[${LogsRepository.name}][ERROR] ${
          this._connect.name
        } error:\n${JSON.stringify(error, null, 2)}`
      );
    });
  }

  public async logs(): Promise<APILog[]> {
    if (!this._db.connected) {
      // If the connection is not open, open it
      await this._connect();
    }

    console.debug(
      `[${LogsRepository.name}][DEBUG] ${this.logs.name} Fetching API logs`
    );

    // Perform the query to get the API logs from the database
    return await this._db.query<APILog[]>`SELECT * FROM dbo.logschatbot`
      .then((result: IResult<APILog>): APILog[] => {
        // Parse the results of the query to an APILog array

        if (result?.recordset?.length > 0) {
          // If the query returns results, map the results to the APILog type
          return result.recordset.map((r: APILog) => {
            return {
              id: r.id,
              fecha: new Date(r.fecha),
              txt: JSON.parse(r.txt),
            };
          });
        }

        // If the query returns no results, return an empty array
        return [];
      })
      .catch((error: Error) => {
        // Catches any errors that occur during the API logs query

        console.error(
          `[${LogsRepository.name}][ERROR] ${
            this.logs.name
          } error:\n${JSON.stringify(error, null, 2)}`
        );

        // Return an empty array if an error occurs
        return [];
      });
  }

  public async createLog(message: string): Promise<void> {
    if (!this._db.connected) {
      // If the connection is not open, open it
      await this._connect();
    }

    console.debug(
      `[${LogsRepository.name}][DEBUG] ${this.createLog.name} Creating API log with message: ${message}`
    );

    // Perform the query to create the API log in the database
    await this._db
      .query<any>`INSERT INTO dbo.logschatbot (txt) VALUES (${message})`.catch(
      (error: Error) => {
        // Catches any errors that occur during the API logs query

        console.error(
          `[${LogsRepository.name}][ERROR] ${
            this.logs.name
          } error:\n${JSON.stringify(error, null, 2)}`
        );

        // Return an empty array if an error occurs
        return [];
      }
    );
  }
}
