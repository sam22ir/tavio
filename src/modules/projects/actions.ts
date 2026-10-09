'use server';

import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import { defineAction, toFormAction } from '@/core/actions/define-action';
import type { FormState } from '@/core/entities/types';
import type { Result } from '@/core/result';
import { changeProjectState, createProject, projectInput } from './service/projects';
import { createTask, logTimesheet, moveTask, taskInput, timesheetInput } from './service/tasks';
import { PROJECT_STATES } from './service/rules';

const MODULE = 'projects';

const stateInput = z.object({ id: z.uuid(), state: z.enum(PROJECT_STATES) });
const moveInput = z.object({ id: z.uuid(), stageId: z.uuid() });

const createProjectAction = defineAction(
  { perm: 'projects.project.write', schema: projectInput, module: MODULE },
  createProject,
);
const changeStateAction = defineAction(
  { perm: 'projects.project.write', schema: stateInput, module: MODULE },
  (ctx, { id, state }) => changeProjectState(ctx, id, state),
);
const createTaskAction = defineAction(
  { perm: 'projects.task.write', schema: taskInput, module: MODULE },
  createTask,
);
const moveTaskAction = defineAction(
  { perm: 'projects.task.write', schema: moveInput, module: MODULE },
  (ctx, { id, stageId }) => moveTask(ctx, id, stageId),
);
const logTimeAction = defineAction(
  { perm: 'projects.timesheet.write', schema: timesheetInput, module: MODULE },
  logTimesheet,
);

/** Form action for /projects/new. */
export async function createProjectForm(prev: FormState, formData: FormData): Promise<FormState> {
  const locale = await getLocale();
  return toFormAction(createProjectAction, {
    schema: projectInput,
    redirectTo: ({ id }) => `/${locale}/projects/${id}`,
  })(prev, formData);
}

/** Form action for a new task on a project page. */
export async function createTaskForm(prev: FormState, formData: FormData): Promise<FormState> {
  const locale = await getLocale();
  return toFormAction(createTaskAction, {
    schema: taskInput,
    redirectTo: ({ id }) => `/${locale}/projects/tasks/${id}`,
  })(prev, formData);
}

/** Form action for logging time on a task. */
export async function logTimeForm(prev: FormState, formData: FormData): Promise<FormState> {
  return toFormAction(logTimeAction, { schema: timesheetInput })(prev, formData);
}

/** Kanban drop handler: moves a task to a stage. */
export async function moveTaskStage(id: string, stageId: string): Promise<Result<void>> {
  return moveTaskAction({ id, stageId });
}

/** Form action for the project state buttons. */
export async function changeProjectStateForm(formData: FormData): Promise<void> {
  const locale = await getLocale();
  const id = String(formData.get('id') ?? '');
  const state = PROJECT_STATES.find((s) => s === formData.get('state'));
  if (state) await changeStateAction({ id, state });
  redirect(`/${locale}/projects/${encodeURIComponent(id)}`);
}
