<script lang="ts">
  import type { PageProps } from './$types';
  import CourseCard from '$lib/components/CourseCard.svelte';
  import SEO from '$lib/components/SEO.svelte';
  import { t } from '$lib/i18n';
  let { data }: PageProps = $props();
</script>

<SEO lang={data.lang} />

<section class="article">
  <header class="hero">
    <h1 class="main-header">Appunti universitari</h1>
    <p class="hero-desc">{t(data.lang, 'home.subtitle')}</p>
  </header>
  <div class="grid">
    {#each data.courses ?? [] as c}
      <CourseCard title={c.title} description={c.description} image={c.image} url={c.url} />
    {/each}
  </div>
</section>

<style>
  .grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
    margin-top: 1rem;
  }
</style>
