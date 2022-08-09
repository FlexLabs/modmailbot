const pagination = new Map;

function paginate(items, nPerPage) {
  if (! items || ! items.length) throw new RangeError("Expected an array with elements");

  const chunks = [[]];
  let index = 0;

  for (const i of items) {
    if (chunks[index].length >= (nPerPage || 25)) {
      index++;
      chunks.push([]);
    }
    chunks[index].push(i);
  }

  return chunks;
}

function createPagination(id, data, authorID, info, onUpdate, extras) {
  pagination.set(id, {
    pages: data,
    index: 0,
    authorID,
    info,
    extras,
    onUpdate,
    expire: setTimeout(() => pagination.delete(id), 3e5)
  });
  return pagination.get(id);
}

module.exports = { createPagination, paginate };
