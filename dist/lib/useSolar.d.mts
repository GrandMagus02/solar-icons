import { App, Ref } from "vue";
export interface SolarIconsConfig {
  color?: string;
  size?: string | number;
  strokeWidth?: number;
  secondaryColor?: string;
  secondaryOpacity?: number;
}
export interface SolarState {
  color: Ref<string | undefined>;
  setColor: (val: string) => void;
  size: Ref<string | number | undefined>;
  setSize: (val: string | number) => void;
  strokeWidth: Ref<number | undefined>;
  setStrokeWidth: (val: number) => void;
  secondaryColor: Ref<string | undefined>;
  setSecondaryColor: (val: string) => void;
  secondaryOpacity: Ref<number | undefined>;
  setSecondaryOpacity: (val: number) => void;
}
export declare function createSolarIcons(config?: SolarIconsConfig): SolarState;
export declare function provideSolarIconsContextInApp(app: App, state: SolarState): void;
export declare function useSolar(): SolarState;
export interface SolarIconsPlugin {
  install(app: App, options?: SolarIconsConfig): void;
}
export declare function applySolarCssVariables(state: SolarState): void;
export declare const SolarIconsPlugin: SolarIconsPlugin;