/* ---------- Color profiles ---------- */
// Four full themes: Dark and Light are the originals; Ocean and Sunset are
// two extra profiles for variety. Each carries its own category color map
// so quest tags stay legible against its own palette.
export const THEMES = {
    dark: {
        label: "Dark", isDark: true,
        colors: { bg: "#12141a", panel: "#1a1d26", panel2: "#20242f", border: "#2c3140", text: "#e8e6df", textDim: "#8b8f9e", accent: "#5ec8a8", accentDim: "#3a8f77", amber: "#e0a940", danger: "#d9614f" },
        catColors: { mundane: "#8b8f9e", personal: "#5ec8a8", work: "#e0836a", epic: "#e0a940" },
    },
    light: {
        label: "Light", isDark: false,
        colors: { bg: "#f4f1ea", panel: "#ffffff", panel2: "#ece7db", border: "#ddd5c2", text: "#26241d", textDim: "#767061", accent: "#1d7a5f", accentDim: "#2f9f7c", amber: "#b5780f", danger: "#b8402f" },
        catColors: { mundane: "#767061", personal: "#1d7a5f", work: "#b5502f", epic: "#b5780f" },
    },
    ocean: {
        label: "Ocean", isDark: true,
        colors: { bg: "#0d1420", panel: "#141d2e", panel2: "#1a2540", border: "#243252", text: "#e5ecf5", textDim: "#7c8aa8", accent: "#4fb8e8", accentDim: "#3486ab", amber: "#e0a940", danger: "#e2685a" },
        catColors: { mundane: "#7c8aa8", personal: "#4fb8e8", work: "#e08a5a", epic: "#e0a940" },
    },
    sunset: {
        label: "Sunset", isDark: false,
        colors: { bg: "#fdf3ec", panel: "#ffffff", panel2: "#f7e3d2", border: "#f0d2b8", text: "#3a2a1f", textDim: "#8a6f5c", accent: "#e0663f", accentDim: "#c9502c", amber: "#c77d1d", danger: "#c23b2f" },
        catColors: { mundane: "#8a6f5c", personal: "#e0663f", work: "#b5502f", epic: "#c77d1d" },
    },
};
