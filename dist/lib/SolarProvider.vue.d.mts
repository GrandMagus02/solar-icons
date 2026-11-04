type __VLS_Props = {
  /** Default icon color. Sets `--solar-color` on the wrapper. */
  color?: string;
  /** Default icon size. Sets `--solar-size`. */
  size?: string | number;
  /** Default stroke width. Sets `--solar-stroke-width`. */
  strokeWidth?: number;
  /** Default secondary color for duotone styles. Sets `--solar-secondary-color`. */
  secondaryColor?: string;
  /** Default secondary opacity for duotone styles (0–1). Sets `--solar-secondary-opacity`. */
  secondaryOpacity?: number;
};
declare var __VLS_1: {};
type __VLS_Slots = {} & {
  default?: (props: typeof __VLS_1) => any;
};
declare const __VLS_base: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const __VLS_export: __VLS_WithSlots<typeof __VLS_base, __VLS_Slots>;
declare const _default: typeof __VLS_export;
type __VLS_WithSlots<T, S> = T & {
  new (): {
    $slots: S;
  };
};
export { _default as default };