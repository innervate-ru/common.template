-- !Downs

DROP TABLE IF EXISTS interaction_timers CASCADE;

-- !Ups

CREATE TABLE interaction_timers (
  name     VARCHAR(100) PRIMARY KEY,
  options  JSONB,
  created  TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  modified TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX interaction_timers_name
  ON interaction_timers (name);
