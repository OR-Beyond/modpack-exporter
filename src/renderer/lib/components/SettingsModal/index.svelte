<!--
  First-run / settings modal — modpack root (via ProfileSelector) + export dir.
-->
<script lang="ts">
  import FolderOpen from '@lucide/svelte/icons/folder-open';
  import ProfileSelector from './ProfileSelector.svelte';
  import { getCachedSetting, setCachedSetting } from '@/lib/utils/settingsCache';
  import Modal from '../base/Modal.svelte';
  import ModalHeader from '../base/ModalHeader.svelte';
  import ModalFooter from '../base/ModalFooter.svelte';
  import Button from '../base/Button.svelte';
  import Input from '../base/Input.svelte';
  import { LABEL_CLASSES } from '../base/fieldClasses';
  import IconButton from '../base/IconButton.svelte';
  import { toast } from '../../state/toast.svelte';
  import { ipc } from '../../ipc';

  interface Props {
    /** When false, the close button and overlay-click dismiss are hidden. */
    dismissible?: boolean;
    /** Closes the modal. */
    onClose: () => void;
    /** Called after Save. The parent should refresh state. */
    onSaved: () => void;
    /** If true, show a "Skip" button that closes without saving. */
    showSkip?: boolean;
  }

  let { dismissible = true, onClose, onSaved, showSkip = false }: Props = $props();

  let modpackRoot = $state('');
  let exportDir = $state('');
  let isSaving = $state(false);

  $effect(() => {
    exportDir = getCachedSetting('exportDir');
    modpackRoot = getCachedSetting('modpackRoot');

    const unsub = ipc.modpack.onRootFound(({ path: p }) => {
      modpackRoot = modpackRoot || p;
    });
    return unsub;
  });

  function handleProfileSelected(path: string, profileName?: string) {
    modpackRoot = path;
    toast.success(profileName ? `Profile "${profileName}" selected` : `Modpack root set to ${path}`);
  }

  async function selectExportDir() {
    const dir = await ipc.app.selectDirectory();
    if (dir) exportDir = dir;
  }

  async function handleSave() {
    if (!modpackRoot.trim()) {
      toast.error('Modpack root is required');
      return;
    }
    isSaving = true;
    await Promise.all([
      setCachedSetting('modpackRoot', modpackRoot.trim()),
      setCachedSetting('exportDir', exportDir.trim()),
    ]);
    isSaving = false;
    toast.success('Settings saved');
    onSaved();
  }

  function handleSkip() {
    toast('You can configure this later in Settings', { icon: '\u2699\uFE0F' });
    onClose();
  }
</script>

<Modal open onClose={onClose} {dismissible} widthClass="w-[500px]">
  <ModalHeader onClose={dismissible ? onClose : undefined}>
    <h2 class="text-foreground font-semibold text-base">Welcome to ORB Modpack Exporter</h2>
  </ModalHeader>

  <div class="p-5 flex flex-col gap-5 overflow-y-auto flex-1">
    <div>
      <label class={LABEL_CLASSES} for="settings-modal-modpack-root">
        Modpack Root Directory <span class="text-brand">*</span>
      </label>
      <p class="text-muted text-xs mb-2">
        Detected from every major launcher on this machine (must contain a{' '}
        <code class="bg-line/10 px-1 rounded">mods/</code> subfolder), or pick one manually.
      </p>
      <ProfileSelector selectedPath={modpackRoot} onSelected={handleProfileSelected} />
    </div>

    <div>
      <label class={LABEL_CLASSES} for="settings-modal-export-dir">
        Export Directory <span class="text-muted font-normal">(optional)</span>
      </label>
      <p class="text-muted text-xs mb-2">
        Where <code class="bg-line/10 px-1 rounded">.mrpack</code> files are saved.
        Defaults to <code class="bg-line/10 px-1 rounded">modpack_root/Modpack Export/</code>.
      </p>
      <div class="flex gap-2">
        <div class="flex-1">
          <Input id="settings-modal-export-dir" bind:value={exportDir} placeholder="Leave blank for default" />
        </div>
        <IconButton
          icon={FolderOpen}
          label="Browse"
          variant="secondary"
          sizeClass="px-3 py-2"
          onclick={selectExportDir}
        />
      </div>
    </div>
  </div>

  <ModalFooter>
    <div class="mr-auto">
      {#if showSkip}
        <Button variant="ghost" onclick={handleSkip}>Skip, I'll configure later</Button>
      {/if}
    </div>
    {#if dismissible && !showSkip}
      <Button variant="ghost" onclick={onClose}>Cancel</Button>
    {/if}
    <Button variant="primary" loading={isSaving} disabled={!modpackRoot.trim()} onclick={handleSave}>
      {isSaving ? 'Saving…' : 'Save'}
    </Button>
  </ModalFooter>
</Modal>
