<script lang="ts">
  // Ported from specy.app's logo.svelte (diamond mark + "Specy" + animated ".app").
  let { lang = 'it' }: { lang?: string } = $props();
  let toggled = $state(false);
</script>

<a
  class="logo-wrapper"
  href="/{lang}"
  aria-label="Specy"
  onmouseenter={() => (toggled = true)}
  onmouseleave={() => (toggled = false)}
>
  <img src="/images/logo.png" alt="" class="logo" />
  <div class="name">
    <div>Specy</div>
    <div class="overflow-wrapper">
      <div class="logo-line-wrapper">
        <div class="logo-line" class:toggled></div>
        <div class="logo-app"><span> . </span>app</div>
      </div>
    </div>
  </div>
</a>

<style>
  .logo-wrapper {
    display: flex;
    align-items: center;
    flex-direction: row;
    color: var(--background-text);
  }
  .logo {
    width: 2.5rem;
    height: 2.5rem;
    margin-right: 0.5rem;
  }
  .name {
    font-size: 1.3rem;
    font-weight: bold;
    font-family: var(--heading-font), sans-serif;
  }
  .overflow-wrapper {
    width: 65px;
    overflow: hidden;
  }
  .logo-line-wrapper {
    display: flex;
    flex-direction: row;
    align-items: center;
    margin-top: -0.2rem;
    height: 1.2rem;
    width: 140px;
  }
  .logo-line {
    width: 30px;
    height: 2px;
    background-color: var(--accent);
    transition: all 0.4s ease-in-out;
  }
  .logo-line.toggled {
    width: 65px;
  }
  .logo-app {
    font-size: 0.8rem;
    margin-left: 2px;
    color: var(--accent);
    display: flex;
    flex-direction: row;
    font-weight: bold;
  }
  .logo-app > span {
    font-size: 1.2rem;
    height: 0.8rem;
    margin-top: -0.4rem;
  }
  @media (max-width: 650px) {
    .logo {
      width: 2.1rem;
      height: 2.1rem;
    }
  }
</style>
