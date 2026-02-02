import type { PageLoad } from './$types';
import dataJson from '../../../data.json';
import type { Data, FoundryBuild } from '../../../types';

const TARGET_REGION = 'eastus2';

interface BuildWithLifespan extends FoundryBuild {
	lifespanHours: number;
	lifespanDays: number;
	isActive: boolean;
}

interface SurvivalProbability {
	hours: number;
	probability: number; // 0-1
}

interface BuildStaleness {
	sprintToBuildDays: number;
	buildToDeployDays: number;
	totalStaleness: number;
}

interface StabilityMetrics {
	currentBuild: BuildWithLifespan | null;
	previousBuild: BuildWithLifespan | null;
	medianLifespanHours: number;
	averageLifespanHours: number;
	longestBuild: BuildWithLifespan | null;
	shortestBuild: BuildWithLifespan | null;
	totalBuilds: number;
	stabilityScore: number; // 0-100
	percentileRank: number; // where current build ranks
	threatLevel: 'MINIMAL' | 'LOW' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
	recentBuilds: BuildWithLifespan[];
	deploysPerDay: number;
	hoursSinceLastDeploy: number;
	survivalProbabilities: SurvivalProbability[];
	currentBuildStaleness: BuildStaleness | null;
	totalUptimeHours: number;
	consistencyScore: number; // 0-100, based on std deviation
}

function calculateLifespan(build: FoundryBuild): {
	hours: number;
	days: number;
	isActive: boolean;
} {
	const start = new Date(build.firstSeenAt).getTime();
	const end = new Date(build.lastSeenAt).getTime();
	const now = Date.now();

	// Consider build "active" if last seen within 2 hours
	const isActive = now - end < 2 * 60 * 60 * 1000;

	const lifespanMs = end - start;
	const hours = lifespanMs / (1000 * 60 * 60);
	const days = hours / 24;

	return { hours, days, isActive };
}

function calculateStabilityScore(
	currentLifespanHours: number,
	medianLifespanHours: number,
	longestLifespanHours: number
): number {
	// Score based on how long current build has survived relative to historical data
	// 0-100 scale, where 100 = matched or exceeded longest build

	if (longestLifespanHours === 0) return 50;

	const score = (currentLifespanHours / longestLifespanHours) * 100;
	return Math.min(100, Math.max(0, score));
}

function calculateThreatLevel(
	deploysPerDay: number,
	hoursSinceLastDeploy: number
): StabilityMetrics['threatLevel'] {
	// Threat = how likely is a deploy to happen soon
	// Based on deploy frequency and time since last deploy

	if (deploysPerDay < 0.2) return 'MINIMAL'; // Less than 1 deploy per 5 days
	if (deploysPerDay < 0.5) return 'LOW'; // Less than 1 deploy per 2 days
	if (deploysPerDay < 1.0) return 'ELEVATED'; // ~1 deploy per day
	if (deploysPerDay < 2.0) return 'HIGH'; // ~2 deploys per day
	return 'CRITICAL'; // 2+ deploys per day
}

function calculateSurvivalProbability(historicalLifespans: number[]): SurvivalProbability[] {
	// Calculate probability a build survives to X hours total (from birth)
	const targets = [12, 24, 48, 72];

	return targets.map((targetHours) => {
		// Count how many builds survived at least this long
		const survived = historicalLifespans.filter((h) => h >= targetHours).length;
		const total = historicalLifespans.length;

		return {
			hours: targetHours,
			probability: total > 0 ? survived / total : 0.5
		};
	});
}

function parseBuildNumber(buildNumber: string): {
	sprintDate: Date | null;
	buildDate: Date | null;
} {
	// Parse: AiFoundry-2026-Jan-22-2026-01-29.2
	const match = buildNumber.match(
		/^AiFoundry-(\d{4})-(\w{3})-(\d{2})-(\d{4})-(\d{2})-(\d{2})\.\d+$/
	);
	if (!match) return { sprintDate: null, buildDate: null };

	const [, sprintYear, sprintMonth, sprintDay, buildYear, buildMonth, buildDay] = match;

	const months: Record<string, number> = {
		Jan: 0,
		Feb: 1,
		Mar: 2,
		Apr: 3,
		May: 4,
		Jun: 5,
		Jul: 6,
		Aug: 7,
		Sep: 8,
		Oct: 9,
		Nov: 10,
		Dec: 11
	};

	return {
		sprintDate: new Date(Date.UTC(parseInt(sprintYear), months[sprintMonth], parseInt(sprintDay))),
		buildDate: new Date(Date.UTC(parseInt(buildYear), parseInt(buildMonth) - 1, parseInt(buildDay)))
	};
}

function calculateBuildStaleness(build: FoundryBuild): BuildStaleness | null {
	const parsed = parseBuildNumber(build.buildNumber);
	if (!parsed.sprintDate || !parsed.buildDate) return null;

	const deployDate = new Date(build.firstSeenAt);

	const sprintToBuildMs = parsed.buildDate.getTime() - parsed.sprintDate.getTime();
	const buildToDeployMs = deployDate.getTime() - parsed.buildDate.getTime();

	return {
		sprintToBuildDays: sprintToBuildMs / (1000 * 60 * 60 * 24),
		buildToDeployDays: buildToDeployMs / (1000 * 60 * 60 * 24),
		totalStaleness: (sprintToBuildMs + buildToDeployMs) / (1000 * 60 * 60 * 24)
	};
}

