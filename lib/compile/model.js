/**
 * Isolate the compiler's writes from the caller's model. Unlike cds.clone(), this
 * preserves symbols, non-enumerable runtime metadata, linked prototypes and cycles.
 * Parameter overrides live in an auxiliary lookup, never on the source CSN.
 */
function compilationModel(csn) {
  const overrides = new WeakMap();
  // EDM uses nullability for parameter optionality, ignoring @mandatory. Keep
  // the necessary notNull override out of the caller's parameter definitions.
  for (const def of Object.values(csn.definitions ?? {})) {
    if (def.kind !== 'function') continue;
    for (const param of Object.values(def.params ?? {})) {
      if (param['@mandatory'] === true && param.notNull === undefined)
        overrides.set(param, { notNull: true });
    }
  }

  const copies = new WeakMap();
  function copy(value) {
    if (value === null || typeof value !== 'object') return value;
    if (copies.has(value)) return copies.get(value);

    const result = Array.isArray(value) ? [] : Object.create(null);
    copies.set(value, result);
    const prototype = Object.getPrototypeOf(value);
    // Class prototypes are shared; model-local inheritance (e.g. lean drafts)
    // must instead point to the corresponding isolated model object.
    Object.setPrototypeOf(result, prototype && !Object.hasOwn(prototype, 'constructor')
      ? copy(prototype) : prototype);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const key of Reflect.ownKeys(descriptors)) {
      const descriptor = Reflect.get(descriptors, key);
      if ('value' in descriptor) descriptor.value = copy(descriptor.value);
      Object.defineProperty(result, key, descriptor);
    }
    Object.assign(result, overrides.get(value));
    return result;
  }

  return copy(csn);
}

module.exports = compilationModel;
