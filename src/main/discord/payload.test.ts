import { describe, it, expect } from 'vitest';
import { buildPushNotification } from './payload';
import { validateWebhookV2Payload, getWebhookV2Violations } from './validate';

describe('discord v2 payload', () => {
  it('builds valid payload for small push', () => {
    const p = buildPushNotification({
      version: '1.0.0',
      added: [{ name: 'Foo', version: '1.0' }],
      updated: [{ name: 'Bar', version: '2.0', oldVersion: '1.0' }],
      removed: [{ name: 'Baz', version: '0.9' }],
      changedFiles: ['config/a.json'],
      maintainerRoleIds: ['123'],
    });
    const v = validateWebhookV2Payload(p);
    expect(v.valid).toBe(true);
    expect(p.flags).toBe(32768);
  });

  it('truncates large push', () => {
    const mods = Array.from({ length: 600 }, (_, i) => ({ name: `mod${i}`, version: '1.0' }));
    const p = buildPushNotification({ version: '1.0.0', added: mods, textBudget: 3500 });
    const v = validateWebhookV2Payload(p);
    expect(v.valid).toBe(true);
    const total = JSON.stringify(p).length;
    // text budget enforced
    let text = 0;
    const walk = (c: any) => {
      if (c.type === 10) text += c.content.length;
      if (c.components) c.components.forEach(walk);
      if (c.items) {}
    };
    p.components.forEach(walk);
    expect(text).toBeLessThanOrEqual(3500);
  });

  it('rejects thumbnail at top level via validator', () => {
    const bad: any = { flags: 32768, components: [{ type: 11, media: { url: 'https://x.com/a.png' } }] };
    const v = validateWebhookV2Payload(bad);
    expect(v.valid).toBe(false);
  });

  it('rejects content field', () => {
    const p: any = buildPushNotification({ version: '1' });
    p.content = 'hi';
    const v = validateWebhookV2Payload(p);
    expect(v.valid).toBe(false);
  });
});
