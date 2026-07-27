import React from 'react';

export interface PageTab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface PageTabsProps {
  tabs: PageTab[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}

/** Horizontal tab bar — clicking a tab shows content/forms inline (no popups). */
export const PageTabs: React.FC<PageTabsProps> = ({
  tabs,
  active,
  onChange,
  className = '',
}) => (
  <div className={`page-tabs ${className}`.trim()} role="tablist">
    {tabs.map((tab) => (
      <button
        key={tab.id}
        type="button"
        role="tab"
        aria-selected={active === tab.id}
        className={`page-tab${active === tab.id ? ' is-active' : ''}`}
        onClick={() => onChange(tab.id)}
      >
        {tab.icon}
        {tab.label}
      </button>
    ))}
  </div>
);

export default PageTabs;
