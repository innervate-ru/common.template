-- !Downs

DROP TABLE IF EXISTS public.actions;

-- !Ups

CREATE TABLE public.actions
(
  id serial PRIMARY KEY NOT NULL,
  timestamp timestamp NOT NULL,
  host varchar(100),
  node varchar(100) NOT NULL,
  service varchar(100),
  action varchar(100),
  type varchar(100) NOT NULL,
  message varchar(2000), -- сообщение, как оно выводится в консоль
  req_id varchar(100), -- идентификатор начального действия, для объединения последовательных действий
  username varchar(500), -- username пользователя
  email varchar(500), -- email пользователя
  client varchar(100), -- код клиента, из Киберлайнз
  user_ip inet, -- ip адрес пользователь
  options json NOT NULL
);
CREATE UNIQUE INDEX actions_id_uindex ON public.actions (id);
CREATE INDEX actions_timestamp_index ON public.actions (timestamp);
CREATE INDEX actions_service_index ON public.actions (service);
CREATE INDEX actions_action_index ON public.actions (action);
CREATE INDEX actions_type_index ON public.actions (type);
CREATE INDEX actions_req_id_index ON public.actions (req_id);
CREATE INDEX actions_username_index ON public.actions (username);
CREATE INDEX actions_email_index ON public.actions (email);
CREATE INDEX actions_client_index ON public.actions (client);
CREATE INDEX actions_user_ip_index ON public.actions (user_ip);
