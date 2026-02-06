import React from 'react';
import { GameDefinition } from '@/types/game';

interface PacksTabProps {
    game: GameDefinition;
    onResetLayout: () => void;
    onLoadPack: (url: string) => void;
    onResetToDefault: () => void;
    onImportPack: () => void;
}

const PACKS = [
    { id: 'dsp', name: 'Dyson Sphere Program', description: 'The official DSP manufacturing data.', url: '/packs/dsp.json' },
    { id: 'factorio', name: 'Factorio (Basic)', description: 'Early game items and smelting.', url: '/packs/factorio.json' },
    { id: 'satisfactory', name: 'Satisfactory (Experimental)', description: '3D factory mechanics.', url: null, disabled: true }
];

export const PacksTab: React.FC<PacksTabProps> = ({
    game,
    onResetLayout,
    onLoadPack,
    onResetToDefault,
    onImportPack
}) => {
    return (
        <div className="space-y-6">
            <h3 className="text-2xl font-bold">Game Packs</h3>
            <p className="text-gray-400 text-sm">
                Switching a pack replaces all items, recipes, machines, and belts.
                Existing layouts may break if the new pack doesn't contain the same IDs.
            </p>

            <div className="grid grid-cols-1 gap-4">
                {PACKS.map((pack) => (
                    <div
                        key={pack.id}
                        className={`p-4 rounded-xl border-2 transition-all ${game.id === pack.id ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 bg-gray-800/40 hover:border-gray-600'} ${pack.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        onClick={() => {
                            if (pack.disabled || game.id === pack.id) return;
                            if (confirm(`Switch to ${pack.name}? We highly recommend clearing your layout first to avoid errors.`)) {
                                if (confirm('Clear current layout?')) {
                                    onResetLayout();
                                }
                                if (pack.url) onLoadPack(pack.url);
                                else if (pack.id === 'dsp') onResetToDefault();
                            }
                        }}
                    >
                        <div className="flex justify-between items-center">
                            <span className="text-lg font-bold">{pack.name}</span>
                            {game.id === pack.id && <span className="text-xs bg-blue-500 px-2 py-0.5 rounded uppercase">Active</span>}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{pack.description}</p>
                    </div>
                ))}
            </div>

            <div className="pt-10 border-t border-gray-700">
                <h4 className="text-lg font-bold mb-2">Custom Pack</h4>
                <p className="text-gray-400 text-sm mb-4">Paste a full GameDefinition JSON to load a custom environment.</p>
                <button
                    onClick={onImportPack}
                    className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded font-bold transition-all"
                >
                    Import Pack JSON
                </button>
            </div>
        </div>
    );
};
