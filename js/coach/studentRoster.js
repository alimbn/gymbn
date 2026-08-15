import { renderRosterScreen } from '../roster/rosterUi.js';
import {
  listMyStudents, listPendingStudentInvites, createStudentInvite, cancelStudentInvite, coachSignOut,
} from './coachCloud.js';

function buildInviteLink(token) {
  const url = new URL('./join.html', location.href);
  url.hash = `/student/${token}`;
  return url.href;
}

export async function render(container) {
  container.innerHTML = `
    <div class="view-header">
      <h2 class="view-title">Öğrenciler</h2>
      <button type="button" class="btn btn-ghost" id="coach-signout-btn">Çıkış</button>
    </div>
    <div id="coach-body"></div>
  `;
  container.querySelector('#coach-signout-btn').addEventListener('click', () => coachSignOut());

  await renderRosterScreen(container.querySelector('#coach-body'), {
    addPlaceholder: 'Öğrenci adı',
    addButtonLabel: 'Öğrenci Davet Et',
    emptyText: 'Henüz öğrenci eklenmedi.',
    statLabel: 'Öğrenci',
    loadItems: async () => {
      const students = await listMyStudents();
      return students
        .sort((a, b) => a.displayName.localeCompare(b.displayName, 'tr'))
        .map((s) => ({
          id: s.id,
          title: s.displayName,
          subtitle: 'Program atamak için dokun',
          href: `#/assign/${s.id}`,
        }));
    },
    loadPendingInvites: async () => {
      const invites = await listPendingStudentInvites();
      return invites.map((inv) => ({ id: inv.id, displayName: inv.displayName, link: buildInviteLink(inv.id) }));
    },
    onAdd: async (name) => ({ link: buildInviteLink(await createStudentInvite(name)) }),
    onCancelInvite: (id) => cancelStudentInvite(id),
  });
}
