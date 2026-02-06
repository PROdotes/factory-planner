
import { GameDefinition } from '@/types/game';
import { validateGameData } from '@/lib/io/gameData';

// Minimal empty state for bootstrapping
export const EMPTY_GAME_DATA: GameDefinition = {
    id: 'dsp',
    name: 'Loading...',
    version: '0.0.0',
    items: [],
    recipes: [],
    machines: [],
    belts: [],
    settings: {
        rateUnit: 'minute',
        lanesPerBelt: 1,
        hasSpeedModifiers: true,
        gridSize: 20
    }
};

export const DEFAULT_PACK_URL = '/packs/dsp.json';

export async function fetchGameData(url: string = DEFAULT_PACK_URL): Promise<GameDefinition> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch game data: ${response.statusText}`);
    }
    const json = await response.json();
    return validateGameData(json);
}
