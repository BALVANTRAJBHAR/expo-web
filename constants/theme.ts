/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

export const Palette = {
  cream: '#f7f2ea',
  ivory: '#fffaf3',
  ink: '#1b1b1b',
  cocoa: '#5b3b2a',
  copper: '#c06b34',
  amber: '#f0b35f',
  teal: '#1f7f7b',
  emerald: '#1f5e49',
  rose: '#e8897b',
  slate: '#5a6a6a',
  gold: '#f7d08a',
  shadow: '#1b0b0033',
};

export const Colors = {
  light: {
    text: Palette.ink,
    background: Palette.cream,
    tint: Palette.copper,
    icon: Palette.slate,
    tabIconDefault: Palette.slate,
    tabIconSelected: Palette.copper,
    surface: Palette.ivory,
    surfaceAlt: '#f3e4d2',
    accent: Palette.teal,
    accentSoft: '#cfe8e6',
    border: '#ead9c2',
  },
  dark: {
    text: '#f6f3ec',
    background: '#14110e',
    tint: Palette.gold,
    icon: '#d2c9bc',
    tabIconDefault: '#b8b0a4',
    tabIconSelected: Palette.gold,
    surface: '#211b16',
    surfaceAlt: '#2b221b',
    accent: '#2aa198',
    accentSoft: '#20403c',
    border: '#3c2f24',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
