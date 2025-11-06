import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API } from '../App';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Separator } from '../components/ui/separator';
import { ShoppingCart, Trash2, Minus, Plus, Barcode, Camera, AlertCircle } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

function POS() {
  const [cart, setCart] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('nakit');
  const [loading, setLoading] = useState(false);
  const [scannerDialogOpen, setScannerDialogOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const barcodeRef = useRef(null);
  const scannerRef = useRef(null);

  useEffect(() => {
    // Focus on barcode input when component mounts
    barcodeRef.current?.focus();
  }, []);

  const addProductToCart = async (barcode) => {
    try {
      const response = await axios.get(`${API}/products/barcode/${barcode}`);
      const product = response.data;

      if (product.quantity <= 0) {
        toast.error('Ürün stokta yok!');
        return;
      }

      const existingItem = cart.find(item => item.id === product.id);
      if (existingItem) {
        if (existingItem.quantity >= product.quantity) {
          toast.error('Stok yetersiz!');
          return;
        }
        updateQuantity(product.id, existingItem.quantity + 1);
      } else {
        setCart([...cart, { ...product, cartQuantity: 1 }]);
      }

      toast.success(`${product.name} sepete eklendi`);
    } catch (error) {
      toast.error('Ürün bulunamadı!');
    }
  };

  const handleBarcodeSubmit = async (e) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    await addProductToCart(barcodeInput);
    setBarcodeInput('');
    barcodeRef.current?.focus();
  };

  const startBarcodeScanner = () => {
    setScannerDialogOpen(true);
    setCameraError('');
    
    setTimeout(() => {
      try {
        const html5QrCode = new Html5Qrcode("pos-barcode-scanner-region");
        
        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          formatsToSupport: [0, 8, 9, 10, 11, 13, 14, 15]
        };
        
        const qrCodeSuccessCallback = (decodedText) => {
          console.log('Barcode scanned in POS:', decodedText);
          
          if (scannerRef.current) {
            scannerRef.current.stop().then(() => {
              scannerRef.current = null;
              setScannerDialogOpen(false);
              addProductToCart(decodedText);
              barcodeRef.current?.focus();
            }).catch(err => {
              console.error('Stop error:', err);
              scannerRef.current = null;
              setScannerDialogOpen(false);
              addProductToCart(decodedText);
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
          console.log('✅ POS Camera started');
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

  const updateQuantity = (productId, newQuantity) => {
    const product = cart.find(item => item.id === productId);
    if (newQuantity > product.quantity) {
      toast.error('Stok yetersiz!');
      return;
    }
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(cart.map(item => 
      item.id === productId ? { ...item, cartQuantity: newQuantity } : item
    ));
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.id !== productId));
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => total + (item.sale_price * item.cartQuantity), 0);
  };

  const calculateFinalAmount = () => {
    return Math.max(0, calculateTotal() - discount);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error('Sepet boş!');
      return;
    }

    setLoading(true);
    try {
      const saleData = {
        items: cart.map(item => ({
          product_id: item.id,
          name: item.name,
          quantity: item.cartQuantity,
          price: item.sale_price,
          total: item.sale_price * item.cartQuantity
        })),
        total_amount: calculateTotal(),
        discount: discount,
        payment_method: paymentMethod
      };

      await axios.post(`${API}/sales`, saleData);
      toast.success('Satış başarıyla tamamlandı!');
      setCart([]);
      setDiscount(0);
      barcodeRef.current?.focus();
    } catch (error) {
      toast.error('Satış işlemi başarısız!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="pos-page">
      <h1 className="text-4xl font-bold text-gray-800">Kasiyer / POS</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Barcode Scanner & Cart */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Barcode className="w-5 h-5" />
                Barkod Okuyucu
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
                <Input
                  ref={barcodeRef}
                  type="text"
                  placeholder="Barkod okutun veya girin..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  className="barcode-focus"
                  data-testid="barcode-input"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={startBarcodeScanner}
                  title="Kamera ile Barkod Tara"
                >
                  <Camera className="w-4 h-4" />
                </Button>
                <Button type="submit" data-testid="barcode-submit-btn">Ekle</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Sepet ({cart.length} ürün)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cart.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Sepet boş</p>
              ) : (
                <div className="space-y-3" data-testid="cart-items">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg" data-testid={`cart-item-${item.id}`}>
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">{item.name}</p>
                        <p className="text-sm text-gray-500">{item.brand}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-white rounded-lg px-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateQuantity(item.id, item.cartQuantity - 1)}
                            data-testid={`decrease-qty-${item.id}`}
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          <span className="w-8 text-center font-medium" data-testid={`qty-${item.id}`}>{item.cartQuantity}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateQuantity(item.id, item.cartQuantity + 1)}
                            data-testid={`increase-qty-${item.id}`}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="w-24 text-right font-semibold">₺{(item.sale_price * item.cartQuantity).toFixed(2)}</p>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeFromCart(item.id)}
                          data-testid={`remove-${item.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Payment Panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ödeme Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-gray-600">İndirim (₺)</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  data-testid="discount-input"
                />
              </div>

              <div>
                <label className="text-sm text-gray-600">Ödeme Yöntemi</label>
                <select
                  className="w-full border rounded-md px-3 py-2"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  data-testid="payment-method-select"
                >
                  <option value="nakit">Nakit</option>
                  <option value="kredi_karti">Kredi Kartı</option>
                </select>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Ara Toplam:</span>
                  <span className="font-medium">₺{calculateTotal().toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>İndirim:</span>
                  <span className="font-medium text-red-600">-₺{discount.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Toplam:</span>
                  <span className="text-green-600" data-testid="final-amount">₺{calculateFinalAmount().toFixed(2)}</span>
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleCheckout}
                disabled={loading || cart.length === 0}
                data-testid="checkout-btn"
              >
                {loading ? 'İşlem yapılıyor...' : 'Ödemeyi Tamamla'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Barcode Scanner Dialog */}
      <Dialog open={scannerDialogOpen} onOpenChange={(open) => {
        if (!open) stopBarcodeScanner();
      }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>📷 Barkod Tara (POS)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div id="pos-barcode-scanner-region" className="w-full min-h-[300px] rounded-lg overflow-hidden bg-black"></div>
            
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
                Ürün otomatik olarak sepete eklenecektir
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

export default POS;