export default function ring_buffer({
  capacity = 3,
  on_eviction = nothing => nothing, // thanks TS
  max_age,
}) {
  let buffer = Array.from({ length: capacity })
  let cursor = -1
  const on_timeout = key => () => {
    const { element: deprecated_element } = buffer.find(
      ({ key: element_key } = {}) => element_key === key
    )
    on_eviction(deprecated_element)
  }
  return {
    /** add an element in the buffer and potentially trigger an eviction */
    add(element) {
      const {
        element: evicted_element,
        handle,
        key: old_key,
      } = buffer.at(-1) ?? {}
      if (old_key) {
        if (handle) clearTimeout(handle)
        on_eviction(evicted_element)
      }
      const key = Symbol('ringbuffer_element')
      buffer = [
        {
          element,
          key,
          handle: max_age ? setTimeout(on_timeout(key), max_age) : undefined,
        },
        ...buffer.slice(0, -1),
      ]
      cursor = (cursor + 1) % capacity
    },
    cursor: () => cursor,
  }
}
