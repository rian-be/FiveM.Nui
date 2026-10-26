import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mount, unmount } from 'svelte';
import NuiTable from '../../src/components/data/NuiTable.svelte';

describe('NuiTable page size normalization', () => {
  let container: HTMLElement;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  afterEach(() => container.remove());

  it('clamps a positive fractional page size to one row', () => {
    const component = mount(NuiTable, {
      target: container,
      props: {
        columns: [{ key: 'name', header: 'Name' }],
        data: [{ name: 'A' }, { name: 'B' }],
        pageSize: 0.5
      }
    });

    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(container.querySelectorAll('[aria-label^="Page "]')).toHaveLength(2);
    unmount(component);
  });
});
