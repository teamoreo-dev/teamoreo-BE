import mongoose from "mongoose";

// A deliberately small database double: real Mongoose documents/validation, in-memory queries.
// No MongoDB connection is opened and no external data can be modified.
export function memoryModel(Model) {
  const records = new Map();
  const originals = [];
  const patch = (name, value, target = Model) => {
    originals.push([target, name, target[name]]);
    target[name] = value;
  };
  const at = (obj, path) => path.split(".").reduce((value, key) => value?.[key], obj);
  function matches(doc, filter = {}) {
    return Object.entries(filter).every(([key, value]) => {
      if (key === "$or") return value.some((item) => matches(doc, item));
      const actual = at(doc, key);
      if (value instanceof RegExp) return value.test(actual || "");
      if (value && typeof value === "object" && "$ne" in value) return String(actual) !== String(value.$ne);
      return String(actual) === String(value);
    });
  }
  function query(operation) {
    let fields, sorting, skip = 0, limit = Infinity;
    const result = {
      select(value) { fields = value; return this; },
      sort(value) { sorting = value; return this; },
      skip(value) { skip = value; return this; },
      limit(value) { limit = value; return this; },
      then(resolve, reject) {
        return Promise.resolve().then(operation).then((data) => {
          const many = Array.isArray(data);
          let docs = many ? data : data ? [data] : [];
          if (sorting) docs.sort((a, b) => {
            for (const [key, direction] of Object.entries(sorting)) {
              if (a[key] > b[key]) return direction;
              if (a[key] < b[key]) return -direction;
            }
            return 0;
          });
          docs = docs.slice(skip, skip + limit).map((data) => {
            let plain = { ...data };
            if (fields && !fields.startsWith("+") && !fields.startsWith("-")) {
              plain = Object.fromEntries(["_id", ...fields.split(" ")].filter((key) => key in plain).map((key) => [key, plain[key]]));
            }
            if (Model.modelName === "Admin" && fields !== "+passwordHash") delete plain.passwordHash;
            return Model.hydrate(plain);
          });
          return many ? docs : docs[0] || null;
        }).then(resolve, reject);
      },
    };
    return result;
  }
  const all = (filter) => [...records.values()].filter((doc) => matches(doc, filter));
  patch("find", (filter) => query(() => all(filter)));
  patch("findOne", (filter) => query(() => all(filter)[0]));
  patch("findById", (id) => query(() => records.get(String(id))));
  patch("countDocuments", async (filter) => all(filter).length);
  patch("exists", async (filter) => all(filter)[0] ? { _id: all(filter)[0]._id } : null);
  patch("findByIdAndDelete", async (id) => {
    const data = records.get(String(id));
    records.delete(String(id));
    return data ? Model.hydrate(data) : null;
  });
  patch("findByIdAndUpdate", async (id, update) => {
    const data = records.get(String(id));
    if (!data) return null;
    const doc = Model.hydrate(data);
    doc.set(update);
    await doc.save();
    return doc;
  });
  patch("create", async (data) => new Model(data).save());
  patch("save", async function () {
    await this.validate();
    if (this.slug && [...records.values()].some((doc) => doc.slug === this.slug && String(doc._id) !== String(this._id))) {
      throw Object.assign(new Error("Duplicate slug"), { code: 11000, keyPattern: { slug: 1 } });
    }
    this.createdAt ||= new Date();
    this.updatedAt = new Date();
    records.set(String(this._id), this.toObject());
    return this;
  }, Model.prototype);
  return {
    records,
    reset() { records.clear(); },
    restore() { for (const [target, name, value] of originals.reverse()) target[name] = value; },
    id: () => new mongoose.Types.ObjectId().toString(),
  };
}
