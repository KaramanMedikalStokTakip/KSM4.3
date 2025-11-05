import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '../App';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Package, TrendingDown, DollarSign, ShoppingCart, AlertCircle, Search } from 'lucide-react';

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [barcodeSearch, setBarcodeSearch] = useState('');
  const [foundProduct, setFoundProduct] = useState(null);
  const [searching, setSearching] = useState(false);
  const searchInputRef = useRef(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (searchDialogOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchDialogOpen]);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, lowStockRes] = await Promise.all([
        axios.get(`${API}/reports/dashboard`),
        axios.get(`${API}/products/low-stock`)
      ]);
      setStats(statsRes.data);
      setLowStock(lowStockRes.data);
    } catch (error) {
      console.error('Dashboard data fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBarcodeSearch = async (e) => {
    e.preventDefault();
    if (!barcodeSearch.trim()) return;

    setSearching(true);
    try {
      const response = await axios.get(`${API}/products/barcode/${barcodeSearch}`);
      setFoundProduct(response.data);
      toast.success('Ürün bulundu!');
    } catch (error) {
      toast.error('Ürün bulunamadı!');
      setFoundProduct(null);
    } finally {
      setSearching(false);
    }
  };

  const closeSearchDialog = () => {
    setSearchDialogOpen(false);
    setBarcodeSearch('');
    setFoundProduct(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div className="flex justify-between items-center">
        <h1 className="text-4xl font-bold text-gray-800">Dashboard</h1>
        <Button onClick={() => setSearchDialogOpen(true)} data-testid="search-product-btn">
          <Search className="w-4 h-4 mr-2" />
          Ürün Bul
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card 
          className="stat-card cursor-pointer hover:shadow-lg transition-shadow" 
          data-testid="total-products-card"
          onClick={() => navigate('/stock')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Toplam Ürün</p>
                <h3 className="text-3xl font-bold text-gray-800">{stats?.total_products || 0}</h3>
                <p className="text-xs text-blue-500 mt-1">Tıklayın →</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="stat-card cursor-pointer hover:shadow-lg transition-shadow" 
          data-testid="low-stock-card"
          onClick={() => navigate('/stock')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Düşük Stok</p>
                <h3 className="text-3xl font-bold text-orange-600">{stats?.low_stock_count || 0}</h3>
                <p className="text-xs text-orange-500 mt-1">Tıklayın →</p>
              </div>
              <div className="bg-orange-100 p-3 rounded-full">
                <TrendingDown className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card" data-testid="today-sales-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Bugünkü Satış</p>
                <h3 className="text-3xl font-bold text-green-600">₺{stats?.today_revenue?.toFixed(2) || '0.00'}</h3>
                <p className="text-xs text-gray-400">{stats?.today_sales_count || 0} adet</p>
              </div>
              <div className="bg-green-100 p-3 rounded-full">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card" data-testid="week-sales-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Haftalık Satış</p>
                <h3 className="text-3xl font-bold text-purple-600">₺{stats?.week_revenue?.toFixed(2) || '0.00'}</h3>
                <p className="text-xs text-gray-400">{stats?.week_sales_count || 0} adet</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-full">
                <ShoppingCart className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Alert */}
      {lowStock.length > 0 && (
        <Card className="border-orange-200 bg-orange-50" data-testid="low-stock-alert">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <AlertCircle className="w-5 h-5" />
              Düşük Stok Uyarısı
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lowStock.slice(0, 5).map((product) => (
                <div key={product.id} className="flex justify-between items-center p-3 bg-white rounded-lg">
                  <div>
                    <p className="font-medium text-gray-800">{product.name}</p>
                    <p className="text-sm text-gray-500">{product.brand} - {product.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-orange-600">Stok: {product.quantity}</p>
                    <p className="text-xs text-gray-500">Min: {product.min_quantity}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Product Search Dialog */}
      <Dialog open={searchDialogOpen} onOpenChange={(open) => !open && closeSearchDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ürün Bul (Barkod ile)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <form onSubmit={handleBarcodeSearch} className="flex gap-2">
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Barkod okutun veya girin..."
                value={barcodeSearch}
                onChange={(e) => setBarcodeSearch(e.target.value)}
                className="barcode-focus"
                data-testid="dashboard-barcode-input"
              />
              <Button type="submit" disabled={searching} data-testid="dashboard-barcode-search-btn">
                {searching ? 'Aranıyor...' : 'Ara'}
              </Button>
            </form>

            {foundProduct && (
              <Card className="bg-blue-50">
                <CardContent className="pt-4">
                  {foundProduct.image_url && (
                    <img src={foundProduct.image_url} alt={foundProduct.name} className="w-full h-32 object-cover rounded-md mb-3" />
                  )}
                  <h3 className="font-bold text-xl text-gray-800 mb-2">{foundProduct.name}</h3>
                  <div className="space-y-1 text-sm">
                    <p><span className="font-medium">Marka:</span> {foundProduct.brand}</p>
                    <p><span className="font-medium">Kategori:</span> {foundProduct.category}</p>
                    <p><span className="font-medium">Barkod:</span> {foundProduct.barcode}</p>
                    <p><span className="font-medium">Stok:</span> <span className={foundProduct.quantity <= foundProduct.min_quantity ? 'text-red-600' : 'text-green-600'}>{foundProduct.quantity} adet</span></p>
                    <p><span className="font-medium">Satış Fiyatı:</span> <span className="text-blue-600 font-bold">₺{foundProduct.sale_price.toFixed(2)}</span></p>
                    {foundProduct.description && (
                      <p className="mt-2 text-gray-600">{foundProduct.description}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Dashboard;