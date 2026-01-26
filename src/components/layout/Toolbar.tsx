import React from 'react';
import {
    Settings,
    Plus,
    Save,
    Download,
    Upload,
    RotateCcw,
    Package
} from 'lucide-react';
import { useLayoutStore } from '@/stores/layoutStore';
import { useReactFlow } from 'reactflow';

interface ToolbarProps {
    className?: string;
    onOpenEditor?: () => void;
    onAddBlock?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ className = '', onOpenEditor, onAddBlock }) => {
    const { saveToStorage, loadFromStorage, exportLayout, importLayout, addSplitter } = useLayoutStore();
    const { getViewport, project } = useReactFlow();

    const handleAddSplitter = () => {
        // Project center of window to flow space
        // project() automatically accounts for viewport x, y and zoom
        const center = project({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2
        });
        addSplitter('splitter', center);
    };

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
                    <span className="font-black italic text-xl tracking-tighter text-white">DSP<span className="text-primary NOT-italic">FLOW</span></span>
                </div>

                <div className="h-8 w-px bg-white/10 mx-2" />

                <button
                    onClick={onAddBlock}
                    className="glass-button-primary"
                >
                    <Plus size={16} />
                    <span>New Block</span>
                </button>

                <button
                    onClick={handleAddSplitter}
                    className="glass-button flex items-center gap-2"
                    title="Add Splitter/Merger"
                >
                    <Plus size={14} className="text-amber-500" />
                    <span>Splitter</span>
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
