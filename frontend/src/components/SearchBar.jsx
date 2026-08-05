import React from 'react';

export default function SearchBar({ searchQuery, setSearchQuery, selectedTag, setSelectedTag, availableTags }) {
  return (
    <div className="search-bar-container">
      <div className="search-input-wrapper">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          placeholder="Search notes by title, content, or #tag..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        {searchQuery && (
          <button className="search-clear-btn" onClick={() => setSearchQuery('')}>
            ✕
          </button>
        )}
      </div>

      {availableTags && availableTags.length > 0 && (
        <div className="tag-pills">
          <button
            className={`tag-pill ${!selectedTag ? 'active' : ''}`}
            onClick={() => setSelectedTag('')}
          >
            All
          </button>
          {availableTags.map((tag) => (
            <button
              key={tag}
              className={`tag-pill ${selectedTag === tag ? 'active' : ''}`}
              onClick={() => setSelectedTag(selectedTag === tag ? '' : tag)}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
