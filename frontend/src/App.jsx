// frontend/src/App.jsx

// Added useMemo to imports
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import InfiniteScroll from 'react-infinite-scroll-component';
import PortraitCard from './components/PortraitCard';
import SkeletonCard from './components/SkeletonCard';

const API_URL = import.meta.env.VITE_API_URL || '/api/portraits';
const ITEMS_PER_PAGE = 60;
const SEARCH_THRESHOLD = 3; // Minimum characters to trigger search

// --- Shuffle Function (Keep) ---
function shuffleArray(array) {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }
  return array;
}

function App() {
  // --- State variables ---
  const [portraits, setPortraits] = useState([]); // Master list from API
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalPortraits, setTotalPortraits] = useState(0);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isHoveringMadeBy, setIsHoveringMadeBy] = useState(false);
  const [searchQuery, setSearchQuery] = useState(''); // State for search input (kept but input hidden)

  // --- Fetch logic (Kept as is - Client-side search doesn't affect fetch) ---
  const fetchPortraits = useCallback(async (currentPage) => {
    if (isLoading && currentPage > 1) return;
    setIsLoading(true); setError(null);
    try {
        const response = await fetch(`${API_URL}?page=${currentPage}&limit=${ITEMS_PER_PAGE}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        setPortraits(prev => [...prev, ...data.portraits]);
        if (currentPage === 1 || totalPortraits === 0) setTotalPortraits(data.total);
        setHasMore((portraits.length + data.portraits.length) < data.total);
    } catch (e) {
        console.error("Failed to fetch portraits:", e); setError(`Failed to load portraits: ${e.message}. Please try refreshing.`); setHasMore(false);
    } finally { setIsLoading(false); }
  }, [isLoading, totalPortraits, portraits.length]);

  // --- Initial fetch (Kept as is) ---
  useEffect(() => {
    const fetchAndShuffleFirstPage = async () => {
       setPortraits([]); setPage(1); setHasMore(true); setError(null); setTotalPortraits(0); setIsLoading(true);
       try {
         const response = await fetch(`${API_URL}?page=1&limit=${ITEMS_PER_PAGE}`);
         if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
         const data = await response.json();
         const shuffledPortraits = shuffleArray([...data.portraits]);
         setPortraits(shuffledPortraits);
         setTotalPortraits(data.total);
         setHasMore(shuffledPortraits.length < data.total);
       } catch (e) {
         console.error("Failed to fetch initial portraits:", e); setError(`Failed to load portraits: ${e.message}. Please try refreshing.`); setHasMore(false);
       } finally { setIsLoading(false); }
    };
    fetchAndShuffleFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Load more logic (Kept as is - Includes check for active search) ---
  const loadMore = () => {
    // This correctly prevents loading more via scroll when search is active client-side
    if (!isLoading && hasMore && searchQuery.length < SEARCH_THRESHOLD) {
      const nextPage = page + 1; setPage(nextPage); fetchPortraits(nextPage);
    }
  };

  // --- Memoized Filtering Logic (Kept as is - Client-side search) ---
  const filteredPortraits = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (query.length < SEARCH_THRESHOLD) {
      return portraits;
    }
    return portraits.filter(p =>
      p.username.toLowerCase().includes(query)
    );
  }, [searchQuery, portraits]);


  // --- Skeleton component helper (Kept as is) ---
  const Skeletons = () => {
      const showSkeletons = isLoading && filteredPortraits.length === 0;
      const skeletonCount = showSkeletons ? (page === 1 ? ITEMS_PER_PAGE : 12) : 0;
      if (!showSkeletons) return null;
      return Array.from({ length: skeletonCount }).map((_, index) => (
          <SkeletonCard key={`skeleton-${index}`} />
      ));
  };


  // --- JSX Return ---
  return (
    <div className="max-w-screen-lg mx-auto px-4 pb-8 pt-20 text-gray-100"> {/* ADJUST PADDING TOP HERE */}

      {/* --- Always Visible Sticky Header --- */}
      <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-screen-lg mx-auto px-4 z-20 bg-gray-900/80 backdrop-blur-md shadow-lg py-2">
        <div className="flex items-center justify-between w-full">
          {/* Logo and Title Group */}
          <div className="flex items-center space-x-2 md:space-x-3">
            <img src="/portrait-viewer-logo.png" alt="Portrait Viewer logo" className="w-auto h-8" />
            <span className="text-gray-100 font-sans text-xl md:text-2xl">
              Discover<span className="bg-gradient-to-r from-purple-500 via-orange-500 to-yellow-500 bg-clip-text text-transparent font-serif italic inline">&nbsp;new&nbsp;</span>portraits!
            </span>
          </div>

          {/* --- Search Input - COMMENTED OUT --- */}
          {/*
          <div className="flex-grow mx-4 max-w-xs">
             <input
               type="search"
               placeholder="Search by username (3+ chars)..."
               className="w-full px-3 py-1.5 rounded-md bg-gray-700/50 border border-gray-600/70 text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
               value={searchQuery} // Still connected to allow future re-enabling
               onChange={(e) => setSearchQuery(e.target.value)}
             />
           </div>
          */}
          {/* --- End Search Input Comment --- */}

          {/* --- Placeholder for Search Input to maintain layout --- */}
          <div className="flex-grow mx-4 max-w-xs" aria-hidden="true"></div>

        </div>
      </header>
      {/* --- End Header --- */}

      {/* Description Paragraph */}
      <p className="text-center text-base text-gray-400 max-w-2xl mx-auto mt-6 mb-8">
        Scroll to find live "portraits", decentralized micro-websites where people share who they are, what they do, what they are working on and many other things!
      </p>

      {/* Error message */}
      {error && !isLoading && ( <div className="text-center text-red-400 bg-red-900/30 p-4 rounded-md border border-red-600 mb-4"><p><strong>Error:</strong> {error}</p></div> )}

      {/* Infinite Scroll Container - Uses filteredPortraits */}
      {!error && (
        <InfiniteScroll
          dataLength={filteredPortraits.length}
          next={loadMore}
          hasMore={searchQuery.length < SEARCH_THRESHOLD && hasMore && !error} // Correctly handles client-side search status
          loader={
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6 mt-6">
               <Skeletons />
            </div>
          }
          endMessage={
            searchQuery.length < SEARCH_THRESHOLD && !isLoading && !error && portraits.length > 0 && portraits.length >= totalPortraits ? (
              <p className="text-center text-gray-400 mt-8 py-4"><b>Yay! You have seen it all</b></p>
            ) : null
          }
          style={{ overflow: 'visible' }}
        >
          {/* Portrait Grid - Uses filteredPortraits */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
            {filteredPortraits.map((portrait) => (
              <PortraitCard key={portrait.id} portrait={portrait} />
            ))}
          </div>
        </InfiniteScroll>
      )}
      {/* End Infinite Scroll */}

       {/* No Search Results Message (Client-side) */}
       {searchQuery.length >= SEARCH_THRESHOLD && filteredPortraits.length === 0 && !isLoading && !error && (
         <p className="text-center text-gray-400 mt-8 py-4">No portraits found matching "{searchQuery}".</p>
       )}

      {/* Counter Display - Updated text */}
       {totalPortraits > 0 && !isLoading && (
           <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-10 p-2 px-3 rounded-lg bg-gray-900/30 backdrop-blur-md border border-gray-700/50 text-gray-100 text-xs shadow-lg">
              {portraits.length} / {totalPortraits} Portraits {filteredPortraits.length !== portraits.length ? `(${filteredPortraits.length} shown)` : ''}
           </div>
       )}

      {/* --- "Made by" Box (MODIFIED Expanded View) --- */}
      <div
          className="fixed bottom-4 right-4 z-10 rounded-lg bg-gray-800/40 backdrop-blur-md border border-gray-700/40 shadow-md transition-all duration-300 ease-in-out overflow-hidden"
          onMouseEnter={() => setIsHoveringMadeBy(true)}
          onMouseLeave={() => setIsHoveringMadeBy(false)}
      >
         {/* Compact View (remains the same) */}
         {!isHoveringMadeBy ? (
              <div className="flex items-center space-x-2 p-2">
                  <img src="https://irys.portrait.host/FEQnDav4onGWwukVL1-p1ytDMaZu6Cai0AxvUPMRemw" alt="remivalade profile picture" className="w-6 h-6 rounded-full border border-gray-600/50"/>
                  <a href="https://portrait.so/remivalade" target="_blank" rel="noopener noreferrer" className="text-xs text-gray-200 hover:text-white font-medium" title="View remivalade's Portrait profile">made by remivalade</a>
              </div>
          ) : (
             // --- Expanded View ---
             <div className="p-4 w-48 flex flex-col items-center text-center">
                 <img src="https://irys.portrait.host/FEQnDav4onGWwukVL1-p1ytDMaZu6Cai0AxvUPMRemw" alt="remivalade profile picture" className="w-16 h-16 rounded-full border-2 border-gray-600/70 mb-3 shadow-md"/>
                 <p className="text-sm font-medium text-gray-100 mb-1">Hi, I'm Rémi.</p>
                 <p className="text-xs text-gray-300 mb-3">I hope you like what you see there.</p>

                 {/* --- Social Links Container with Hover Effects --- */}
                 <div className="flex items-center justify-center space-x-4 mb-4">
                     {/* LinkedIn Link */}
                     <a href="https://www.linkedin.com/in/remivalade/"
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Rémi Valade on LinkedIn"
                        className="p-1 rounded-md border border-transparent hover:border-purple-400/50 transition-all duration-200 ease-in-out hover:scale-110 block" // Added padding, border, transition, scale
                     >
                         <img src="/linkedin.svg" alt="LinkedIn" className="w-5 h-5 block" /> {/* Added block */}
                     </a>
                     {/* X (Twitter) Link */}
                     <a href="https://x.com/remivalade"
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Rémi Valade on X"
                        className="p-1 rounded-md border border-transparent hover:border-purple-400/50 transition-all duration-200 ease-in-out hover:scale-110 block" // Added padding, border, transition, scale
                      >
                          <img src="/x.svg" alt="X" className="w-5 h-5 block" /> {/* Added block */}
                     </a>
                 </div>
                 {/* --- End Social Links Container --- */}

                 {/* === CORRECTED Bling bling Button === */}
               <a href="https://portrait.so/remivalade"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative /* Needs position context for absolute span */
                             inline-flex items-center justify-center space-x-2 mt-3 px-3 py-1.5 border border-gray-600
                             text-gray-100 hover:text-white
                             rounded-md shadow-sm text-xs font-medium w-full
                             overflow-hidden group /* Crucial: overflow-hidden and group */
                             bg-gradient-to-r from-purple-500 via-orange-500 to-yellow-500 /* Keep gradient bg */
                             transition-all duration-300 /* Base transition */
                             hover:shadow-lg hover:shadow-purple-500/20 /* Keep optional glow */
                            "
               >
                  {/* NEW: Shine Span */}
                  <span className="absolute top-0 right-0 w-10 h-full -mt-1 /* Positioning & Size */
                                 transition-all duration-700 /* Animation speed */
                                 transform translate-x-12 /* Initial position (off-right) */
                                 bg-white opacity-20 /* Shine color & intensity */
                                 rotate-12 /* Angle */
                                 group-hover:-translate-x-56 /* Move across on hover */
                                 ease-out /* Animation timing */
                                "></span>
                   {/* Text span needs to be relative to stay on top */}
                  <span className="relative z-10 transition-colors duration-300">Check my Portrait</span>
               </a>
                 {/* === End Button Correction === */}
             </div>
          )}
      </div>
      {/* --- End of "Made by" Box --- */}

    </div> // End of main container div
  ); // End of return statement
} // End of App function

export default App;