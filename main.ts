import { readFile, writeFile } from "node:fs/promises";
import type { Data, FoundryBuild, FoundryConfig } from "./types";

const FOUNDRY_URL = "https://ai.azure.com/nextgen";
const DATA_FILE_PATH = "./data.json";

async function readData(filePath: string): Promise<Data> {
  try {
    const content = await readFile(filePath, "utf-8");
    const data = JSON.parse(content);

    if (
      typeof data === "object" &&
      data != null &&
      Array.isArray(data.builds)
    ) {
      return data as Data;
    }
    throw new Error("invalid data structure in data.json");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      console.log("data.json not found, creating a new one");
      return {
        lastUpdatedAt: new Date().toISOString(),
        builds: [],
      };
    }
    throw error;
  }
}

async function writeData(filePath: string, data: Data): Promise<void> {
  const content = JSON.stringify(data, null, 2);
  await writeFile(filePath, content, "utf-8");
}

function extractFoundryConfig(html: string): FoundryConfig | undefined {
  const scriptIdMatch = html.match(
    /<script id="ai-foundry-host-context"[^>]*>([\s\S]*?)<\/script>/,
  );

  if (scriptIdMatch) {
    const content = scriptIdMatch[1].trim();
    const decoded = decodeURIComponent(content);
    try {
      const config = JSON.parse(decoded);
      return config as FoundryConfig;
    } catch (error) {
      console.error("failed to parse Foundry config JSON:", error);
      return undefined;
    }
  }
  return undefined;
}

async function main() {
  const data = await readData(DATA_FILE_PATH);

  const res = await fetch(FOUNDRY_URL);
  if (!res.ok) {
    console.error(
      `failed to fetch ${FOUNDRY_URL}: ${res.status} ${res.statusText}`,
    );
    return;
  }
  const rawHtml = await res.text();

  const config = extractFoundryConfig(rawHtml);

  console.log("<<config start");
  console.log(config);
  console.log("<<config end");

  if (!config?.environment?.buildNumber) {
    console.log("fould not find build information");
    return;
  }

  const now = new Date().toISOString();
  const { buildNumber, ...foundryEnv } = config.environment;

  const existingBuildIndex = data.builds.findIndex(
    (build) => build.foundryEnv.buildNumber === buildNumber,
  );

  if (existingBuildIndex !== -1) {
    console.log(`build ${buildNumber} already exists`);
    data.builds[existingBuildIndex].lastSeenAt = now;
  } else {
    console.log(`found new build: ${buildNumber}`);
    const newBuild: FoundryBuild = {
      firstSeenAt: now,
      lastSeenAt: now,
      foundryEnv: {
        ...foundryEnv,
        buildNumber,
      },
      rawConfig: config,
    };
    data.builds.unshift(newBuild);
  }

  data.lastUpdatedAt = now;

  await writeData(DATA_FILE_PATH, data);

  console.log("done");
}

main().catch((error) => {
  console.error("unexpected error:", error);
  process.exit(1);
});
