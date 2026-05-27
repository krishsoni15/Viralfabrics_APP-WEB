import OrdersTableSkeleton from './components/OrdersTableSkeleton';

export default function OrdersLoading() {
  return (
    <div className="min-h-screen p-4">
      <OrdersTableSkeleton />
    </div>
  );
}
