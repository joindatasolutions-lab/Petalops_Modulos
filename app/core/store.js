export function createStore(initialState) {
  let state = structuredClone(initialState);
  const listeners = [];

  function getState() {
    return state;
  }

  function setState(patch, keys = []) {
    state = mergeDeep(state, patch);
    listeners.forEach(listener => {
      const shouldRun = !listener.keys?.length || listener.keys.some(key => keys.includes(key));
      if (shouldRun) listener.fn(state);
    });
  }

  function subscribe(fn, keys = []) {
    listeners.push({ fn, keys });
  }

  return { getState, setState, subscribe };
}

function mergeDeep(target, patch) {
  const output = { ...target };

  Object.entries(patch || {}).forEach(([key, value]) => {
    if (isObject(value) && isObject(target[key])) {
      output[key] = mergeDeep(target[key], value);
      return;
    }

    output[key] = value;
  });

  return output;
}

function isObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}
