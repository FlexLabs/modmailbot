exports.up = async (knex) => {
  await knex.schema.table("threads", (table) => {
    table.json("staff_role_overrides").nullable().defaultTo(null).after("alert_users");
  });
};

exports.down = async (knex) => {
  await knex.schema.table("threads", table => {
    table.dropColumn("staff_role_overrides");
  });
};
