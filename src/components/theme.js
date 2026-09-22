import { createContext, useContext } from "react";

// Active theme (colors, category colors, dark flag) shared by every view so
// components don't need the palette threaded through props.
export const ThemeCtx = createContext(null);
export function useUi() {
    return useContext(ThemeCtx);
}

export const MONO = "'JetBrains Mono', monospace";
export const SERIF = "'Fraunces', serif";
