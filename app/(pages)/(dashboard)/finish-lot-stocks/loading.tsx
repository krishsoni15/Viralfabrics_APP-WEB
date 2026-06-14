export default function FinishLotStockLoading() {
  return (
    <div className="p-6 space-y-6">
      <div className="animate-pulse">
        {/* Header skeleton */}
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-xl w-1/3 mb-2"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg w-1/4 mb-8"></div>
        
        {/* Stats widgets skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
          ))}
        </div>
        
        {/* Controls skeleton */}
        <div className="h-14 bg-gray-200 dark:bg-gray-700 rounded-2xl w-full mb-6"></div>
        
        {/* Cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-72 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
          ))}
        </div>
      </div>
    </div>
  );
}
