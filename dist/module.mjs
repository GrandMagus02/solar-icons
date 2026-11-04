import { defineNuxtModule, createResolver, addTypeTemplate, addComponent, addImports, addPlugin } from '@nuxt/kit';

async function getMainBarrelIconNames() {
  try {
    const solarIcons = await import('@solar-icons/vue');
    return Object.keys(solarIcons).filter(
      (name) => name !== "default" && name !== "IconBase" && name !== "SolarProvider" && name !== "useSolar" && name !== "IconStyle" && name !== "SOLAR_DEFAULTS_KEY"
    );
  } catch (error) {
    console.error("Solar Icons: Error loading main barrel:", error);
    return [];
  }
}
async function getDynamicBarrelIconNames() {
  try {
    const dynamicIcons = await import('@solar-icons/vue/dynamic');
    return Object.keys(dynamicIcons).filter((name) => name !== "default");
  } catch (error) {
    console.error("Solar Icons: Error loading dynamic barrel:", error);
    return [];
  }
}
const STYLES = ["bold", "bold-duotone", "broken", "linear", "line-duotone", "outline"];
const module$1 = defineNuxtModule({
  meta: {
    name: "@solar-icons/nuxt",
    configKey: "solarIcons",
    compatibility: {
      nuxt: ">=3.0.0"
    }
  },
  defaults: {
    namePrefix: "Solar",
    autoImport: true,
    provider: true
  },
  async setup(options, nuxt) {
    const resolver = createResolver(import.meta.url);
    nuxt.options.alias["#solar-icons"] = "@solar-icons/vue";
    nuxt.options.alias["#solar-icons/lib"] = "@solar-icons/vue/lib";
    nuxt.options.alias["#solar-icons/dynamic"] = "@solar-icons/vue/dynamic";
    for (const style of STYLES) {
      nuxt.options.alias[`#solar-icons/${style}`] = `@solar-icons/vue/${style}`;
    }
    addTypeTemplate({
      filename: "types/solar-icons.d.ts",
      getContents: () => `
          declare module '#solar-icons' {
            export * from '@solar-icons/vue'
          }

          declare module '#solar-icons/lib' {
            export * from '@solar-icons/vue/lib'
          }

          declare module '#solar-icons/dynamic' {
            export * from '@solar-icons/vue/dynamic'
          }

          ${STYLES.map((s) => `declare module '#solar-icons/${s}' {
            export * from '@solar-icons/vue/${s}'
          }`).join("\n")}
        `
    });
    if (options.autoImport) {
      const mainIcons = await getMainBarrelIconNames();
      mainIcons.forEach((iconName) => {
        addComponent({
          name: `${options.namePrefix}${iconName}`,
          export: iconName,
          filePath: "@solar-icons/vue"
        });
      });
      const dynamicIcons = await getDynamicBarrelIconNames();
      dynamicIcons.forEach((iconName) => {
        addComponent({
          name: `${options.namePrefix}${iconName}`,
          export: iconName,
          filePath: "@solar-icons/vue/dynamic"
        });
      });
    }
    addImports({
      name: "useSolar",
      from: "@solar-icons/vue/lib"
    });
    if (options.provider) {
      const providerConfig = {};
      if (options.color !== void 0) providerConfig.color = options.color;
      if (options.size !== void 0) providerConfig.size = options.size;
      if (options.strokeWidth !== void 0) providerConfig.strokeWidth = options.strokeWidth;
      if (options.secondaryColor !== void 0) providerConfig.secondaryColor = options.secondaryColor;
      if (options.secondaryOpacity !== void 0) providerConfig.secondaryOpacity = options.secondaryOpacity;
      if (Object.keys(providerConfig).length > 0) {
        nuxt.options.runtimeConfig.public.solarIcons = providerConfig;
      }
      addComponent({
        name: "SolarProvider",
        filePath: resolver.resolve("./runtime/SolarProviderWrapper"),
        priority: 999
      });
      addPlugin({
        src: resolver.resolve("./runtime/plugin"),
        mode: "all"
      });
    } else {
      const ignored = ["color", "size", "strokeWidth", "secondaryColor", "secondaryOpacity"].filter((key) => options[key] !== void 0);
      if (ignored.length > 0) {
        console.warn(
          `[solar-icons] provider is disabled; ignoring styling options: ${ignored.join(", ")}. Set them on a <SolarProvider> in your app instead.`
        );
      }
      addComponent({
        name: "SolarProvider",
        export: "SolarProvider",
        filePath: "@solar-icons/vue/lib"
      });
    }
  }
});

export { module$1 as default, getDynamicBarrelIconNames, getMainBarrelIconNames };
