// frontend/src/App.jsx
import React, { useState, useEffect, useCallback } from 'react';
import InfiniteScroll from 'react-infinite-scroll-component';
import PortraitCard from './components/PortraitCard';
import SkeletonCard from './components/SkeletonCard';

// -----------------------------------------------------------------------------
// Config
// -----------------------------------------------------------------------------
const API_BASE_URL        = import.meta.env.VITE_API_URL || '';
const PORTRAITS_API       = `${API_BASE_URL}/api/portraits`;
const SEARCH_API          = `${API_BASE_URL}/api/portraits/search`;

const ITEMS_PER_PAGE      = 60;
const SEARCH_THRESHOLD    = 3;
const DEBOUNCE_DELAY      = 400;

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

  const [isHoveringMadeBy, setIsHoveringMadeBy] = useState(false);

  // ---------------------------------------------------------------------------
  // Stable fetch callback  (dependency array EMPTY)
  // ---------------------------------------------------------------------------
  const fetchPortraits = useCallback(async (currentPage = 1, currentSearch = '') => {
    setIsLoading(true);

    if (currentPage === 1) {
      setInit(true);
      setPortraits([]);
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
  }, []);   //  ← 🔒 keep stable

  // ---------------------------------------------------------------------------
  // Fetch when the debounced search term really changes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const q = debouncedQuery.trim();
    if (q.length >= SEARCH_THRESHOLD || q.length === 0) {
      setPage(1);
      fetchPortraits(1, q);
    }
  }, [debouncedQuery]);

  // ---------------------------------------------------------------------------
  // “Load more” handler
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

      {/* ───────────────────── Header ───────────────────── */}
      <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-screen-lg
                         bg-gray-900/80 backdrop-blur-md shadow-lg z-20 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img src="/portrait-viewer-logo.png" alt="Portrait Viewer logo" className="h-8 w-auto" />
            <span className="text-xl md:text-2xl">
              Discover
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent italic">
                &nbsp;new&nbsp;
              </span>
              portraits
            </span>
          </div>

          <input
            type="text"
            placeholder="Search (3+ chars)…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-grow max-w-xs rounded-md bg-gray-800/70 border border-gray-700 px-3 py-1.5 text-sm
                       focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-500"
          />
        </div>
      </header>

      {/* ───────────────────── Error ───────────────────── */}
      {error && (
        <p className="mt-24 text-center text-red-400">{error}</p>
      )}

      {/* ─────────────────── InfiniteScroll ──────────────── */}
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

      {/* ─────────────────── Counter ───────────────────── */}
      {totalPortraits > 0 && !isLoading && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-10 p-2 px-3 rounded-lg
                        bg-gray-900/30 backdrop-blur-md border border-gray-700/50
                        text-gray-100 text-xs shadow-lg">
          {portraits.length} / {totalPortraits} Portrait{totalPortraits > 1 ? 's' : ''}
        </div>
      )}

      {/* ──────────────── “Made by” hover card ───────────── */}
      <div
        className="fixed bottom-4 right-4 z-10 rounded-lg bg-gray-800/40 backdrop-blur-md
                   border border-gray-700/40 shadow-md transition-all duration-300
                   overflow-hidden"
        onMouseEnter={() => setIsHoveringMadeBy(true)}
        onMouseLeave={() => setIsHoveringMadeBy(false)}
      >
        {/* Compact view */}
        {!isHoveringMadeBy ? (
          <div className="flex items-center space-x-2 p-2">
            <img
              src="https://irys.portrait.host/FEQnDav4onGWwukVL1-p1ytDMaZu6Cai0AxvUPMRemw"
              alt="remivalade profile"
              className="w-6 h-6 rounded-full border border-gray-600/50"
            />
            <a
              href="https://portrait.so/remivalade"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-200 hover:text-white font-medium"
              title="View remivalade's Portrait profile"
            >
              made by remivalade
            </a>
          </div>
        ) : (
          /* Expanded view */
          <div className="p-4 w-48 flex flex-col items-center text-center">
            <img
              src="https://irys.portrait.host/FEQnDav4onGWwukVL1-p1ytDMaZu6Cai0AxvUPMRemw"
              alt="remivalade profile"
              className="w-16 h-16 rounded-full border-2 border-gray-600/70 mb-3 shadow-md"
            />
            <p className="text-sm font-medium text-gray-100 mb-1">Hi, I'm Rémi.</p>
            <p className="text-xs text-gray-300 mb-3">
              I hope you like what you see there.
            </p>

            {/* Social links */}
            <div className="flex items-center justify-center space-x-4 mb-4">
              <a
                href="https://www.linkedin.com/in/remivalade/"
                target="_blank"
                rel="noopener noreferrer"
                title="Rémi Valade on LinkedIn"
                className="p-1 rounded-md border border-transparent hover:border-purple-400/50
                           transition-all duration-200 hover:scale-110 block"
              >
                <img src="/linkedin.svg" alt="LinkedIn" className="w-5 h-5 block" />
              </a>
              <a
                href="https://x.com/remivalade"
                target="_blank"
                rel="noopener noreferrer"
                title="Rémi Valade on X"
                className="p-1 rounded-md border border-transparent hover:border-purple-400/50
                           transition-all duration-200 hover:scale-110 block"
              >
                <img src="/x.svg" alt="X" className="w-5 h-5 block" />
              </a>
            </div>

            {/* CTA button */}
            <a
              href="https://portrait.so/remivalade"
              target="_blank"
              rel="noopener noreferrer"
              className="relative inline-flex items-center justify-center w-full px-3 py-1.5
                         border border-gray-600 text-gray-100 hover:text-white text-xs rounded-md
                         shadow-sm overflow-hidden group bg-gradient-to-r
                         from-purple-500 via-orange-500 to-yellow-500
                         transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20"
            >
              <span
                className="absolute top-0 right-0 w-10 h-full -mt-1 bg-white opacity-20 rotate-12
                           transform translate-x-12 transition-all duration-700 group-hover:-translate-x-56
                           ease-out"
              />
              <span className="relative z-10">Check my Portrait</span>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
