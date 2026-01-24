export type FoundryConfig = Partial<{
  environment: Partial<{
    name: string;
    region: string;
    buildNumber: string;
  }>;
}>;

export type FoundryBuild = {
  firstSeenAt: string;
  lastSeenAt: string;
  buildNumber: string;
  manifestHash: string;
  rawConfig: FoundryConfig;
};

export type CheckStatus =
  | "ok"
  | "network_error"
  | "http_error"
  | "parse_error"
  | "missing_build_info"
  | "unknown_error";

export type Check = {
  checkedAt: string;
  status: CheckStatus;
  durationMs: number;
  httpStatus?: number;
  errorMessage?: string;
  buildNumber?: string;
  manifestHash?: string;
  isNewBuild?: boolean;
};

export type Data = {
  lastUpdatedAt: string;
  builds: Array<FoundryBuild>;
  checks: Array<Check>;
};