function calculateConsistencyScore(lifespans: number[]): number {
	// Lower std deviation = higher consistency
	if (lifespans.length < 2) return 50;

	const mean = lifespans.reduce((sum, h) => sum + h, 0) / lifespans.length;
	const variance = lifespans.reduce((sum, h) => sum + Math.pow(h - mean, 2), 0) / lifespans.length;
	const stdDev = Math.sqrt(variance);

	// Convert to 0-100 score (lower stdDev = higher score)
	// If stdDev is 0 (all same), score = 100
	// If stdDev equals mean (high variance), score approaches 0
	const normalizedStdDev = stdDev / (mean || 1);
	const score = Math.max(0, 100 - normalizedStdDev * 100);

	return score;
}

export const load: PageLoad = (): StabilityMetrics => {
	const data = dataJson as unknown as Data;

	// Filter to eastus2 only
	const eus2Builds = data.builds.filter(
		(build) => build.rawConfig.environment?.region === TARGET_REGION
	);

	if (eus2Builds.length === 0) {
		// No eastus2 data yet
		return {
			currentBuild: null,
			previousBuild: null,
			medianLifespanHours: 0,
			averageLifespanHours: 0,
			longestBuild: null,
			shortestBuild: null,
			totalBuilds: 0,
			stabilityScore: 0,
			percentileRank: 0,
			threatLevel: 'MINIMAL',
			recentBuilds: [],
			deploysPerDay: 0,
			hoursSinceLastDeploy: 0,
			survivalProbabilities: [],
			currentBuildStaleness: null,
			totalUptimeHours: 0,
			consistencyScore: 0
		};
	}

	// Calculate lifespan for all builds
	const buildsWithLifespan: BuildWithLifespan[] = eus2Builds.map((build) => {
		const { hours, days, isActive } = calculateLifespan(build);
		return {
			...build,
			lifespanHours: hours,
			lifespanDays: days,
			isActive
		};
	});

	// Sort by lastSeenAt (most recent first)
	buildsWithLifespan.sort(
		(a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime()
	);

	const currentBuild = buildsWithLifespan[0];
	const previousBuild = buildsWithLifespan[1] || null;

	// Calculate historical stats
	const lifespans = buildsWithLifespan.map((b) => b.lifespanHours).sort((a, b) => a - b);
	const medianLifespanHours = lifespans[Math.floor(lifespans.length / 2)] || 0;
	const averageLifespanHours = lifespans.reduce((sum, h) => sum + h, 0) / lifespans.length || 0;

	// Find longest and shortest builds
	const longestBuild = buildsWithLifespan.reduce((longest, build) =>
		build.lifespanHours > longest.lifespanHours ? build : longest
	);
	const shortestBuild = buildsWithLifespan.reduce((shortest, build) =>
		build.lifespanHours < shortest.lifespanHours ? build : shortest
	);

	// Calculate percentile rank (where does current build rank among all builds)
	const rank = lifespans.filter((h) => h <= currentBuild.lifespanHours).length;
	const percentileRank = (rank / lifespans.length) * 100;

	// Stability score (0-100)
	const stabilityScore = calculateStabilityScore(
		currentBuild.lifespanHours,
		medianLifespanHours,
		longestBuild.lifespanHours
	);

	// Calculate deploy frequency (deploys per day)
	const firstBuildTime = new Date(
		buildsWithLifespan[buildsWithLifespan.length - 1].firstSeenAt
	).getTime();
	const lastBuildTime = new Date(buildsWithLifespan[0].lastSeenAt).getTime();
	const timeSpanDays = (lastBuildTime - firstBuildTime) / (1000 * 60 * 60 * 24);
	const deploysPerDay = timeSpanDays > 0 ? buildsWithLifespan.length / timeSpanDays : 0;

	// Hours since last deploy (hours since current build started)
	const hoursSinceLastDeploy =
		(Date.now() - new Date(currentBuild.firstSeenAt).getTime()) / (1000 * 60 * 60);

	// Threat level
	const threatLevel = calculateThreatLevel(deploysPerDay, hoursSinceLastDeploy);

	// Survival probabilities (probability a build survives to X hours total)
	const survivalProbabilities = calculateSurvivalProbability(lifespans);

	// Build staleness
	const currentBuildStaleness = calculateBuildStaleness(currentBuild);

	// Total uptime (sum of all build lifespans)
	const totalUptimeHours = buildsWithLifespan.reduce((sum, b) => sum + b.lifespanHours, 0);

	// Consistency score
	const consistencyScore = calculateConsistencyScore(lifespans);

	return {
		currentBuild,
		previousBuild,
		medianLifespanHours,
		averageLifespanHours,
		longestBuild,
		shortestBuild,
		totalBuilds: buildsWithLifespan.length,
		stabilityScore,
		percentileRank,
		threatLevel,
		recentBuilds: buildsWithLifespan.slice(0, 10), // Last 10 builds
		deploysPerDay,
		hoursSinceLastDeploy,
		survivalProbabilities,
		currentBuildStaleness,
		totalUptimeHours,
		consistencyScore
	};
};
