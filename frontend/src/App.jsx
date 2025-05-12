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

  // --- Single declaration for filterMode ---
  const [filterMode, setFilterMode]     = useState('live');
  // --- State for new filter panel visibility ---
  const [isFilterPanelVisible, setIsFilterPanelVisible] = useState(false);
  // --- Single declaration for "Made By" Box State (Click Toggle) ---
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

    const params = new URLSearchParams({
        page: currentPage,
        limit: ITEMS_PER_PAGE,
    });

    if (isSearching) {
        params.append('q', term);
    }

    if (currentFilter === 'live') {
        params.append('filter', 'live');
    } else if (currentFilter === 'avatar') {
        params.append('filter', 'avatar');
    } else if (currentFilter === 'all'){
        params.append('filter', 'all');
    }

    const url = `${baseUrl}?${params.toString()}`;
    console.log(`Workspaceing: ${url}`);

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

      setPortraits(prev => currentPage === 1 ? data.portraits : [...prev, ...data.portraits]);
      setTotal(data.total);

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
       setPortraits([]); setTotal(0); setHasMore(false); setError(null);
    }
  }, [debouncedQuery, filterMode, fetchPortraits]);


  // “Load more” handler
  const loadMore = () => {
    if (isLoading || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPortraits(nextPage, filterMode, debouncedQuery.trim());
  };

   // Handler for filter button clicks (for the new filter panel)
  const handleFilterChange = (newFilterMode) => {
    if (newFilterMode !== filterMode) {
        setFilterMode(newFilterMode);
        // Optionally close the panel after selection, or let onBlur handle it
        // setIsFilterPanelVisible(false);
    }
  };

  // Render
  return (
    // Increased pt slightly to clear the fixed header
    <div className="max-w-screen-lg mx-auto px-4 pb-8 pt-28 md:pt-32 text-gray-100">

      {/* Header */}
<header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-screen-lg bg-gray-900/80 backdrop-blur-md shadow-lg z-20 px-4 py-3">
    {/* This div will now be a row on all screens, but content inside changes responsively */}
    <div className="flex items-center justify-between space-x-3"> {/* space-x-3 for gap between logo-group and search-group */}
        {/* Logo + Title Section */}
        <div className="flex items-center space-x-2 md:space-x-3"> {/* space-x for gap between logo and title (on desktop) */}
            <img src="/portrait-viewer-logo.png" alt="Portrait Viewer logo" className="h-8 md:h-10 w-auto flex-shrink-0" /> {/* flex-shrink-0 to prevent logo from shrinking */}
            {/* Title Text - HIDDEN on mobile (default), SHOWN from md: screens up */}
            <span className="hidden md:inline text-xl md:text-2xl text-gray-100"> {/* md:inline ensures it appears on desktop */}
                Discover
                <span className="bg-gradient-to-r from-purple-500 via-orange-500 to-yellow-500 bg-clip-text text-transparent font-serif italic">&nbsp;new&nbsp;</span>
                portraits
            </span>
        </div>

        {/* Search Input and its Dropdown Filter Panel Wrapper */}
        {/* flex-grow will allow search to take available space on mobile */}
        <div className="relative flex-grow md:flex-grow-0 md:w-auto md:max-w-xs">
            <input
                type="search"
                placeholder="Search or filter..." // Shorter placeholder for mobile
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsFilterPanelVisible(true)}
                onBlur={() => {
                    setTimeout(() => {
                        setIsFilterPanelVisible(false);
                    }, 200);
                }}
                className="w-full rounded-lg border-none px-4 py-2 md:px-5 md:py-3 text-sm md:text-base // Smaller padding/text on mobile
                           bg-white/5 text-white placeholder-gray-400
                           outline-none backdrop-blur-md transition-all duration-300 ease-in-out
                           focus:ring-2 focus:ring-purple-500"
            />

            {/* Filter Panel (remains the same internally) */}
            <div
                className={`absolute top-full left-0 right-0 mt-1 w-full z-30
                            bg-gray-800/90 backdrop-blur-md shadow-lg rounded-lg
                            flex flex-col items-stretch space-y-1 p-2
                            transition-all duration-300 ease-in-out
                            ${isFilterPanelVisible
                                ? 'opacity-100 translate-y-0 pointer-events-auto'
                                : 'opacity-0 -translate-y-2 pointer-events-none'
                            }`
                }
            >
                {['live', 'avatar', 'all'].map((mode) => (
            <button
                key={mode}
                onClick={() => {
                    handleFilterChange(mode);
                    setIsFilterPanelVisible(false); // Close panel on selection
                }}
                className={`w-full text-left px-4 py-2 text-sm font-medium rounded-md cursor-pointer border-none
                            transition-colors duration-200 ease-in-out
                            ${filterMode === mode
                                // --- CHOOSE ONE OF THE OPTIONS BELOW ---

                                ? 'bg-white/20 text-white font-semibold shadow-md'

                                : 'text-gray-200 hover:bg-white/10' // Inactive style (current text-gray-300 or text-gray-200)
                            }`
                }
            >
                {mode === 'live' ? 'Live Only' : mode === 'avatar' ? 'With Avatar' : 'All Portraits'}
            </button>
                ))}
            </div>
        </div>
    </div>
</header>

      {/* Description Paragraph */}
      {/* Adjusted top margin to ensure it's below the fixed header + filter panel space */}
      <p className="text-center text-base text-gray-400 max-w-2xl mx-auto mb-6">
         Scroll to find live "portraits", decentralized micro-websites...
      </p>

      {/* --- REMOVED Old Filter Buttons UI div --- */}

      {/* Error message */}
      {error && !isLoading && ( <p className="text-center text-red-400 my-4">{error}</p> )}

      {/* InfiniteScroll Area */}
      <InfiniteScroll
        dataLength={portraits.length}
        next={loadMore}
        hasMore={hasMore && !error}
        loader={
          isLoading && hasMore ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mt-4 p-4">
                <SkeletonCard repeat={10} />
              </div>
          ) : null
        }
        // --- CORRECTED endMessage prop ---
        endMessage={
          !isLoading && !hasMore && !error && portraits.length > 0 ? ( // Added portraits.length > 0 check
            <p className="text-center text-gray-500 dark:text-gray-400 mt-8 py-4 text-sm">
              {totalPortraits > 0 && portraits.length >= totalPortraits // Ensure we've actually reached the total
                  ? `Showing all ${totalPortraits} ${debouncedQuery.length >= SEARCH_THRESHOLD ? 'matching ' : ''}${filterMode !== 'all' ? `${filterMode} ` : ''}portrait${totalPortraits !== 1 ? 's' : ''}.`
                  // If no portraits were found at all (e.g. initial error or empty dataset for filter)
                  : (debouncedQuery.length >= SEARCH_THRESHOLD ? 'No matching portraits found.' : (totalPortraits === 0 && portraits.length === 0) ? 'No portraits to display.' : '')
              }
            </p>
          ) : null
        }
        // --- End Correction ---
        className="overflow-visible"
      >
        {/* Grid for Portraits & Initial Skeletons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4">
        {isInitialLoading && !error ? (
          <SkeletonCard repeat={ITEMS_PER_PAGE} />
        ) : (
          portraits.map(p => (
            <PortraitCard key={p.id} portrait={p} />
          ))
        )}
        </div>
      </InfiniteScroll>

       {/* No Results Message, Min Chars Message, Counter, "Made by" Box */}
       {/* ... (These sections remain the same) ... */}
       {!isLoading && !error && debouncedQuery.length >= SEARCH_THRESHOLD && portraits.length === 0 && !isInitialLoading && (
         <p className="text-center text-gray-400 mt-8 py-4">No portraits found matching "{debouncedQuery}".</p>
       )}
       {searchQuery.length > 0 && searchQuery.length < SEARCH_THRESHOLD && !isLoading && !error && (
         <p className="text-center text-gray-400 mt-8 py-4">Enter at least {SEARCH_THRESHOLD} characters.</p>
       )}
      {totalPortraits > 0 && !isLoading && !error && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-10 p-2 px-3 rounded-lg bg-gray-900/30 backdrop-blur-md border border-gray-700/50 text-gray-100 text-xs shadow-lg">
          {portraits.length} / {totalPortraits} {filterMode !== 'all' ? `(${filterMode}) ` : ''}{debouncedQuery.length >= SEARCH_THRESHOLD ? 'Matching ' : ''}Portraits
        </div>
      )}
      <div
         onClick={() => setIsMadeByBoxOpen(prev => !prev)}
         className="fixed bottom-4 right-4 z-10 rounded-lg bg-gray-800/40 backdrop-blur-md border border-gray-700/40 shadow-md transition-all duration-300 ease-in-out overflow-hidden cursor-pointer"
      >
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
              <div className="flex items-center justify-center space-x-4 mb-4">
                  <a href="https://www.linkedin.com/in/remivalade/" onClick={e => e.stopPropagation()} target="_blank" rel="noopener noreferrer" title="Rémi Valade on LinkedIn" className="p-1 rounded-md border border-transparent hover:border-purple-400/50 transition-all duration-200 ease-in-out hover:scale-110 block"> <img src="/linkedin.svg" alt="LinkedIn" className="w-5 h-5 block" /> </a>
                  <a href="https://x.com/remivalade" onClick={e => e.stopPropagation()} target="_blank" rel="noopener noreferrer" title="Rémi Valade on X" className="p-1 rounded-md border border-transparent hover:border-purple-400/50 transition-all duration-200 ease-in-out hover:scale-110 block"> <img src="/x.svg" alt="X" className="w-5 h-5 block" /> </a>
              </div>
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