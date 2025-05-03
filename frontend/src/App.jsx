// frontend/src/App.jsx

import React, { useState, useEffect, useCallback } from 'react'; // Removed useRef
import InfiniteScroll from 'react-infinite-scroll-component';
import PortraitCard from './components/PortraitCard';
import SkeletonCard from './components/SkeletonCard';

const API_URL = import.meta.env.VITE_API_URL || '/api/portraits';
const ITEMS_PER_PAGE = 60;

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
  const [portraits, setPortraits] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalPortraits, setTotalPortraits] = useState(0);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isHoveringMadeBy, setIsHoveringMadeBy] = useState(false);

  // --- REMOVED: State and Effect for Sticky Header ---
  // const [isScrolled, setIsScrolled] = useState(false);
  // const headerRef = useRef(null);
  // useEffect(() => { ... scroll listener ... }, []);

  // --- Fetch logic (Keep) ---
  const fetchPortraits = useCallback(async (currentPage) => {
    if (isLoading && currentPage > 1) return;
    setIsLoading(true); setError(null);
    try {
        const response = await fetch(`${API_URL}?page=${currentPage}&limit=${ITEMS_PER_PAGE}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        setPortraits(prev => [...prev, ...data.portraits]);
        // Only set totalPortraits once from the first successful fetch
        if (currentPage === 1 || totalPortraits === 0) setTotalPortraits(data.total);
        // Correctly update hasMore based on the new total length vs data.total
        setHasMore((portraits.length + data.portraits.length) < data.total);
    } catch (e) {
        console.error("Failed to fetch portraits:", e); setError(`Failed to load portraits: ${e.message}. Please try refreshing.`); setHasMore(false);
    } finally { setIsLoading(false); }
  }, [isLoading, totalPortraits, portraits.length]); // Added portraits.length dependency

  // --- Initial fetch (Shuffles first page - Keep) ---
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
  }, []); // Keep fetchPortraits out of initial load deps

  // --- Load more logic (Keep) ---
  const loadMore = () => {
    if (!isLoading && hasMore) {
      const nextPage = page + 1; setPage(nextPage); fetchPortraits(nextPage);
    }
  };

  // --- Skeleton component helper (Keep) ---
  const Skeletons = () => {
      const skeletonCount = isLoading && portraits.length === 0 ? ITEMS_PER_PAGE : 12;
      return Array.from({ length: skeletonCount }).map((_, index) => (
          <SkeletonCard key={`skeleton-${index}`} />
      ));
  };

  // --- JSX Return ---
  return (
    // Adjust padding top to match the fixed header height.
    // Measure the actual rendered height of the header and set pt-[value] accordingly.
    // Example: If header height is 60px, use pt-[60px] or Tailwind's pt-16 (64px).
    <div className="max-w-screen-lg mx-auto px-4 pb-8 pt-20 text-gray-100"> {/* ADJUST PADDING TOP HERE */}

      {/* --- Always Visible Sticky Header --- */}
      <header
        // No ref needed anymore
        // Removed conditional classes, using only sticky styles
        className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-screen-lg mx-auto px-4 z-20 bg-gray-900/80 backdrop-blur-md shadow-lg py-2"
      >
        {/* Flex container - Always space-between */}
        <div className="flex items-center justify-between w-full">

          {/* Logo and Title Group - Always justify-start */}
          <div className="flex items-center space-x-2 md:space-x-3">
            <img
              src="/portrait-viewer-logo.png"
              alt="Portrait Viewer logo"
              // Always use smaller size
              className="w-auto h-8 transition-all duration-300 ease-in-out" // Removed animation classes, kept size
            />
            {/* Title - Always use smaller size */}
            <span className="text-gray-100 font-sans text-xl md:text-2xl"> {/* Removed animation classes, kept size */}
              Discover {/* Text before gradient */}
              <span className={
                // Removed conditional visibility, always inline
                `bg-gradient-to-r from-purple-500 via-orange-500 to-yellow-500 bg-clip-text text-transparent font-serif italic inline`
               }>
                &nbsp;new&nbsp;
              </span>
              {/* Text after gradient */} portraits!
            </span>
          </div>

          {/* --- Search Input - Always visible --- */}
          <div className="opacity-100 flex-grow mx-4 max-w-xs"> {/* Removed conditional opacity/absolute */}
             <input
               type="search"
               placeholder="Search portraits..."
               className="w-full px-3 py-1.5 rounded-md bg-gray-700/50 border border-gray-600/70 text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
               // Remember to add state and onChange for functionality
             />
           </div>
        </div>
        {/* --- REMOVED Description Paragraph --- */}
      </header>
      {/* --- End Header --- */}

      <p className="text-center text-base text-gray-400 max-w-2xl mx-auto mt-6 mb-8"> {/* Added top/bottom margin */}
        Scroll to find live "portraits", decentralized micro-websites where people share who they are, what they do, what they are working on and many other things!
      </p>

      {/* Error message */}
      {error && !isLoading && (
        <div className="text-center text-red-400 bg-red-900/30 p-4 rounded-md border border-red-600 my-4">
          <p><strong>Error:</strong> {error}</p>
        </div>
      )}

      {/* --- Infinite Scroll Container --- */}
      {!error && (
        <InfiniteScroll
          dataLength={portraits.length}
          next={loadMore}
          hasMore={hasMore && !error}
          loader={
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6 mt-6">
              <Skeletons />
            </div>
          }
          endMessage={
           !isLoading && !error && portraits.length > 0 && portraits.length >= totalPortraits ? (
             <p className="text-center text-gray-400 mt-8 py-4">
               <b>Yay! You have seen it all</b>
             </p>
           ) : null
          }
          style={{ overflow: 'visible' }}
        >
          {/* --- Portrait Grid --- */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
            {portraits.map((portrait) => (
              <PortraitCard key={portrait.id} portrait={portrait} />
            ))}
          </div>
        </InfiniteScroll>
      )}
      {/* --- End Infinite Scroll --- */}

      {/* Initial loading skeletons */}
      {isLoading && portraits.length === 0 && !error && (
       <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6 mt-6">
         <Skeletons />
       </div>
      )}

      {/* Counter Display */}
      {totalPortraits > 0 && !isLoading && (
           <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-10 p-2 px-3 rounded-lg bg-gray-900/30 backdrop-blur-md border border-gray-700/50 text-gray-100 text-xs shadow-lg">
             {portraits.length} / {totalPortraits} Portraits
           </div>
      )}

      {/* "Made by" Box */}
      <div
          className="fixed bottom-4 right-4 z-10 rounded-lg bg-gray-800/40 backdrop-blur-md border border-gray-700/40 shadow-md transition-all duration-300 ease-in-out overflow-hidden"
          onMouseEnter={() => setIsHoveringMadeBy(true)}
          onMouseLeave={() => setIsHoveringMadeBy(false)}
      >
          {/* Conditional rendering for hover effect */}
          {!isHoveringMadeBy ? (
              <div className="flex items-center space-x-2 p-2">
                  <img src="https://irys.portrait.host/FEQnDav4onGWwukVL1-p1ytDMaZu6Cai0AxvUPMRemw" alt="remivalade profile picture" className="w-6 h-6 rounded-full border border-gray-600/50"/>
                  <a href="https://portrait.so/remivalade" target="_blank" rel="noopener noreferrer" className="text-xs text-gray-200 hover:text-white font-medium" title="View remivalade's Portrait profile">made by remivalade</a>
              </div>
          ) : (
              <div className="p-4 w-48 flex flex-col items-center text-center">
                  <img src="https://irys.portrait.host/FEQnDav4onGWwukVL1-p1ytDMaZu6Cai0AxvUPMRemw" alt="remivalade profile picture" className="w-16 h-16 rounded-full border-2 border-gray-600/70 mb-3 shadow-md"/>
                  <p className="text-sm font-medium text-gray-100 mb-1">Hi, I'm Rémi.</p>
                  <p className="text-xs text-gray-300 mb-3">I hope you like what you see there.</p>
                  <a href="https://portrait.so/remivalade" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center space-x-2 mt-3 px-3 py-1.5 bg-gray-700 border border-gray-600 hover:bg-gray-600 text-gray-200 rounded-md shadow-sm text-xs font-medium transition-colors duration-150 w-full">Check my Portrait</a>
              </div>
          )}
          {/* --- End of Conditional Rendering --- */}
      </div>
      {/* --- End of "Made by" Box --- */}

    </div> // End of main container div
  ); // End of return statement
} // End of App function

export default App;