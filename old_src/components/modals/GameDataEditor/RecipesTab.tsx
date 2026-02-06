import React from 'react';
import { Recipe } from '@/types/game';

interface RecipesTabProps {
    recipes: Recipe[];
    selectedId: string | null;
    onSelect: (id: string) => void;
}

export const RecipesTab: React.FC<RecipesTabProps> = ({ recipes, selectedId, onSelect }) => {
    return (
        <div className="space-y-1">
            {recipes.map((recipe) => (
                <div
                    key={recipe.id}
                    onClick={() => onSelect(recipe.id)}
                    className={`p-2 rounded cursor-pointer ${selectedId === recipe.id ? 'bg-blue-900' : 'hover:bg-gray-800'}`}
                >
                    <div className="font-medium">{recipe.name}</div>
                </div>
            ))}
        </div>
    );
};
