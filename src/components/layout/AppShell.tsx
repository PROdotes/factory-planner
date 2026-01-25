import React from 'react';
import { Sidebar } from './Sidebar';
import { Toolbar } from './Toolbar';
import { NeedsPanel } from './NeedsPanel';

interface AppShellProps {
    children?: React.ReactNode;
    onOpenEditor?: () => void;
    onAddBlock?: () => void;
}

export const AppShell: React.FC<AppShellProps> = ({ children, onOpenEditor, onAddBlock }) => {
    return (
        <div className="h-screen w-screen flex flex-col bg-[#0b0f1a] text-text overflow-hidden font-sans">
            {/* Top Navigation */}
            <Toolbar
                className="flex-none z-30"
                onOpenEditor={onOpenEditor}
                onAddBlock={onAddBlock}
            />

            <div className="flex-1 flex overflow-hidden">
                {/* Left Discovery Panel */}
                <Sidebar className="flex-none z-20" />

                <main className="flex-1 relative overflow-hidden bg-[radial-gradient(circle_at_50%_50%,#1a2333_0%,#0b0f1a_100%)]">
                    <div className="absolute inset-0 z-0 pointer-events-none opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>

                    <div className="absolute inset-0 z-10 flex flex-col">
                        <div className="flex-1 relative">
                            {children}
                        </div>

                        {/* Polished Status Bar */}
                        <div className="h-8 bg-black/40 backdrop-blur-md border-t border-white/5 flex items-center px-6 text-[10px] font-bold text-textSecondary justify-between z-30 select-none uppercase tracking-widest">
                            <div className="flex space-x-6 items-center">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_var(--color-primary)]"></div>
                                    <span>Signal: Nominal</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="opacity-40">Grid:</span>
                                    <span className="text-primary">Magnetite-V4</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="opacity-40">Engine:</span>
                                    <span className="text-primary truncate max-w-[100px]">Node-Flow-2D</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-white/20 font-black italic">Antigravity Console v0.1.0</span>
                            </div>
                        </div>
                    </div>
                </main>

                <NeedsPanel className="flex-none z-20" />
            </div>
        </div>
    );
};
