import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Plus, Edit, Trash2, Sparkles, Upload } from 'lucide-react';

function Stock() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [priceCompareDialogOpen, setPriceCompareDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [priceSearchLoading, setPriceSearchLoading] = useState(false);
  const [priceResults, setPriceResults] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
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
    image_base64: ''
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${API}/products`);
      setProducts(response.data);
    } catch (error) {
      toast.error('Ürünler yüklenemedi');
    } finally {
      setLoading(false);
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
      // Get product info from backend
      const response = await axios.get(`${API}/products/${product.id}/price-comparison`);
      
      // Simulated price search results (in real scenario, this would be web search)
      // You would integrate with a real price comparison API or web scraping service
      const mockResults = [
        { site: 'Hepsiburada', price: product.sale_price * 0.95, url: 'https://www.hepsiburada.com', available: true },
        { site: 'Trendyol', price: product.sale_price * 0.92, url: 'https://www.trendyol.com', available: true },
        { site: 'N11', price: product.sale_price * 0.98, url: 'https://www.n11.com', available: true },
        { site: 'Gittigidiyor', price: product.sale_price * 1.02, url: 'https://www.gittigidiyor.com', available: true },
        { site: 'Amazon TR', price: product.sale_price * 0.89, url: 'https://www.amazon.com.tr', available: true },
        { site: 'Çiçeksepeti', price: product.sale_price * 1.05, url: 'https://www.ciceksepeti.com', available: true },
        { site: 'Akakçe', price: product.sale_price * 0.93, url: 'https://www.akakce.com', available: true },
        { site: 'Epttavm', price: product.sale_price * 0.96, url: 'https://www.epttavm.com', available: true },
        { site: 'Morhipo', price: product.sale_price * 1.01, url: 'https://www.morhipo.com', available: true },
        { site: 'Beymen', price: product.sale_price * 1.08, url: 'https://www.beymen.com', available: false }
      ].sort((a, b) => a.price - b.price).slice(0, 10);

      // Add some randomness to make it more realistic
      const resultsWithVariation = mockResults.map(result => ({
        ...result,
        price: parseFloat((result.price + (Math.random() * 10 - 5)).toFixed(2))
      }));

      setPriceResults(resultsWithVariation);
      toast.info('Fiyat araması tamamlandı (Demo veriler)');
    } catch (error) {
      toast.error('Fiyat karşılaştırması başarısız');
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
      image_base64: product.image_url || ''
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
      image_base64: ''
    });
    setEditMode(false);
    setCurrentProduct(null);
  };

  if (loading && products.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="stock-page">
      <div className="flex justify-between items-center">
        <h1 className="text-4xl font-bold text-gray-800">Stok Yönetimi</h1>
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
                  <Input
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    required
                    data-testid="product-barcode-input"
                  />
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
              </div>

              <div>
                <Label>Açıklama</Label>
                <div className="flex gap-2">
                  <textarea
                    className="w-full border rounded-md px-3 py-2 min-h-[80px]"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
                      <p className="text-xs text-gray-500 mt-2">Görsel seç</p>
                    </div>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" data-testid="product-image-input" />
                  </label>
                  {formData.image_base64 && (
                    <img src={formData.image_base64} alt="Preview" className="w-20 h-20 object-cover rounded-md" />
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {products.map((product) => (
          <Card key={product.id} className="card-hover" data-testid={`product-card-${product.id}`}>
            <CardContent className="pt-6">
              {product.image_url && (
                <img src={product.image_url} alt={product.name} className="w-full h-40 object-cover rounded-md mb-3" />
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
                  {product.quantity} adet
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

      {products.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">Henüz ürün eklenmemiş</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default Stock;