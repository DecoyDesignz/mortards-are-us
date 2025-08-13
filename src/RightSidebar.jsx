import React from 'react';

export default function RightSidebar({
  open,
  activeTab, // 'adjust' | 'sheaf'
  setActiveTab,
  onClose,
  renderAdjustFireTab,
  renderSheafTab,
}) {
  return (
    <>
      {open && <div className="right-sidebar-backdrop" onClick={onClose} />}
      <aside className={`right-sidebar ${open ? 'open' : ''}`}>
        <div className="right-sidebar-header">
          <div className="title">Tools</div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="tabs">
          <button className={activeTab === 'adjust' ? 'active' : ''} onClick={() => setActiveTab('adjust')}>Adjust Fire</button>
          <button className={activeTab === 'sheaf' ? 'active' : ''} onClick={() => setActiveTab('sheaf')}>Sheaf</button>
        </div>

        <div className="right-tab-content">
          {activeTab === 'adjust' && renderAdjustFireTab?.()}
          {activeTab === 'sheaf' && renderSheafTab?.()}
        </div>
      </aside>
    </>
  );
}

