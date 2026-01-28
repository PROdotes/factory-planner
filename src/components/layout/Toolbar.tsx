import React from 'react';
import {
    Settings,
    Plus,
    Save,
    Download,
    Upload,
    RotateCcw,
    Package,
    Eye,
    Activity,
    Layers,
    TrendingUp,
    GitBranch,
    Grid3X3
} from 'lucide-react';
import { useLayoutStore } from '@/stores/layoutStore';
import { useGameStore } from '@/stores/gameStore';

interface ToolbarProps {
    className?: string;
    onOpenEditor?: () => void;
    onAddBlock?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ className = '', onOpenEditor, onAddBlock }) => {
    const { game } = useGameStore();
    const {
        saveToStorage,
        loadFromStorage,
        exportLayout,
        importLayout,
        viewSettings,
        toggleViewSetting
    } = useLayoutStore();

    const handleImport = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (re) => {
                    const content = re.target?.result as string;
                    importLayout(content);
                };
                reader.readAsText(file);
            }
        };
        input.click();
    };

    const handleReset = () => {
        if (confirm('Are you sure you want to clear the entire layout?')) {
            useLayoutStore.setState({ nodes: [], edges: [] });
        }
    };

    return (
        <div className={`h-14 bg-surface/80 backdrop-blur-md border-b border-white/5 flex items-center px-6 justify-between select-none ${className}`}>
            <div className="flex items-center space-x-4">
                <div className="flex items-center gap-3 mr-4">
                    <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
                        <Package size={20} className="text-white" />
                    </div>
                    <span className="font-black italic text-xl tracking-tighter text-white uppercase">{game.name.split(' ')[0]}<span className="text-primary NOT-italic">FLOW</span></span>
                </div>

                <div className="h-8 w-px bg-white/10 mx-2" />

                <button
                    onClick={onAddBlock}
                    className="glass-button-primary"
                >
                    <Plus size={16} />
                    <span>New Block</span>
                </button>

                <div className="flex items-center gap-1.5 ml-2">
                    <button onClick={() => saveToStorage()} className="glass-button !p-2" title="Save to Browser Storage">
                        <Save size={16} />
                    </button>
                    <button onClick={() => loadFromStorage()} className="glass-button !p-2" title="Load from Browser Storage">
                        <RotateCcw size={16} />
                    </button>
                    <div className="h-6 w-px bg-white/5 mx-1" />
                    <button onClick={exportLayout} className="glass-button !p-2" title="Export Layout JSON">
                        <Download size={16} />
                    </button>
                    <button onClick={handleImport} className="glass-button !p-2" title="Import Layout JSON">
                        <Upload size={16} />
                    </button>
                    <button onClick={handleReset} className="glass-button !p-2 hover:!text-red-400" title="Clear All">
                        <RotateCcw size={16} className="rotate-45" />
                    </button>
                </div>

                <div className="h-8 w-px bg-white/10 mx-4" />

                <div className="flex items-center gap-1.5">
                    {/* Flow Mode Toggle - Primary */}
                    <button
                        onClick={() => toggleViewSetting('flowMode')}
                        className={`glass-button !p-2 ${viewSettings.flowMode ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30' : 'text-white/40'}`}
                        title="Flow Mode - Compact factories, emphasized belts"
                    >
                        <GitBranch size={16} />
                    </button>

                    <div className="h-6 w-px bg-white/5 mx-0.5" />

                    <button
                        onClick={() => toggleViewSetting('showLabels')}
                        className={`glass-button !p-2 ${viewSettings.showLabels ? 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30' : 'text-white/40'}`}
                        title="Toggle Labels"
                    >
                        <Eye size={16} />
                    </button>
                    <button
                        onClick={() => toggleViewSetting('showFlow')}
                        className={`glass-button !p-2 ${viewSettings.showFlow ? 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30' : 'text-white/40'}`}
                        title="Toggle Flow Animation"
                    >
                        <Activity size={16} />
                    </button>
                    <button
                        onClick={() => toggleViewSetting('bundleLanes')}
                        className={`glass-button !p-2 ${viewSettings.bundleLanes ? 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30' : 'text-white/40'}`}
                        title="Bundle Lanes (Ribbon Mode)"
                    >
                        <Layers size={16} />
                    </button>
                    <button
                        onClick={() => toggleViewSetting('autoIncrementSource')}
                        className={`glass-button !p-2 ${viewSettings.autoIncrementSource ? 'text-amber-400 bg-amber-400/10 border-amber-400/30' : 'text-white/40'}`}
                        title="Auto-increment Source Rate on Connection"
                    >
                        <TrendingUp size={16} />
                    </button>

                    <div className="h-6 w-px bg-white/5 mx-0.5" />

                    <button
                        onClick={() => toggleViewSetting('snapToGrid')}
                        className={`glass-button !p-2 ${viewSettings.snapToGrid ? 'text-indigo-400 bg-indigo-400/10 border-indigo-400/30' : 'text-white/40'}`}
                        title="Snap to Grid"
                    >
                        <Grid3X3 size={16} />
                    </button>
                </div>
            </div>

            <div className="flex items-center space-x-6">
                <button
                    onClick={onOpenEditor}
                    className="glass-button flex items-center gap-2 group"
                >
                    <Settings size={16} className="group-hover:rotate-90 transition-transform duration-500" />
                    <span className="text-xs font-bold uppercase tracking-wider">Game Data</span>
                </button>
            </div>
        </div>
    );
};
