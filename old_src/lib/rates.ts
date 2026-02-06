import { BeltTier, GameDefinition, GameSettings } from '@/types/game';

export const SECONDS_PER_MINUTE = 60;
export const DEFAULT_BELT_ITEMS_PER_SECOND = 6;

export function rateMultiplierForUnit(rateUnit: GameSettings['rateUnit']): number {
    return rateUnit === 'minute' ? SECONDS_PER_MINUTE : 1;
}

export function rateMultiplierForGame(game: GameDefinition): number {
    return rateMultiplierForUnit(game.settings.rateUnit);
}

export function beltItemsPerUnit(belt: BeltTier, rateUnit: GameSettings['rateUnit']): number {
    return belt.itemsPerSecond * rateMultiplierForUnit(rateUnit);
}

export function defaultBeltCapacity(rateUnit: GameSettings['rateUnit']): number {
    return DEFAULT_BELT_ITEMS_PER_SECOND * rateMultiplierForUnit(rateUnit);
}

export function defaultTargetRate(rateUnit: GameSettings['rateUnit']): number {
    return rateUnit === 'minute' ? SECONDS_PER_MINUTE : 1;
}

export function rateUnitSuffix(rateUnit: GameSettings['rateUnit']): string {
    return rateUnit === 'minute' ? '/m' : '/s';
}

export function formatRate(rate: number, rateUnit: GameSettings['rateUnit'], decimals: number = 1): string {
    return `${rate.toFixed(decimals)}${rateUnitSuffix(rateUnit)}`;
}

export function getRateParts(rate: number, rateUnit: GameSettings['rateUnit'], decimals: number = 1) {
    return {
        value: rate.toFixed(decimals),
        unit: rateUnitSuffix(rateUnit)
    };
}
