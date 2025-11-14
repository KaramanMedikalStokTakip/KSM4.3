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
import { Package, TrendingDown, DollarSign, ShoppingCart, AlertCircle, Search, Camera } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

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
  const [scannerDialogOpen, setScannerDialogOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const searchInputRef = useRef(null);
  const scannerRef = useRef(null);

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

  const searchProductByBarcode = async (barcode) => {
    setSearching(true);
    try {
      const response = await axios.get(`${API}/products/barcode/${barcode}`);
      setFoundProduct(response.data);
      toast.success('Ürün bulundu!');
    } catch (error) {
      toast.error('Ürün bulunamadı!');
      setFoundProduct(null);
    } finally {
      setSearching(false);
    }
  };

  const handleBarcodeSearch = async (e) => {
    e.preventDefault();
    if (!barcodeSearch.trim()) return;
    await searchProductByBarcode(barcodeSearch);
  };

  const closeSearchDialog = () => {
    setSearchDialogOpen(false);
    setBarcodeSearch('');
    setFoundProduct(null);
  };

  const startBarcodeScanner = () => {
    setScannerDialogOpen(true);
    setCameraError('');
    
    setTimeout(() => {
      try {
        const html5QrCode = new Html5Qrcode("dashboard-barcode-scanner-region");
        
        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          formatsToSupport: [0, 8, 9, 10, 11, 13, 14, 15]
        };
        
        const qrCodeSuccessCallback = (decodedText) => {
          console.log('Barcode scanned in Dashboard:', decodedText);
          
          if (scannerRef.current) {
            scannerRef.current.stop().then(() => {
              scannerRef.current = null;
              setScannerDialogOpen(false);
              setSearchDialogOpen(true);
              setBarcodeSearch(decodedText);
              searchProductByBarcode(decodedText);
            }).catch(err => {
              console.error('Stop error:', err);
              scannerRef.current = null;
              setScannerDialogOpen(false);
              setSearchDialogOpen(true);
              setBarcodeSearch(decodedText);
              searchProductByBarcode(decodedText);
            });
          }
        };
        
        const qrCodeErrorCallback = () => {};
        
        html5QrCode.start(
          { facingMode: "environment" },
          config,
          qrCodeSuccessCallback,
          qrCodeErrorCallback
        ).then(() => {
          console.log('✅ Dashboard Camera started');
          scannerRef.current = html5QrCode;
          setCameraError('');
        }).catch((err) => {
          console.warn('❌ Back camera failed:', err.message);
          html5QrCode.start(
            { facingMode: "user" },
            config,
            qrCodeSuccessCallback,
            qrCodeErrorCallback
          ).then(() => {
            scannerRef.current = html5QrCode;
            setCameraError('');
          }).catch((err2) => {
            Html5Qrcode.getCameras().then(devices => {
              if (devices && devices.length > 0) {
                html5QrCode.start(devices[0].id, config, qrCodeSuccessCallback, qrCodeErrorCallback)
                  .then(() => { scannerRef.current = html5QrCode; setCameraError(''); })
                  .catch(() => { setCameraError('Kamera açılamadı'); toast.error('Kamera izni gerekli!'); });
              } else {
                setCameraError('Kamera bulunamadı');
                toast.error('Kamera bulunamadı!');
              }
            }).catch(() => {
              setCameraError('Kamera erişimi reddedildi');
              toast.error('Kamera iznini kontrol edin!');
            });
          });
        });
      } catch (error) {
        console.error('Scanner error:', error);
        setCameraError('Barkod okuyucu başlatılamadı');
        toast.error('Bir hata oluştu!');
      }
    }, 500);
  };

  const stopBarcodeScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop()
        .then(() => {
          scannerRef.current = null;
          setScannerDialogOpen(false);
        })
        .catch(err => {
          console.error(err);
          scannerRef.current = null;
          setScannerDialogOpen(false);
        });
    } else {
      setScannerDialogOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6" data-testid="dashboard-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800">Dashboard</h1>
        <Button onClick={() => setSearchDialogOpen(true)} data-testid="search-product-btn" className="w-full sm:w-auto">
          <Search className="w-4 h-4 mr-2" />
          <span className="sm:inline">Ürün Bul</span>
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Card 
          className="stat-card cursor-pointer hover:shadow-lg transition-shadow" 
          data-testid="total-products-card"
          onClick={() => navigate('/stock')}
        >
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-500">Toplam Ürün</p>
                <h3 className="text-2xl sm:text-3xl font-bold text-gray-800">{stats?.total_products || 0}</h3>
              </div>
              <div className="bg-blue-100 p-2 sm:p-3 rounded-full">
                <Package className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`stat-card ${stats?.low_stock_count > 0 ? 'cursor-pointer hover:shadow-lg transition-shadow' : 'opacity-75'}`}
          data-testid="low-stock-card"
          onClick={() => {
            if (stats?.low_stock_count > 0) {
              navigate('/stock?filter=low-stock');
            } else {
              toast.info('Düşük stokta ürün bulunmuyor! 🎉');
            }
          }}
        >
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-500">Düşük Stok</p>
                <h3 className="text-2xl sm:text-3xl font-bold text-orange-600">{stats?.low_stock_count || 0}</h3>
                {stats?.low_stock_count === 0 && (
                  <p className="text-xs text-green-600 mt-1">✓ Hepsi yeterli</p>
                )}
              </div>
              <div className="bg-orange-100 p-2 sm:p-3 rounded-full">
                <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card" data-testid="today-sales-card">
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-500">Bugünkü Satış</p>
                <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-600">₺{stats?.today_revenue?.toFixed(2) || '0.00'}</h3>
                <p className="text-xs text-gray-400">{stats?.today_sales_count || 0} adet</p>
              </div>
              <div className="bg-green-100 p-2 sm:p-3 rounded-full">
                <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card" data-testid="week-sales-card">
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-500">Haftalık Satış</p>
                <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-purple-600">₺{stats?.week_revenue?.toFixed(2) || '0.00'}</h3>
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
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  closeSearchDialog();
                  startBarcodeScanner();
                }}
                disabled={searching}
                title="Kamera ile Barkod Tara"
              >
                <Camera className="w-4 h-4" />
              </Button>
            </form>

            {foundProduct && (
              <Card className="bg-blue-50">
                <CardContent className="pt-4">
                  {foundProduct.image_url && (
                    <div className="relative mb-4">
                      <img 
                        src={foundProduct.image_url} 
                        alt={foundProduct.name} 
                        className="w-full h-64 object-contain rounded-lg bg-white cursor-pointer hover:opacity-90 transition-opacity" 
                        onClick={() => setImagePreviewOpen(true)}
                        title="Tam boyutta görmek için tıklayın"
                      />
                      <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded">
                        Tıklayarak büyüt
                      </div>
                    </div>
                  )}
                  <h3 className="font-bold text-xl text-gray-800 mb-2">{foundProduct.name}</h3>
                  <div className="space-y-1 text-sm">
                    <p><span className="font-medium">Marka:</span> {foundProduct.brand}</p>
                    <p><span className="font-medium">Kategori:</span> {foundProduct.category}</p>
                    <p><span className="font-medium">Barkod:</span> {foundProduct.barcode}</p>
                    <p><span className="font-medium">Stok:</span> <span className={foundProduct.quantity <= foundProduct.min_quantity ? 'text-red-600' : 'text-green-600'}>{foundProduct.quantity} {foundProduct.unit_type || 'adet'}</span></p>
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

      {/* Image Preview Dialog */}
      <Dialog open={imagePreviewOpen} onOpenChange={setImagePreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ürün Görseli - {foundProduct?.name}</DialogTitle>
          </DialogHeader>
          {foundProduct?.image_url && (
            <div className="relative w-full rounded-lg overflow-hidden bg-gray-100">
              <img 
                src={foundProduct.image_url} 
                alt={foundProduct.name} 
                className="w-full h-auto max-h-[80vh] object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Barcode Scanner Dialog */}
      <Dialog open={scannerDialogOpen} onOpenChange={(open) => {
        if (!open) stopBarcodeScanner();
      }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>📷 Barkod Tara</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div id="dashboard-barcode-scanner-region" className="w-full min-h-[300px] rounded-lg overflow-hidden bg-black"></div>
            
            {cameraError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-700">
                  <p className="font-semibold">Hata:</p>
                  <p>{cameraError}</p>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <p className="text-sm text-gray-600 text-center font-medium">
                📱 Barkodu kameranın önüne getirin
              </p>
              <p className="text-xs text-gray-500 text-center">
                Ürün bilgileri otomatik olarak gösterilecektir
              </p>
            </div>
            <Button variant="outline" onClick={stopBarcodeScanner} className="w-full">
              Kapat
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Dashboard;