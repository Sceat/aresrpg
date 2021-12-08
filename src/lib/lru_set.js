const no_key =
  key =>
  ({ key: filtered_key } = { key: undefined }) =>
    filtered_key !== key

export default function lru_set({ capacity, on_eviction, max_age }) {
  let cache = Array.from({ length: capacity })
  const on_timeout = key => () => {
    const { element: deprecated_element } =
      cache.find(({ key: element_key } = {}) => element_key === key) ?? {}
    if (deprecated_element !== undefined) {
      on_eviction(deprecated_element)
      cache = [undefined, ...cache.filter(no_key(key))]
    }
  }
  return {
    /** add an element in the cache and potentially trigger an eviction */
    add(element) {
      const {
        element: evicted_element,
        handle,
        key: old_key,
      } = cache.at(-1) ?? {}
      if (old_key) {
        if (handle) clearTimeout(handle)
        on_eviction(evicted_element)
      }
      const key = Symbol('cache_element')
      cache = [
        {
          element,
          key,
          handle: max_age ? setTimeout(on_timeout(key), max_age) : undefined,
        },
        ...cache.filter(no_key(key)).slice(0, -1),
      ]
    },
    /** access an element and reset his timer
     * @returns weither or not the element exist
     */
    access(element) {
      const { handle, key } =
        cache.find(
          ({ element: found_element } = {}) => found_element === element
        ) ?? {}
      if (!key) return false
      if (handle) clearTimeout(handle)
      cache = [
        {
          element,
          key,
          handle: max_age ? setTimeout(on_timeout(key), max_age) : undefined,
        },
        ...cache.filter(no_key(key)),
      ]
      return true
    },
  }
}
