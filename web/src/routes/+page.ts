import type { PageLoad } from './$types';
import dataJson from '../../../data.json';
import type { Data, Check } from '../../../types';

interface ParsedBuild {
	sprintDate: Date | null; // "2026-Jan-22" → version/sprint identifier
	buildDate: Date | null; // "2026-01-23" → CI build timestamp
	revision: string | null; // "3" or "4"
}

// Parse build number like "AiFoundry-2026-Jan-22-2026-01-23.3"
// Format: AiFoundry-{SPRINT_DATE}-{BUILD_DATE}.{REVISION}
function parseBuildNumber(buildNumber: string): ParsedBuild {
	const match = buildNumber.match(
		/^AiFoundry-(\d{4})-(\w{3})-(\d{2})-(\d{4})-(\d{2})-(\d{2})\.(\d+)$/
	);
	if (!match) return { sprintDate: null, buildDate: null, revision: null };

	const [, sprintYear, sprintMonth, sprintDay, buildYear, buildMonth, buildDay, rev] = match;

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
		sprintDate: new Date(
			Date.UTC(parseInt(sprintYear), months[sprintMonth], parseInt(sprintDay))
		),
		buildDate: new Date(
			Date.UTC(parseInt(buildYear), parseInt(buildMonth) - 1, parseInt(buildDay))
		),
		revision: rev
	};
}

export const load: PageLoad = () => {
	// Use unknown cast since data.json may not have all fields (e.g., checks array)
	const data = dataJson as unknown as Data;
	const latestBuild = data.builds[0];
	const previousBuild = data.builds[1];

	// Parse build number to get both sprint and build dates
	const parsed = parseBuildNumber(latestBuild.buildNumber);

	// Use the most recent of sprintDate vs buildDate for "days since" calculation
	const now = new Date();
	let referenceDate: Date;
	if (parsed.sprintDate && parsed.buildDate) {
		referenceDate = new Date(Math.max(parsed.sprintDate.getTime(), parsed.buildDate.getTime()));
	} else {
		referenceDate = parsed.sprintDate ?? parsed.buildDate ?? new Date(latestBuild.firstSeenAt);
	}
	const days = Math.floor((now.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));

	// Determine what changed between builds
	let changeType: 'build' | 'hash' | 'both' | 'initial' = 'initial';
	if (previousBuild) {
		const buildChanged = latestBuild.buildNumber !== previousBuild.buildNumber;
		const hashChanged = latestBuild.manifestHash !== previousBuild.manifestHash;
		if (buildChanged && hashChanged) changeType = 'both';
		else if (buildChanged) changeType = 'build';
		else if (hashChanged) changeType = 'hash';
	}

	// Get checks array (may not exist in older data)
	const checks: Check[] = data.checks ?? [];

	return {
		days,
		latestBuild,
		previousBuild,
		changeType,
		checks,
		lastUpdatedAt: data.lastUpdatedAt,
		region: latestBuild.rawConfig.environment?.region ?? 'unknown'
	};
};
