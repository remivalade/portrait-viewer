// frontend/src/App.jsx

// Removed useMemo, kept others
import React, { useState, useEffect, useCallback } from 'react';
import InfiniteScroll from 'react-infinite-scroll-component';
import PortraitCard from './components/PortraitCard';
import SkeletonCard from './components/SkeletonCard';

// Use actual API base provided by api.js structure
const API_BASE_URL = import.meta.env.VITE_API_URL || ''; // Use VITE_API_URL or empty string
const PORTRAITS_API_ENDPOINT = `${API_BASE_URL}/api/portraits`;
const SEARCH_API_ENDPOINT = `${API_BASE_URL}/api/portraits/search`; // New endpoint

const ITEMS_PER_PAGE = 60;
const SEARCH_THRESHOLD = 3;
const DEBOUNCE_DELAY = 400; // ms

// --- Custom Debounce Hook ---
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedValue(value); }, delay);
    return () => { clearTimeout(handler); };
  }, [value, delay]);
  return debouncedValue;
}

// --- Shuffle Function (Keep) ---
function shuffleArray(array) { /* ... */ }


function App() {
  // --- State variables ---
  const [portraits, setPortraits] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalPortraits, setTotalPortraits] = useState(0); // Total based on current view
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isMadeByBoxOpen, setIsMadeByBoxOpen] = useState(false); // For click toggle
  const [searchQuery, setSearchQuery] = useState(''); // Raw search input

  // --- Debounced search query ---
  const debouncedSearchQuery = useDebounce(searchQuery, DEBOUNCE_DELAY);

  // --- Fetch Logic (Handles both search and normal listing) ---
  const fetchPortraits = useCallback(async (currentPage, currentSearch = '') => {
    if (isLoading && currentPage > 1) return;

    setIsLoading(true);
    if (currentPage === 1) {
      setIsInitialLoading(true);
      setPortraits([]); // Clear results when starting new fetch (page 1)
    } else {
      setIsInitialLoading(false);
    }
    setError(null);

    const searchTerm = currentSearch.trim();
    let url;

    // Determine API endpoint based on search term
    if (searchTerm.length >= SEARCH_THRESHOLD) {
      url = `${SEARCH_API_ENDPOINT}?q=${encodeURIComponent(searchTerm)}&page=${currentPage}&limit=${ITEMS_PER_PAGE}`;
      console.log(`Workspaceing SEARCH results: ${url}`);
    } else {
      url = `${PORTRAITS_API_ENDPOINT}?page=${currentPage}&limit=${ITEMS_PER_PAGE}`;
      console.log(`Workspaceing unfiltered results: ${url}`);
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
         let errorMsg = `HTTP error! status: ${response.status}`;
         try { // Try to get more specific error from backend response body
            const errData = await response.json();
            errorMsg = errData.error || errorMsg;
         } catch (_) { /* Ignore parsing error */ }
         throw new Error(errorMsg);
      }
      const data = await response.json();

      setPortraits(prev => currentPage === 1 ? data.portraits : [...prev, ...data.portraits]);
      setTotalPortraits(data.total); // Total is now specific to search or full list
      setHasMore((currentPage === 1 ? data.portraits.length : portraits.length + data.portraits.length) < data.total);

    } catch (e) {
      console.error("Failed to fetch portraits:", e);
      setError(`Failed to load portraits: ${e.message}. Please try refreshing.`);
      setHasMore(false);
      setPortraits([]); // Clear results on error
      setTotalPortraits(0);
    } finally {
      setIsLoading(false);
      setIsInitialLoading(false);
    }
  }, [isLoading, portraits.length]); // Depend on portraits.length for hasMore calculation


  // --- Effect to Fetch Data When Debounced Search Changes ---
  useEffect(() => {
    const query = debouncedSearchQuery.trim();
    // Trigger fetch if query is long enough OR if it's cleared (empty string)
    if (query.length >= SEARCH_THRESHOLD || query.length === 0) {
      setPage(1); // Reset to page 1
      fetchPortraits(1, query); // Fetch based on new query
    } else {
      // Query is 1 or 2 chars - don't fetch, clear results and show message?
      // setPortraits([]); // Optional: Clear results immediately
      // setTotalPortraits(0);
      // setHasMore(false);
    }
  }, [debouncedSearchQuery, fetchPortraits]);


  // --- Load More Logic ---
  const loadMore = () => {
    if (!isLoading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      // Fetch next page using the current debounced query
      fetchPortraits(nextPage, debouncedSearchQuery.trim());
    }
  };

  // --- REMOVED Memoized Filtering Logic ---
  // const filteredPortraits = useMemo(() => { ... });

  // --- Skeleton component helper (Keep) ---
  const Skeletons = () => {
    if (!isLoading || portraits.length > 0) return null;
    const count = isInitialLoading ? ITEMS_PER_PAGE : 12;
    return Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={`skeleton-${index}`} />
    ));
  };


  // --- JSX Return ---
  return (
    <div className="max-w-screen-lg mx-auto px-4 pb-8 pt-20 text-gray-100"> {/* ADJUST PADDING TOP */}

      {/* --- Header with UNCOMMENTED Search Input --- */}
      <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-screen-lg mx-auto px-4 z-20 bg-gray-900/80 backdrop-blur-md shadow-lg py-2">
        <div className="flex items-center justify-between w-full">
          {/* Logo and Title Group */}
          <div className="flex items-center space-x-2 md:space-x-3">
            <img src="/portrait-viewer-logo.png" alt="Portrait Viewer logo" className="w-auto h-8" />
            <span className="text-gray-100 font-sans text-xl md:text-2xl">
              Discover<span className="bg-gradient-to-r from-purple-500 via-orange-500 to-yellow-500 bg-clip-text text-transparent font-serif italic inline">&nbsp;new&nbsp;</span>portraits!
            </span>
          </div>

          {/* --- Search Input - UNCOMMENTED and Functional --- */}
          <div className="flex-grow mx-4 max-w-xs">
             <input
               type="search"
               placeholder="Search portraits (3+ chars)..." // Updated placeholder
               className="w-full px-3 py-1.5 rounded-md bg-gray-700/50 border border-gray-600/70 text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
               value={searchQuery} // Controlled input
               onChange={(e) => setSearchQuery(e.target.value)} // Update raw query state -> triggers debounce -> triggers useEffect
             />
           </div>
          {/* --- End Search Input --- */}

        </div>
      </header>
      {/* --- End Header --- */}

      {/* Description Paragraph */}
      <p className="text-center text-base text-gray-400 max-w-2xl mx-auto mt-6 mb-8">
        Scroll to find live "portraits", decentralized micro-websites... {/* Truncated */}
      </p>

      {/* Error message */}
      {error && !isLoading && ( <div className="text-center text-red-400 bg-red-900/30 p-4 rounded-md border border-red-600 mb-4"><p><strong>Error:</strong> {error}</p></div> )}

      {/* Infinite Scroll Container - Renders portraits state */}
      {(!error || isLoading) && (
        <InfiniteScroll
          dataLength={portraits.length} // Length of current results
          next={loadMore}
          hasMore={hasMore && !error} // Use hasMore from API
          loader={
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6 mt-6">
               <Skeletons />
            </div>
          }
          endMessage={
            !isLoading && !hasMore && portraits.length > 0 ? (
              <p className="text-center text-gray-400 mt-8 py-4">
                {debouncedSearchQuery.length >= SEARCH_THRESHOLD
                  ? <b>End of search results.</b>
                  : <b>Yay! You have seen it all.</b>
                }
              </p>
            ) : null
          }
          style={{ overflow: 'visible' }}
        >
          {/* Portrait Grid - Renders portraits state */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
            {/* Render directly from portraits state */}
            {portraits.map((portrait) => (
              <PortraitCard key={portrait.id} portrait={portrait} />
            ))}
          </div>
        </InfiniteScroll>
      )}
      {/* End Infinite Scroll */}

       {/* No Results Message (Server-side) */}
       {!isLoading && !error && debouncedSearchQuery.length >= SEARCH_THRESHOLD && portraits.length === 0 && !isInitialLoading && ( // Check !isInitialLoading to avoid showing during initial search fetch
         <p className="text-center text-gray-400 mt-8 py-4">
            No portraits found matching "{debouncedSearchQuery}".
         </p>
       )}

       {/* Message while search query is below threshold (optional) */}
       {searchQuery.length > 0 && searchQuery.length < SEARCH_THRESHOLD && (
         <p className="text-center text-gray-400 mt-8 py-4">
            Please enter at least {SEARCH_THRESHOLD} characters to search.
         </p>
       )}

      {/* Counter Display - Uses totalPortraits from API */}
       {totalPortraits > 0 && !isLoading && (
           <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-10 p-2 px-3 rounded-lg bg-gray-900/30 backdrop-blur-md border border-gray-700/50 text-gray-100 text-xs shadow-lg">
              {portraits.length} / {totalPortraits} {debouncedSearchQuery.length >= SEARCH_THRESHOLD ? 'Matching' : ''} Portraits
           </div>
       )}

      {/* "Made by" Box (Click Toggle + Social Links Hover) */}
      <div
          onClick={() => setIsMadeByBoxOpen(prev => !prev)} // Click toggle
          className="fixed bottom-4 right-4 z-10 rounded-lg bg-gray-800/40 backdrop-blur-md border border-gray-700/40 shadow-md transition-all duration-300 ease-in-out overflow-hidden cursor-pointer"
      >
         {!isMadeByBoxOpen ? (
              // Compact View
              <div className="flex items-center space-x-2 p-2">
                  <img src="https://irys.portrait.host/FEQnDav4onGWwukVL1-p1ytDMaZu6Cai0AxvUPMRemw" alt="remivalade profile picture" className="w-6 h-6 rounded-full border border-gray-600/50"/>
                  <span className="text-xs text-gray-200 font-medium" title="Show info">made by remivalade</span>
              </div>
          ) : (
             // Expanded View
             <div className="p-4 w-48 flex flex-col items-center text-center">
                 <img src="https://irys.portrait.host/FEQnDav4onGWwukVL1-p1ytDMaZu6Cai0AxvUPMRemw" alt="remivalade profile picture" className="w-16 h-16 rounded-full border-2 border-gray-600/70 mb-3 shadow-md"/>
                 <p className="text-sm font-medium text-gray-100 mb-1">Hi, I'm Rémi.</p>
                 <p className="text-xs text-gray-300 mb-3">I hope you like what you see there.</p>
                 {/* Social Links */}
                 <div className="flex items-center justify-center space-x-4 mb-4">
                     <a href="https://www.linkedin.com/in/remivalade/" onClick={e => e.stopPropagation()} target="_blank" rel="noopener noreferrer" title="Rémi Valade on LinkedIn" className="p-1 rounded-md border border-transparent hover:border-purple-400/50 transition-all duration-200 ease-in-out hover:scale-110 block">
                         <img src="/linkedin.svg" alt="LinkedIn" className="w-5 h-5 block" />
                     </a>
                     <a href="https://x.com/remivalade" onClick={e => e.stopPropagation()} target="_blank" rel="noopener noreferrer" title="Rémi Valade on X" className="p-1 rounded-md border border-transparent hover:border-purple-400/50 transition-all duration-200 ease-in-out hover:scale-110 block">
                          <img src="/x.svg" alt="X" className="w-5 h-5 block" />
                     </a>
                 </div>
                 {/* Animated Button */}
                 <a href="https://portrait.so/remivalade"
                    onClick={e => e.stopPropagation()}
                    target="_blank" rel="noopener noreferrer"
                    className="relative inline-flex items-center justify-center space-x-2 mt-3 px-3 py-1.5 border border-gray-600 text-gray-100 hover:text-white rounded-md shadow-sm text-xs font-medium w-full overflow-hidden group bg-gradient-to-r from-purple-500 via-orange-500 to-yellow-500 bg-[length:300%_100%] bg-no-repeat hover:animate-gradient-sweep transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20"
                 >
                    <span className="absolute top-0 right-0 w-10 h-full -mt-1 transition-all duration-700 transform translate-x-12 bg-white opacity-20 rotate-12 group-hover:-translate-x-56 ease-out"></span>
                    <span className="relative z-10 transition-colors duration-300">Check my Portrait</span>
                 </a>
             </div>
          )}
      </div>
      {/* --- End of "Made by" Box --- */}

    </div> // End of main container div
  ); // End of return statement
} // End of App function

export default App;