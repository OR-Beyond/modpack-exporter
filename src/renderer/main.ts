import { mount } from 'svelte';
import App from './App.svelte';
import Toaster from './lib/components/common/Toaster.svelte';
import { initTheme } from './lib/state/theme.svelte';
import { initLogger } from './lib/utils/logger';
import './lib/styles/globals.css';

// Apply the persisted theme before the first paint so the UI never flashes.
initTheme();
initLogger();

mount(App, { target: document.getElementById('root')! });
mount(Toaster, { target: document.body });
