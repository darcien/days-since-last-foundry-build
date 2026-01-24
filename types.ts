export type FoundryEnv = Partial<{
  name: string;
  region: string;
  buildNumber: string;
}>;

export type FoundryConfig = Partial<{
  environment: FoundryEnv;
}>;

export type FoundryBuild = {
  firstSeenAt: string;
  lastSeenAt: string;
  foundryEnv: FoundryEnv;
  rawConfig: FoundryConfig;
};

export type Data = {
  lastUpdatedAt: string;
  builds: Array<FoundryBuild>;
  // checks: Array<Check>;
};
