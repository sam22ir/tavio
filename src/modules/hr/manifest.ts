import { defineModule } from '@/core/modules/define';
import { employeeEntity, leaveRequestEntity } from './entities';

export const manifest = defineModule({
  id: 'hr',
  name: 'hr.module.name',
  version: '1.0.0',
  depends: ['contacts'],
  permissions: [
    'hr.employee.read',
    'hr.employee.write',
    'hr.department.read',
    'hr.department.write',
    'hr.leave.read',
    'hr.leave.write',
    'hr.leave.approve',
    'hr.attendance.read',
    'hr.attendance.write',
  ],
  app: { pillar: 'operations', icon: 'Users', label: 'shell.apps.hr', order: 7 },
  menus: [
    { label: 'hr.menu.employees', href: '/hr/employees', perm: 'hr.employee.read', order: 60 },
    { label: 'hr.menu.departments', href: '/hr/departments', perm: 'hr.department.read', order: 61 },
    { label: 'hr.menu.leave', href: '/hr/leave', perm: 'hr.leave.read', order: 62 },
    { label: 'hr.menu.attendance', href: '/hr/attendance', perm: 'hr.attendance.read', order: 63 },
  ],
  entities: [employeeEntity, leaveRequestEntity],
});
