<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Derived values from data (static for prerendered page)
	const days = $derived(data.days);
	const latestBuild = $derived(data.latestBuild);
	const changeType = $derived(data.changeType);
	const checks = $derived(data.checks);
	const lastUpdatedAt = $derived(data.lastUpdatedAt);

	function formatDateTime(iso: string): string {
		const d = new Date(iso);
		const year = d.getUTCFullYear();
		const month = String(d.getUTCMonth() + 1).padStart(2, '0');
		const day = String(d.getUTCDate()).padStart(2, '0');
		const hour = String(d.getUTCHours()).padStart(2, '0');
		const min = String(d.getUTCMinutes()).padStart(2, '0');
		const sec = String(d.getUTCSeconds()).padStart(2, '0');
		return `${year}.${month}.${day} // ${hour}:${min}:${sec}Z`;
	}

	function formatLogTime(iso: string): string {
		const d = new Date(iso);
		return d.toLocaleString('en-US', {
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false
		});
	}

	function shortBuild(build: string): string {
		// "AiFoundry-2026-Jan-13-2026-01-23.4" → "Jan-23.4"
		const match = build.match(/(\w+-\d+\.\d+)$/);
		return match?.[1] ?? build;
	}
</script>

<svelte:head>
	<title>Days Since Last Foundry Build</title>
</svelte:head>

<div
	class="min-h-screen bg-neutral-950 font-mono flex items-center justify-center p-4 relative overflow-hidden"
	style="--vfd: 233, 114, 37;"
