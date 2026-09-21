<script lang="ts">
	// Prerenders to build/404.html. Cloudflare Pages serves that file (with a real
	// 404 status) for any request that doesn't match an asset; without it, Pages
	// assumes a SPA and hands back index.html with a 200 instead.
	import ErrorPage from '$lib/components/ErrorPage.svelte';
</script>

<svelte:head>
	<title>404 | Specy</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<ErrorPage status={404} />
