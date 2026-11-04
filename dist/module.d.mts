import { NuxtModule } from '@nuxt/schema';

interface SolarNuxtModuleOptions {
    namePrefix?: string;
    autoImport?: boolean;
    provider?: boolean;
    color?: string;
    size?: string | number;
    strokeWidth?: number;
    secondaryColor?: string;
    secondaryOpacity?: number;
}
declare function getMainBarrelIconNames(): Promise<string[]>;
declare function getDynamicBarrelIconNames(): Promise<string[]>;
declare const module$1: NuxtModule<SolarNuxtModuleOptions>;

export { module$1 as default, getDynamicBarrelIconNames, getMainBarrelIconNames };
export type { SolarNuxtModuleOptions };
