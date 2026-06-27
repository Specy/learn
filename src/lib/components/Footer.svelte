<script lang="ts">
  import { page } from '$app/state';
  import { t } from '$lib/i18n';
  import Icon from '$lib/components/Icon.svelte';
  import { REPO_APP, REPO_NOTES, DONATE, editUrl } from '$lib/links';

  const lang = $derived(page.url.pathname.split('/').filter(Boolean)[0] ?? 'it');
  // Source path of the current note/folder, carried on the page node. Absent on
  // the home and offline routes → no "edit this page" link there.
  const relPath = $derived((page.data as any)?.node?.relPath as string | undefined);
  const edit = $derived(relPath ? editUrl(relPath) : null);
</script>

<footer class="footer">
  <div class="footer-sep" aria-hidden="true"></div>
  <nav class="footer-links" aria-label={t(lang, 'footer.donate')}>
    <a href={DONATE} target="_blank" rel="noopener noreferrer">
      <Icon name="heart" size={15} />{t(lang, 'footer.donate')}
    </a>
    <a href={REPO_APP} target="_blank" rel="noopener noreferrer">
      <Icon name="github" size={15} />{t(lang, 'footer.repoApp')}
    </a>
    <a href={REPO_NOTES} target="_blank" rel="noopener noreferrer">
      <Icon name="github" size={15} />{t(lang, 'footer.repoNotes')}
    </a>
    {#if edit}
      <a href={edit} target="_blank" rel="noopener noreferrer">
        <Icon name="edit" size={15} />{t(lang, 'footer.edit')}
      </a>
    {/if}
  </nav>
</footer>

<style>
  .footer {
    margin-top: 3rem;
    padding-bottom: 2.5rem;
  }
  /* Thin separator, inset from the edges and fading to transparent on both ends. */
  .footer-sep {
    height: 1px;
    width: min(85%, 46rem);
    margin: 0 auto 1.25rem;
    background: linear-gradient(to right, transparent, var(--accent2), transparent);
  }
  .footer-links {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 0.6rem 1.5rem;
    padding: 0 1rem;
  }
  .footer-links a {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--muted);
    font-size: 0.85rem;
    transition: color 0.15s;
  }
  .footer-links a:hover {
    color: var(--accent);
  }
</style>
