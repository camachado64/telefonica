export type Required<T, U extends keyof T> = T & { [key in U]-?: T[key] };

export interface MicrosoftTokenResponse {
  token_type: "Bearer" | string;
  scope: string;
  started_at: Date;
  expires_in: number;
  ext_expires_in: number;
  access_token: string;
}
