import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { API } from '../App';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Plus, Edit, Trash2, Sparkles, Upload, Grid3x3, List, Search, Camera, X, Filter, AlertCircle } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

function Stock() {
  const location = useLocation();
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [priceCompareDialogOpen, setPriceCompareDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [priceSearchLoading, setPriceSearchLoading] = useState(false);
  const [priceResults, setPriceResults] = useState([]);
  const [productDetailDialogOpen, setProductDetailDialogOpen] = useState(false);
  const [selectedProductDetail, setSelectedProductDetail] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [showFilters, setShowFilters] = useState(false);
  const [scannerDialogOpen, setScannerDialogOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [scannerMode, setScannerMode] = useState('filter'); // 'filter' or 'form'
  const scannerRef = useRef(null);
  const [cameraDialogOpen, setCameraDialogOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    quantity: 0,
    min_quantity: 0,
    brand: '',
    category: '',
    purchase_price: 0,
    sale_price: 0,
    description: '',
    image_base64: '',
    unit_type: 'adet',
    package_quantity: null
  });
  const [filters, setFilters] = useState({
    name: '',
    barcode: '',
    brand: '',
    category: ''
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    // URL parametrelerini kontrol et ve düşük stok filtresini uygula
    const params = new URLSearchParams(location.search);
    if (params.get('filter') === 'low-stock') {
      setShowFilters(true);
      toast.info('Düşük stoklu ürünler gösteriliyor');
    }
  }, [location]);

  useEffect(() => {
    applyFilters();
  }, [products, filters]);

  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${API}/products`);
      setProducts(response.data);
      setFilteredProducts(response.data);
    } catch (error) {
      toast.error('Ürünler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...products];

    // URL parametresinden düşük stok filtresi kontrolü
    const params = new URLSearchParams(location.search);
    if (params.get('filter') === 'low-stock') {
      filtered = filtered.filter(p => p.quantity <= p.min_quantity);
    }

    if (filters.name) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(filters.name.toLowerCase())
      );
    }

    if (filters.barcode) {
      filtered = filtered.filter(p => 
        p.barcode.toLowerCase().includes(filters.barcode.toLowerCase())
      );
    }

    if (filters.brand) {
      filtered = filtered.filter(p => 
        p.brand.toLowerCase().includes(filters.brand.toLowerCase())
      );
    }

    if (filters.category) {
      filtered = filtered.filter(p => 
        p.category.toLowerCase().includes(filters.category.toLowerCase())
      );
    }

    setFilteredProducts(filtered);
  };

  const clearFilters = () => {
    setFilters({
      name: '',
      barcode: '',
      brand: '',
      category: ''
    });
  };

  const startBarcodeScanner = (mode = 'filter') => {
    setScannerMode(mode);
    setScannerDialogOpen(true);
    setCameraError('');
    
    setTimeout(() => {
      try {
        const html5QrCode = new Html5Qrcode("barcode-scanner-region");
        
        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          formatsToSupport: [
            0, // QR_CODE
            8, // EAN_13
            9, // EAN_8
            10, // UPC_A
            11, // UPC_E
            13, // CODE_39
            14, // CODE_93
            15, // CODE_128
          ]
        };
        
        const qrCodeSuccessCallback = (decodedText) => {
          console.log('Barcode scanned:', decodedText);
          
          // Update the correct field based on scanner mode
          if (scannerMode === 'filter') {
            setFilters(prev => ({ ...prev, barcode: decodedText }));
          } else if (scannerMode === 'form') {
            setFormData(prev => ({ ...prev, barcode: decodedText }));
          }
          
          toast.success(`Barkod tarandı: ${decodedText}`);
          
          if (scannerRef.current) {
            scannerRef.current.stop().then(() => {
              console.log('Scanner stopped after success');
              scannerRef.current = null;
              setScannerDialogOpen(false);
            }).catch(err => {
              console.error('Stop error:', err);
              scannerRef.current = null;
              setScannerDialogOpen(false);
            });
          }
        };
        
        const qrCodeErrorCallback = (errorMessage) => {
          // Silent - scanning errors are normal during continuous scanning
        };
        
        console.log('Attempting to start camera...');
        
        // Try environment (back) camera first for mobile
        html5QrCode.start(
          { facingMode: "environment" },
          config,
          qrCodeSuccessCallback,
          qrCodeErrorCallback
        ).then(() => {
          console.log('✅ Back camera started successfully');
          scannerRef.current = html5QrCode;
          setCameraError('');
        }).catch((err) => {
          console.warn('❌ Back camera failed:', err.message);
          
          // Fallback to front camera
          html5QrCode.start(
            { facingMode: "user" },
            config,
            qrCodeSuccessCallback,
            qrCodeErrorCallback
          ).then(() => {
            console.log('✅ Front camera started successfully');
            scannerRef.current = html5QrCode;
            setCameraError('');
          }).catch((err2) => {
            console.warn('❌ Front camera failed:', err2.message);
            
            // Last attempt: enumerate and use first available camera
            Html5Qrcode.getCameras().then(devices => {
              console.log('Available cameras:', devices);
              
              if (devices && devices.length > 0) {
                const cameraId = devices[0].id;
                console.log('Trying camera ID:', cameraId);
                
                html5QrCode.start(
                  cameraId,
                  config,
                  qrCodeSuccessCallback,
                  qrCodeErrorCallback
                ).then(() => {
                  console.log('✅ Camera started with ID');
                  scannerRef.current = html5QrCode;
                  setCameraError('');
                }).catch(err3 => {
                  console.error('❌ All camera attempts failed:', err3);
                  setCameraError('Kamera açılamadı. Lütfen tarayıcı ayarlarından kamera iznini verin.');
                  toast.error('Kamera izni gerekli!');
                });
              } else {
                console.error('❌ No cameras found');
                setCameraError('Kamera bulunamadı.');
                toast.error('Kamera bulunamadı!');
              }
            }).catch(err3 => {
              console.error('❌ getCameras failed:', err3);
              setCameraError('Kamera listesi alınamadı. İzin verildi mi?');
              toast.error('Kamera iznini kontrol edin!');
            });
          });
        });
      } catch (error) {
        console.error('❌ Scanner initialization error:', error);
        setCameraError('Barkod okuyucu başlatılamadı: ' + error.message);
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

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, image_base64: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    setCameraDialogOpen(true);
    setCapturedPhoto(null);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 1280, height: 720 }
      });
      
      setCameraStream(stream);
      
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch (error) {
      console.error('Kamera erişim hatası:', error);
      toast.error('Kamera açılamadı. Lütfen izinleri kontrol edin.');
      setCameraDialogOpen(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const photoData = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedPhoto(photoData);
    }
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
  };

  const usePhoto = () => {
    if (capturedPhoto) {
      setFormData({ ...formData, image_base64: capturedPhoto });
      stopCamera();
      toast.success('Fotoğraf eklendi!');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setCameraDialogOpen(false);
    setCapturedPhoto(null);
  };

  const generateAIDescription = async () => {
    if (!formData.name || !formData.brand || !formData.category) {
      toast.error('Lütfen önce ürün adı, marka ve kategori girin');
      return;
    }

    setAiLoading(true);
    try {
      const response = await axios.post(`${API}/products/generate-description`, {
        name: formData.name,
        brand: formData.brand,
        category: formData.category
      });
      setFormData({ ...formData, description: response.data.description });
      toast.success('Yapay zeka açıklaması oluşturuldu!');
    } catch (error) {
      toast.error('Açıklama oluşturulamadı');
    } finally {
      setAiLoading(false);
    }
  };

  const searchProductPrices = async (product) => {
    setSelectedProduct(product);
    setPriceCompareDialogOpen(true);
    setPriceSearchLoading(true);
    setPriceResults([]);

    try {
      // Get real price comparison from backend
      const response = await axios.get(`${API}/products/${product.id}/price-comparison`);
      
      if (response.data.price_results && response.data.price_results.length > 0) {
        setPriceResults(response.data.price_results);
        toast.success(`${response.data.result_count} site üzerinden fiyat karşılaştırması yapıldı`);
      } else if (response.data.error) {
        toast.error(response.data.error);
        // Show empty state
        setPriceResults([]);
      } else {
        toast.info('Fiyat bilgisi bulunamadı');
        setPriceResults([]);
      }
    } catch (error) {
      toast.error('Fiyat karşılaştırması başarısız');
      setPriceResults([]);
    } finally {
      setPriceSearchLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editMode) {
        await axios.put(`${API}/products/${currentProduct.id}`, formData);
        toast.success('Ürün güncellendi');
      } else {
        await axios.post(`${API}/products`, formData);
        toast.success('Ürün eklendi');
      }
      fetchProducts();
      resetForm();
      setDialogOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'işlem başarısız');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (product) => {
    setEditMode(true);
    setCurrentProduct(product);
    setFormData({
      name: product.name,
      barcode: product.barcode,
      quantity: product.quantity,
      min_quantity: product.min_quantity,
      brand: product.brand,
      category: product.category,
      purchase_price: product.purchase_price,
      sale_price: product.sale_price,
      description: product.description || '',
      image_base64: product.image_url || '',
      unit_type: product.unit_type || 'adet',
      package_quantity: product.package_quantity || null
    });
    setDialogOpen(true);
  };

  const handleDelete = async (productId) => {
    if (!window.confirm('Ürünü silmek istediğinize emin misiniz?')) return;

    try {
      await axios.delete(`${API}/products/${productId}`);
      toast.success('Ürün silindi');
      fetchProducts();
    } catch (error) {
      toast.error('Silme işlemi başarısız');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      barcode: '',
      quantity: 0,
      min_quantity: 0,
      brand: '',
      category: '',
      purchase_price: 0,
      sale_price: 0,
      description: '',
      image_base64: '',
      unit_type: 'adet',
      package_quantity: null
    });
    setEditMode(false);
    setCurrentProduct(null);
  };

  const openProductDetail = (product) => {
    setSelectedProductDetail(product);
    setProductDetailDialogOpen(true);
  };

  if (loading && products.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6" data-testid="stock-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800">Stok Yönetimi</h1>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filtrele
          </Button>
          <div className="flex border rounded-md">
            <Button 
              variant={viewMode === 'grid' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setViewMode('grid')}
              className="rounded-r-none"
            >
              <Grid3x3 className="w-4 h-4" />
            </Button>
            <Button 
              variant={viewMode === 'list' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-l-none"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button data-testid="add-product-btn">
                <Plus className="w-4 h-4 mr-2" />
                Yeni Ürün
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editMode ? 'Ürün Düzenle' : 'Yeni Ürün Ekle'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Ürün Adı *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      data-testid="product-name-input"
                    />
                  </div>
                  <div>
                    <Label>Barkod *</Label>
                    <div className="flex gap-2">
                      <Input
                        value={formData.barcode}
                        onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                        required
                        placeholder="Barkod numarası"
                        data-testid="product-barcode-input"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => startBarcodeScanner('form')}
                        title="Barkod Tara"
                      >
                        <Camera className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label>Marka *</Label>
                    <Input
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      required
                      data-testid="product-brand-input"
                    />
                  </div>
                  <div>
                    <Label>Kategori *</Label>
                    <Input
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      required
                      data-testid="product-category-input"
                    />
                  </div>
                  <div>
                    <Label>Stok Adedi *</Label>
                    <Input
                      type="number"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                      required
                      data-testid="product-quantity-input"
                    />
                  </div>
                  <div>
                    <Label>Minimum Stok *</Label>
                    <Input
                      type="number"
                      value={formData.min_quantity}
                      onChange={(e) => setFormData({ ...formData, min_quantity: parseInt(e.target.value) || 0 })}
                      required
                      data-testid="product-min-quantity-input"
                    />
                  </div>
                  <div>
                    <Label>Alış Fiyatı (₺) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.purchase_price}
                      onChange={(e) => setFormData({ ...formData, purchase_price: parseFloat(e.target.value) || 0 })}
                      required
                      data-testid="product-purchase-price-input"
                    />
                  </div>
                  <div>
                    <Label>Satış Fiyatı (₺) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.sale_price}
                      onChange={(e) => setFormData({ ...formData, sale_price: parseFloat(e.target.value) || 0 })}
                      required
                      data-testid="product-sale-price-input"
                    />
                  </div>
                  <div>
                    <Label>Satış Birimi *</Label>
                    <select
                      className="w-full border rounded-md px-3 py-2 bg-white"
                      value={formData.unit_type}
                      onChange={(e) => setFormData({ ...formData, unit_type: e.target.value })}
                      data-testid="product-unit-type-select"
                    >
                      <option value="adet">Adet</option>
                      <option value="kutu">Kutu</option>
                    </select>
                  </div>
                  {formData.unit_type === 'kutu' && (
                    <div>
                      <Label>Kutu İçeriği (Adet) *</Label>
                      <Input
                        type="number"
                        value={formData.package_quantity || ''}
                        onChange={(e) => setFormData({ ...formData, package_quantity: parseInt(e.target.value) || null })}
                        placeholder="Örn: 12"
                        required={formData.unit_type === 'kutu'}
                        data-testid="product-package-quantity-input"
                      />
                      <p className="text-xs text-gray-500 mt-1">1 kutu kaç adet içeriyor?</p>
                    </div>
                  )}
                </div>

                <div>
                  <Label>Açıklama</Label>
                  <div className="flex gap-2">
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Ürün açıklaması"
                      data-testid="product-description-input"
                    />
                    <Button
                      type="button"
                      onClick={generateAIDescription}
                      disabled={aiLoading}
                      variant="outline"
                      data-testid="generate-ai-description-btn"
                    >
                      <Sparkles className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Yapay zeka ile otomatik açıklama oluştur</p>
                </div>

                <div>
                  <Label>Ürün Görseli</Label>
                  <div className="flex items-center gap-4">
                    <label className="cursor-pointer">
                      <div className="border-2 border-dashed rounded-md p-4 hover:border-blue-500 transition-colors">
                        <Upload className="w-6 h-6 mx-auto text-gray-400" />
                        <p className="text-xs text-gray-500 mt-2">Dosya seç</p>
                      </div>
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" data-testid="product-image-input" />
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={startCamera}
                      className="h-[72px] px-4"
                      title="Kamera ile çek"
                    >
                      <div className="flex flex-col items-center">
                        <Camera className="w-6 h-6 text-gray-400" />
                        <p className="text-xs text-gray-500 mt-1">Kamera</p>
                      </div>
                    </Button>
                    {formData.image_base64 && (
                      <div className="relative">
                        <img src={formData.image_base64} alt="Preview" className="w-20 h-20 object-cover rounded-md" />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 w-6 h-6"
                          onClick={() => setFormData({ ...formData, image_base64: '' })}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={loading} className="flex-1" data-testid="submit-product-btn">
                    {loading ? 'Kaydediliyor...' : editMode ? 'Güncelle' : 'Ekle'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filtre Paneli */}
      {showFilters && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <Label>Ürün Adı</Label>
                <Input
                  placeholder="Ürün adı ara..."
                  value={filters.name}
                  onChange={(e) => setFilters({ ...filters, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Barkod</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Barkod okutun veya girin..."
                    value={filters.barcode}
                    onChange={(e) => setFilters({ ...filters, barcode: e.target.value })}
                    autoFocus={filters.barcode === ''}
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={startBarcodeScanner}
                    title="Kamera ile tara"
                  >
                    <Camera className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label>Marka</Label>
                <Input
                  placeholder="Marka ara..."
                  value={filters.brand}
                  onChange={(e) => setFilters({ ...filters, brand: e.target.value })}
                />
              </div>
              <div>
                <Label>Kategori</Label>
                <Input
                  placeholder="Kategori ara..."
                  value={filters.category}
                  onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                />
              </div>
              <div className="flex items-end">
                <Button 
                  variant="outline" 
                  onClick={clearFilters}
                  className="w-full"
                >
                  <X className="w-4 h-4 mr-2" />
                  Temizle
                </Button>
              </div>
            </div>
            <div className="mt-4 text-sm text-gray-600">
              {filteredProducts.length} ürün gösteriliyor {filteredProducts.length !== products.length && `(${products.length} toplam)`}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grid Görünümü */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="card-hover" data-testid={`product-card-${product.id}`}>
              <CardContent className="pt-6">
                {product.image_url && (
                  <img 
                    src={product.image_url} 
                    alt={product.name} 
                    className="w-full h-40 object-cover rounded-md mb-3 cursor-pointer hover:opacity-80 transition-opacity" 
                    onClick={() => openProductDetail(product)}
                    title="Detayları görmek için tıklayın"
                  />
                )}
                <h3 
                  className="font-semibold text-lg text-gray-800 mb-1 cursor-pointer hover:text-blue-600 transition-colors"
                  onClick={() => searchProductPrices(product)}
                  title="Fiyat karşılaştırması için tıklayın"
                >
                  {product.name}
                </h3>
                <p className="text-sm text-gray-500 mb-2">{product.brand} - {product.category}</p>
                <p className="text-xs text-gray-400 mb-3">{product.barcode}</p>
                {product.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{product.description}</p>
                )}
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-gray-600">Stok:</span>
                  <span className={`font-medium ${product.quantity <= product.min_quantity ? 'text-red-600' : 'text-green-600'}`}>
                    {product.quantity} {product.unit_type || 'adet'}
                    {product.unit_type === 'kutu' && product.package_quantity && (
                      <span className="text-xs text-gray-500 ml-1">
                        ({product.quantity * product.package_quantity} adet)
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm text-gray-600">Fiyat:</span>
                  <span className="font-bold text-blue-600">₺{product.sale_price.toFixed(2)}</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => handleEdit(product)} data-testid={`edit-product-${product.id}`}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDelete(product.id)} data-testid={`delete-product-${product.id}`}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Liste Görünümü */}
      {viewMode === 'list' && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Görsel</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ürün Adı</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Marka</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kategori</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Barkod</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stok</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fiyat</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50" data-testid={`product-row-${product.id}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {product.image_url ? (
                          <img 
                            src={product.image_url} 
                            alt={product.name} 
                            className="w-16 h-16 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity" 
                            onClick={() => openProductDetail(product)}
                            title="Detayları görmek için tıklayın"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center">
                            <span className="text-gray-400 text-xs">Resim Yok</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div 
                          className="text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600"
                          onClick={() => searchProductPrices(product)}
                          title="Fiyat karşılaştırması için tıklayın"
                        >
                          {product.name}
                        </div>
                        {product.description && (
                          <div className="text-xs text-gray-500 mt-1 line-clamp-1">{product.description}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.brand}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.category}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div
                          className="text-gray-500 cursor-pointer hover:text-blue-600 hover:underline"
                          onClick={() => openProductDetail(product)}
                          title="Detayları görmek için tıklayın"
                        >
                          {product.barcode}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm font-medium ${product.quantity <= product.min_quantity ? 'text-red-600' : 'text-green-600'}`}>
                          <div>{product.quantity} {product.unit_type || 'adet'}</div>
                          {product.unit_type === 'kutu' && product.package_quantity && (
                            <div className="text-xs text-gray-500">
                              ({product.quantity * product.package_quantity} adet)
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-bold text-blue-600">₺{product.sale_price.toFixed(2)}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="outline" onClick={() => handleEdit(product)} data-testid={`edit-product-${product.id}`}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleDelete(product.id)} data-testid={`delete-product-${product.id}`}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {filteredProducts.length === 0 && products.length > 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">Filtrelere uygun ürün bulunamadı</p>
            <Button variant="outline" onClick={clearFilters} className="mt-4">
              Filtreleri Temizle
            </Button>
          </CardContent>
        </Card>
      )}

      {products.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">Henüz ürün eklenmemiş</p>
          </CardContent>
        </Card>
      )}

      {/* Barcode Scanner Dialog */}
      <Dialog open={scannerDialogOpen} onOpenChange={(open) => {
        if (!open) stopBarcodeScanner();
      }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>📷 Barkod Tara</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div id="barcode-scanner-region" className="w-full min-h-[300px] rounded-lg overflow-hidden bg-black"></div>
            
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
                Barkod otomatik olarak taranacaktır
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-gray-700">
                <p className="font-semibold mb-1">💡 Kamera açılmadıysa:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Tarayıcı izin isteğinde "İzin Ver" seçeneğini tıklayın</li>
                  <li>Ayarlar {">"} Site Ayarları {">"} Kamera iznini kontrol edin</li>
                  <li>Chrome: Adres çubuğundaki kilit/kamera ikonuna tıklayın</li>
                  <li>Sayfayı yenileyin ve tekrar deneyin</li>
                  <li>Konsolu açın (F12) ve hata mesajlarını kontrol edin</li>
                </ul>
              </div>
            </div>
            <Button variant="outline" onClick={stopBarcodeScanner} className="w-full">
              Kapat
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Camera Dialog */}
      <Dialog open={cameraDialogOpen} onOpenChange={(open) => {
        if (!open) stopCamera();
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>📷 Fotoğraf Çek</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!capturedPhoto ? (
              <>
                <div className="relative bg-black rounded-lg overflow-hidden" style={{ minHeight: '400px' }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                    style={{ minHeight: '400px' }}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={capturePhoto} className="flex-1">
                    <Camera className="w-4 h-4 mr-2" />
                    Fotoğraf Çek
                  </Button>
                  <Button variant="outline" onClick={stopCamera}>
                    İptal
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="relative bg-black rounded-lg overflow-hidden">
                  <img src={capturedPhoto} alt="Çekilen fotoğraf" className="w-full h-auto" />
                </div>
                <div className="flex gap-2">
                  <Button onClick={usePhoto} className="flex-1" variant="default">
                    ✓ Bu Fotoğrafı Kullan
                  </Button>
                  <Button onClick={retakePhoto} variant="outline">
                    🔄 Tekrar Çek
                  </Button>
                  <Button variant="outline" onClick={stopCamera}>
                    İptal
                  </Button>
                </div>
              </>
            )}
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Detail Dialog */}
      <Dialog open={productDetailDialogOpen} onOpenChange={setProductDetailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ürün Detayları</DialogTitle>
          </DialogHeader>
          {selectedProductDetail && (
            <div className="space-y-4">
              {/* Ürün Görseli - Tam Boyut */}
              {selectedProductDetail.image_url && (
                <div className="relative w-full rounded-lg overflow-hidden bg-gray-100">
                  <img 
                    src={selectedProductDetail.image_url} 
                    alt={selectedProductDetail.name} 
                    className="w-full h-auto max-h-[500px] object-contain"
                  />
                </div>
              )}

              {/* Ürün Bilgileri */}
              <div className="space-y-3">
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">{selectedProductDetail.name}</h3>
                  <p className="text-lg text-gray-600 mt-1">
                    {selectedProductDetail.brand} - {selectedProductDetail.category}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-500">Barkod</p>
                    <p className="text-base font-medium text-gray-800">{selectedProductDetail.barcode}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Stok Durumu</p>
                    <p className={`text-base font-bold ${selectedProductDetail.quantity <= selectedProductDetail.min_quantity ? 'text-red-600' : 'text-green-600'}`}>
                      {selectedProductDetail.quantity} {selectedProductDetail.unit_type || 'adet'}
                      {selectedProductDetail.unit_type === 'kutu' && selectedProductDetail.package_quantity && (
                        <span className="text-sm text-gray-500 ml-1">
                          ({selectedProductDetail.quantity * selectedProductDetail.package_quantity} adet)
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Minimum Stok</p>
                    <p className="text-base font-medium text-gray-800">{selectedProductDetail.min_quantity} {selectedProductDetail.unit_type || 'adet'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Satış Fiyatı</p>
                    <p className="text-xl font-bold text-blue-600">₺{selectedProductDetail.sale_price.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Alış Fiyatı</p>
                    <p className="text-base font-medium text-gray-800">₺{selectedProductDetail.purchase_price.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Satış Birimi</p>
                    <p className="text-base font-medium text-gray-800 capitalize">{selectedProductDetail.unit_type || 'adet'}</p>
                  </div>
                </div>

                {/* Açıklama - Tam Metin */}
                {selectedProductDetail.description && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-semibold text-gray-700 mb-2">Ürün Açıklaması:</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {selectedProductDetail.description}
                    </p>
                  </div>
                )}

                {/* Aksiyon Butonları */}
                <div className="flex gap-2 pt-2">
                  <Button 
                    className="flex-1" 
                    onClick={() => {
                      setProductDetailDialogOpen(false);
                      handleEdit(selectedProductDetail);
                    }}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Düzenle
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => {
                      setProductDetailDialogOpen(false);
                      searchProductPrices(selectedProductDetail);
                    }}
                  >
                    Fiyat Karşılaştır
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Price Comparison Dialog */}
      <Dialog open={priceCompareDialogOpen} onOpenChange={setPriceCompareDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Fiyat Karşılaştırması</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-lg text-gray-800">{selectedProduct.name}</h3>
                <p className="text-sm text-gray-600">{selectedProduct.brand} - {selectedProduct.category}</p>
                <div className="mt-2">
                  <span className="text-sm text-gray-600">Mevcut Fiyatınız: </span>
                  <span className="font-bold text-blue-600">₺{selectedProduct.sale_price.toFixed(2)}</span>
                </div>
              </div>

              {priceSearchLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="loading-spinner"></div>
                  <p className="ml-3 text-gray-600">Fiyatlar aranıyor...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-semibold text-gray-700">İnternet Siteleri (En Düşük 10 Fiyat)</h4>
                    {priceResults.length > 0 && (
                      <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                        ✓ Gerçek Zamanlı
                      </span>
                    )}
                  </div>
                  {priceResults.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">Fiyat bilgisi bulunamadı</p>
                  ) : (
                    priceResults.map((result, index) => (
                      <div 
                        key={index} 
                        className={`flex justify-between items-center p-3 rounded-lg border ${
                          index === 0 ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                            index === 0 ? 'bg-green-500 text-white' : 
                            index === 1 ? 'bg-blue-500 text-white' : 
                            index === 2 ? 'bg-orange-500 text-white' : 
                            'bg-gray-300 text-gray-700'
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">{result.site}</p>
                            {result.available ? (
                              <span className="text-xs text-green-600">Stokta var</span>
                            ) : (
                              <span className="text-xs text-red-600">Stokta yok</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className={`text-lg font-bold ${
                            index === 0 ? 'text-green-600' : 'text-gray-800'
                          }`}>
                            ₺{result.price.toFixed(2)}
                          </p>
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 text-blue-600 hover:text-blue-800 whitespace-nowrap"
                          >
                            Siteye Git →
                          </a>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Stock;
