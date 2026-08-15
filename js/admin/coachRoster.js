import { renderRosterScreen } from '../roster/rosterUi.js';
import {
  listCoachesWithCounts, listPendingCoachInvites, createCoachInvite, cancelCoachInvite,
} from './adminCloud.js';

function buildInviteLink(token) {
  const url = new URL('./join.html', location.href);
  url.hash = `/coach/${token}`;
  return url.href;
}

export async function render(container) {
  await renderRosterScreen(container, {
    addPlaceholder: 'Hoca adı',
    addButtonLabel: 'Hoca Davet Et',
    emptyText: 'Henüz hoca eklenmedi.',
    statLabel: 'Hoca',
    loadItems: async () => {
      const coaches = await listCoachesWithCounts();
      return coaches
        .sort((a, b) => a.displayName.localeCompare(b.displayName, 'tr'))
        .map((c) => ({
          id: c.id,
          title: c.displayName,
          subtitle: `${c.studentCount} öğrenci`,
        }));
    },
    loadPendingInvites: async () => {
      const invites = await listPendingCoachInvites();
      return invites.map((inv) => ({ id: inv.id, displayName: inv.displayName, link: buildInviteLink(inv.id) }));
    },
    onAdd: async (name) => ({ link: buildInviteLink(await createCoachInvite(name)) }),
    onCancelInvite: (id) => cancelCoachInvite(id),
  });
}
