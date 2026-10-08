// Entity metadata contract. Generic list, form and kanban views are driven by these definitions.
export type FieldType =
  | 'text' | 'textarea' | 'email' | 'phone' | 'number' | 'money'
  | 'date' | 'datetime' | 'boolean' | 'select' | 'relation';

export interface FieldOption { value: string; label: string } // label is an i18n key

export interface FieldDef {
  name: string;            // camelCase property of the row object
  type: FieldType;
  label: string;           // i18n key
  required?: boolean;
  readonly?: boolean;
  options?: readonly FieldOption[];                  // for 'select'
  relation?: { entity: string; labelField: string }; // for 'relation'; the row carries `${name}Label`
  list?: boolean;          // show as a list column
  search?: boolean;        // included in free-text search
  filter?: boolean;        // offered as a URL filter
  form?: boolean;          // shown in RecordForm (default true unless readonly)
}

export interface EntityDef {
  name: string;            // `${module}.${entity}`, e.g. 'contacts.partner'
  labelField: string;      // field used as the record title
  fields: readonly FieldDef[];
  kanban?: { groupBy: string; titleField: string; subtitleField?: string };
  defaultSort?: { field: string; dir: 'asc' | 'desc' };
}

export type Row = Record<string, unknown> & { id: string };

export interface ListQuery {
  q?: string;
  page: number;      // 1-based
  pageSize: number;  // default 25, max 100
  sort?: string;
  dir?: 'asc' | 'desc';
  filters: Record<string, string>;
}

export interface ListResult<T = Row> { rows: T[]; total: number; page: number; pageSize: number }

/** State returned by form server actions used with useActionState. */
export interface FormState {
  ok?: boolean;
  message?: string;                  // i18n key or plain text
  fieldErrors?: Record<string, string>;
  redirectTo?: string;
}
