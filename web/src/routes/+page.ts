import type { PageLoad } from './$types';
import dataJson from '../../../data.json';
import type { Data, Check } from '../../../types';

export const load: PageLoad = () => {
	// Use unknown cast since data.json may not have all fields (e.g., checks array)
	const data = dataJson as unknown as Data;
	const latestBuild = data.builds[0];
	const previousBuild = data.builds[1];

	// Calculate days since last build
	const firstSeen = new Date(latestBuild.firstSeenAt);
	const now = new Date();
	const days = Math.floor((now.getTime() - firstSeen.getTime()) / (1000 * 60 * 60 * 24));

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
		checks: checks.slice(0, 24), // Last 24 checks (1 day)
		lastUpdatedAt: data.lastUpdatedAt
	};
};
