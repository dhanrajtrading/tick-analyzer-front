import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import './styles/globals.css';

// Optimized table component with synchronized scrolling
function DataTable({ data, getDisplayValue, side, scrollSyncRef, onScrollSync, tableId }) {
  const scrollContainerRef = useRef(null);
  const isInternalScrollRef = useRef(false);
  
  // Only render first 1000 rows initially, then lazy load more
  const initialRenderLimit = 1000;
  const [renderLimit, setRenderLimit] = useState(initialRenderLimit);
  
  const visibleData = useMemo(() => {
    return data.slice(0, Math.min(renderLimit, data.length));
  }, [data, renderLimit]);

  // Handle scroll with synchronization
  const handleScroll = useCallback((e) => {
    if (isInternalScrollRef.current) {
      isInternalScrollRef.current = false;
      return;
    }
    
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;
    
    // Lazy load more rows
    if (scrollPercentage > 0.8 && renderLimit < data.length) {
      setRenderLimit(prev => Math.min(prev + 500, data.length));
    }
    
    // Sync scroll with other table
    if (onScrollSync && scrollSyncRef) {
      scrollSyncRef.current = {
        ...scrollSyncRef.current,
        scrollTop: scrollTop,
        sourceTable: tableId
      };
      onScrollSync(scrollTop, tableId);
    }
  }, [data.length, renderLimit, onScrollSync, scrollSyncRef, tableId]);

  // Sync scroll from other table
  useEffect(() => {
    if (!scrollSyncRef?.current) return;
    
    const { scrollTop, sourceTable } = scrollSyncRef.current;
    
    // Only sync if the scroll came from the other table
    if (sourceTable && sourceTable !== tableId && scrollContainerRef.current) {
      const currentScroll = scrollContainerRef.current.scrollTop;
      
      if (Math.abs(currentScroll - scrollTop) > 1) {
        isInternalScrollRef.current = true;
        scrollContainerRef.current.scrollTop = scrollTop;
      }
    }
  }, [scrollSyncRef?.current?.scrollTop, tableId]);

  return (
    <div
      ref={scrollContainerRef}
      className="table-scroll-container"
      onScroll={handleScroll}
    >
      <table className="data-table">
        <thead className="table-head">
          <tr>
            <th className="sr-no-col">Sr No</th>
            <th className="time-col">Time</th>
            <th>Last Price</th>
            <th>Volume</th>
            <th>OI</th>
            <th>Buy Qty</th>
            <th>Sell Qty</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan="7" className="empty-message">
                Select files to compare data
              </td>
            </tr>
          ) : (
            <>
              {visibleData.map((row, index) => {
                const item = side === 'left' ? row.data1 : row.data2;
                const srNo = index + 1;
                return (
                  <tr
                    key={index}
                    className={item ? '' : 'empty-row'}
                  >
                    <td className="sr-no-col">{srNo}</td>
                    <td className="time-col">{row.time || ''}</td>
                    <td>{getDisplayValue(item, 'raw.last_price')}</td>
                    <td>{getDisplayValue(item, 'raw.volume_traded')}</td>
                    <td>{getDisplayValue(item, 'raw.oi')}</td>
                    <td>{getDisplayValue(item, 'raw.total_buy_quantity')}</td>
                    <td>{getDisplayValue(item, 'raw.total_sell_quantity')}</td>
                  </tr>
                );
              })}
              {renderLimit < data.length && (
                <tr>
                  <td colSpan="7" className="loading-more">
                    Loading more rows... ({renderLimit} / {data.length})
                  </td>
                </tr>
              )}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}

function App() {
  const [file1Data, setFile1Data] = useState([]);
  const [file2Data, setFile2Data] = useState([]);
  const [file1Name, setFile1Name] = useState('');
  const [file2Name, setFile2Name] = useState('');
  const [comparedData, setComparedData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState({ file1: 0, file2: 0, processing: 0 });
  const file1InputRef = useRef(null);
  const file2InputRef = useRef(null);
  const scrollSyncRef = useRef({ isScrolling: false, scrollTop: 0 });

  // Extract time from timestamp (HH:MM:SS format) - memoized
  const extractTime = useCallback((timestamp) => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${hours}:${minutes}:${seconds}`;
    } catch {
      return '';
    }
  }, []);

  // Parse JSONL file with optimized chunked processing
  const parseJSONL = useCallback(async (file, fileNumber) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const text = e.target.result;
          const lines = text.split('\n');
          const totalLines = lines.length;
          const data = [];
          const chunkSize = 5000; // Smaller chunks for better responsiveness
          let processed = 0;

          // Process in chunks to avoid blocking UI
          const processChunk = async (startIndex) => {
            const endIndex = Math.min(startIndex + chunkSize, totalLines);
            
            // Process this chunk
            for (let i = startIndex; i < endIndex; i++) {
              const line = lines[i].trim();
              if (line) {
                try {
                  const parsed = JSON.parse(line);
                  if (parsed && parsed._saved_at) {
                    data.push(parsed);
                  }
                } catch (err) {
                  // Skip invalid lines silently
                }
              }
              processed++;
            }

            // Update progress
            const progress = Math.round((processed / totalLines) * 100);
            setLoadingProgress(prev => ({
              ...prev,
              [`file${fileNumber}`]: progress
            }));

            // Continue with next chunk or resolve
            if (endIndex < totalLines) {
              // Yield to browser to prevent blocking
              await new Promise(resolve => {
                if (window.requestIdleCallback) {
                  requestIdleCallback(() => resolve(), { timeout: 50 });
                } else {
                  setTimeout(() => resolve(), 10);
                }
              });
              await processChunk(endIndex);
            } else {
              resolve(data);
            }
          };

          processChunk(0).catch(reject);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }, []);

  // Handle file selection with loading state
  const handleFile1Change = useCallback(async (e) => {
    const file = e.target.files[0];
    if (file) {
      setFile1Name(file.name);
      setLoading(true);
      setLoadingProgress(prev => ({ ...prev, file1: 0 }));
      try {
        const data = await parseJSONL(file, 1);
        setFile1Data(data);
        if (file2Data.length > 0) {
          await compareData(data, file2Data);
        }
      } catch (err) {
        console.error('Error parsing file 1:', err);
        alert('Error reading file 1. Please ensure it is a valid JSONL file.');
      } finally {
        setLoading(false);
        setLoadingProgress(prev => ({ ...prev, file1: 100 }));
      }
    }
  }, [parseJSONL, file2Data]);

  const handleFile2Change = useCallback(async (e) => {
    const file = e.target.files[0];
    if (file) {
      setFile2Name(file.name);
      setLoading(true);
      setLoadingProgress(prev => ({ ...prev, file2: 0 }));
      try {
        const data = await parseJSONL(file, 2);
        setFile2Data(data);
        if (file1Data.length > 0) {
          await compareData(file1Data, data);
        }
      } catch (err) {
        console.error('Error parsing file 2:', err);
        alert('Error reading file 2. Please ensure it is a valid JSONL file.');
      } finally {
        setLoading(false);
        setLoadingProgress(prev => ({ ...prev, file2: 100 }));
      }
    }
  }, [parseJSONL, file1Data]);

  // Compare data by timestamp - optimized with async chunked processing
  const compareData = useCallback(async (data1, data2) => {
    setLoading(true);
    setLoadingProgress(prev => ({ ...prev, processing: 0 }));

    try {
      // Create maps keyed by time (HH:MM:SS)
      const map1 = new Map();
      const map2 = new Map();

      // Process first file in chunks
      const chunkSize = 5000;
      let processed1 = 0;
      const total1 = data1.length;
      
      for (let i = 0; i < data1.length; i += chunkSize) {
        const chunk = data1.slice(i, Math.min(i + chunkSize, data1.length));
        for (const item of chunk) {
          const time = extractTime(item._saved_at);
          if (time) {
            if (!map1.has(time)) {
              map1.set(time, []);
            }
            map1.get(time).push(item);
          }
        }
        processed1 += chunk.length;
        const progress = Math.round((processed1 / total1) * 40);
        setLoadingProgress(prev => ({ ...prev, processing: progress }));
        
        // Yield to browser
        await new Promise(resolve => {
          if (window.requestIdleCallback) {
            requestIdleCallback(() => resolve(), { timeout: 50 });
          } else {
            setTimeout(() => resolve(), 10);
          }
        });
      }

      // Process second file in chunks
      let processed2 = 0;
      const total2 = data2.length;
      
      for (let i = 0; i < data2.length; i += chunkSize) {
        const chunk = data2.slice(i, Math.min(i + chunkSize, data2.length));
        for (const item of chunk) {
          const time = extractTime(item._saved_at);
          if (time) {
            if (!map2.has(time)) {
              map2.set(time, []);
            }
            map2.get(time).push(item);
          }
        }
        processed2 += chunk.length;
        const progress = 40 + Math.round((processed2 / total2) * 30);
        setLoadingProgress(prev => ({ ...prev, processing: progress }));
        
        // Yield to browser
        await new Promise(resolve => {
          if (window.requestIdleCallback) {
            requestIdleCallback(() => resolve(), { timeout: 50 });
          } else {
            setTimeout(() => resolve(), 10);
          }
        });
      }

      // Get all unique timestamps
      const allTimes = new Set([...map1.keys(), ...map2.keys()]);
      const sortedTimes = Array.from(allTimes).sort();

      // Create compared data structure in chunks
      const compared = [];
      const timeChunkSize = 2000;
      let processed3 = 0;
      const total3 = sortedTimes.length;
      
      for (let i = 0; i < sortedTimes.length; i += timeChunkSize) {
        const timeChunk = sortedTimes.slice(i, Math.min(i + timeChunkSize, sortedTimes.length));
        
        for (const time of timeChunk) {
          const items1 = map1.get(time) || [];
          const items2 = map2.get(time) || [];
          
          const maxRows = Math.max(items1.length, items2.length);
          
          for (let j = 0; j < maxRows; j++) {
            compared.push({
              time: time, // Show time for all rows
              data1: items1[j] || null,
              data2: items2[j] || null,
            });
          }
        }
        
        processed3 += timeChunk.length;
        const progress = 70 + Math.round((processed3 / total3) * 30);
        setLoadingProgress(prev => ({ ...prev, processing: progress }));
        
        // Yield to browser
        await new Promise(resolve => {
          if (window.requestIdleCallback) {
            requestIdleCallback(() => resolve(), { timeout: 50 });
          } else {
            setTimeout(() => resolve(), 10);
          }
        });
      }

      setLoadingProgress(prev => ({ ...prev, processing: 100 }));
      setComparedData(compared);
    } catch (err) {
      console.error('Error comparing data:', err);
    } finally {
      setLoading(false);
    }
  }, [extractTime]);

  // Format number for display - memoized
  const formatNumber = useCallback((num) => {
    if (num === null || num === undefined) return '-';
    if (typeof num === 'number') {
      return num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
    }
    return num;
  }, []);

  // Get display value from data item - memoized
  const getDisplayValue = useCallback((item, key) => {
    if (!item) return '';
    const keys = key.split('.');
    let value = item;
    for (const k of keys) {
      value = value?.[k];
      if (value === undefined || value === null) return '';
    }
    return formatNumber(value);
  }, [formatNumber]);

  // Handle synchronized scrolling
  const handleScrollSync = useCallback((scrollTop, sourceTable) => {
    // The scroll sync ref is already updated in the DataTable component
    // This callback is just for triggering the sync
  }, []);

  return (
    <div className="app-container">
      {/* Header Section */}
      <div className="header-section">
        <div className="header-content">
          <h1 className="main-heading">Options Data Comparison</h1>
          
          {/* Filter Section */}
          <div className="filter-section">
            <div className="file-selector-group">
              <label className="file-label">
                <span className="file-label-text">File 1:</span>
                <input
                  ref={file1InputRef}
                  type="file"
                  accept=".jsonl"
                  onChange={handleFile1Change}
                  className="file-input"
                  disabled={loading}
                />
                <span className="file-name">{file1Name || 'No file selected'}</span>
              </label>
            </div>
            
            <div className="file-selector-group">
              <label className="file-label">
                <span className="file-label-text">File 2:</span>
                <input
                  ref={file2InputRef}
                  type="file"
                  accept=".jsonl"
                  onChange={handleFile2Change}
                  className="file-input"
                  disabled={loading}
                />
                <span className="file-name">{file2Name || 'No file selected'}</span>
              </label>
            </div>
          </div>
        </div>
        
        {/* Loading Indicator */}
        {loading && (
          <div className="loading-indicator">
            <div className="loading-bar">
              <div 
                className="loading-progress" 
                style={{ width: `${Math.max(loadingProgress.file1, loadingProgress.file2, loadingProgress.processing)}%` }}
              />
            </div>
            <div className="loading-text">
              {loadingProgress.processing > 0 
                ? `Processing comparison: ${loadingProgress.processing}%`
                : loadingProgress.file1 > 0 
                  ? `Loading File 1: ${loadingProgress.file1}%`
                  : `Loading File 2: ${loadingProgress.file2}%`
              }
            </div>
          </div>
        )}
      </div>

      {/* Tables Section */}
      <div className="tables-container">
        {/* Left Table */}
        <div className="table-wrapper">
          <div className="table-header">
            <h2 className="table-title">{file1Name || 'File 1'}</h2>
          </div>
          <DataTable
            data={comparedData}
            getDisplayValue={getDisplayValue}
            side="left"
            scrollSyncRef={scrollSyncRef}
            onScrollSync={handleScrollSync}
            tableId="left"
          />
        </div>

        {/* Right Table */}
        <div className="table-wrapper">
          <div className="table-header">
            <h2 className="table-title">{file2Name || 'File 2'}</h2>
          </div>
          <DataTable
            data={comparedData}
            getDisplayValue={getDisplayValue}
            side="right"
            scrollSyncRef={scrollSyncRef}
            onScrollSync={handleScrollSync}
            tableId="right"
          />
        </div>
      </div>
    </div>
  );
}

export default App;
