exports.up = async (knex) => {
  await knex.schema.table("threads", (table) => {
    table.string("topic").nullable();
  });
};

exports.down = async (knex) => {
  await knex.schema.table("threads", (table) => {
    table.dropColumn("topic");
  });
};
