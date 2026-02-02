<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Glitch animation state
	let glitchActive = $state(false);
	let seedModifier = $state(0);
	let prefersReducedMotion = $state(false);

	// Pulse animation for sync ratio
	let pulseIntensity = $state(1.0);

	// Real-time uptime ticker
	let liveUptimeMs = $state(0);

	// Real-time uptime ticker effect
	$effect(() => {
		if (!data.currentBuild) return;

		const startTime = new Date(data.currentBuild.firstSeenAt).getTime();

		const updateUptime = () => {
			liveUptimeMs = Date.now() - startTime;
		};

		updateUptime();
		const interval = setInterval(updateUptime, 1000);

		return () => clearInterval(interval);
	});

	$effect(() => {
		// Check for reduced motion preference
		const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		prefersReducedMotion = motionQuery.matches;

		const handleMotionChange = (e: MediaQueryListEvent) => {
			prefersReducedMotion = e.matches;
		};
		motionQuery.addEventListener('change', handleMotionChange);

		if (prefersReducedMotion) {
			return () => motionQuery.removeEventListener('change', handleMotionChange);
		}

		let animationFrame: number;
		let lastModifierUpdate = 0;
		let startTime = 0;
		const CYCLE_DURATION = 12000; // 12 seconds
		const GLITCH_START = 0.85;
		const GLITCH_END = 0.9;
		const MODIFIER_INTERVAL = 80;

		const animate = (timestamp: number) => {
			if (startTime === 0) {
				startTime = timestamp;
			}

			const elapsed = timestamp - startTime;
			const cycleProgress = (elapsed % CYCLE_DURATION) / CYCLE_DURATION;

			glitchActive = cycleProgress >= GLITCH_START && cycleProgress <= GLITCH_END;

			if (glitchActive) {
				if (timestamp - lastModifierUpdate >= MODIFIER_INTERVAL) {
					seedModifier++;
					lastModifierUpdate = timestamp;
				}
			}

			// Pulse effect for sync ratio (slow breathing)
			pulseIntensity = 0.85 + Math.sin(elapsed / 2000) * 0.15;

			animationFrame = requestAnimationFrame(animate);
		};

		const handleVisibilityChange = () => {
			if (document.hidden) {
				if (animationFrame) {
					cancelAnimationFrame(animationFrame);
				}
			} else {
				animationFrame = requestAnimationFrame(animate);
			}
		};
		document.addEventListener('visibilitychange', handleVisibilityChange);

		animationFrame = requestAnimationFrame(animate);

		return () => {
			if (animationFrame) {
				cancelAnimationFrame(animationFrame);
			}
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			motionQuery.removeEventListener('change', handleMotionChange);
		};
	});

	function formatBuildNumber(build: string): string {
		return build.replace(/^AiFoundry-/, '');
	}

	function formatDateTime(iso: string): string {
		const d = new Date(iso);
		const month = String(d.getUTCMonth() + 1).padStart(2, '0');
		const day = String(d.getUTCDate()).padStart(2, '0');
		const hour = String(d.getUTCHours()).padStart(2, '0');
		const min = String(d.getUTCMinutes()).padStart(2, '0');
		return `${month}.${day} // ${hour}:${min}Z`;
	}

	function formatDuration(hours: number): string {
		const days = Math.floor(hours / 24);
		const h = Math.floor(hours % 24);
		const m = Math.floor((hours * 60) % 60);
		if (days > 0) return `${days}d ${h}h ${m}m`;
		if (h > 0) return `${h}h ${m}m`;
		return `${m}m`;
	}

	function formatLiveUptime(ms: number): string {
		const totalSeconds = Math.floor(ms / 1000);
		const days = Math.floor(totalSeconds / 86400);
		const hours = Math.floor((totalSeconds % 86400) / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;

		if (days > 0) {
			return `${days}d ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
		}
		return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
	}

	function getProbabilityColor(prob: number): string {
		if (prob >= 0.8) return 'rgb(34, 197, 94)'; // green
		if (prob >= 0.6) return 'rgb(234, 179, 8)'; // yellow
		if (prob >= 0.4) return 'rgb(249, 115, 22)'; // orange
		return 'rgb(239, 68, 68)'; // red
	}

	// Threat level colors
	function getThreatColor(level: string): string {
		switch (level) {
			case 'MINIMAL':
				return 'rgb(34, 197, 94)'; // green
			case 'LOW':
				return 'rgb(59, 130, 246)'; // blue
			case 'ELEVATED':
				return 'rgb(234, 179, 8)'; // yellow
			case 'HIGH':
				return 'rgb(249, 115, 22)'; // orange
			case 'CRITICAL':
				return 'rgb(239, 68, 68)'; // red
			default:
				return 'rgb(156, 163, 175)'; // gray
		}
	}

	// Status based on entropy level (higher entropy = more chaos = worse)
	function getStatusText(entropyScore: number): string {
		if (entropyScore <= 10) return 'ANOMALOUS STABILITY';
		if (entropyScore <= 25) return 'LOW ENTROPY';
		if (entropyScore <= 50) return 'MODERATE CHAOS';
		if (entropyScore <= 75) return 'HIGH ENTROPY';
		return 'MAXIMUM CHAOS';
	}

	function getStatusColor(entropyScore: number): string {
		if (entropyScore <= 25) return 'rgb(34, 197, 94)'; // green - low chaos
		if (entropyScore <= 50) return 'rgb(234, 179, 8)'; // yellow - moderate
		return 'rgb(239, 68, 68)'; // red - high chaos
	}

	// Calculate drift from median
	const driftFromMedian = $derived(
		data.currentBuild ? data.currentBuild.lifespanHours - data.medianLifespanHours : 0
	);
	const driftSign = $derived(driftFromMedian >= 0 ? '+' : '');

	// INVERT stability to entropy (100 = max chaos, 0 = min chaos)
	const entropyScore = $derived(100 - data.stabilityScore);

	// Sigma (σ) = variance/chaos score (inverse of consistency)
	// High consistency = low variance = low sigma
	const sigmaScore = $derived(100 - data.consistencyScore);

	// Deploy forecast - predict when next deploy might happen
	const avgLifespanHours = $derived(data.averageLifespanHours);
	const currentUptimeHours = $derived(liveUptimeMs / (1000 * 60 * 60));
	const hoursUntilAvgExpiry = $derived(Math.max(0, avgLifespanHours - currentUptimeHours));
	const deployRisk = $derived(
		currentUptimeHours >= avgLifespanHours * 1.2
			? 'HIGH'
			: currentUptimeHours >= avgLifespanHours * 0.8
				? 'ELEVATED'
				: 'LOW'
	);
	const deployRiskColor = $derived(
		deployRisk === 'HIGH'
			? 'rgb(239, 68, 68)'
			: deployRisk === 'ELEVATED'
				? 'rgb(234, 179, 8)'
				: 'rgb(34, 197, 94)'
	);
</script>

<svelte:head>
	<title>Azure AI Foundry Entropy Tracker</title>
	<meta
		name="description"
		content="Real-time chaos monitoring for Azure AI Foundry EASTUS2 deployments. Track entropy levels, survival probabilities, and deployment threat assessments."
	/>
	<meta property="og:title" content="Azure AI Foundry Entropy Tracker" />
	<meta
		property="og:description"
		content="Monitoring deployment chaos and build entropy in real-time"
	/>
	<meta property="og:type" content="website" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Azure AI Foundry Entropy Tracker" />
	<meta
		name="twitter:description"
		content="Real-time chaos monitoring for Azure AI Foundry deployments"
	/>
</svelte:head>

<div
	class="relative flex min-h-screen flex-col overflow-hidden bg-neutral-950 p-4 font-mono md:p-6"
	style="--vfd: 233, 114, 37;"
>
	<!-- Scanline overlay -->
	<div
		class="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.3)_2px,rgba(0,0,0,0.3)_4px)]"
	></div>

	<!-- Vignette -->
	<div
		class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]"
	></div>

	<div class="relative z-10 mx-auto w-full max-w-7xl space-y-4">
		<!-- Header bar -->
		<div
			class="grid grid-cols-2 items-center border px-4 py-2 text-sm tracking-wider md:grid-cols-3"
			style="border-color: rgba(var(--vfd), 0.3); background-color: rgba(var(--vfd), 0.05);"
		>
			<span class="vfd-glow-strong" style="color: rgb(var(--vfd));">[ ENTROPY TRACKER ]</span>
			<span
				class="vfd-glow-medium hidden text-center md:block"
				style="color: rgba(var(--vfd), 0.7);">◈ EASTUS2</span
			>
			<span
				class="text-right"
				style="color: rgba(var(--vfd), 0.5);"
				title="Sigma (σ) = variance/chaos score. Higher σ = more unpredictable deploys"
				>CHAOS CORE σ{sigmaScore.toFixed(0)}</span
			>
		</div>

		{#if !data.currentBuild}
			<!-- No data state -->
			<div
				class="border p-12 text-center"
				style="border-color: rgba(var(--vfd), 0.3); background-color: rgba(var(--vfd), 0.03);"
			>
				<p class="text-xl" style="color: rgba(var(--vfd), 0.6);">NO EASTUS2 DATA AVAILABLE</p>
				<p class="mt-2 text-sm" style="color: rgba(var(--vfd), 0.4);">
					Waiting for first build detection...
				</p>
			</div>
		{:else}
			<!-- Main grid layout -->
			<div class="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
				<!-- Left column: Sync Ratio + Stats -->
				<div class="space-y-4 lg:col-span-2">
					<!-- SYNC RATIO - Main display -->
					<div
						class="relative border p-6 md:p-8"
						style="border-color: rgba(var(--vfd), 0.3); background-color: rgba(var(--vfd), 0.03);"
					>
						<!-- Corner accents -->
						<div
							class="absolute top-0 left-0 h-6 w-6 border-t-2 border-l-2"
							style="border-color: rgba(var(--vfd), 0.6);"
						></div>
						<div
							class="absolute top-0 right-0 h-6 w-6 border-t-2 border-r-2"
							style="border-color: rgba(var(--vfd), 0.6);"
						></div>

						<div class="text-center">
							<p
								class="vfd-glow-soft mb-4 text-sm tracking-[0.3em] uppercase"
								style="color: rgba(var(--vfd), 0.6);"
								title="Entropy Index measures chaos level: 0% = maximum stability, 100% = maximum chaos"
							>
								Entropy Index
							</p>

							<!-- The big number -->
							<div class="relative inline-block">
								<!-- Glow layer -->
								<div
									class="absolute inset-0 text-[8rem] leading-none font-bold blur-md select-none md:text-[12rem]"
									style="color: rgba(var(--vfd), {0.3 * pulseIntensity});"
									aria-hidden="true"
								>
									{entropyScore.toFixed(1)}%
								</div>
								<!-- Main number -->
								<div
									class="vfd-glow-multilayer relative text-[8rem] leading-none font-bold tracking-tight md:text-[12rem]"
									style="color: rgb(var(--vfd)); opacity: {pulseIntensity};"
								>
									{entropyScore.toFixed(1)}%
								</div>
							</div>

							<!-- Status text -->
							<div class="mt-4 space-y-1">
								<p
									class="text-lg font-bold tracking-wider"
									style="color: {getStatusColor(
										entropyScore
									)}; text-shadow: 0 0 8px {getStatusColor(entropyScore)};"
								>
									{getStatusText(entropyScore)}
								</p>
								<p
									class="text-sm"
									style="color: rgba(var(--vfd), 0.5);"
									title="Current build ranks in the {data.percentileRank.toFixed(
										0
									)}th percentile of all builds, {driftSign}{(driftFromMedian / 24).toFixed(
										1
									)} days from median lifespan"
								>
									{data.percentileRank.toFixed(0)}th PERCENTILE // {driftSign}{(
										driftFromMedian / 24
									).toFixed(1)}d DEVIATION
								</p>
							</div>
						</div>
					</div>

					<!-- Stats grid -->
					<div class="grid grid-cols-2 gap-4 md:grid-cols-3">
						<!-- Current uptime (LIVE) -->
						<div
							class="border px-3 py-2"
							style="border-color: rgba(var(--vfd), 0.3); background-color: rgba(var(--vfd), 0.03);"
						>
							<p
								class="mb-1 flex items-center gap-1 text-[10px] tracking-widest uppercase"
								style="color: rgba(var(--vfd), 0.4);"
								title="Live uptime counter for the current build"
							>
								Uptime
								<span
									class="h-1 w-1 animate-pulse rounded-full"
									style="background-color: rgb(34, 197, 94); box-shadow: 0 0 4px rgb(34, 197, 94);"
								></span>
							</p>
							<p
								class="vfd-glow-panel font-mono text-sm font-bold md:text-base"
								style="color: rgb(var(--vfd));"
							>
								{formatLiveUptime(liveUptimeMs)}
							</p>
						</div>

						<!-- Median lifespan -->
						<div
							class="border px-3 py-2"
							style="border-color: rgba(var(--vfd), 0.3); background-color: rgba(var(--vfd), 0.03);"
						>
							<p
								class="mb-1 text-[10px] tracking-widest uppercase"
								style="color: rgba(var(--vfd), 0.4);"
								title="Median build lifespan across all historical builds"
							>
								Median
							</p>
							<p
								class="vfd-glow-panel text-base font-bold md:text-lg"
								style="color: rgb(var(--vfd));"
							>
								{formatDuration(data.medianLifespanHours)}
							</p>
						</div>

						<!-- Consistency -->
						<div
							class="border px-3 py-2"
							style="border-color: rgba(var(--vfd), 0.3); background-color: rgba(var(--vfd), 0.03);"
						>
							<p
								class="mb-1 text-[10px] tracking-widest uppercase"
								style="color: rgba(var(--vfd), 0.4);"
								title="Build lifespan consistency (100% = very predictable, 0% = highly chaotic)"
							>
								Consistency
							</p>
							<p
								class="vfd-glow-panel text-base font-bold md:text-lg"
								style="color: rgb(var(--vfd));"
							>
								{data.consistencyScore.toFixed(0)}%
							</p>
						</div>
					</div>

					<!-- Extended stats grid -->
					<div class="grid grid-cols-2 gap-4">
						<!-- Total uptime -->
						<div
							class="border px-3 py-2"
							style="border-color: rgba(var(--vfd), 0.3); background-color: rgba(var(--vfd), 0.03);"
						>
							<p
								class="mb-1 text-[10px] tracking-widest uppercase"
								style="color: rgba(var(--vfd), 0.4);"
								title="Combined uptime of all builds tracked"
							>
								Total Uptime
							</p>
							<p
								class="vfd-glow-panel text-base font-bold md:text-lg"
								style="color: rgb(var(--vfd));"
							>
								{formatDuration(data.totalUptimeHours)}
							</p>
						</div>

						<!-- Deploy frequency -->
						<div
							class="border px-3 py-2"
							style="border-color: rgba(var(--vfd), 0.3); background-color: rgba(var(--vfd), 0.03);"
						>
							<p
								class="mb-1 text-[10px] tracking-widest uppercase"
								style="color: rgba(var(--vfd), 0.4);"
								title="Average deployment frequency (deploys per day)"
							>
								Deploy/Day
							</p>
							<p
								class="vfd-glow-panel text-base font-bold md:text-lg"
								style="color: rgb(var(--vfd));"
							>
								{data.deploysPerDay.toFixed(2)}
							</p>
						</div>
					</div>

					<!-- Survival Probability Panel -->
					<div
						class="border"
						style="border-color: rgba(var(--vfd), 0.3); background-color: rgba(var(--vfd), 0.03);"
					>
						<div
							class="flex items-center gap-2 border-b px-4 py-2"
							style="border-color: rgba(var(--vfd), 0.3);"
						>
							<span class="vfd-glow-strong" style="color: rgb(var(--vfd));">◈</span>
							<span
								class="text-sm tracking-wider uppercase"
								style="color: rgba(var(--vfd), 0.6);"
								title="Historical probability that builds survive to specific hour milestones"
								>Chaos Survival Matrix</span
							>
						</div>

						<div class="grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
							{#each data.survivalProbabilities as prob}
								<div class="text-center">
									<div
										class="mb-2 text-2xl font-bold"
										style="color: {getProbabilityColor(
											prob.probability
										)}; text-shadow: 0 0 8px {getProbabilityColor(prob.probability)};"
									>
										{(prob.probability * 100).toFixed(0)}%
									</div>
									<div class="text-xs" style="color: rgba(var(--vfd), 0.5);">
										{prob.hours}h
									</div>
									<div class="mt-1 h-1 w-full overflow-hidden rounded-full bg-neutral-900">
										<div
											class="h-full transition-all"
											style="width: {prob.probability *
												100}%; background-color: {getProbabilityColor(
												prob.probability
											)}; box-shadow: 0 0 6px {getProbabilityColor(prob.probability)};"
										></div>
									</div>
								</div>
							{/each}
						</div>
					</div>

					<!-- Deploy Forecast -->
					<div
						class="border p-4"
						style="border-color: rgba(var(--vfd), 0.3); background-color: rgba(var(--vfd), 0.03);"
					>
						<div class="mb-4 flex items-center justify-between">
							<p
								class="text-sm tracking-wider uppercase"
								style="color: rgba(var(--vfd), 0.6);"
								title="Predicted time until next deploy based on historical average lifespan"
							>
								Chaos Incoming
							</p>
							<span
								class="rounded px-2 py-0.5 text-xs font-bold tracking-wide"
								style="color: {deployRiskColor}; background-color: {deployRiskColor}20; border: 1px solid {deployRiskColor}; box-shadow: 0 0 6px {deployRiskColor}40;"
							>
								{deployRisk} RISK
							</span>
						</div>

						<div class="mb-4 text-center">
							{#if hoursUntilAvgExpiry > 0}
								<div class="mb-1 text-xs" style="color: rgba(var(--vfd), 0.5);">Expected in</div>
								<div
									class="font-mono text-3xl font-bold"
									style="color: {deployRiskColor}; text-shadow: 0 0 8px {deployRiskColor};"
								>
									{formatLiveUptime(hoursUntilAvgExpiry * 3600 * 1000)}
								</div>
							{:else}
								<div class="mb-1 text-xs" style="color: rgba(var(--vfd), 0.5);">
									Beyond average lifespan
								</div>
								<div
									class="text-2xl font-bold"
									style="color: rgb(239, 68, 68); text-shadow: 0 0 8px rgb(239, 68, 68);"
								>
									OVERDUE
								</div>
								<div class="mt-1 text-sm" style="color: rgba(var(--vfd), 0.6);">
									+{formatDuration(Math.abs(hoursUntilAvgExpiry))}
								</div>
							{/if}
						</div>

						<!-- Progress bar showing current uptime vs average -->
						<div class="mb-2">
							<div
								class="mb-1 flex justify-between text-[10px]"
								style="color: rgba(var(--vfd), 0.5);"
							>
								<span>Current</span>
								<span>Avg: {formatDuration(avgLifespanHours)}</span>
							</div>
							<div class="h-2 w-full overflow-hidden rounded-full bg-neutral-900">
								<div
									class="h-full transition-all duration-1000"
									style="width: {Math.min(
										100,
										(currentUptimeHours / avgLifespanHours) * 100
									)}%; background-color: {deployRiskColor}; box-shadow: 0 0 8px {deployRiskColor};"
								></div>
							</div>
						</div>

						<div class="text-xs" style="color: rgba(var(--vfd), 0.4);">
							Based on {data.totalBuilds} build average
						</div>
					</div>

					<!-- Current build info -->
					<div
						class="border px-4 py-3"
						style="border-color: rgba(var(--vfd), 0.3); background-color: rgba(var(--vfd), 0.03);"
					>
						<div class="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
							<div>
								<span style="color: rgba(var(--vfd), 0.4);">BUILD:</span>
								<span class="ml-2 font-bold" style="color: rgb(var(--vfd));"
									>{formatBuildNumber(data.currentBuild.buildNumber)}</span
								>
							</div>
							<div>
								<span style="color: rgba(var(--vfd), 0.4);">MANIFEST:</span>
								<span class="ml-2 font-bold" style="color: rgb(var(--vfd));"
									>{data.currentBuild.manifestHash}</span
								>
							</div>
							<div>
								<span style="color: rgba(var(--vfd), 0.4);">DEPLOYED:</span>
								<span class="ml-2" style="color: rgba(var(--vfd), 0.7);"
									>{formatDateTime(data.currentBuild.firstSeenAt)}</span
								>
							</div>
							<div>
								<span style="color: rgba(var(--vfd), 0.4);">LAST SEEN:</span>
								<span class="ml-2" style="color: rgba(var(--vfd), 0.7);"
									>{formatDateTime(data.currentBuild.lastSeenAt)}</span
								>
							</div>
						</div>
					</div>
				</div>

				<!-- Right column: Threat assessment + warnings -->
				<div class="flex h-full flex-col gap-4">
					<!-- Threat level -->
					<div
						class="relative border p-6"
						style="border-color: rgba(var(--vfd), 0.3); background-color: rgba(var(--vfd), 0.03);"
					>
						<div
							class="absolute top-0 right-0 h-4 w-4 border-t-2 border-r-2"
							style="border-color: rgba(var(--vfd), 0.6);"
						></div>

						<p
							class="mb-4 text-sm tracking-[0.2em] uppercase"
							style="color: rgba(var(--vfd), 0.5);"
							title="Deployment frequency threat level based on recent deploy patterns"
						>
							Entropy Threat Level
						</p>

						<!-- Threat level indicator -->
						<div class="mb-3">
							<div
								class="text-3xl font-bold tracking-wide"
								style="color: {getThreatColor(
									data.threatLevel
								)}; text-shadow: 0 0 12px {getThreatColor(data.threatLevel)};"
							>
								{data.threatLevel}
							</div>
						</div>

						<!-- Threat bars (fills from bottom to top) -->
						<div class="space-y-1.5">
							{#each ['CRITICAL', 'HIGH', 'ELEVATED', 'LOW', 'MINIMAL'] as level, i}
								{@const levelIndex = ['MINIMAL', 'LOW', 'ELEVATED', 'HIGH', 'CRITICAL'].indexOf(
									level
								)}
								{@const currentIndex = ['MINIMAL', 'LOW', 'ELEVATED', 'HIGH', 'CRITICAL'].indexOf(
									data.threatLevel
								)}
								{@const isActive = levelIndex <= currentIndex}
								<div class="flex items-center gap-2">
									<div
										class="h-1.5 flex-1"
										style="background-color: {isActive
											? getThreatColor(level)
											: 'rgba(var(--vfd), 0.1)'}; box-shadow: {isActive
											? `0 0 6px ${getThreatColor(level)}`
											: 'none'};"
									></div>
									<span
										class="w-16 text-[10px] tracking-wider"
										style="color: {isActive ? getThreatColor(level) : 'rgba(var(--vfd), 0.3)'};"
									>
										{level}
									</span>
								</div>
							{/each}
						</div>

						<div class="mt-4 space-y-1 text-xs" style="color: rgba(var(--vfd), 0.5);">
							<p>LAST DEPLOY: {formatDuration(data.hoursSinceLastDeploy)} AGO</p>
							<p>TRACKING: {data.totalBuilds} BUILDS</p>
						</div>
					</div>

					<!-- System alerts -->
					<div
						class="border p-4"
						style="border-color: rgba(var(--vfd), 0.3); background-color: rgba(var(--vfd), 0.03);"
					>
						<div class="mb-3 flex items-center gap-2">
							<span
								class="h-2 w-2 animate-pulse rounded-full"
								style="background-color: {getStatusColor(
									entropyScore
								)}; box-shadow: 0 0 8px {getStatusColor(entropyScore)};"
							></span>
							<span
								class="text-sm tracking-wider uppercase"
								style="color: rgba(var(--vfd), 0.6);"
								title="Active chaos and anomaly alerts based on current system state"
								>Entropy Alerts</span
							>
						</div>

						<div class="space-y-2 text-xs">
							{#if entropyScore <= 10}
								<div class="flex gap-2" title="Entropy ≤10% - Build showing exceptional stability">
									<span style="color: rgb(34, 197, 94);">▲</span>
									<span style="color: rgba(var(--vfd), 0.7);">Anomalous stability detected</span>
								</div>
							{/if}

							{#if data.currentBuild.lifespanHours > data.longestBuild?.lifespanHours * 0.9}
								<div class="flex gap-2">
									<span style="color: rgb(234, 179, 8);">▲</span>
									<span style="color: rgba(var(--vfd), 0.7);">Build defying entropy curve</span>
								</div>
							{/if}

							{#if data.threatLevel === 'HIGH' || data.threatLevel === 'CRITICAL'}
								<div class="flex gap-2">
									<span style="color: rgb(239, 68, 68);">▲</span>
									<span style="color: rgba(var(--vfd), 0.7);">Chaos frequency critical</span>
								</div>
							{/if}

							{#if data.currentBuild.lifespanHours < data.medianLifespanHours * 0.5}
								<div class="flex gap-2">
									<span style="color: rgb(249, 115, 22);">▲</span>
									<span style="color: rgba(var(--vfd), 0.7);">High entropy detected</span>
								</div>
							{/if}

							{#if hoursUntilAvgExpiry < 0}
								<div class="flex gap-2">
									<span style="color: rgb(239, 68, 68);">▲</span>
									<span style="color: rgba(var(--vfd), 0.7);">Build exceeded average lifespan</span>
								</div>
							{/if}

							{#if sigmaScore > 75}
								<div class="flex gap-2" title="σ >75 - Build lifespans are highly unpredictable">
									<span style="color: rgb(249, 115, 22);">▲</span>
									<span style="color: rgba(var(--vfd), 0.7);"
										>High variance detected (σ{sigmaScore.toFixed(0)})</span
									>
								</div>
							{/if}

							{#if data.consistencyScore < 30}
								<div
									class="flex gap-2"
									title="Consistency <30% - Deploy timing is extremely unpredictable"
								>
									<span style="color: rgb(234, 179, 8);">▲</span>
									<span style="color: rgba(var(--vfd), 0.7);">Deploy pattern highly irregular</span>
								</div>
							{/if}

							{#if entropyScore > 10 && data.threatLevel !== 'HIGH' && data.threatLevel !== 'CRITICAL' && !(hoursUntilAvgExpiry < 0) && !(sigmaScore > 75) && !(data.consistencyScore < 30)}
								<div class="flex gap-2">
									<span style="color: rgba(var(--vfd), 0.4);">○</span>
									<span style="color: rgba(var(--vfd), 0.5);">Entropy within parameters</span>
								</div>
							{/if}
						</div>
					</div>

					<!-- Historical Records -->
					<div
						class="border p-4"
						style="border-color: rgba(var(--vfd), 0.3); background-color: rgba(var(--vfd), 0.03);"
					>
						<p
							class="mb-3 text-sm tracking-wider uppercase"
							style="color: rgba(var(--vfd), 0.6);"
							title="Longest, shortest, and average build lifespans from all tracked builds"
						>
							Historical Records
						</p>

						<div class="space-y-1.5 text-xs">
							<div class="flex justify-between">
								<span style="color: rgba(var(--vfd), 0.5);">Longest:</span>
								<span style="color: rgba(var(--vfd), 0.7);"
									>{formatDuration(data.longestBuild?.lifespanHours ?? 0)}</span
								>
							</div>
							<div class="flex justify-between">
								<span style="color: rgba(var(--vfd), 0.5);">Shortest:</span>
								<span style="color: rgba(var(--vfd), 0.7);"
									>{formatDuration(data.shortestBuild?.lifespanHours ?? 0)}</span
								>
							</div>
							<div class="flex justify-between">
								<span style="color: rgba(var(--vfd), 0.5);">Average:</span>
								<span style="color: rgba(var(--vfd), 0.7);"
									>{formatDuration(data.averageLifespanHours)}</span
								>
							</div>
						</div>
					</div>

					<!-- Build Comparison -->
					{#if data.previousBuild}
						{@const diff = data.currentBuild.lifespanHours - data.previousBuild.lifespanHours}
						{@const diffSign = diff >= 0 ? '+' : ''}
						<div
							class="border p-4"
							style="border-color: rgba(var(--vfd), 0.3); background-color: rgba(var(--vfd), 0.03);"
						>
							<p
								class="mb-3 text-sm tracking-wider uppercase"
								style="color: rgba(var(--vfd), 0.6);"
							>
								Current vs Previous
							</p>

							<div class="space-y-2 text-xs">
								<div>
									<div class="mb-0.5 flex justify-between">
										<span style="color: rgba(var(--vfd), 0.5);">Lifespan Change:</span>
										<span style="color: {diff >= 0 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'};">
											{diffSign}{formatDuration(Math.abs(diff))}
										</span>
									</div>
								</div>

								<div class="text-[10px]" style="color: rgba(var(--vfd), 0.4);">
									Prev: {formatBuildNumber(data.previousBuild.buildNumber)}
								</div>
							</div>
						</div>
					{/if}

					<!-- Statistical Confidence -->
					<div
						class="flex flex-1 flex-col justify-center border p-4"
						style="border-color: rgba(var(--vfd), 0.3); background-color: rgba(var(--vfd), 0.03);"
					>
						<p
							class="mb-4 text-center text-sm tracking-wider uppercase"
							style="color: rgba(var(--vfd), 0.6);"
							title="Statistical reliability based on sample size (20+ builds = 100% confidence)"
						>
							Data Confidence
						</p>

						<div class="text-center">
							<div
								class="mb-2 text-4xl font-bold"
								style="color: rgb(var(--vfd)); text-shadow: 0 0 12px rgba(var(--vfd), 0.6);"
							>
								{Math.min(100, (data.totalBuilds / 20) * 100).toFixed(0)}%
							</div>
							<div class="mb-3 text-xs" style="color: rgba(var(--vfd), 0.5);">
								Statistical Reliability
							</div>
							<div class="h-1.5 w-full overflow-hidden rounded-full bg-neutral-900">
								<div
									class="h-full transition-all"
									style="width: {Math.min(
										100,
										(data.totalBuilds / 20) * 100
									)}%; background-color: rgb(var(--vfd)); box-shadow: 0 0 8px rgba(var(--vfd), 0.6);"
								></div>
							</div>
							<div class="mt-3 text-[10px]" style="color: rgba(var(--vfd), 0.4);">
								{data.totalBuilds} / 20 samples
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Build history log -->
			<div
				class="border"
				style="border-color: rgba(var(--vfd), 0.3); background-color: rgba(var(--vfd), 0.03);"
			>
				<div
					class="flex items-center gap-2 border-b px-4 py-2"
					style="border-color: rgba(var(--vfd), 0.3);"
				>
					<span class="vfd-glow-strong" style="color: rgb(var(--vfd));">▌</span>
					<span class="text-sm tracking-wider uppercase" style="color: rgba(var(--vfd), 0.6);"
						>Entropy Timeline // Recent 10</span
					>
				</div>

				<div class="overflow-x-auto p-4 text-sm">
					<div class="space-y-1.5">
						{#each data.recentBuilds as build, i}
							{@const isCurrent = i === 0}
							<div
								class="flex flex-wrap items-center gap-x-3 gap-y-1 py-1"
								style="border-left: 2px solid {isCurrent
									? 'rgb(var(--vfd))'
									: 'rgba(var(--vfd), 0.2)'}; padding-left: 12px;"
							>
								<span
									class="font-mono font-bold"
									style="color: {isCurrent ? 'rgb(var(--vfd))' : 'rgba(var(--vfd), 0.6)'};"
								>
									{formatBuildNumber(build.buildNumber)}
								</span>
								<span style="color: rgba(var(--vfd), 0.4);">│</span>
								<span style="color: rgba(var(--vfd), 0.5);">{build.manifestHash}</span>
								<span style="color: rgba(var(--vfd), 0.4);">│</span>
								<span style="color: rgba(var(--vfd), 0.6);"
									>{formatDuration(build.lifespanHours)}</span
								>
								{#if isCurrent && build.isActive}
									<span style="color: rgb(34, 197, 94); text-shadow: 0 0 6px rgb(34, 197, 94);"
										>*ACTIVE</span
									>
								{/if}
								<span class="text-xs" style="color: rgba(var(--vfd), 0.4);"
									>{formatDateTime(build.firstSeenAt)}</span
								>
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}

		<!-- Footer -->
		<div class="flex items-center justify-center gap-2 pb-4 text-sm tracking-wider uppercase">
			<span
				class="h-2 w-2 animate-pulse rounded-full"
				style="background-color: rgb(var(--vfd)); box-shadow: 0 0 8px rgba(var(--vfd), 0.8);"
			></span>
			<span style="color: rgba(var(--vfd), 0.5);">ENTROPY MONITORING ACTIVE</span>
		</div>
	</div>

	<!-- CRT glitch interference overlay -->
	<div class="glitch-bands pointer-events-none absolute inset-0 overflow-hidden"></div>
</div>

<style>
	/* Chromatic aberration VFD glow utilities */
	.vfd-glow-strong {
		text-shadow:
			var(--chroma-r, 0px) 0 rgba(255, 0, 64, var(--chroma-opacity, 0)),
			var(--chroma-c, 0px) 0 rgba(0, 255, 255, var(--chroma-opacity, 0)),
			0 0 8px rgba(var(--vfd), 0.6);
	}

	.vfd-glow-medium {
		text-shadow:
			var(--chroma-r, 0px) 0 rgba(255, 0, 64, var(--chroma-opacity, 0)),
			var(--chroma-c, 0px) 0 rgba(0, 255, 255, var(--chroma-opacity, 0)),
			0 0 6px rgba(var(--vfd), 0.4);
	}

	.vfd-glow-soft {
		text-shadow:
			var(--chroma-r, 0px) 0 rgba(255, 0, 64, var(--chroma-opacity, 0)),
			var(--chroma-c, 0px) 0 rgba(0, 255, 255, var(--chroma-opacity, 0)),
			0 0 10px rgba(var(--vfd), 0.3);
	}

	.vfd-glow-multilayer {
		text-shadow:
			var(--chroma-r, 0px) 0 rgba(255, 0, 64, var(--chroma-opacity, 0)),
			var(--chroma-c, 0px) 0 rgba(0, 255, 255, var(--chroma-opacity, 0)),
			0 0 20px rgba(var(--vfd), 0.8),
			0 0 40px rgba(var(--vfd), 0.4),
			0 0 80px rgba(var(--vfd), 0.2);
	}

	.vfd-glow-panel {
		text-shadow:
			var(--chroma-r, 0px) 0 rgba(255, 0, 64, var(--chroma-opacity, 0)),
			var(--chroma-c, 0px) 0 rgba(0, 255, 255, var(--chroma-opacity, 0)),
			0 0 8px rgba(var(--vfd), 0.5);
	}

	@keyframes display-glitch {
		0%,
		100% {
			transform: none;
			filter: none;
			opacity: 1;
		}
		5%,
		84% {
			transform: none;
			filter: none;
			opacity: 1;
		}
		85% {
			transform: translateX(-4px);
			filter: contrast(1.15) brightness(1.05);
			opacity: 1;
		}
		85.5% {
			transform: translateX(6px);
			opacity: 0.9;
		}
		86% {
			transform: translateX(-2px);
			filter: contrast(0.95) brightness(1.1);
			opacity: 1;
		}
		86.5% {
			transform: translateX(3px);
			opacity: 0.95;
		}
		87% {
			transform: translateX(-5px);
			filter: contrast(1.1);
			opacity: 1;
		}
		87.5% {
			transform: translateX(0);
			opacity: 0.85;
		}
		88% {
			transform: translateX(2px);
			filter: brightness(1.08);
			opacity: 1;
		}
		88.5% {
			transform: translateX(-1px);
			opacity: 1;
		}
		89% {
			transform: none;
			filter: contrast(1.05);
			opacity: 1;
		}
		90% {
			transform: none;
			filter: none;
			opacity: 1;
		}
	}

	@keyframes chromatic-aberration {
		0%,
		100% {
			--chroma-r: 0px;
			--chroma-c: 0px;
			--chroma-opacity: 0;
		}
		5%,
		84% {
			--chroma-r: 0px;
			--chroma-c: 0px;
			--chroma-opacity: 0;
		}
		85% {
			--chroma-r: -2px;
			--chroma-c: 2px;
			--chroma-opacity: 0.75;
		}
		85.5% {
			--chroma-r: 3px;
			--chroma-c: -3px;
			--chroma-opacity: 0.75;
		}
		86% {
			--chroma-r: -4px;
			--chroma-c: 4px;
			--chroma-opacity: 0.75;
		}
		86.5% {
			--chroma-r: 2px;
			--chroma-c: -2px;
			--chroma-opacity: 0.75;
		}
		87% {
			--chroma-r: -3px;
			--chroma-c: 3px;
			--chroma-opacity: 0.75;
		}
		87.5% {
			--chroma-r: 1px;
			--chroma-c: -1px;
			--chroma-opacity: 0.75;
		}
		88% {
			--chroma-r: -2px;
			--chroma-c: 2px;
			--chroma-opacity: 0.75;
		}
		88.5% {
			--chroma-r: 1px;
			--chroma-c: -1px;
			--chroma-opacity: 0.75;
		}
		89% {
			--chroma-r: -1px;
			--chroma-c: 1px;
			--chroma-opacity: 0.75;
		}
		90% {
			--chroma-r: 0px;
			--chroma-c: 0px;
			--chroma-opacity: 0;
		}
	}

	@keyframes scan-interference {
		0%,
		84% {
			transform: translateY(-100%);
			opacity: 0;
		}
		85% {
			transform: translateY(0%);
			opacity: 0.3;
		}
		86% {
			transform: translateY(20%);
			opacity: 0.5;
		}
		87% {
			transform: translateY(40%);
			opacity: 0.4;
		}
		88% {
			transform: translateY(60%);
			opacity: 0.6;
		}
		89% {
			transform: translateY(80%);
			opacity: 0.3;
		}
		90%,
		100% {
			transform: translateY(100%);
			opacity: 0;
		}
	}

	:global(.glitch-bands::before),
	:global(.glitch-bands::after) {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		height: 3px;
		background: linear-gradient(
			to bottom,
			transparent,
			rgba(233, 114, 37, 0.4) 40%,
			rgba(233, 114, 37, 0.6) 50%,
			rgba(233, 114, 37, 0.4) 60%,
			transparent
		);
		box-shadow: 0 0 8px rgba(233, 114, 37, 0.5);
		animation: scan-interference 12s steps(1) infinite;
	}

	:global(.glitch-bands::after) {
		height: 2px;
		background: linear-gradient(to bottom, transparent, rgba(233, 114, 37, 0.3) 50%, transparent);
		animation-delay: 0.5s;
	}

	:global(.relative.z-10) {
		animation:
			display-glitch 12s steps(1) infinite,
			chromatic-aberration 12s steps(1) infinite;
	}

	@media (prefers-reduced-motion: reduce) {
		:global(.relative.z-10) {
			animation: none;
		}
		:global(.glitch-bands::before),
		:global(.glitch-bands::after) {
			animation: none;
			opacity: 0;
		}
	}
</style>
