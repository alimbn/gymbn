import { dayTypes } from '../storage.js';
import { renderLibraryList } from '../components/libraryList.js';

export function render(container) {
  renderLibraryList(container, {
    title: 'Gün Tipleri',
    store: dayTypes,
    placeholder: 'Yeni gün tipi adı',
    backHref: '#/more',
  });
}
