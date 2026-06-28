create table if not exists cf_meta (
  name text primary key,
  value text not null,
  updated_at text not null default (datetime('now'))
);

insert into cf_meta (name, value, updated_at)
values ('schema_version', '0001_foundation', datetime('now'))
on conflict(name) do update set
  value = excluded.value,
  updated_at = excluded.updated_at;
