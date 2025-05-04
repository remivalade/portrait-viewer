// frontend/src/App.jsx
import React, { useState, useEffect, useCallback } from 'react';
import InfiniteScroll from 'react-infinite-scroll-component';
import PortraitCard from './components/PortraitCard';
import SkeletonCard from './components/SkeletonCard';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------
const API_BASE_URL        = import.meta.env.VITE_API_URL || '';
const PORTRAITS_API       = `${API_BASE_URL}/api/portraits`;
const SEARCH_API          = `${API_BASE_URL}/api/portraits/search`;

const ITEMS_PER_PAGE      = 60;
const SEARCH_THRESHOLD    = 3;
const DEBOUNCE_DELAY      = 400; // ms

// -----------------------------------------------------------------------------
// Debounce helper
// -----------------------------------------------------------------------------
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// -----------------------------------------------------------------------------
// Main component
// -----------------------------------------------------------------------------
export default function App() {
  const [portraits, setPortraits]       = useState([]);
  const [page, setPage]                 = useState(1);
  const [hasMore, setHasMore]           = useState(true);
  const [totalPortraits, setTotal]      = useState(0);

  const [isLoading, setIsLoading]       = useState(false);
  const [isInitialLoading, setInit]     = useState(false);
  const [error, setError]               = useState(null);

  const [searchQuery, setSearchQuery]   = useState('');
  const debouncedQuery                  = useDebounce(searchQuery, DEBOUNCE_DELAY);

  // ---------------------------------------------------------------------------
  // fetchPortraits  ❧  **stable callback – dependency array is EMPTY**
  // ---------------------------------------------------------------------------
  const fetchPortraits = useCallback(async (currentPage = 1, currentSearch = '') => {
    console.log(`→ fetchPortraits(page=${currentPage}, q="${currentSearch}")`);
    setIsLoading(true);

    if (currentPage === 1) {
      setInit(true);
      setPortraits([]);           // reset list on a fresh search / first page
    } else {
      setInit(false);
    }
    setError(null);

    const term = currentSearch.trim();
    const url  = (term.length >= SEARCH_THRESHOLD)
      ? `${SEARCH_API}?q=${encodeURIComponent(term)}&page=${currentPage}&limit=${ITEMS_PER_PAGE}`
      : `${PORTRAITS_API}?page=${currentPage}&limit=${ITEMS_PER_PAGE}`;

    try {
      const res  = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setPortraits(prev => currentPage === 1
        ? data.portraits
        : [...prev, ...data.portraits]);
      setTotal(data.total);

      // safer “has-more” test: are there still unseen portraits server-side?
      const already = (currentPage - 1) * ITEMS_PER_PAGE + data.portraits.length;
      setHasMore(already < data.total);

    } catch (e) {
      console.error(e);
      setError(`Failed to load portraits: ${e.message}. Please try again.`);
      setHasMore(false);
      setPortraits([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
      setInit(false);
    }
  }, []);              //  ← 🔒 STABLE – no stale re-creations!

  // ---------------------------------------------------------------------------
  // Re-fetch when the *debounced* search term really changes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const q = debouncedQuery.trim();

    if (q.length >= SEARCH_THRESHOLD || q.length === 0) {
      setPage(1);
      fetchPortraits(1, q);
    }
  }, [debouncedQuery]);   //  ← only the search term, NOT the callback!

  // ---------------------------------------------------------------------------
  // “Load more” handler for InfiniteScroll
  // ---------------------------------------------------------------------------
  const loadMore = () => {
    if (isLoading || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPortraits(nextPage, debouncedQuery.trim());
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="max-w-screen-lg mx-auto px-4 pb-8 pt-20 text-gray-100">

      {/* Header -------------------------------------------------------------- */}
      <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-screen-lg
                         bg-gray-900/80 backdrop-blur-md shadow-lg z-20 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img src="/portrait-viewer-logo.png" alt="Portrait Viewer logo" className="h-8 w-auto"/>
            <span className="text-xl md:text-2xl">
              Discover<span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent italic">&nbsp;new&nbsp;</span>portraits
            </span>
          </div>

          <input
            type="text"
            placeholder="Search (3+ chars)…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-grow max-w-xs rounded-md bg-gray-800/70 border border-gray-700 px-3 py-1.5 text-sm
                       focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-500"
          />
        </div>
      </header>

      {/* Content ------------------------------------------------------------- */}
      {error && (
        <p className="mt-24 text-center text-red-400">{error}</p>
      )}

      <InfiniteScroll
        dataLength={portraits.length}
        next={loadMore}
        hasMore={hasMore && !error}
        loader={<SkeletonCard repeat={ITEMS_PER_PAGE} />}
        endMessage={
          !isLoading && !hasMore && portraits.length > 0 && (
            <p className="text-center text-gray-400 mt-6">
              {totalPortraits > 0
                ? `That's all ${totalPortraits} portrait${totalPortraits > 1 ? 's' : ''}!`
                : 'No portraits found.'}
            </p>
          )
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mt-4">
          {portraits.map(p => (
            <PortraitCard key={p.id} portrait={p} />
          ))}
          {isInitialLoading && <SkeletonCard repeat={ITEMS_PER_PAGE} />}
        </div>
      </InfiniteScroll>
    </div>
  );
}
