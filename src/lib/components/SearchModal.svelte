<script lang="ts">
	import { tick } from "svelte"
	import { fade, scale } from "svelte/transition"
	import { page } from "$app/state"
	import { goto } from "$app/navigation"
	import { t } from "$lib/i18n"
	import Icon from "$lib/components/Icon.svelte"
	import { searchClient } from "$lib/search/searchClient.svelte"
	import type { SearchContext, SearchResult } from "$lib/search/types"

	let { open = $bindable(), lang = "it" }: { open: boolean; lang?: string } =
		$props()

	let query = $state("")
	let results = $state<SearchResult[]>([])
	let selected = $state(0)
	let inputEl = $state<HTMLInputElement | null>(null)
	let listEl = $state<HTMLUListElement | null>(null)

	// Throttle (live updates while typing — leading + trailing, not debounced).
	const THROTTLE_MS = 80
	let throttleTimer: ReturnType<typeof setTimeout> | null = null
	let lastRun = 0
	let searchToken = 0

	// Delay the spinner so a fast search (< 300ms) never flashes one.
	const SPINNER_DELAY = 300
	let showSpinner = $state(false)
	let spinnerTimer: ReturnType<typeof setTimeout> | null = null
	$effect(() => {
		if (searchClient.searching) {
			if (!spinnerTimer && !showSpinner) {
				spinnerTimer = setTimeout(() => {
					showSpinner = true
					spinnerTimer = null
				}, SPINNER_DELAY)
			}
		} else {
			if (spinnerTimer) {
				clearTimeout(spinnerTimer)
				spinnerTimer = null
			}
			showSpinner = false
		}
	})
	const errored = $derived(searchClient.status === "error")

	function currentContext(): SearchContext {
		const segs = page.url.pathname.split("/").filter(Boolean)
		return {
			lang: segs[0] || lang || "it",
			course: segs[1] ?? "",
			notePath: segs.slice(1).join("/"),
		}
	}

	async function runSearch() {
		const q = query.trim()
		if (!q) {
			results = []
			return
		}
		const token = ++searchToken
		const r = await searchClient.search(q, currentContext())
		if (token === searchToken) {
			results = r
			selected = 0
		}
	}

	function onInput() {
		const now = performance.now()
		const since = now - lastRun
		if (since >= THROTTLE_MS) {
			lastRun = now
			void runSearch()
		} else if (!throttleTimer) {
			throttleTimer = setTimeout(() => {
				throttleTimer = null
				lastRun = performance.now()
				void runSearch()
			}, THROTTLE_MS - since)
		}
	}

	async function scrollSelectedIntoView() {
		await tick()
		listEl
			?.querySelector('[data-selected="true"]')
			?.scrollIntoView({ block: "nearest" })
	}

	function move(delta: number) {
		if (!results.length) return
		selected = (selected + delta + results.length) % results.length
		void scrollSelectedIntoView()
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === "ArrowDown") {
			e.preventDefault()
			move(1)
		} else if (e.key === "ArrowUp") {
			e.preventDefault()
			move(-1)
		} else if (e.key === "Enter") {
			e.preventDefault()
			const r = results[selected]
			if (r) openResult(r)
		} else if (e.key === "Escape") {
			e.preventDefault()
			close()
		}
	}

	function openResult(r: SearchResult) {
		close()
		void goto(r.url)
	}

	function close() {
		open = false
	}

	function scopeLabel(r: SearchResult): string {
		if (r.scope === "current") return t(lang, "search.scope.current")
		if (r.scope === "same-course") return ""
		return r.courseTitle || "—"
	}

	// When opened: reset the previous search, warm the index, lock page scroll,
	// focus the input. `scrollbar-gutter: stable` (app.css) keeps the scrollbar
	// gutter reserved, so locking/unlocking never shifts the layout — neither on
	// open nor while the close animation plays. Overlay scrollbars (mobile)
	// reserve no gutter, so there is nothing to shift there either.
	$effect(() => {
		if (!open) return
		query = ""
		results = []
		selected = 0
		searchToken++
		if (throttleTimer) {
			clearTimeout(throttleTimer)
			throttleTimer = null
		}

		searchClient.sync().catch(() => {})
		const root = document.documentElement
		const prevOverflow = root.style.overflow
		root.style.overflow = "hidden"
		void tick().then(() => inputEl?.focus())
		return () => {
			root.style.overflow = prevOverflow
		}
	})
