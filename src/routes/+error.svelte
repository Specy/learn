<script lang="ts">
	// Client-side navigation failures and any load() error land here. Genuine
	// unknown-URL hits are served build/404.html by the host instead — both render
	// the same component.
	import { page } from '$app/state';
	import ErrorPage from '$lib/components/ErrorPage.svelte';
</script>

<svelte:head>
	<title>{page.status} | Specy</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<ErrorPage status={page.status} message={page.error?.message} />
