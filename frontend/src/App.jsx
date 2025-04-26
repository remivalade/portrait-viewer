import { useEffect, useState } from "react";
import InfiniteScroll from "react-infinite-scroll-component";
import "./App.css";

const PAGE_SIZE = 60;
const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api/portraits";

export default function App() {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => { fetchNext(); }, []);

  async function fetchNext() {
    const res  = await fetch(`${API}?page=${page}&limit=${PAGE_SIZE}`);
    const json = await res.json();

    setItems(prev => [...prev, ...json.portraits]);
    setPage(p => p + 1);
    if (page * PAGE_SIZE >= json.total) setHasMore(false);
  }

  return (
    <div className="wrap">
      <h1>Portrait Gallery</h1>
      <InfiniteScroll
        dataLength={items.length}
        next={fetchNext}
        hasMore={hasMore}
        loader={<p>Loading…</p>}
        endMessage={<p style={{textAlign:"center"}}>🎉 No more portraits</p>}
      >
        <div className="grid">
          {items.map(p => (
            <a key={p.id} className="card" href={p.profileUrl} target="_blank" rel="noreferrer">
              <img src={p.imageUrl} alt={p.username} loading="lazy" />
              <span>{p.username}</span>
            </a>
          ))}
        </div>
      </InfiniteScroll>
    </div>
  );
}
