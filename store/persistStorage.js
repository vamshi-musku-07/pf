import AsyncStorage from "@react-native-async-storage/async-storage";

/** No-op during SSR/static web render — AsyncStorage needs `window`. */
const noopStorage = {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
};

const persistStorage =
  typeof window === "undefined" ? noopStorage : AsyncStorage;

export default persistStorage;
