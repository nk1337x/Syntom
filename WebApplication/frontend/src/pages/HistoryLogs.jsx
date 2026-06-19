import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, FileText, Lock, Unlock, Clock, Trash2, Download, Search, Filter, ChevronDown, ChevronUp } from 'lucide-react';

const HistoryLogs = () => {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'encrypt', 'decrypt'
  const [expandedLog, setExpandedLog] = useState(null);
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest', 'oldest'

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    filterAndSortLogs();
  }, [logs, searchTerm, filterType, sortOrder]);

  const loadLogs = () => {
    const storedLogs = localStorage.getItem('encryptionLogs');
    if (storedLogs) {
      setLogs(JSON.parse(storedLogs));
    }
  };

  const filterAndSortLogs = () => {
    let filtered = [...logs];

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(log => log.operation === filterType);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(log =>
        log.fileName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortOrder === 'newest') {
        return new Date(b.timestamp) - new Date(a.timestamp);
      } else {
        return new Date(a.timestamp) - new Date(b.timestamp);
      }
    });

    setFilteredLogs(filtered);
  };

  const clearAllLogs = () => {
    if (window.confirm('Are you sure you want to clear all logs? This cannot be undone.')) {
      localStorage.removeItem('encryptionLogs');
      setLogs([]);
      setFilteredLogs([]);
    }
  };

  const deleteLog = (id) => {
    const updatedLogs = logs.filter(log => log.id !== id);
    localStorage.setItem('encryptionLogs', JSON.stringify(updatedLogs));
    setLogs(updatedLogs);
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
  };

  const getOperationColor = (operation) => {
    return operation === 'encrypt' 
      ? 'from-green-500 to-emerald-500' 
      : 'from-orange-500 to-amber-500';
  };

  const getOperationIcon = (operation) => {
    return operation === 'encrypt' ? Lock : Unlock;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success':
        return 'text-green-400 bg-green-500/20';
      case 'failed':
        return 'text-red-400 bg-red-500/20';
      default:
        return 'text-gray-400 bg-gray-500/20';
    }
  };

  return (
    <div className="min-h-screen p-6 relative overflow-hidden" style={{ backgroundColor: 'transparent' }}>
      {/* Dark overlay matching landing page */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/30 pointer-events-none" />
      
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <History className="text-[#00E68F]" size={36} />
            <h1 className="text-4xl font-bold">Encryption History</h1>
          </div>
          <p className="text-gray-400">View all previous encryption and decryption operations</p>
        </motion.div>

        {/* Controls Bar */}
        <motion.div
          className="bg-gray-900/90 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4 mb-6"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="flex flex-wrap gap-4 items-center justify-between">
            {/* Search */}
            <div className="flex-1 min-w-[200px] max-w-md relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search by filename..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-900/70 border border-gray-700/50 rounded-lg text-gray-100 placeholder-gray-500 focus:border-[#00E68F] focus:outline-none transition-colors"
              />
            </div>

            {/* Filters */}
            <div className="flex gap-2 items-center">
              <Filter size={18} className="text-gray-400" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 bg-gray-900/70 border border-gray-700/50 rounded-lg text-gray-100 focus:border-[#00E68F] focus:outline-none transition-colors cursor-pointer"
              >
                <option value="all">All Operations</option>
                <option value="encrypt">Encrypt Only</option>
                <option value="decrypt">Decrypt Only</option>
              </select>

              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="px-3 py-2 bg-gray-900/70 border border-gray-700/50 rounded-lg text-gray-100 focus:border-[#00E68F] focus:outline-none transition-colors cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>

            {/* Clear All */}
            {logs.length > 0 && (
              <motion.button
                onClick={clearAllLogs}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded-lg text-red-400 flex items-center gap-2 transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Trash2 size={16} />
                Clear All
              </motion.button>
            )}
          </div>

          {/* Stats */}
          <div className="flex gap-6 mt-4 pt-4 border-t border-gray-700/40">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm text-gray-300">
                Encrypted: <span className="font-semibold text-green-400">
                  {logs.filter(l => l.operation === 'encrypt').length}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="text-sm text-gray-300">
                Decrypted: <span className="font-semibold text-orange-400">
                  {logs.filter(l => l.operation === 'decrypt').length}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-500" />
              <span className="text-sm text-gray-300">
                Total: <span className="font-semibold text-gray-100">{logs.length}</span>
              </span>
            </div>
          </div>
        </motion.div>

        {/* Logs List */}
        {filteredLogs.length === 0 ? (
          <motion.div
            className="bg-gray-900/80 backdrop-blur-sm border border-gray-700/50 rounded-xl p-12 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <History className="mx-auto mb-4 text-gray-600" size={64} />
            <h3 className="text-xl font-semibold text-gray-400 mb-2">No Logs Found</h3>
            <p className="text-gray-500">
              {logs.length === 0 
                ? 'Start encrypting or decrypting files to see history here'
                : 'No logs match your current filters'}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {filteredLogs.map((log, index) => {
                const OperationIcon = getOperationIcon(log.operation);
                const isExpanded = expandedLog === log.id;

                return (
                  <motion.div
                    key={log.id}
                    className="bg-gray-900/80 backdrop-blur-sm border border-gray-700/50 rounded-xl overflow-hidden hover:border-gray-600 transition-colors"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    {/* Main Log Info */}
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        {/* Left: Icon & Info */}
                        <div className="flex items-start gap-4 flex-1">
                          {/* Operation Icon */}
                          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getOperationColor(log.operation)} flex items-center justify-center flex-shrink-0`}>
                            <OperationIcon size={24} className="text-white" />
                          </div>

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-lg font-semibold text-gray-100 truncate">
                                {log.fileName}
                              </h3>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(log.status)}`}>
                                {log.status || 'success'}
                              </span>
                            </div>
                            
                            <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                              <div className="flex items-center gap-1">
                                <Clock size={14} />
                                <span>{formatDate(log.timestamp)}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <FileText size={14} />
                                <span>{formatFileSize(log.fileSize)}</span>
                              </div>
                              <div className="capitalize">
                                <span className={log.operation === 'encrypt' ? 'text-green-400' : 'text-orange-400'}>
                                  {log.operation}ed
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-2">
                          <motion.button
                            onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                            className="p-2 hover:bg-gray-700/50 rounded-lg transition-colors"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            {isExpanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                          </motion.button>
                          
                          <motion.button
                            onClick={() => deleteLog(log.id)}
                            className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-red-400"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Trash2 size={18} />
                          </motion.button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          className="border-t border-gray-700/40 bg-gray-900/50 p-5"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Original Name:</span>
                              <p className="text-gray-200 font-medium">{log.fileName}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">File Type:</span>
                              <p className="text-gray-200 font-medium">{log.fileType || 'Unknown'}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Operation:</span>
                              <p className="text-gray-200 font-medium capitalize">{log.operation}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Status:</span>
                              <p className={`font-medium capitalize ${log.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                                {log.status || 'Success'}
                              </p>
                            </div>
                            {log.layers && (
                              <div className="col-span-2">
                                <span className="text-gray-500">Layers Used:</span>
                                <div className="flex gap-2 mt-1">
                                  {log.layers.map(layer => (
                                    <span key={layer} className="px-2 py-1 bg-[#00E68F]/10 text-[#00E68F] rounded text-xs">
                                      {layer}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {log.sessionId && (
                              <div className="col-span-2">
                                <span className="text-gray-500">Session ID:</span>
                                <p className="text-gray-200 font-mono text-xs mt-1">{log.sessionId}</p>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryLogs;