</script>

{#if open}
	<div
		class="backdrop"
		role="presentation"
		onclick={close}
		transition:fade={{ duration: 150 }}
	></div>

	<div
		class="spotlight-wrap"
		role="presentation"
		onclick={(e) => {
			if (e.target === e.currentTarget) close()
		}}
	>
		<div
			class="spotlight"
			role="dialog"
			aria-modal="true"
			aria-label={t(lang, "search.button")}
			tabindex="-1"
			transition:scale={{ duration: 160, start: 0.97 }}
		>
			<div class="search-row">
				<Icon name="search" size={20} />
				<input
					bind:this={inputEl}
					bind:value={query}
					oninput={onInput}
					onkeydown={onKeydown}
					type="text"
					class="search-input"
					placeholder={t(lang, "search.placeholder")}
					autocomplete="off"
					autocapitalize="off"
					autocorrect="off"
					spellcheck="false"
				/>
				{#if showSpinner}
					<span class="spinner" aria-hidden="true"></span>
				{/if}
			</div>

			{#if query.trim()}
				<ul class="results" bind:this={listEl} role="listbox">
					{#each results as r, i (r.url + i)}
						{@const scopeLabelText = scopeLabel(r)}
						<li>
							<a
								href={r.url}
								class="result"
								class:is-file={r.kind === "file"}
								class:selected={i === selected}
								data-selected={i === selected}
								role="option"
								aria-selected={i === selected}
								onclick={(e) => {
									e.preventDefault()
									openResult(r)
								}}
								onmouseenter={() => (selected = i)}
							>
								<span class="r-icon" class:accent={r.kind === "file"}>
									<Icon name={r.kind === "file" ? "file" : "hash"} size={16} />
								</span>
								<span class="r-body">
									<span class="r-head">
										{#if r.kind === "file"}
											<span class="r-title">{r.noteTitle}</span>
										{:else}
											<span class="r-crumb">
												<span class="r-note">{r.noteTitle}</span>
												<span class="r-sep">›</span>
												<span class="r-heading">{r.heading}</span>
											</span>
										{/if}
										{#if scopeLabelText !== ""}
											<span class="chip chip-{r.scope}">{scopeLabelText}</span>
										{/if}
									</span>
									{#if r.kind !== "file" && (r.snippet.hit || r.snippet.after || r.snippet.before)}
										<span class="r-snippet"
											>{r.snippet.before}{#if r.snippet.hit}<mark
													>{r.snippet.hit}</mark
												>{/if}{r.snippet.after}</span
										>
									{/if}
								</span>
							</a>
						</li>
					{:else}
						{#if !searchClient.searching}
							<li class="msg">
								{errored
									? t(lang, "search.unavailable")
									: t(lang, "search.noResults")}
							</li>
						{/if}
					{/each}
				</ul>
				<div class="hint">{t(lang, "search.hint")}</div>
			{:else}
				<div class="empty">{t(lang, "search.empty")}</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(8, 9, 13, 0.45);
		z-index: 200;
	}
	.spotlight-wrap {
		position: fixed;
		inset: 0;
		z-index: 201;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 14vh 1rem 2rem;
		pointer-events: none;
	}
	/* Same glass language as the menu toggle, scaled up for a spotlight panel. */
	.spotlight {
		font-family: var(--heading-font), sans-serif;
		pointer-events: auto;
		width: min(92vw, 42rem);
		max-height: 72vh;
		display: flex;
		flex-direction: column;
		background: var(--modal-glass);
		backdrop-filter: blur(0.8rem);
		border: 1px solid var(--background);
		box-shadow: 0 16px 48px var(--shadow-color);
		border-radius: 1rem;
		overflow: hidden;
	}

	.search-row {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.95rem 1.1rem;
		color: var(--muted);
		border-bottom: 1px solid var(--background);
	}
	.search-input {
		flex: 1;
		background: transparent;
		border: none;
		outline: none;
		color: var(--background-text);
		font-family: var(--heading-font), sans-serif;
		font-size: 1.15rem;
	}
	.search-input::placeholder {
		color: var(--muted);
	}

	.spinner {
		width: 1.05rem;
		height: 1.05rem;
		border: 2px solid var(--background);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
		flex: none;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.results {
		list-style: none;
		margin: 0;
		padding: 0.4rem;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--accent2) transparent;
	}

	.result {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.55rem 0.7rem;
		border-radius: 0.6rem;
		color: var(--background-text);
		cursor: pointer;
		border: 1px solid transparent;
	}
	/* Neutral selection highlight — accent colour lives only on the scope pill,
     not on the row. File vs section is conveyed by the icon + bold title. */
	.result.selected {
		background: color-mix(in srgb, var(--background-text) 12%, transparent);
	}

	.r-icon {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.7rem;
		height: 1.7rem;
		border-radius: 0.45rem;
		background: color-mix(in srgb, var(--accent2) 60%, transparent);
		color: var(--muted);
	}
	.r-icon.accent {
		background: color-mix(in srgb, var(--accent) 22%, transparent);
		color: var(--accent);
	}

	.r-body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	/* Title/crumb and the scope tag share one row; the tag sits at the right and
	   the title shrinks first (it rarely fills the width and matters less). The
	   snippet below then gets the full width. */
	.r-head {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		min-width: 0;
	}
	.r-title {
		flex: 0 1 auto;
		min-width: 0;
		font-weight: 700;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.r-crumb {
		flex: 0 1 auto;
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}
	.r-note {
		color: var(--muted);
		font-size: 0.85rem;
		flex: none;
		max-width: 40%;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.r-sep {
		color: var(--muted);
		flex: none;
	}
	.r-heading {
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	/* Plain inline snippet: the match sits ~1/3 in (set in makeSnippet) and the
	   line clips at its end — no flex gaps. The matched text is highlighted. */
	.r-snippet {
		color: var(--muted);
		font-size: 0.85rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.r-snippet mark {
		background: color-mix(in srgb, var(--accent) 30%, transparent);
		color: var(--background-text);
		border-radius: 0.2rem;
		padding: 0 0.15rem;
	}

	.chip {
		flex: none;
		margin-left: auto;
		align-self: center;
		font-size: 0.7rem;
		font-weight: 600;
		padding: 0.18rem 0.5rem;
		border-radius: 1rem;
		white-space: nowrap;
		max-width: 9rem;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	/* --accent2 and --tertiary are dark in both themes, so chip text is always
     light (using --background-text would go dark-on-dark in the light theme). */
	.chip-current {
		background: var(--accent);
		color: #fff;
	}
	.chip-same-course {
		background: var(--accent2);
		color: #f2f2f2;
	}
	.chip-other {
		background: color-mix(in srgb, var(--tertiary) 88%, transparent);
		color: #f2f2f2;
	}

	.empty,
	.msg {
		padding: 1.4rem 1.2rem;
		color: var(--muted);
		text-align: center;
		list-style: none;
	}
	.hint {
		padding: 0.7rem 1rem;
		border-top: 1px solid var(--background);
		color: var(--muted);
		font-size: 0.72rem;
		text-align: center;
	}

	@media (max-width: 768px) {
		.spotlight-wrap {
			padding: 8vh 0.6rem 1rem;
		}
	}
</style>
