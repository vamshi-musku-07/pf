import { createContext, useContext, useRef } from "react";
import { Animated } from "react-native";

const HomeScrollContext = createContext(null);

export function HomeScrollProvider({ children }) {
  const scrollY = useRef(new Animated.Value(0)).current;
  return (
    <HomeScrollContext.Provider value={scrollY}>{children}</HomeScrollContext.Provider>
  );
}

export function useHomeScrollY() {
  return useContext(HomeScrollContext);
}
