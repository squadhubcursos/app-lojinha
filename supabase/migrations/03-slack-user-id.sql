-- ID do usuario no Slack (ex: U01ABCDEF), usado para enviar a ficha semanal por DM.
alter table usuarios add column if not exists slack_user_id text;
