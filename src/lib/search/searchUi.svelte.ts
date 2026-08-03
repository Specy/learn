// src/lib/search/searchUi.svelte.ts
// Whether the search modal is open. The modal itself lives in the root layout,
// but the home page's search bar has to open it too — a tiny shared singleton is
// simpler than threading a callback down through the page slot.
class SearchUi {
	open = $state(false);
}

export const searchUi = new SearchUi();
