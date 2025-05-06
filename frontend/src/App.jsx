// frontend/src/App.jsx
import React, { useState, useEffect, useCallback } from 'react';
import InfiniteScroll from 'react-infinite-scroll-component';
import PortraitCard from './components/PortraitCard';
import SkeletonCard from './components/SkeletonCard'; // Assuming handles 'repeat'

// Config
const API_BASE_URL        = import.meta.env.VITE_API_URL || '';
const PORTRAITS_API       = `${API_BASE_URL}/api/portraits`;
const SEARCH_API          = `${API_BASE_URL}/api/portraits/search`;
const ITEMS_PER_PAGE      = 60;
const SEARCH_THRESHOLD    = 3;
const DEBOUNCE_DELAY      = 400;

// Debounce helper
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// Main component
export default function App() {
  const [portraits, setPortraits]       = useState([]);
  const [page, setPage]                 = useState(1);
  const [hasMore, setHasMore]           = useState(true);
  const [totalPortraits, setTotal]      = useState(0);
  const [isLoading, setIsLoading]       = useState(false);
  const [isInitialLoading, setInit]     = useState(true); // Start true
  const [error, setError]               = useState(null);
  const [searchQuery, setSearchQuery]   = useState('');
  const debouncedQuery                  = useDebounce(searchQuery, DEBOUNCE_DELAY);

  // Filter State - Defaulting to 'live' as requested
  const [filterMode, setFilterMode]     = useState('live');

  // "Made By" Box State (Click Toggle)
  const [isMadeByBoxOpen, setIsMadeByBoxOpen] = useState(false);

  // Stable fetch callback
  const fetchPortraits = useCallback(async (currentPage = 1, currentFilter = 'live', currentSearch = '') => {
    console.log(`>>> fetchPortraits called: page=${currentPage}, filter=${currentFilter}, search="${currentSearch}"`);
    setIsLoading(true);
    if (currentPage === 1) {
      setInit(true);
      setPortraits([]);
    } else {
      setInit(false);
    }
    setError(null);

    const term = currentSearch.trim();
    const isSearching = term.length >= SEARCH_THRESHOLD;
    const baseUrl = isSearching ? SEARCH_API : PORTRAITS_API;

    // Use URLSearchParams for cleaner query string building
    const params = new URLSearchParams({
        page: currentPage,
        limit: ITEMS_PER_PAGE,
    });

    if (isSearching) {
        params.append('q', term);
    }

    // --- Add filter parameter according to brief ---
    // If filter is 'live' (or empty, which we treat as 'live' by default),
    // the backend brief says this is the default and doesn't strictly need a parameter,
    // but the api.js handles `filter=live` explicitly, so we send it.
    // Send 'avatar' or 'all' when selected.
    if (currentFilter === 'live') {
        params.append('filter', 'live');
    } else if (currentFilter === 'avatar') {
        params.append('filter', 'avatar');
    } else if (currentFilter === 'all'){
        params.append('filter', 'all');
    }
    // Note: The brief mentions 'live,avatar' - you could add another filterMode for this if needed.

    const url = `${baseUrl}?${params.toString()}`;
    console.log(`Workspaceing: ${url}`); // Log the exact URL being fetched

    try {
      const res  = await fetch(url);
      console.log(`Received response for ${url}, Status: ${res.status}, OK: ${res.ok}`);

      const contentType = res.headers.get("content-type");
      if (!res.ok || !contentType || !contentType.includes("application/json")) {
          let errorText = `HTTP error! Status: ${res.status}`;
          try {
             const text = await res.text(); console.error("Non-JSON response:", text);
             errorText = text.startsWith('<!doctype') ? `${errorText} (Received HTML)` : `${errorText}: ${text.substring(0, 100)}...`;
          } catch (_) { /* Ignore */ }
          throw new Error(errorText);
      }
      const data = await res.json();

      // No client-side filtering needed now that backend handles it
      setPortraits(prev => currentPage === 1 ? data.portraits : [...prev, ...data.portraits]);
      setTotal(data.total); // Use total count directly from API

      // Calculate hasMore based on total from API
      const alreadyFetched = (currentPage - 1) * ITEMS_PER_PAGE + data.portraits.length;
      setHasMore(alreadyFetched < data.total);

    } catch (e) {
      console.error("Fetch error:", e);
      setError(`Failed to load portraits: ${e.message}. Please try again.`);
      setHasMore(false); setPortraits([]); setTotal(0);
    } finally {
      setIsLoading(false); setInit(false);
    }
  }, []); // Keep stable callback

  // Fetch when filter or debounced search changes
  useEffect(() => {
    const q = debouncedQuery.trim();
    if (q.length >= SEARCH_THRESHOLD || q.length === 0) {
      console.log(`>>> useEffect: Fetching page 1 for filter='${filterMode}', query='${q}'`);
      setPage(1);
      fetchPortraits(1, filterMode, q);
    } else {
       console.log(`>>> useEffect: Query "${q}" below threshold.`);
       setPortraits([]); setTotal(0); setHasMore(false); setError(null); // Clear results if query too short
    }
  }, [debouncedQuery, filterMode, fetchPortraits]);


  // “Load more” handler
  const loadMore = () => {
    if (isLoading || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPortraits(nextPage, filterMode, debouncedQuery.trim()); // Pass filter and query
  };

   // Handler for filter button clicks
  const handleFilterChange = (newFilterMode) => {
    if (newFilterMode !== filterMode) {
        setFilterMode(newFilterMode); // Update state, useEffect will trigger fetch
    }
  };

  // Render
  return (
    <div className="max-w-screen-lg mx-auto px-4 pb-8 pt-24 text-gray-100"> {/* Increased pt slightly */}

      {/* Header */}
      <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-screen-lg bg-gray-900/80 backdrop-blur-md shadow-lg z-20 px-4 py-2">
         {/* ... Header content ... */}
         <div className="flex items-center justify-between">
           <div className="flex items-center space-x-3">
             <img src="/portrait-viewer-logo.png" alt="Portrait Viewer logo" className="h-8 w-auto" />
             <span className="text-xl md:text-2xl text-gray-100">Discover<span className="bg-gradient-to-r from-purple-500 via-orange-500 to-yellow-500 bg-clip-text text-transparent font-serif italic">&nbsp;new&nbsp;</span>portraits</span>
           </div>
           <input type="search" placeholder="Search (3+ chars)…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-grow max-w-xs rounded-md bg-gray-800/70 border border-gray-700 px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"/>
        </div>
      </header>

      {/* Description Paragraph */}
      <p className="text-center text-base text-gray-400 max-w-2xl mx-auto mt-6 mb-6">
         Scroll to find live "portraits", decentralized micro-websites...
      </p>

      {/* Filter Buttons UI */}
      <div className="flex justify-center items-center space-x-4 mb-8">
        {['live', 'avatar', 'all'].map((mode) => (
          <button
            key={mode}
            onClick={() => handleFilterChange(mode)}
            className={`px-4 py-1.5 text-sm rounded-md border transition-colors duration-200 ${
              filterMode === mode
                ? 'bg-purple-600 border-purple-500 text-white shadow-md'
                : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 hover:border-gray-500'
            }`}
          >
            {mode === 'live' ? 'Live Only' : mode === 'avatar' ? 'With Avatar' : 'All Portraits'}
          </button>
        ))}
      </div>

      {/* Error message */}
      {error && !isLoading && ( <p className="text-center text-red-400 my-4">{error}</p> )}

      {/* InfiniteScroll Area */}
      <InfiniteScroll
        dataLength={portraits.length}
        next={loadMore}
        hasMore={hasMore && !error}
        loader={
          isLoading && hasMore ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mt-4 p-4"> {/* Halo Fix Padding */}
                <SkeletonCard repeat={10} /> {/* Using repeat prop */}
              </div>
          ) : null
        }
        endMessage={
          !isLoading && !hasMore && !error ? (
            <p className="text-center text-gray-500 mt-8 py-4 text-sm">
              {totalPortraits > 0
                  ? `Showing all ${totalPortraits} ${debouncedQuery.length >= SEARCH_THRESHOLD ? 'matching ' : ''}${filterMode !== 'all' ? `${filterMode} ` : ''}portrait${totalPortraits !== 1 ? 's' : ''}.`
                  : (debouncedQuery.length >= SEARCH_THRESHOLD ? 'No matching portraits found.' : 'No portraits found.')
              }
            </p>
          ) : null
        }
        className="overflow-visible"
      >
        {/* Grid for Portraits & Initial Skeletons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4"> {/* Halo Fix Padding */}
          {/* --- COMBINED Conditional Rendering --- */}
        {isInitialLoading && !error ? (
          // If initial loading and no error, show skeletons
          <SkeletonCard repeat={ITEMS_PER_PAGE} /> // Use the repeat prop as in your code
        ) : (
          // Otherwise (not initial loading or error occurred), render portraits map
          // map over an empty array renders nothing, handling the error/no-results case
          portraits.map(p => (
            <PortraitCard key={p.id} portrait={p} />
          ))
        )}
        {/* --- End COMBINED Conditional Rendering --- */}
        </div>
      </InfiniteScroll>

       {/* No Results Message */}
       {!isLoading && !error && debouncedQuery.length >= SEARCH_THRESHOLD && portraits.length === 0 && !isInitialLoading && (
         <p className="text-center text-gray-400 mt-8 py-4">No portraits found matching "{debouncedQuery}".</p>
       )}

       {/* Min Chars Message */}
       {searchQuery.length > 0 && searchQuery.length < SEARCH_THRESHOLD && !isLoading && !error && (
         <p className="text-center text-gray-400 mt-8 py-4">Enter at least {SEARCH_THRESHOLD} characters.</p>
       )}

      {/* Counter */}
      {totalPortraits > 0 && !isLoading && !error && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-10 p-2 px-3 rounded-lg bg-gray-900/30 backdrop-blur-md border border-gray-700/50 text-gray-100 text-xs shadow-lg">
          {/* Updated text */}
          {portraits.length} / {totalPortraits} {filterMode !== 'all' ? `(${filterMode}) ` : ''}{debouncedQuery.length >= SEARCH_THRESHOLD ? 'Matching ' : ''}Portraits
        </div>
      )}

      {/* "Made by" Box (using click toggle) */}
      <div
         onClick={() => setIsMadeByBoxOpen(prev => !prev)}
         className="fixed bottom-4 right-4 z-10 rounded-lg bg-gray-800/40 backdrop-blur-md border border-gray-700/40 shadow-md transition-all duration-300 ease-in-out overflow-hidden cursor-pointer"
      >
         {/* Content using click toggle */}
       {!isMadeByBoxOpen ? (
         <div className="flex items-center space-x-2 p-2">
             <img src="https://irys.portrait.host/FEQnDav4onGWwukVL1-p1ytDMaZu6Cai0AxvUPMRemw" alt="remivalade profile picture" className="w-6 h-6 rounded-full border border-gray-600/50"/>
             <span className="text-xs text-gray-200 font-medium" title="Show info">made by remivalade</span>
         </div>
        ) : (
          <div className="p-4 w-48 flex flex-col items-center text-center">
              <img src="https://irys.portrait.host/FEQnDav4onGWwukVL1-p1ytDMaZu6Cai0AxvUPMRemw" alt="remivalade profile picture" className="w-16 h-16 rounded-full border-2 border-gray-600/70 mb-3 shadow-md"/>
              <p className="text-sm font-medium text-gray-100 mb-1">Hi, I'm Rémi.</p>
              <p className="text-xs text-gray-300 mb-3">I hope you like what you see there.</p>
              {/* Social Links */}
              <div className="flex items-center justify-center space-x-4 mb-4">
                  <a href="https://www.linkedin.com/in/remivalade/" onClick={e => e.stopPropagation()} target="_blank" rel="noopener noreferrer" title="Rémi Valade on LinkedIn" className="p-1 rounded-md border border-transparent hover:border-purple-400/50 transition-all duration-200 ease-in-out hover:scale-110 block"> <img src="/linkedin.svg" alt="LinkedIn" className="w-5 h-5 block" /> </a>
                  <a href="https://x.com/remivalade" onClick={e => e.stopPropagation()} target="_blank" rel="noopener noreferrer" title="Rémi Valade on X" className="p-1 rounded-md border border-transparent hover:border-purple-400/50 transition-all duration-200 ease-in-out hover:scale-110 block"> <img src="/x.svg" alt="X" className="w-5 h-5 block" /> </a>
              </div>
              {/* Animated Button */}
              <a href="https://portrait.so/remivalade" onClick={e => e.stopPropagation()} target="_blank" rel="noopener noreferrer" className="relative inline-flex items-center justify-center w-full px-3 py-1.5 border border-gray-600 text-gray-100 hover:text-white text-xs rounded-md shadow-sm overflow-hidden group bg-gradient-to-r from-purple-500 via-orange-500 to-yellow-500 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20">
                 <span className="absolute top-0 right-0 w-10 h-full -mt-1 bg-white opacity-20 rotate-12 transform translate-x-12 transition-all duration-700 group-hover:-translate-x-56 ease-out"></span>
                 <span className="relative z-10">Check my Portrait</span>
              </a>
          </div>
        )}
      </div> {/* End Made By Box */}

    </div> // End main container
  ); // End return
} // End App