/** A compilation-only overlay: local properties take precedence over the CSN. */
function auxiliaryModel(csn) {
  const proxies = new WeakMap();

  function wrap(source) {
    if (source === null || typeof source !== 'object') return source;
    if (proxies.has(source)) return proxies.get(source);
    const local = Array.isArray(source) ? new Array(source.length) : Object.create(null);
    Object.setPrototypeOf(local, Object.getPrototypeOf(source));

    function own(key) {
      const descriptor = Reflect.getOwnPropertyDescriptor(local, key)
        ?? Reflect.getOwnPropertyDescriptor(source, key);
      return descriptor && {
        ...descriptor,
        ...(Object.hasOwn(local, key) ? {} : { configurable: true }),
        ...('value' in descriptor ? { value: wrap(descriptor.value) } : {}),
      };
    }

    function prototype() {
      const parent = Object.getPrototypeOf(local);
      // Preserve class identity; CSN-local prototypes use the same overlay.
      return parent && Object.hasOwn(parent, 'constructor') ? parent : wrap(parent);
    }

    const proxy = new Proxy(local, {
      get(_, key, receiver) {
        const object = Object.hasOwn(local, key) ? local
          : Object.hasOwn(source, key) ? source : prototype();
        return object === null ? undefined : wrap(Reflect.get(object, key, receiver));
      },
      set(_, key, value) {
        return Reflect.defineProperty(local, key, {
          value: wrap(value), writable: true, configurable: true,
          enumerable: own(key)?.enumerable ?? true,
        });
      },
      defineProperty: (_, key, descriptor) => Reflect.defineProperty(local, key, {
        configurable: true, ...descriptor,
        ...('value' in descriptor ? { value: wrap(descriptor.value) } : {}),
      }),
      getOwnPropertyDescriptor: (_, key) => own(key),
      ownKeys: () => [...new Set([...Reflect.ownKeys(source), ...Reflect.ownKeys(local)])],
      has: (_, key) => !!own(key) || (prototype() !== null && Reflect.has(prototype(), key)),
      getPrototypeOf: prototype,
      setPrototypeOf(_, parent) {
        for (let next = parent; next; next = Object.getPrototypeOf(next))
          if (next === proxy) return false;
        return Reflect.setPrototypeOf(local, parent);
      },
      // Freezing the overlay would require copying all fallback properties.
      preventExtensions: () => false,
    });
    proxies.set(source, proxy);
    proxies.set(proxy, proxy);
    return proxy;
  }

  return wrap(csn);
}

module.exports = auxiliaryModel;
