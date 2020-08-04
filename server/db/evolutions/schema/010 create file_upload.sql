-- !Downs

DROP TABLE IF EXISTS file_upload;

-- !Ups

create table file_upload (
  id                varchar(100)            not null constraint file_upload_pk primary key,
  path              varchar(100),
  filename          varchar(1000),
  mime_type         varchar(100),
  completed         timestamp,
  completed_context varchar(100),
  removed           timestamp,
  removed_context   varchar(100),
  size              integer,
  uploaded_in       integer,
  username          varchar(500),
  email             varchar(500),
  options           jsonb,
  created           timestamp default now() not null
);

comment on column file_upload.id
is 'nanoid() идентификатор файла, без пути';

create unique index file_upload_id_uindex
  on file_upload (id);


