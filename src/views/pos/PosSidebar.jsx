import React from 'react';
import { usePosContext } from './PosContext';

export default function PosSidebar({ 
    categories, 
    dragCatRef, 
    dropCatRef, 
    handleCatDragEnd, 
    catClassesInactive, 
    catBgActive, 
    catTextActive,
    posUI
}) {
    const { isAdmin, selectedCategory, setSelectedCategory } = usePosContext();
    const displayCategory = selectedCategory || (categories.length > 0 ? categories[0] : '');

    return (
        <div className="pt-5 pb-3 px-4 sm:px-6 overflow-x-auto no-scrollbar shrink-0 w-full bg-transparent">
            <div className="flex gap-3 w-max items-center">
                {categories.map((cat, idx) => (
                    <button 
                        key={cat} 
                        draggable={isAdmin}
                        onDragStart={() => { if(dragCatRef) dragCatRef.current = idx; }}
                        onDragEnter={() => { if(dropCatRef) dropCatRef.current = idx; }}
                        onDragEnd={handleCatDragEnd}
                        onDragOver={e => e.preventDefault()}
                        onClick={() => setSelectedCategory(cat)} 
                        className={`px-5 sm:px-7 rounded-full font-bold transition-all duration-300 whitespace-nowrap text-sm sm:text-[15px] flex items-center justify-center border-2 ${displayCategory === cat ? 'shadow-[0_8px_16px_-6px_rgba(0,0,0,0.3)] scale-105 border-transparent' : catClassesInactive} ${isAdmin ? 'cursor-move' : ''}`} 
                        style={displayCategory === cat ? { minWidth: `${posUI?.catWidth || 100}px`, height: `${posUI?.catHeight || 40}px`, backgroundColor: catBgActive, color: catTextActive } : { minWidth: `${posUI?.catWidth || 100}px`, height: `${posUI?.catHeight || 40}px` }}
                    >
                        {cat}
                    </button>
                ))}
            </div>
        </div>
    );
}
