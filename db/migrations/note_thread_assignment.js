exports.up = async (knex) => {
  await knex.schema.table("notes", (table) => {
    table.string("thread", 36).nullable();
  });
};

exports.down = async (knex) => {
  await knex.schema.table("notes", (table) => {
    table.dropColumn("thread");
  });
};