>
	<!-- Scanline overlay -->
	<div class="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.3)_2px,rgba(0,0,0,0.3)_4px)]"></div>

	<!-- Subtle vignette -->
	<div class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]"></div>

	<div class="relative z-10 w-full max-w-4xl">
		<!-- Top status bar -->
		<div
			class="border px-4 py-2 flex justify-between items-center text-xs uppercase tracking-wider mb-6"
			style="border-color: rgba(var(--vfd), 0.3); background-color: rgba(var(--vfd), 0.05);"
		>
			<span style="color: rgb(var(--vfd)); text-shadow: 0 0 8px rgba(var(--vfd), 0.6);">[ SYSTEM MONITOR ]</span>
			<span style="color: rgba(var(--vfd), 0.5);">AZURE AI FOUNDRY BUILD TRACKER v0.1</span>
		</div>

		<!-- Main display -->
		<div
			class="p-8 md:p-12 relative border"
			style="border-color: rgba(var(--vfd), 0.3); background-color: rgba(var(--vfd), 0.03);"
		>
			<!-- Corner accents -->
			<div class="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2" style="border-color: rgba(var(--vfd), 0.6);"></div>
			<div class="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2" style="border-color: rgba(var(--vfd), 0.6);"></div>
			<div class="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2" style="border-color: rgba(var(--vfd), 0.6);"></div>
			<div class="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2" style="border-color: rgba(var(--vfd), 0.6);"></div>

			<div class="text-center">
				<p
					class="text-sm uppercase tracking-[0.3em] mb-4"
					style="color: rgba(var(--vfd), 0.6); text-shadow: 0 0 10px rgba(var(--vfd), 0.3);"
				>
					Days Since Last Build
				</p>

				<!-- VFD-style number display -->
				<div class="relative inline-block">
					<!-- Glow layer (behind) -->
					<div
						class="absolute inset-0 text-[10rem] md:text-[14rem] font-bold leading-none blur-md select-none"
						style="color: rgba(var(--vfd), 0.3);"
						aria-hidden="true"
					>
						{days.toString().padStart(3, '0')}
					</div>
					<!-- Main number -->
					<div
						class="relative text-[10rem] md:text-[14rem] font-bold leading-none tracking-tight"
						style="color: rgb(var(--vfd)); text-shadow: 0 0 20px rgba(var(--vfd), 0.8), 0 0 40px rgba(var(--vfd), 0.4), 0 0 80px rgba(var(--vfd), 0.2);"
					>
						{days.toString().padStart(3, '0')}
					</div>
				</div>

				<p
					class="text-sm uppercase tracking-[0.2em] mt-4"
					style="color: rgba(var(--vfd), 0.6); text-shadow: 0 0 10px rgba(var(--vfd), 0.3);"
				>
					{days === 1 ? 'Day' : 'Days'} Elapsed
				</p>
			</div>
		</div>

		<!-- Bottom info panels -->
		<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
			<!-- Build info -->
			<div
				class="border px-4 py-3"
				style="border-color: rgba(var(--vfd), 0.3); background-color: rgba(var(--vfd), 0.03);"
			>
				<p class="text-[10px] uppercase tracking-widest mb-1" style="color: rgba(var(--vfd), 0.4);">Latest Build</p>
				<p class="text-sm font-bold" style="color: rgb(var(--vfd)); text-shadow: 0 0 8px rgba(var(--vfd), 0.5);">{latestBuild.buildNumber}</p>
			</div>

			<!-- Manifest hash -->
			<div
				class="border px-4 py-3"
				style="border-color: rgba(var(--vfd), 0.3); background-color: rgba(var(--vfd), 0.03);"
			>
				<p class="text-[10px] uppercase tracking-widest mb-1" style="color: rgba(var(--vfd), 0.4);">Manifest Hash</p>
				<p class="text-lg font-bold tracking-widest" style="color: rgb(var(--vfd)); text-shadow: 0 0 8px rgba(var(--vfd), 0.5);">{latestBuild.manifestHash}</p>
			</div>

			<!-- Last check -->
			<div
				class="border px-4 py-3"
				style="border-color: rgba(var(--vfd), 0.3); background-color: rgba(var(--vfd), 0.03);"
			>
				<p class="text-[10px] uppercase tracking-widest mb-1" style="color: rgba(var(--vfd), 0.4);">Last Check</p>
				<p class="text-sm font-bold" style="color: rgb(var(--vfd)); text-shadow: 0 0 8px rgba(var(--vfd), 0.5);">{formatDateTime(lastUpdatedAt)}</p>
			</div>
		</div>

		<!-- Change indicator -->
		<div class="mt-6 flex items-center justify-center gap-4 text-xs uppercase tracking-wider">
			<span style="color: rgba(var(--vfd), 0.4);">Last Change:</span>
			<span
				style="color: {changeType === 'build' || changeType === 'both' ? 'rgb(var(--vfd))' : 'rgba(var(--vfd), 0.2)'}; text-shadow: {changeType === 'build' || changeType === 'both' ? '0 0 8px rgba(var(--vfd), 0.6)' : 'none'};"
			>
				▲ BUILD
			</span>
			<span
				style="color: {changeType === 'hash' || changeType === 'both' ? 'rgb(var(--vfd))' : 'rgba(var(--vfd), 0.2)'}; text-shadow: {changeType === 'hash' || changeType === 'both' ? '0 0 8px rgba(var(--vfd), 0.6)' : 'none'};"
			>
				▲ MANIFEST
			</span>
		</div>

		<!-- System Log -->
		<div
			class="mt-6 border"
			style="border-color: rgba(var(--vfd), 0.3); background-color: rgba(var(--vfd), 0.03);"
		>
			<div
				class="px-4 py-2 border-b flex items-center gap-2"
				style="border-color: rgba(var(--vfd), 0.3);"
			>
				<span style="color: rgb(var(--vfd)); text-shadow: 0 0 8px rgba(var(--vfd), 0.6);">▌</span>
				<span class="text-xs uppercase tracking-wider" style="color: rgba(var(--vfd), 0.6);">System Log</span>
			</div>
			<div class="p-4 text-xs max-h-48 overflow-y-auto">
				{#if checks.length === 0}
					<div style="color: rgba(var(--vfd), 0.4);">No check history available yet.</div>
				{:else}
					{#each checks as check}
						<div class="flex gap-3 py-0.5">
							<span style="color: rgba(var(--vfd), 0.4);">[{formatLogTime(check.checkedAt)}]</span>
							<span
								style="color: {check.status === 'ok' ? 'rgb(var(--vfd))' : 'rgb(220, 38, 38)'}; text-shadow: {check.status === 'ok' ? '0 0 6px rgba(var(--vfd), 0.5)' : '0 0 6px rgba(220, 38, 38, 0.5)'};"
							>
								{check.status.toUpperCase().padEnd(3)}
							</span>
							{#if check.buildNumber}
								<span style="color: rgba(var(--vfd), 0.7);">build={shortBuild(check.buildNumber)}</span>
							{/if}
							{#if check.manifestHash}
								<span style="color: rgba(var(--vfd), 0.5);">hash={check.manifestHash}</span>
							{/if}
							{#if check.isNewBuild}
								<span style="color: rgb(var(--vfd)); text-shadow: 0 0 8px rgba(var(--vfd), 0.8);">★ NEW</span>
							{/if}
							{#if check.errorMessage}
								<span style="color: rgba(220, 38, 38, 0.7);">{check.errorMessage}</span>
							{/if}
						</div>
					{/each}
				{/if}
			</div>
		</div>

		<!-- Status indicator -->
		<div class="mt-4 flex items-center justify-center gap-2 text-xs uppercase tracking-wider">
			<span
				class="w-2 h-2 rounded-full animate-pulse"
				style="background-color: rgb(var(--vfd)); box-shadow: 0 0 8px rgba(var(--vfd), 0.8);"
			></span>
			<span style="color: rgba(var(--vfd), 0.5);">Monitoring Active</span>
		</div>
	</div>
</div>
