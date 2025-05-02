// frontend/src/App.jsx

import React, { useState, useEffect, useCallback } from 'react';
import InfiniteScroll from 'react-infinite-scroll-component';
import PortraitCard from './components/PortraitCard';
import SkeletonCard from './components/SkeletonCard'; // Ensure SkeletonCard is imported

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

  // --- Keep "Made By" Hover State ---
  const [isHoveringMadeBy, setIsHoveringMadeBy] = useState(false);

  // --- REMOVED Dark Mode State & Effect ---

  // --- Fetch logic (Keep) ---
  const fetchPortraits = useCallback(async (currentPage) => {
      if (isLoading && currentPage > 1) return;
      setIsLoading(true); setError(null); console.log(`Fetching page: ${currentPage}`);
      try {
          const response = await fetch(`${API_URL}?page=${currentPage}&limit=${ITEMS_PER_PAGE}`);
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          const data = await response.json(); console.log(`Data received for page ${currentPage}:`, data);
          setPortraits(prev => [...prev, ...data.portraits]);
          if (totalPortraits === 0) setTotalPortraits(data.total);
          setHasMore((portraits.length + data.portraits.length) < data.total);
      } catch (e) {
          console.error("Failed to fetch portraits:", e); setError(`Failed to load portraits: ${e.message}. Please try refreshing.`); setHasMore(false);
      } finally { setIsLoading(false); }
  }, [isLoading, portraits.length, totalPortraits]);

  // --- Initial fetch (Shuffles first page - Keep) ---
  useEffect(() => {
    const fetchAndShuffleFirstPage = async () => {
       setPortraits([]); setPage(1); setHasMore(true); setError(null); setTotalPortraits(0); setIsLoading(true);
       console.log(`Fetching page: 1 for initial load`);
       try {
         const response = await fetch(`${API_URL}?page=1&limit=${ITEMS_PER_PAGE}`);
         if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
         const data = await response.json(); console.log('Initial data received:', data);
         const shuffledPortraits = shuffleArray([...data.portraits]);
         setPortraits(shuffledPortraits); setTotalPortraits(data.total); setHasMore(shuffledPortraits.length < data.total);
       } catch (e) {
         console.error("Failed to fetch initial portraits:", e); setError(`Failed to load portraits: ${e.message}. Please try refreshing.`); setHasMore(false);
       } finally { setIsLoading(false); }
    };
    fetchAndShuffleFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Load more logic (Keep) ---
  const loadMore = () => {
    if (!isLoading && hasMore) {
      const nextPage = page + 1; setPage(nextPage); fetchPortraits(nextPage);
    }
  };

  // --- *** CORRECTED Skeleton component helper *** ---
  const skeletonCount = isLoading && portraits.length === 0 ? ITEMS_PER_PAGE : 12;
  // Restore the actual component logic here
  const Skeletons = () => (
    Array.from({ length: skeletonCount }).map((_, index) => (
      // Apply dark mode styles to SkeletonCard if needed, e.g., by passing a prop
      // or defining dark styles within SkeletonCard itself
      <SkeletonCard key={`skeleton-${index}`} />
    ))
  );
  // --- *** End Correction *** ---

  // --- REMOVED: toggleDarkMode function ---

  return (
    // Use dark mode text color as default
    <div className="max-w-screen-lg mx-auto px-4 py-8 text-gray-100">

      {/* REMOVED Dark Mode Toggle Button */}Ò

      {/* Adjust header padding if needed */}
      <header className="text-center mb-12 pt-4">
        {/* Use dark mode title color directly */}
        <h1 className="text-4xl font-bold mb-2 text-black dark:text-gray-100
               flex items-center justify-center space-x-3
               font-sans-serif">
    {/* Logo Image */}
    <img
        src="/portrait-viewer-logo.png" // Path relative to public folder
        alt="Portrait Viewer logo"
        className="h-10 w-auto" // Adjust height as needed, width will be auto
    />
    {/* Title Text */}
            <span>
                Discover {/* Text before gradient */}
                <span className="bg-gradient-to-r from-purple-500 via-orange-500 to-yellow-500 bg-clip-text text-transparent font-serif italic">
                    {/* Apply gradient classes to this span */}
                    new
                </span>
                {/* Text after gradient */} portraits!
            </span>    
      </h1>
        {/* Use dark mode button styles directly */}
        <a
            href="https://portrait.so/" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center space-x-2 mt-4 px-4 py-2 bg-gray-700 border border-gray-600 hover:bg-gray-600 text-gray-200 rounded-lg shadow-sm font-medium transition-colors duration-150"
        >
            <svg className="w-5 h-5" viewBox="0 0 58 58" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" fillRule="evenodd" d="M40 8.5H18A9.5 9.5 0 0 0 8.5 18v22a9.5 9.5 0 0 0 9.5 9.5h22a9.5 9.5 0 0 0 9.5-9.5V18A9.5 9.5 0 0 0 40 8.5ZM18 0C8.059 0 0 8.059 0 18v22c0 9.941 8.059 18 18 18h22c9.941 0 18-8.059 18-18V18c0-9.941-8.059-18-18-18H18Z" clipRule="evenodd"></path></svg>
            <span>Create Your Own</span>
        </a>
      </header>

      {/* Error message - use dark styles directly */}
      {error && !isLoading && (
        <div className="text-center text-red-400 bg-red-900/30 p-4 rounded-md border border-red-600">
          <p><strong>Error:</strong> {error}</p>
        </div>
      )}

      {/* Infinite Scroll Container */}
      {!error && (
        <InfiniteScroll
          dataLength={portraits.length} next={loadMore} hasMore={hasMore && !error}
          loader={
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 mt-6">
              <Skeletons /> {/* Call the corrected helper */}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {portraits.map((portrait) => (
              <PortraitCard key={portrait.id} portrait={portrait} />
            ))}
          </div>
        </InfiniteScroll>
      )}

      {/* Initial loading skeletons - Ensure SkeletonCard has dark styles */}
      {isLoading && portraits.length === 0 && !error && (
       <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 mt-6">
         <Skeletons />
       </div>
      )}

      {/* Counter Display - use dark styles directly */}
      {totalPortraits > 0 && !isLoading && (
           <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-10 p-2 px-3 rounded-lg bg-gray-900/30 backdrop-blur-md border border-gray-700/50 text-gray-100 text-xs shadow-lg">
             {portraits.length} / {totalPortraits} Portraits
           </div>
      )}

      {/* "Made by" Box - use dark styles directly, keep hover logic */}
      <div
          className="fixed bottom-4 right-4 z-10 rounded-lg bg-gray-800/40 backdrop-blur-md border border-gray-700/40 shadow-md transition-all duration-300 ease-in-out overflow-hidden"
          onMouseEnter={() => setIsHoveringMadeBy(true)}
          onMouseLeave={() => setIsHoveringMadeBy(false)}
      >
          {/* ... conditional rendering for hover effect (kept the same) ... */}
          {!isHoveringMadeBy ? (
              // --- Compact View ---
              <div className="flex items-center space-x-2 p-2">
                  <img src="https://irys.portrait.host/FEQnDav4onGWwukVL1-p1ytDMaZu6Cai0AxvUPMRemw" alt="remivalade profile picture" className="w-6 h-6 rounded-full border border-gray-600/50"/>
                  <a href="https://portrait.so/remivalade" target="_blank" rel="noopener noreferrer" className="text-xs text-gray-200 hover:text-white font-medium" title="View remivalade's Portrait profile">made by remivalade</a>
              </div>
          ) : (
              // --- Expanded "Business Card" View ---
              <div className="p-4 w-48 flex flex-col items-center text-center">
                  <img src="https://irys.portrait.host/FEQnDav4onGWwukVL1-p1ytDMaZu6Cai0AxvUPMRemw" alt="remivalade profile picture" className="w-16 h-16 rounded-full border-2 border-gray-600/70 mb-3 shadow-md"/>
                  <p className="text-sm font-medium text-gray-100 mb-1">Hi, I'm Rémi.</p>
                  <p className="text-xs text-gray-300 mb-3">I hope you like what you see there.</p>
                  <a href="https://portrait.so/remivalade" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center space-x-2 mt-3 px-3 py-1.5 bg-gray-700 border border-gray-600 hover:bg-gray-600 text-gray-200 rounded-md shadow-sm text-xs font-medium transition-colors duration-150 w-full">Check my Portrait</a>
              </div>
          )}
      </div>
      {/* --- End of "Made by" Box --- */}

    </div> // End of main container div
  ); // End of return statement

} // End of App function

export default App; // Export the component