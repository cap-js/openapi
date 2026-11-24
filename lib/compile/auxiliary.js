/**
 * A lazy CSN view: values stay on the source, while writes live on per-object
 * auxiliary targets. Stable proxies preserve cycles and shared references.
 */
function auxiliaryModel(csn) {
  const proxies = new WeakMap();

  function wrap(source) {
    if (source === null || typeof source !== 'object') return source;
    if (proxies.has(source)) return proxies.get(source);
    const array = Array.isArray(source);
    const auxiliary = array ? [] : Object.create(null);
    if (array) auxiliary.length = source.length;
    Object.setPrototypeOf(auxiliary, Object.getPrototypeOf(source));
    const deleted = new Set();

    function own(key) {
      const local = Reflect.getOwnPropertyDescriptor(auxiliary, key);
      if (local) return local;
      if (deleted.has(key) || (array && isIndex(key) && Number(key) >= auxiliary.length)) return;
      const descriptor = Reflect.getOwnPropertyDescriptor(source, key);
      if (!descriptor) return;
      return 'value' in descriptor
        ? { ...descriptor, value: wrap(descriptor.value), configurable: true }
        : { ...descriptor, configurable: true };
    }

    function prototype() {
      const value = Object.getPrototypeOf(auxiliary);
      // Keep class prototypes intact for instanceof; model-local inheritance
      // must go through its proxy so inherited auxiliary changes are visible.
      const constructor = value && Reflect.getOwnPropertyDescriptor(value, 'constructor')?.value;
      return typeof constructor === 'function' && constructor.prototype === value ? value : wrap(value);
    }

    const proxy = new Proxy(auxiliary, {
      get(_, key, receiver) {
        const descriptor = own(key);
        if (descriptor) return 'value' in descriptor ? descriptor.value
          : wrap(descriptor.get?.call(receiver));
        const parent = prototype();
        return parent === null ? undefined : wrap(Reflect.get(parent, key, receiver));
      },
      has: (_, key) => !!own(key) || (prototype() !== null && Reflect.has(prototype(), key)),
      ownKeys: () => [...new Set([
        ...Reflect.ownKeys(source).filter(key => !deleted.has(key) && !!own(key)),
        ...Reflect.ownKeys(auxiliary),
      ])],
      getOwnPropertyDescriptor: (_, key) => own(key),
      getPrototypeOf: prototype,
      set(_, key, value, receiver) {
        let descriptor = own(key);
        for (let parent = prototype(); !descriptor && parent; parent = Object.getPrototypeOf(parent))
          descriptor = Reflect.getOwnPropertyDescriptor(parent, key);
        if (descriptor && !('value' in descriptor)) {
          if (!descriptor.set) return false;
          descriptor.set.call(receiver, value);
          return true;
        }
        return Reflect.defineProperty(receiver, key, {
          value,
          ...(Object.hasOwn(auxiliary, key) ? {} : {
            enumerable: own(key)?.enumerable ?? true, writable: true, configurable: true,
          }),
        });
      },
      defineProperty(_, key, descriptor) {
        // Materialize only a property being changed, never the source graph.
        const current = own(key);
        // Default to configurable auxiliary properties: a proxy cannot expose
        // a wrapped value for a target's locked, object-valued data property.
        const local = { configurable: current?.configurable ?? true, ...descriptor };
        if ('value' in local) {
          const value = wrap(local.value);
          if (!local.configurable && !(local.writable ?? current?.writable) && value !== local.value)
            throw new TypeError('Immutable auxiliary properties must use a proxied object value');
          local.value = value;
        }
        if (!Object.hasOwn(auxiliary, key) && current)
          Reflect.defineProperty(auxiliary, key, current);
        const result = Reflect.defineProperty(auxiliary, key, local);
        if (array && key === 'length' && 'value' in descriptor) {
          for (const key of Reflect.ownKeys(source))
            if (isIndex(key) && Number(key) >= auxiliary.length) deleted.add(key);
        }
        return result;
      },
      deleteProperty(_, key) {
        if (!Reflect.deleteProperty(auxiliary, key)) return false;
        deleted.add(key);
        return true;
      },
      setPrototypeOf(_, parent) {
        for (let next = parent; next; next = Object.getPrototypeOf(next))
          if (next === proxy) return false;
        return Reflect.setPrototypeOf(auxiliary, parent);
      },
      // Non-extensibility cannot be virtualized without materializing every
      // source property. Reject it instead of copying or freezing the source.
      preventExtensions: () => false,
    });
    proxies.set(source, proxy);
    proxies.set(proxy, proxy);
    return proxy;
  }

  return wrap(csn);
}

function isIndex(key) {
  return typeof key === 'string' && String(Number(key)) === key
    && Number.isInteger(Number(key)) && Number(key) >= 0 && Number(key) < 2 ** 32 - 1;
}

module.exports = auxiliaryModel;
