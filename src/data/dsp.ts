import { GameDefinition } from '@/types/game';

// DSP Initial Data (mock)
export const DSP_DATA: GameDefinition = {
    id: 'dsp',
    name: 'Dyson Sphere Program',
    version: '0.10',
    items: [
        { id: "iron-ore", name: "Iron Ore", category: "ore", stackSize: 100 },
        { id: "copper-ore", name: "Copper Ore", category: "ore", stackSize: 100 },
        { id: "crude-oil", name: "Crude Oil", category: "fluid", stackSize: 20 },
        { id: "refined-oil", name: "Refined Oil", category: "fluid", stackSize: 20 },
        { id: "hydrogen", name: "Hydrogen", category: "fluid", stackSize: 20 },
        { id: "iron-ingot", name: "Iron Ingot", category: "ingot", stackSize: 100 },
        { id: "copper-ingot", name: "Copper Ingot", category: "ingot", stackSize: 100 },
        { id: "magnet", name: "Magnet", category: "component", stackSize: 100 },
        { id: "magnetic-coil", name: "Magnetic Coil", category: "component", stackSize: 100 },
        { id: "gear", name: "Gear", category: "component", stackSize: 100 },
        { id: "circuit-board", name: "Circuit Board", category: "component", stackSize: 100 },
        { id: "electromagnetic-matrix", name: "Electromagnetic Matrix", category: "science", stackSize: 100 }
    ],
    recipes: [
        {
            id: "iron-ingot",
            name: "Iron Ingot",
            machineId: "arc-smelter",
            inputs: [{ itemId: "iron-ore", amount: 1 }],
            outputs: [{ itemId: "iron-ingot", amount: 1 }],
            craftingTime: 1.0,
            category: "smelting"
        },
        {
            id: "copper-ingot",
            name: "Copper Ingot",
            machineId: "arc-smelter",
            inputs: [{ itemId: "copper-ore", amount: 1 }],
            outputs: [{ itemId: "copper-ingot", amount: 1 }],
            craftingTime: 1.0,
            category: "smelting"
        },
        {
            id: "magnet",
            name: "Magnet",
            machineId: "arc-smelter",
            inputs: [{ itemId: "iron-ore", amount: 1 }],
            outputs: [{ itemId: "magnet", amount: 1 }],
            craftingTime: 1.5,
            category: "smelting"
        },
        {
            id: "gear",
            name: "Gear",
            machineId: "assembler-mk1",
            inputs: [{ itemId: "iron-ingot", amount: 1 }],
            outputs: [{ itemId: "gear", amount: 1 }],
            craftingTime: 1.0,
            category: "assembling"
        },
        {
            id: "magnetic-coil",
            name: "Magnetic Coil",
            machineId: "assembler-mk1",
            inputs: [
                { itemId: "magnet", amount: 2 },
                { itemId: "copper-ingot", amount: 1 }
            ],
            outputs: [{ itemId: "magnetic-coil", amount: 2 }],
            craftingTime: 1.0,
            category: "assembling"
        },
        {
            id: "plasma-refining",
            name: "Plasma Refining",
            machineId: "chemical-plant",
            inputs: [{ itemId: "crude-oil", amount: 2 }],
            outputs: [
                { itemId: "refined-oil", amount: 2 },
                { itemId: "hydrogen", amount: 1 }
            ],
            craftingTime: 4.0,
            category: "chemical"
        },
        {
            id: "mining-iron",
            name: "Mining: Iron Ore",
            machineId: "mining-machine",
            inputs: [],
            outputs: [{ itemId: "iron-ore", amount: 1 }],
            craftingTime: 1.0,
            category: "mining"
        },
        {
            id: "mining-copper",
            name: "Mining: Copper Ore",
            machineId: "mining-machine",
            inputs: [],
            outputs: [{ itemId: "copper-ore", amount: 1 }],
            craftingTime: 1.0,
            category: "mining"
        }
    ],

    machines: [
        {
            id: "arc-smelter",
            name: "Arc Smelter",
            category: "smelter",
            speed: 1.0,
            powerUsage: 360000,
            size: { width: 2, height: 2 }
        },
        {
            id: "assembler-mk1",
            name: "Assembling Machine Mk.I",
            category: "assembler",
            speed: 0.75,
            powerUsage: 270000,
            size: { width: 2, height: 2 }
        },
        {
            id: "assembler-mk2",
            name: "Assembling Machine Mk.II",
            category: "assembler",
            speed: 1.0,
            powerUsage: 540000,
            size: { width: 2, height: 2 }
        },
        {
            id: "chemical-plant",
            name: "Chemical Plant",
            category: "chemical",
            speed: 1.0,
            powerUsage: 720000,
            size: { width: 3, height: 3 }
        },
        {
            id: "mining-machine",
            name: "Mining Machine",
            category: "miner",
            speed: 1.0,
            powerUsage: 420000,
            size: { width: 3, height: 3 }
        }
    ],

    belts: [
        { id: "belt-mk1", name: "Conveyor Belt Mk.I", tier: 1, itemsPerSecond: 6, color: "#9CA3AF" },
        { id: "belt-mk2", name: "Conveyor Belt Mk.II", tier: 2, itemsPerSecond: 12, color: "#22C55E" },
        { id: "belt-mk3", name: "Conveyor Belt Mk.III", tier: 3, itemsPerSecond: 30, color: "#3B82F6" }
    ],
    settings: {
        lanesPerBelt: 1,
        hasSpeedModifiers: true,
        rateUnit: 'minute',
        gridSize: 1
    }
};
