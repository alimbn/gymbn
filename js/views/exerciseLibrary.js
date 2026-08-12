import { exercises } from '../storage.js';
import { renderLibraryList } from '../components/libraryList.js';

export function render(container) {
  renderLibraryList(container, {
    title: 'Egzersizler',
    store: exercises,
    placeholder: 'Yeni egzersiz adı',
    backHref: '#/more',
    showDurationToggle: true,
  });
}
