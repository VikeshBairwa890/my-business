export type Row = { id: string; [key: string]: any };
export type Snapshot = { organization: { name: string; revision?: number }; user: {name:string}; sites: Row[]; workers: Row[]; attendance: Row[]; entries: Row[]; audit: any[] };
export type Field = { key: string; label: string; placeholder?: string; numeric?: boolean; multiline?: boolean; options?: {label:string; value:string}[] };
export type FormSpec = { title: string; subtitle: string; action: string; entity_id?: string; fields: Field[]; initial: Record<string,string>; transform: (v:Record<string,string>)=>Record<string,unknown> };
