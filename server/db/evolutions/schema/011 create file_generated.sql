-- !Downs

DROP TABLE IF EXISTS file_generated;


-- !Ups

create table file_generated
(
  id                varchar(100)            not null
    constraint file_generated_pkey
    primary key,
  path              varchar(500),
  filename          varchar(1000),
  mime_type         varchar(100),
  completed         timestamp,
  completed_context varchar(100),
  removed           timestamp,
  removed_context   varchar(100),
  size              integer,
  generated_in      integer,
  download_count    integer,
  username          varchar(500),
  email             varchar(500),
  client            varchar(100),
  created           timestamp default now() not null
);

comment on column file_generated.id
is 'shortid() идентификатор файла, без пути';

comment on column file_generated.path
is 'Путь к файлу, относительно корня папки для хранения сгенерированных файлов';

comment on column file_generated.completed
is 'Время когда файл был создан.  если null и прошло достаточно времени с created, значит файл не удалось создать, и надо удалить его с диска в процедуре cleanup';

comment on column file_generated.removed
is 'Время когда файл был удален';

create unique index file_generated_id_uindex
  on file_generated (id);

create index file_generated_created_completed_index
  on file_generated (created, completed);

