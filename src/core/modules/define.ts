export interface MenuItem {
  label: string;
  href: string;
  perm?: string;
  icon?: string;
  order?: number;
}

export interface ModuleManifest {
  id: string;
  name: string;
  version: string;
  depends: readonly string[];
  permissions: readonly string[];
  menus: readonly MenuItem[];
  events?: { emits: readonly string[] };
  entities?: readonly unknown[];
}

const MODULE_ID_PATTERN = /^[a-z][a-z0-9_]*$/;

export function defineModule<const M extends ModuleManifest>(m: M): M {
  if (!MODULE_ID_PATTERN.test(m.id)) {
    throw new Error(`Invalid module id "${m.id}": use snake_case starting with a letter`);
  }
  for (const perm of m.permissions) {
    if (!perm.startsWith(`${m.id}.`)) {
      throw new Error(`Permission "${perm}" must start with "${m.id}."`);
    }
  }
  return m;
}
