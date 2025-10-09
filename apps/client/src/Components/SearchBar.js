// SearchBar.js
import React, { useState } from "react";
import { useHistory } from "react-router-dom";
import { IoSearchSharp } from "react-icons/io5";

const SearchBar = () => {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState("all"); // Options: all, users, posts
  const history = useHistory();

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      // Navigate to search results page with query parameters
      history.push(`/search?q=${encodeURIComponent(query)}&type=${searchType}`);
    }
  };

  return (
    <form onSubmit={handleSearch} className="search-bar">
      {" "}
      <div className="search-container">
        <input
          type="text"
          placeholder="Search users and posts..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="search-input"
        />
        <select
          value={searchType}
          onChange={(e) => setSearchType(e.target.value)}
          className="search-type"
        >
          <option value="all">All</option>
          <option value="users">Users</option>
          <option value="posts">Posts</option>{" "}
        </select>{" "}
        <button type="submit" className="search-button">
          <IoSearchSharp size={28} className="search-icon" />
        </button>
      </div>
    </form>
  );
};

export default SearchBar;
