import { defineModule } from '@/core/modules/define';
import { projectEntity } from './entities';

export const manifest = defineModule({
  id: 'projects',
  name: 'projects.module.name',
  version: '1.0.0',
  depends: ['contacts'],
  permissions: [
    'projects.project.read',
    'projects.project.write',
    'projects.task.read',
    'projects.task.write',
    'projects.timesheet.read',
    'projects.timesheet.write',
  ],
  app: { pillar: 'operations', icon: 'FolderKanban', label: 'shell.apps.projects', order: 8 },
  menus: [{ label: 'projects.menu.projects', href: '/projects', perm: 'projects.project.read', order: 61 }],
  entities: [projectEntity],
});
