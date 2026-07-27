import React from 'react';
import type { MarketCategory } from '../../types';

export interface CategoryFilterProps {
  categories: MarketCategory[];
  activeSlug?: string | null;
  onChange: (slug: string | null) => void;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  categories,
  activeSlug = null,
  onChange,
}) => {
  return (
    <div className="category-filter" role="tablist" aria-label="Categories">
      <button
        type="button"
        className={`category-chip${!activeSlug ? ' active' : ''}`}
        onClick={() => onChange(null)}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          type="button"
          className={`category-chip${activeSlug === cat.slug ? ' active' : ''}`}
          onClick={() => onChange(cat.slug)}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
};

export default CategoryFilter;
